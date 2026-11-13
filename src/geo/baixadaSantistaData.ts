import { GeoCoord } from '../sim/types';

/**
 * Fixed WGS84 Geographic Reference Origin:
 * Ponta da Praia / Cais Inicial do Porto de Santos, Santos - SP, Brasil.
 */
export const SANTOS_ORIGIN: GeoCoord = {
  lat: -23.9885,
  lon: -46.3015,
};

export interface GeoLandPolygon {
  id: string;
  name: string;
  elevationM: number;
  maxHillM: number;
  colorHex: number;
  coordinates: GeoCoord[];
}

export interface GeoPortLandmark {
  id: string;
  name: string;
  city: string;
  kind: 'port' | 'marina' | 'city' | 'island' | 'checkpoint';
  coord: GeoCoord;
  description: string;
}

export const BAIXADA_SANTISTA_LANDMARKS: GeoPortLandmark[] = [
  {
    id: 'porto_santos_pier',
    name: 'Porto de Santos — Cais Inicial',
    city: 'Santos, SP',
    kind: 'port',
    coord: { lat: -23.9885, lon: -46.3015 },
    description: 'Píer de embarque da Aster S-01 na Ponta da Praia / Canal do Estuário.',
  },
  {
    id: 'porto_santos_armazens',
    name: 'Terminais do Porto de Santos',
    city: 'Santos, SP',
    kind: 'port',
    coord: { lat: -23.9635, lon: -46.3125 },
    description: 'Cais comercial e guindastes ao longo do Estuário de Santos.',
  },
  {
    id: 'santos_gonzaga',
    name: 'Baía de Santos (Gonzaga)',
    city: 'Santos, SP',
    kind: 'city',
    coord: { lat: -23.9695, lon: -46.3335 },
    description: 'Orla urbana e jardins da praia de Santos voltados para a baía.',
  },
  {
    id: 'guaruja_balsa',
    name: 'Guarujá (Ponta da Barra)',
    city: 'Guarujá, SP',
    kind: 'port',
    coord: { lat: -23.9912, lon: -46.2935 },
    description: 'Margem leste do canal de navegação na Ilha de Santo Amaro.',
  },
  {
    id: 'guaruja_asturias',
    name: 'Guarujá — Astúrias / Pitangueiras',
    city: 'Guarujá, SP',
    kind: 'city',
    coord: { lat: -23.9965, lon: -46.2625 },
    description: 'Enseada costeira e morros atlânticos do Guarujá.',
  },
  {
    id: 'sao_vicente_porchat',
    name: 'São Vicente (Ilha Porchat)',
    city: 'São Vicente, SP',
    kind: 'city',
    coord: { lat: -23.9775, lon: -46.3695 },
    description: 'Promontório oeste separando a Baía de Santos de São Vicente.',
  },
  {
    id: 'praia_grande_canto',
    name: 'Praia Grande (Canto do Forte)',
    city: 'Praia Grande, SP',
    kind: 'city',
    coord: { lat: -24.0085, lon: -46.4085 },
    description: 'Extenso litoral sul-oeste da Baixada Santista.',
  },
  {
    id: 'ilha_das_palmas',
    name: 'Ilha das Palmas',
    city: 'Santos, SP',
    kind: 'island',
    coord: { lat: -24.0085, lon: -46.3220 },
    description: 'Ilha rochosa na entrada da Baía de Santos.',
  },
  {
    id: 'atlantico_aberto',
    name: 'Boia da Barra — Oceano Atlântico',
    city: 'Oceano Atlântico',
    kind: 'checkpoint',
    coord: { lat: -23.99155, lon: -46.30056 },
    description: 'Ponto de controle da Primeira Travessia na saída do canal portuário.',
  },
];

/**
 * Validated regional WGS84 landmass outlines preserving real spatial relationships
 * between Santos, Guarujá (Ilha de Santo Amaro), São Vicente, Praia Grande,
 * Ilha das Palmas, and the open Atlantic Ocean.
 * Note: Clearly labeled as regional simplified coastal geometry when offline / OSM cache absent.
 */
export const BAIXADA_SANTISTA_POLYGONS: GeoLandPolygon[] = [
  {
    id: 'santos_peninsula',
    name: 'Ilha de São Vicente / Santos',
    elevationM: 1.45,
    maxHillM: 68,
    colorHex: 0x26353c,
    coordinates: [
      // West side of Santos channel (Ponta da Praia northwards toward Valongo)
      { lat: -23.9891, lon: -46.30165 }, // Pier base Ponta da Praia (X ~ -15m, Z ~ +66m)
      { lat: -23.9875, lon: -46.30165 }, // West quay line
      { lat: -23.9820, lon: -46.3035 },
      { lat: -23.9720, lon: -46.3080 },
      { lat: -23.9560, lon: -46.3145 },
      { lat: -23.9380, lon: -46.3240 },
      { lat: -23.9320, lon: -46.3480 },
      { lat: -23.9460, lon: -46.3820 }, // São Vicente inland
      { lat: -23.9780, lon: -46.3740 }, // São Vicente Gonzaguinha
      { lat: -23.9795, lon: -46.3665 }, // Ilha Porchat tip
      { lat: -23.9705, lon: -46.3480 }, // José Menino beach
      { lat: -23.9700, lon: -46.3320 }, // Gonzaga beach
      { lat: -23.9780, lon: -46.3150 }, // Boqueirão / Aparecida
      { lat: -23.9885, lon: -46.3065 }, // Ponta da Praia curve
    ],
  },
  {
    id: 'guaruja_santo_amaro',
    name: 'Guarujá — Ilha de Santo Amaro',
    elevationM: 2.2,
    maxHillM: 120,
    colorHex: 0x233830,
    coordinates: [
      // East side of Santos Estuary channel (~420m East of Santos)
      { lat: -23.9945, lon: -46.2955 }, // Ponta da Fortaleza / Barra Leste
      { lat: -23.9885, lon: -46.2968 }, // Ferry crossing East bank
      { lat: -23.9760, lon: -46.2995 },
      { lat: -23.9550, lon: -46.3035 }, // Vicente de Carvalho
      { lat: -23.9360, lon: -46.2950 },
      { lat: -23.9400, lon: -46.2450 },
      { lat: -23.9820, lon: -46.2280 }, // Enseada
      { lat: -23.9985, lon: -46.2560 }, // Pitangueiras
      { lat: -24.0010, lon: -46.2780 }, // Astúrias / Tombo
      { lat: -24.0040, lon: -46.2915 }, // Monduba headland
    ],
  },
  {
    id: 'praia_grande_continent',
    name: 'Praia Grande — Litoral Sul',
    elevationM: 2.0,
    maxHillM: 85,
    colorHex: 0x2a3838,
    coordinates: [
      { lat: -23.9940, lon: -46.3950 }, // Itaipu / Canto do Forte
      { lat: -23.9820, lon: -46.3840 }, // Ponte Pênsil / Mar Pequeno
      { lat: -23.9680, lon: -46.4250 },
      { lat: -24.0250, lon: -46.4650 },
      { lat: -24.0360, lon: -46.4420 }, // Boqueirão PG coastline
      { lat: -24.0120, lon: -46.4080 }, // Canto do Forte coastline
    ],
  },
  {
    id: 'ilha_das_palmas_poly',
    name: 'Ilha das Palmas',
    elevationM: 2.5,
    maxHillM: 34,
    colorHex: 0x293b33,
    coordinates: [
      { lat: -24.0072, lon: -46.3238 },
      { lat: -24.0074, lon: -46.3204 },
      { lat: -24.0098, lon: -46.3202 },
      { lat: -24.0100, lon: -46.3236 },
    ],
  },
];
