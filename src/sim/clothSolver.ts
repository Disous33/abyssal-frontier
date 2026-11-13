import * as THREE from 'three';

interface DistanceConstraint {
  a: number;
  b: number;
  restLen: number;
  compliance: number;
}

export interface SailClothConfig {
  cols: number;
  rows: number;
  isJib?: boolean;
}

/**
 * Extended Position Based Dynamics (XPBD) cloth simulator for deformable sails.
 * Supports structural, shear, and bending constraints, reefing scale,
 * boom/sheet pinning, aerodynamic belly inflation, and luffing flutter.
 */
export class SailClothSolver {
  public readonly cols: number;
  public readonly rows: number;
  public readonly count: number;
  public readonly isJib: boolean;

  private readonly pos: Float32Array;
  private readonly prevPos: Float32Array;
  private readonly invMass: Float32Array;
  private readonly pinTarget: Float32Array;
  private readonly baseLocal: Float32Array; // template (u, v) coords

  private readonly constraints: DistanceConstraint[] = [];
  private readonly baseRestLens: Float32Array;
  private readonly geometry: THREE.BufferGeometry;

  // Scratch vectors to avoid per-frame allocations
  private readonly _vA = new THREE.Vector3();
  private readonly _vB = new THREE.Vector3();
  private readonly _vC = new THREE.Vector3();
  private readonly _normal = new THREE.Vector3();

  constructor(config: SailClothConfig) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.count = config.cols * config.rows;
    this.isJib = !!config.isJib;

    this.pos = new Float32Array(this.count * 3);
    this.prevPos = new Float32Array(this.count * 3);
    this.invMass = new Float32Array(this.count);
    this.pinTarget = new Float32Array(this.count * 3);
    this.baseLocal = new Float32Array(this.count * 2);

    const uvs = new Float32Array(this.count * 2);

    for (let r = 0; r < this.rows; r++) {
      const v = r / (this.rows - 1);
      for (let c = 0; c < this.cols; c++) {
        const u = c / (this.cols - 1);
        const idx = r * this.cols + c;
        this.baseLocal[idx * 2] = u;
        this.baseLocal[idx * 2 + 1] = v;
        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;

        // Pin luff (c === 0) and foot/clew anchors
        let pinned = false;
        if (this.isJib) {
          pinned = c === 0 || (r === 0 && c === this.cols - 1);
        } else {
          pinned = c === 0 || r === 0;
        }
        this.invMass[idx] = pinned ? 0 : 1.0;
      }
    }

    // Initialize rest positions with neutral boom angle 0, full sail area 1
    this.computeTargetPositions(0, 1.0, this.pos);
    this.prevPos.set(this.pos);
    this.pinTarget.set(this.pos);

    // Build structural, shear, and bending constraints
    const addConstraint = (a: number, b: number, compliance: number) => {
      const dx = this.pos[b * 3] - this.pos[a * 3];
      const dy = this.pos[b * 3 + 1] - this.pos[a * 3 + 1];
      const dz = this.pos[b * 3 + 2] - this.pos[a * 3 + 2];
      const restLen = Math.hypot(dx, dy, dz);
      if (restLen > 1e-4) {
        this.constraints.push({ a, b, restLen, compliance });
      }
    };

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        // Structural
        if (c + 1 < this.cols) addConstraint(i, i + 1, 0.00015);
        if (r + 1 < this.rows) addConstraint(i, i + this.cols, 0.00015);
        // Shear
        if (c + 1 < this.cols && r + 1 < this.rows) {
          addConstraint(i, i + this.cols + 1, 0.0008);
          addConstraint(i + 1, i + this.cols, 0.0008);
        }
        // Bending (skip-1)
        if (c + 2 < this.cols) addConstraint(i, i + 2, 0.006);
        if (r + 2 < this.rows) addConstraint(i, i + this.cols * 2, 0.006);
      }
    }

    this.baseRestLens = new Float32Array(this.constraints.length);
    for (let k = 0; k < this.constraints.length; k++) {
      this.baseRestLens[k] = this.constraints[k].restLen;
    }

    // Build indexed Three.js BufferGeometry
    const indices: number[] = [];
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols - 1; c++) {
        const a = r * this.cols + c;
        const b = a + 1;
        const d = a + this.cols;
        const e = d + 1;
        indices.push(a, b, d, b, e, d);
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    this.geometry.setIndex(indices);
    this.computeSmoothNormals();
  }

  public getGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  /**
   * Computes geometric anchor / rest positions in vessel local space
   * given boom/jib angle and sail reefing factor (0..1).
   */
  private computeTargetPositions(
    angleRad: number,
    sailArea: number,
    out: Float32Array,
  ): void {
    const area = Math.max(0.06, Math.min(1, sailArea));
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);

    if (this.isJib) {
      // Forestay from bow (0, 1.4, -5.6) to upper mast (0, 11.4, -0.45)
      const tackX = 0;
      const tackY = 1.45;
      const tackZ = -5.55;
      const headY = 1.45 + (11.2 - 1.45) * area;
      const headZ = -5.55 + (-0.48 - -5.55) * area;

      const footLen = 3.25 * (0.45 + 0.55 * area);
      const clewX = tackX + sinA * footLen;
      const clewY = 1.65;
      const clewZ = tackZ + cosA * footLen;

      for (let r = 0; r < this.rows; r++) {
        const v = r / (this.rows - 1);
        const luffX = tackX;
        const luffY = tackY + (headY - tackY) * v;
        const luffZ = tackZ + (headZ - tackZ) * v;

        // Taper chord toward head
        const chordScale = Math.pow(1 - v, 0.95) * 0.94 + 0.06;
        const leechX = luffX + (clewX - tackX) * chordScale;
        const leechY = luffY + (clewY - tackY) * (1 - v) * 0.2;
        const leechZ = luffZ + (clewZ - tackZ) * chordScale;

        for (let c = 0; c < this.cols; c++) {
          const u = c / (this.cols - 1);
          const idx = (r * this.cols + c) * 3;
          out[idx] = luffX + (leechX - luffX) * u;
          out[idx + 1] = luffY + (leechY - luffY) * u;
          out[idx + 2] = luffZ + (leechZ - luffZ) * u;
        }
      }
      return;
    }

    // Mainsail: Mast at (0, y, -0.35), Boom base at y = 2.15, Masthead at y = 12.1
    const mastZ = -0.35;
    const boomY = 2.15;
    const maxHeight = 9.75;
    const activeHeight = maxHeight * area;
    const boomLen = 4.35;

    for (let r = 0; r < this.rows; r++) {
      const v = r / (this.rows - 1);
      const y = boomY + v * activeHeight;
      // Realistic Bermudan roach profile
      const roach = Math.sin(v * Math.PI) * 0.34;
      const chord = boomLen * (1 - 0.87 * Math.pow(v, 0.92)) + roach;

      for (let c = 0; c < this.cols; c++) {
        const u = c / (this.cols - 1);
        const idx = (r * this.cols + c) * 3;
        const distAft = u * chord;
        // Slight built-in sail camber when inflated
        out[idx] = sinA * distAft;
        out[idx + 1] = y;
        out[idx + 2] = mastZ + cosA * distAft;
      }
    }
  }

  /**
   * Advances XPBD simulation by dt seconds.
   */
  public step(
    dt: number,
    time: number,
    boomAngleRad: number,
    sailArea: number,
    clothPressure: number,
    luffingFactor: number,
    turbulence: number,
  ): void {
    const safeDt = Math.min(0.033, Math.max(0.004, dt));
    const areaScale = Math.max(0.06, Math.min(1, sailArea));

    // Update target positions for pinned boundary & reef scaling
    this.computeTargetPositions(boomAngleRad, areaScale, this.pinTarget);

    // Substep XPBD twice for crisp, non-stretchy sailcloth
    const substeps = 2;
    const subDt = safeDt / substeps;
    const invDt2 = 1 / (subDt * subDt);

    // Direction perpendicular to sail plane in local XZ
    const perpX = Math.cos(boomAngleRad);
    const perpZ = -Math.sin(boomAngleRad);

    // Pressure clamped for numerical stability
    const pressureAccel = Math.max(-28, Math.min(28, clothPressure * 0.16));
    const damping = 0.93;

    for (let step = 0; step < substeps; step++) {
      for (let i = 0; i < this.count; i++) {
        const i3 = i * 3;
        if (this.invMass[i] === 0) {
          // Smoothly track pinned target
          this.pos[i3] = this.pinTarget[i3];
          this.pos[i3 + 1] = this.pinTarget[i3 + 1];
          this.pos[i3 + 2] = this.pinTarget[i3 + 2];
          this.prevPos[i3] = this.pinTarget[i3];
          this.prevPos[i3 + 1] = this.pinTarget[i3 + 1];
          this.prevPos[i3 + 2] = this.pinTarget[i3 + 2];
          continue;
        }

        const u = this.baseLocal[i * 2];
        const v = this.baseLocal[i * 2 + 1];

        // Velocity from Verlet state
        const vx = (this.pos[i3] - this.prevPos[i3]) * damping;
        const vy = (this.pos[i3 + 1] - this.prevPos[i3 + 1]) * damping;
        const vz = (this.pos[i3 + 2] - this.prevPos[i3 + 2]) * damping;

        this.prevPos[i3] = this.pos[i3];
        this.prevPos[i3 + 1] = this.pos[i3 + 1];
        this.prevPos[i3 + 2] = this.pos[i3 + 2];

        // Sail belly distribution peaks in middle of chord & height
        const bellyWeight = Math.sin(u * Math.PI) * (0.4 + 0.6 * Math.sin(v * Math.PI));
        // Luffing / flutter wave traveling along u when in no-go zone or turbulent gusts
        const flutterWave =
          Math.sin(time * 16.5 - u * 7.5 + v * 3.1) *
          (luffingFactor * 14.0 + turbulence * 3.2) *
          (0.35 + 0.65 * u);

        const aeroForce = pressureAccel * (0.45 + 0.55 * bellyWeight) + flutterWave;

        // Gentle spring pull toward ideal rotating sail sheet plane so cloth tracks rapid tacks cleanly
        const guidePull = 14.0;
        const gx = (this.pinTarget[i3] - this.pos[i3]) * guidePull;
        const gy = (this.pinTarget[i3 + 1] - this.pos[i3 + 1]) * guidePull - 1.2;
        const gz = (this.pinTarget[i3 + 2] - this.pos[i3 + 2]) * guidePull;

        const ax = perpX * aeroForce + gx;
        const ay = gy;
        const az = perpZ * aeroForce + gz;

        this.pos[i3] += vx + ax * subDt * subDt;
        this.pos[i3 + 1] += vy + ay * subDt * subDt;
        this.pos[i3 + 2] += vz + az * subDt * subDt;
      }

      // Solve XPBD distance constraints
      for (let k = 0; k < this.constraints.length; k++) {
        const con = this.constraints[k];
        const w1 = this.invMass[con.a];
        const w2 = this.invMass[con.b];
        const wSum = w1 + w2;
        if (wSum === 0) continue;

        const a3 = con.a * 3;
        const b3 = con.b * 3;
        const dx = this.pos[b3] - this.pos[a3];
        const dy = this.pos[b3 + 1] - this.pos[a3 + 1];
        const dz = this.pos[b3 + 2] - this.pos[a3 + 2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-6) continue;

        // Scale vertical/diagonal rest length during reefing
        const targetLen = this.baseRestLens[k] * (0.45 + 0.55 * areaScale);
        const alpha = con.compliance * invDt2;
        const corr = (dist - targetLen) / (dist * (wSum + alpha));

        if (w1 > 0) {
          this.pos[a3] += dx * corr * w1;
          this.pos[a3 + 1] += dy * corr * w1;
          this.pos[a3 + 2] += dz * corr * w1;
        }
        if (w2 > 0) {
          this.pos[b3] -= dx * corr * w2;
          this.pos[b3 + 1] -= dy * corr * w2;
          this.pos[b3 + 2] -= dz * corr * w2;
        }
      }
    }

    // Update GPU attributes & vertex normals
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.computeSmoothNormals();
  }

  private computeSmoothNormals(): void {
    const pos = this.pos;
    const normAttr = this.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    if (!normAttr) {
      this.geometry.computeVertexNormals();
      return;
    }
    const norms = normAttr.array as Float32Array;
    norms.fill(0);

    const index = this.geometry.getIndex();
    if (!index) return;
    const idxArr = index.array;

    for (let i = 0; i < idxArr.length; i += 3) {
      const a = idxArr[i] * 3;
      const b = idxArr[i + 1] * 3;
      const c = idxArr[i + 2] * 3;

      this._vA.set(pos[a], pos[a + 1], pos[a + 2]);
      this._vB.set(pos[b], pos[b + 1], pos[b + 2]);
      this._vC.set(pos[c], pos[c + 1], pos[c + 2]);

      this._vB.sub(this._vA);
      this._vC.sub(this._vA);
      this._normal.crossVectors(this._vB, this._vC);

      norms[a] += this._normal.x;
      norms[a + 1] += this._normal.y;
      norms[a + 2] += this._normal.z;
      norms[b] += this._normal.x;
      norms[b + 1] += this._normal.y;
      norms[b + 2] += this._normal.z;
      norms[c] += this._normal.x;
      norms[c + 1] += this._normal.y;
      norms[c + 2] += this._normal.z;
    }

    for (let i = 0; i < norms.length; i += 3) {
      const l = Math.hypot(norms[i], norms[i + 1], norms[i + 2]) || 1;
      norms[i] /= l;
      norms[i + 1] /= l;
      norms[i + 2] /= l;
    }
    normAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
  }
}
