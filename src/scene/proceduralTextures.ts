import * as THREE from 'three';

export interface ProceduralTextureSet {
  teakDeck: THREE.CanvasTexture;
  teakNormal: THREE.CanvasTexture;
  sailcloth: THREE.CanvasTexture;
  sailNormal: THREE.CanvasTexture;
  foamSprite: THREE.CanvasTexture;
  hullRoughness: THREE.CanvasTexture;
  portConcrete: THREE.CanvasTexture;
  concreteNormal: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  containerCorrugated: THREE.CanvasTexture;
  containerNormal: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates a tangent-space Normal Map (NoColorSpace) from a grayscale height buffer using Sobel gradients.
 */
function buildNormalTextureFromHeight(
  height: Float32Array,
  size: number,
  strength: number,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const sampleH = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return height[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sampleH(x - 1, y);
      const hR = sampleH(x + 1, y);
      const hD = sampleH(x, y - 1);
      const hU = sampleH(x, y + 1);

      let nx = (hL - hR) * strength;
      let ny = (hD - hU) * strength;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // 1. Teak Deck Plank Albedo (SRGB) + Height for Normal Map (Linear)
  const teakSize = 512;
  const teakCanvas = document.createElement('canvas');
  teakCanvas.width = teakSize;
  teakCanvas.height = teakSize;
  const tctx = teakCanvas.getContext('2d')!;
  tctx.fillStyle = '#7e5939';
  tctx.fillRect(0, 0, teakSize, teakSize);

  const teakHeight = new Float32Array(teakSize * teakSize);
  teakHeight.fill(0.7);

  const plankCount = 16;
  const plankW = teakSize / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const x = i * plankW;
    const toneShift = ((i * 37) % 21) - 10;
    tctx.fillStyle = `rgb(${128 + toneShift}, ${90 + Math.round(toneShift * 0.72)}, ${57 + Math.round(toneShift * 0.45)})`;
    tctx.fillRect(x + 2, 0, plankW - 3, teakSize);

    for (let g = 0; g < 8; g++) {
      const gx = x + 4 + ((g * 4.7) % (plankW - 6));
      tctx.strokeStyle = g % 2 === 0 ? 'rgba(58, 36, 18, 0.24)' : 'rgba(155, 115, 76, 0.16)';
      tctx.lineWidth = 1;
      tctx.beginPath();
      tctx.moveTo(gx, 0);
      tctx.bezierCurveTo(gx + 2, 170, gx - 2, 340, gx, teakSize);
      tctx.stroke();
    }

    // Black marine Sikaflex caulking seam
    tctx.fillStyle = '#181817';
    tctx.fillRect(x, 0, 2.3, teakSize);

    // Height profile for caulking groove & grain
    for (let py = 0; py < teakSize; py++) {
      for (let px = Math.floor(x); px < Math.floor(x + plankW); px++) {
        const localX = px - x;
        const idx = py * teakSize + px;
        if (localX < 2.5) {
          teakHeight[idx] = 0.15;
        } else {
          const grain = Math.sin(localX * 1.4 + Math.sin(py * 0.03 + i) * 1.8) * 0.08;
          teakHeight[idx] = 0.72 + grain;
        }
      }
    }
  }

  const teakDeck = new THREE.CanvasTexture(teakCanvas);
  teakDeck.colorSpace = THREE.SRGBColorSpace;
  teakDeck.wrapS = THREE.RepeatWrapping;
  teakDeck.wrapT = THREE.RepeatWrapping;
  teakDeck.repeat.set(2, 4);
  teakDeck.anisotropy = maxAniso;
  teakDeck.generateMipmaps = true;
  teakDeck.minFilter = THREE.LinearMipmapLinearFilter;

  const teakNormal = buildNormalTextureFromHeight(teakHeight, teakSize, 2.4, maxAniso, 2, 4);

  // 2. Sailcloth Ripstop Weave, Radial Seams, Battens & Aster S-01 Insignia
  const sailSize = 512;
  const sailCanvas = document.createElement('canvas');
  sailCanvas.width = sailSize;
  sailCanvas.height = sailSize;
  const sctx = sailCanvas.getContext('2d')!;
  sctx.fillStyle = '#eff3f6';
  sctx.fillRect(0, 0, sailSize, sailSize);

  const sailHeight = new Float32Array(sailSize * sailSize);
  for (let y = 0; y < sailSize; y++) {
    for (let x = 0; x < sailSize; x++) {
      const rip = ((x % 16 === 0 || y % 16 === 0) ? 0.14 : 0) + Math.sin(x * 1.57) * Math.sin(y * 1.57) * 0.03;
      sailHeight[y * sailSize + x] = 0.5 + rip;
    }
  }

  // Ripstop grid
  sctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  sctx.lineWidth = 1;
  for (let p = 0; p <= sailSize; p += 16) {
    sctx.beginPath();
    sctx.moveTo(p, 0);
    sctx.lineTo(p, sailSize);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(0, p);
    sctx.lineTo(sailSize, p);
    sctx.stroke();
  }

  // Panel stitch seams & carbon batten pockets
  for (let row = 1; row <= 4; row++) {
    const y = row * 102;
    sctx.fillStyle = 'rgba(51, 65, 85, 0.22)';
    sctx.fillRect(0, y - 2, sailSize, 4);
    sctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    sctx.fillRect(310, y - 5, 202, 10);
    for (let py = Math.max(0, y - 5); py < Math.min(sailSize, y + 5); py++) {
      for (let px = 0; px < sailSize; px++) {
        sailHeight[py * sailSize + px] += px > 310 ? 0.32 : 0.14;
      }
    }
  }
  // Draft stripes + Aster S-01 emblem stripes
  sctx.fillStyle = 'rgba(15, 76, 98, 0.78)';
  sctx.fillRect(110, 286, 290, 14);
  sctx.fillStyle = 'rgba(217, 155, 38, 0.88)';
  sctx.fillRect(110, 304, 210, 8);
  // Subtle red/green telltales marks
  sctx.fillStyle = 'rgba(220, 38, 38, 0.75)';
  sctx.fillRect(72, 180, 22, 3);
  sctx.fillStyle = 'rgba(22, 163, 74, 0.75)';
  sctx.fillRect(72, 260, 22, 3);

  const sailcloth = new THREE.CanvasTexture(sailCanvas);
  sailcloth.colorSpace = THREE.SRGBColorSpace;
  sailcloth.anisotropy = maxAniso;
  sailcloth.generateMipmaps = true;
  sailcloth.minFilter = THREE.LinearMipmapLinearFilter;

  const sailNormal = buildNormalTextureFromHeight(sailHeight, sailSize, 1.8, maxAniso, 1, 1);

  // 3. Soft Radial Foam / Wake Sprite (SRGB)
  const foamCanvas = document.createElement('canvas');
  foamCanvas.width = 128;
  foamCanvas.height = 128;
  const fctx = foamCanvas.getContext('2d')!;
  const grad = fctx.createRadialGradient(64, 64, 5, 64, 64, 62);
  grad.addColorStop(0, 'rgba(244, 250, 255, 0.96)');
  grad.addColorStop(0.42, 'rgba(205, 236, 247, 0.58)');
  grad.addColorStop(0.78, 'rgba(150, 210, 230, 0.16)');
  grad.addColorStop(1, 'rgba(150, 210, 230, 0)');
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, 128, 128);
  const foamSprite = new THREE.CanvasTexture(foamCanvas);
  foamSprite.colorSpace = THREE.SRGBColorSpace;

  // 4. Hull Gelcoat Micro-Grain & Waterline Roughness (NoColorSpace)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#383838';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    const rx = (i * 73) % 256;
    const ry = (i * 139) % 256;
    const v = 42 + ((i * 29) % 42);
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(rx, ry, 7, 2);
  }
  const hullRoughness = new THREE.CanvasTexture(roughCanvas);
  hullRoughness.wrapS = THREE.RepeatWrapping;
  hullRoughness.wrapT = THREE.RepeatWrapping;
  hullRoughness.repeat.set(4, 2);
  hullRoughness.anisotropy = maxAniso;

  // 5. Port Concrete Paving & Expansion Joints (SRGB + Normal)
  const concSize = 256;
  const concCanvas = document.createElement('canvas');
  concCanvas.width = concSize;
  concCanvas.height = concSize;
  const cctx = concCanvas.getContext('2d')!;
  cctx.fillStyle = '#6c7a89';
  cctx.fillRect(0, 0, concSize, concSize);

  const concHeight = new Float32Array(concSize * concSize);
  for (let i = 0; i < concSize * concSize; i++) {
    const x = i % concSize;
    const y = Math.floor(i / concSize);
    const n = (Math.sin(x * 0.37 + y * 0.19) * Math.cos(y * 0.43 - x * 0.23)) * 0.12;
    const joint = x % 64 < 2 || y % 64 < 2 ? -0.35 : 0;
    concHeight[i] = 0.65 + n + joint;
    if ((i * 17) % 13 === 0) {
      const s = 96 + ((i * 23) % 34);
      cctx.fillStyle = `rgb(${s},${s + 6},${s + 14})`;
      cctx.fillRect(x, y, 2, 2);
    }
  }
  cctx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
  cctx.lineWidth = 2;
  for (let p = 0; p < concSize; p += 64) {
    cctx.beginPath();
    cctx.moveTo(p, 0);
    cctx.lineTo(p, concSize);
    cctx.stroke();
    cctx.beginPath();
    cctx.moveTo(0, p);
    cctx.lineTo(concSize, p);
    cctx.stroke();
  }
  const portConcrete = new THREE.CanvasTexture(concCanvas);
  portConcrete.colorSpace = THREE.SRGBColorSpace;
  portConcrete.wrapS = THREE.RepeatWrapping;
  portConcrete.wrapT = THREE.RepeatWrapping;
  portConcrete.repeat.set(12, 18);
  portConcrete.anisotropy = maxAniso;

  const concreteNormal = buildNormalTextureFromHeight(concHeight, concSize, 2.2, maxAniso, 12, 18);

  // 6. Port Asphalt Roadway Texture with Painted Lane Markings (SRGB)
  const aspCanvas = document.createElement('canvas');
  aspCanvas.width = 256;
  aspCanvas.height = 256;
  const actx = aspCanvas.getContext('2d')!;
  actx.fillStyle = '#2d3744';
  actx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const ax = (i * 59) % 256;
    const ay = (i * 103) % 256;
    const g = 36 + ((i * 19) % 26);
    actx.fillStyle = `rgb(${g},${g + 5},${g + 12})`;
    actx.fillRect(ax, ay, 2, 2);
  }
  actx.fillStyle = 'rgba(245, 158, 11, 0.72)';
  actx.fillRect(124, 14, 8, 96);
  actx.fillRect(124, 142, 8, 96);
  const asphalt = new THREE.CanvasTexture(aspCanvas);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(1, 10);
  asphalt.anisotropy = maxAniso;

  // 7. Corrugated Shipping Container Sidewall (SRGB + Normal)
  const contSize = 256;
  const contCanvas = document.createElement('canvas');
  contCanvas.width = contSize;
  contCanvas.height = contSize;
  const kctx = contCanvas.getContext('2d')!;
  kctx.fillStyle = '#e2e8f0';
  kctx.fillRect(0, 0, contSize, contSize);
  const contHeight = new Float32Array(contSize * contSize);
  for (let x = 0; x < contSize; x++) {
    const rib = Math.sin((x / contSize) * Math.PI * 24) * 0.5 + 0.5;
    const shade = Math.round(205 + rib * 45);
    kctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    kctx.fillRect(x, 0, 1, contSize);
    for (let y = 0; y < contSize; y++) {
      contHeight[y * contSize + x] = rib;
    }
  }
  // Top & bottom frame rails
  kctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  kctx.fillRect(0, 0, contSize, 14);
  kctx.fillRect(0, contSize - 14, contSize, 14);

  const containerCorrugated = new THREE.CanvasTexture(contCanvas);
  containerCorrugated.colorSpace = THREE.SRGBColorSpace;
  containerCorrugated.wrapS = THREE.RepeatWrapping;
  containerCorrugated.wrapT = THREE.RepeatWrapping;
  containerCorrugated.anisotropy = maxAniso;

  const containerNormal = buildNormalTextureFromHeight(contHeight, contSize, 3.0, maxAniso, 1, 1);

  return {
    teakDeck,
    teakNormal,
    sailcloth,
    sailNormal,
    foamSprite,
    hullRoughness,
    portConcrete,
    concreteNormal,
    asphalt,
    containerCorrugated,
    containerNormal,
    dispose: () => {
      teakDeck.dispose();
      teakNormal.dispose();
      sailcloth.dispose();
      sailNormal.dispose();
      foamSprite.dispose();
      hullRoughness.dispose();
      portConcrete.dispose();
      concreteNormal.dispose();
      asphalt.dispose();
      containerCorrugated.dispose();
      containerNormal.dispose();
    },
  };
}
