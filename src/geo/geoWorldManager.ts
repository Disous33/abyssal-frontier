import { GeoCoord } from '../sim/types';
import { SANTOS_ORIGIN } from './baixadaSantistaData';

// WGS84 ellipsoid constants
const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * GeoWorldManager manages WGS84 <-> Local ENU (East-North-Up) metric projection
 * and floating-origin offsetting for Three.js rendering precision.
 *
 * Coordinate convention:
 *  - +X = East (+lon)
 *  - -Z = North (+lat), +Z = South (-lat)
 *  - +Y = Altitude above mean sea level (meters)
 */
export class GeoWorldManager {
  public readonly originLat: number;
  public readonly originLon: number;
  private readonly metersPerDegLat: number;
  private readonly metersPerDegLon: number;

  // Floating origin offset (global world meters relative to fixed anchor)
  public floatingOffsetX = 0;
  public floatingOffsetZ = 0;

  constructor(origin: GeoCoord = SANTOS_ORIGIN) {
    this.originLat = origin.lat;
    this.originLon = origin.lon;

    const latRad = origin.lat * DEG_TO_RAD;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const denom = 1 - WGS84_E2 * sinLat * sinLat;
    const n = WGS84_A / Math.sqrt(denom);
    const m = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 1.5);

    this.metersPerDegLat = m * DEG_TO_RAD;
    this.metersPerDegLon = n * cosLat * DEG_TO_RAD;
  }

  /**
   * Converts WGS84 (lat, lon) into Three.js scene local meters (X East, Z South)
   * accounting for floating origin offset.
   */
  public geoToLocal(lat: number, lon: number, out = { x: 0, z: 0 }): { x: number; z: number } {
    const globalX = (lon - this.originLon) * this.metersPerDegLon;
    const globalZ = -(lat - this.originLat) * this.metersPerDegLat;
    out.x = globalX - this.floatingOffsetX;
    out.z = globalZ - this.floatingOffsetZ;
    return out;
  }

  /**
   * Converts Three.js local meters (x, z) back to WGS84 (lat, lon).
   */
  public localToGeo(x: number, z: number, out: GeoCoord = { lat: 0, lon: 0 }): GeoCoord {
    const globalX = x + this.floatingOffsetX;
    const globalZ = z + this.floatingOffsetZ;
    out.lon = this.originLon + globalX / this.metersPerDegLon;
    out.lat = this.originLat - globalZ / this.metersPerDegLat;
    return out;
  }

  /**
   * Distance in meters between two WGS84 coordinates (regional tangent plane).
   */
  public distanceBetweenGeoM(a: GeoCoord, b: GeoCoord): number {
    const dx = (b.lon - a.lon) * this.metersPerDegLon;
    const dz = -(b.lat - a.lat) * this.metersPerDegLat;
    return Math.hypot(dx, dz);
  }

  /**
   * Floating origin support: if active camera/vessel drifts beyond threshold (e.g. 2,500m),
   * returns the delta shift to apply to scene entities so rendered coordinates stay near (0,0).
   */
  public checkFloatingOriginShift(localX: number, localZ: number, thresholdM = 3000): { shifted: boolean; dx: number; dz: number } {
    if (Math.hypot(localX, localZ) < thresholdM) {
      return { shifted: false, dx: 0, dz: 0 };
    }
    const dx = Math.round(localX / 500) * 500;
    const dz = Math.round(localZ / 500) * 500;
    this.floatingOffsetX += dx;
    this.floatingOffsetZ += dz;
    return { shifted: true, dx, dz };
  }

  public getScaleFactors(): { metersPerDegLat: number; metersPerDegLon: number; radToDeg: number } {
    return {
      metersPerDegLat: this.metersPerDegLat,
      metersPerDegLon: this.metersPerDegLon,
      radToDeg: RAD_TO_DEG,
    };
  }
}
