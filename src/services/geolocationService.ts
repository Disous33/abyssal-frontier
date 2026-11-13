import { GeoSectorInfo } from '../sim/types';

export function createDefaultGeoSector(): GeoSectorInfo {
  return {
    status: 'idle',
    sectorName: 'Setor Atlântico Padrão (Offline)',
    climateZone: 'Águas Temperadas Oceânicas',
    recommendedWindKnots: 14,
    recommendedWaveScale: 0.9,
    recommendedCurrentSpeed: 0.4,
    latitudeBand: 'Referência Simulada',
    accuracyMeters: null,
    lastUpdated: null,
    errorMessage: null,
    monitoringActive: false,
  };
}

/**
 * Derives a regional maritime sector profile locally without transmitting
 * or displaying precise GPS coordinates.
 */
function classifyMaritimeSector(lat: number, lon: number, accuracy: number): GeoSectorInfo {
  const absLat = Math.abs(lat);
  const hemi = lat >= 0 ? 'Norte' : 'Sul';
  const westEast = lon >= 0 ? 'Oriental' : 'Ocidental';

  let climateZone = 'Corredor Temperado';
  let wind = 15;
  let wave = 0.95;
  let current = 0.45;
  let band = 'Médias Latitudes';

  if (absLat < 12) {
    climateZone = 'Zona Equatorial / Doldrums';
    band = `Faixa Equatorial (${hemi})`;
    wind = 9;
    wave = 0.55;
    current = 0.85;
  } else if (absLat < 28) {
    climateZone = 'Ventos Alísios Subtropicais';
    band = `Faixa Tropical (${hemi})`;
    wind = 16;
    wave = 1.05;
    current = 0.65;
  } else if (absLat < 45) {
    climateZone = 'Atlântico/Pacífico Temperado';
    band = `Faixa Temperada (${hemi})`;
    wind = 18;
    wave = 1.25;
    current = 0.5;
  } else if (absLat < 60) {
    climateZone = 'Rota dos Ventos Fortes (Roaring Forties/Fifties)';
    band = `Alta Latitude (${hemi})`;
    wind = 25;
    wave = 1.75;
    current = 0.9;
  } else {
    climateZone = 'Mar Polar Frio';
    band = `Setor Polar (${hemi})`;
    wind = 21;
    wave = 1.35;
    current = 0.4;
  }

  const inaccurate = accuracy > 5000;

  return {
    status: inaccurate ? 'inaccurate' : 'active',
    sectorName: `Setor Oceânico ${hemi} ${westEast}`,
    climateZone,
    recommendedWindKnots: wind,
    recommendedWaveScale: wave,
    recommendedCurrentSpeed: current,
    latitudeBand: band,
    accuracyMeters: Math.round(accuracy),
    lastUpdated: Date.now(),
    errorMessage: inaccurate
      ? 'Precisão aproximada por rede (> 5 km); perfil regional aplicado com segurança.'
      : null,
    monitoringActive: true,
  };
}

export class GeolocationMonitor {
  private watchId: number | null = null;
  private session = 0;

  public start(onUpdate: (info: GeoSectorInfo) => void): void {
    this.stop();
    const session = this.session;
    if (typeof isSecureContext !== 'undefined' && !isSecureContext) {
      onUpdate({ ...createDefaultGeoSector(), status: 'insecure',
        errorMessage: 'Localização requer HTTPS ou localhost. Você pode jogar sem ela.' });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onUpdate({ ...createDefaultGeoSector(), status: 'unsupported',
        errorMessage: 'API de Geolocalização indisponível. Modo offline mantido.' });
      return;
    }
    const port = navigator.geolocation;
    onUpdate({ ...createDefaultGeoSector(), status: 'requesting', monitoringActive: true });
    const fail = (status: 'denied' | 'timeout' | 'unavailable', message: string): void => {
      if (session !== this.session) return;
      this.stop();
      onUpdate({ ...createDefaultGeoSector(), status, errorMessage: message });
    };
    try {
      const id = port.watchPosition(
        (pos) => {
          if (session !== this.session) return;
          const { latitude, longitude, accuracy } = pos.coords;
          if (![latitude, longitude, accuracy, pos.timestamp].every(Number.isFinite) ||
              Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) {
            fail('unavailable', 'Posição inválida. Perfil oceânico padrão mantido.');
            return;
          }
          if (Date.now() - pos.timestamp > 60000) {
            onUpdate({ ...createDefaultGeoSector(), status: 'stale', monitoringActive: true,
              errorMessage: 'Posição desatualizada; aguardando novo sinal sem alterar o perfil.' });
            return;
          }
          // Exact coordinates never leave this callback or enter persisted application state.
          onUpdate({ ...classifyMaritimeSector(latitude, longitude, accuracy), lastUpdated: pos.timestamp });
        },
        (error) => {
          const status = error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable';
          const message = status === 'denied' ? 'Permissão recusada. Navegação simulada disponível.' :
            status === 'timeout' ? 'Tempo limite de localização excedido. Modo padrão mantido.' :
            'Sinal indisponível. Modo padrão mantido.';
          fail(status, message);
        },
        { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 },
      );
      // Some providers call an error synchronously before returning a watch ID.
      if (session === this.session) this.watchId = id;
      else port.clearWatch(id);
    } catch {
      fail('unavailable', 'Não foi possível iniciar a localização. Jogue no setor padrão.');
    }
  }

  public stop(): void {
    this.session++;
    if (this.watchId !== null) {
      if (typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
