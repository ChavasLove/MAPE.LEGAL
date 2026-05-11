export type MineType =
  | 'gold'
  | 'zinc'
  | 'lead'
  | 'silver'
  | 'iron'
  | 'antimony'
  | 'historical';

export type MineStatus = 'active' | 'inactive' | 'contested' | 'historical';

export interface MiningSite {
  id: string;
  name: string;
  nameEs: string;
  type: MineType;
  status: MineStatus;
  coordinates: [number, number]; // [longitude, latitude]
  department: string;
  municipality: string;
  descriptionEs: string;
  descriptionEn: string;
  production?: string;
  owner?: string;
  since?: string;
  commodities?: string[];
}

export const MINING_SITES: MiningSite[] = [
  {
    id: 'san-andres',
    name: 'San Andrés Mine',
    nameEs: 'Mina San Andrés',
    type: 'gold',
    status: 'active',
    coordinates: [-88.9417, 14.7632],
    department: 'Copán',
    municipality: 'La Unión',
    descriptionEs:
      'Productora primaria de oro más importante de Honduras. Operación de tajo abierto con lixiviación en pilas desde 1983. Propiedad de Aura Minerals (TSX: ORA). Producción 2024: 78,372 oz de oro. Vida útil estimada hasta 2029.',
    descriptionEn:
      "Honduras' premier gold-producing operation. Open-pit heap leach mine owned by Aura Minerals (TSX: ORA). 2024 production: 78,372 oz gold. Estimated mine life through 2029.",
    production: '78,372 oz Au (2024)',
    owner: 'Aura Minerals Inc.',
    since: '1983',
    commodities: ['Gold', 'Silver'],
  },
  {
    id: 'el-mochito',
    name: 'El Mochito Mine',
    nameEs: 'Mina El Mochito',
    type: 'zinc',
    status: 'active',
    coordinates: [-88.0783, 14.8602],
    department: 'Santa Bárbara',
    municipality: 'Las Vegas',
    descriptionEs:
      'La mina de metales base más grande de Centroamérica. Producción ininterrumpida desde 1948 (76+ años). Mina subterránea que produce concentrados de zinc, plomo y plata. Operada por Kirungu Corporation.',
    descriptionEn:
      'The largest base metal mine in Central America. Continuous production since 1948 (76+ years). Underground mine producing zinc, lead, and silver concentrates. Operated by Kirungu Corporation.',
    production: '30,000 t Zn (2023)',
    owner: 'Kirungu Corporation',
    since: '1948',
    commodities: ['Zinc', 'Lead', 'Silver'],
  },
  {
    id: 'clavo-rico',
    name: 'Clavo Rico / El Corpus',
    nameEs: 'Clavo Rico / El Corpus',
    type: 'gold',
    status: 'contested',
    coordinates: [-87.0244, 13.2849],
    department: 'Choluteca',
    municipality: 'El Corpus',
    descriptionEs:
      'Región con significado histórico minero desde la época colonial española (siglo XVI). Concesión de 200 hectáreas. Ha enfrentado escrutinio regulatorio y oposición comunitaria.',
    descriptionEn:
      'Region with historical mining significance dating to Spanish colonial exploitation (16th century). 200-hectare concession. Has faced regulatory scrutiny and community opposition.',
    owner: 'Inception Mining / Empresa Minera',
    since: 'Colonial era (16th c.)',
    commodities: ['Gold', 'Silver'],
  },
  {
    id: 'guapinol',
    name: 'Guapinol (Los Pinares)',
    nameEs: 'Guapinol (Los Pinares)',
    type: 'iron',
    status: 'contested',
    coordinates: [-86.0833, 15.65],
    department: 'Colón',
    municipality: 'Tocoa',
    descriptionEs:
      'Proyecto de extracción de óxido de hierro dentro del Parque Nacional Montaña de Botaderos. Controlado por Inversiones Los Pinares (Grupo EMCO). Profundamente controvertido: denegación de permisos INHGEOMIN en 2024-2025.',
    descriptionEn:
      'Iron oxide extraction project within Botaderos Mountain National Park. Controlled by Inversiones Los Pinares (Grupo EMCO). Deeply controversial: INHGEOMIN permit denials in 2024-2025.',
    owner: 'Inversiones Los Pinares (Grupo EMCO)',
    since: '2013',
    commodities: ['Iron Oxide'],
  },
  {
    id: 'rosario',
    name: 'Rosario Mine (Historical)',
    nameEs: 'Mina Rosario (Histórica)',
    type: 'historical',
    status: 'historical',
    coordinates: [-87.0831, 14.2211],
    department: 'Francisco Morazán',
    municipality: 'Tegucigalpa',
    descriptionEs:
      'La New York and Honduras Rosario Mining Company operó de 1882-1954, produciendo más de $60 millones en oro y plata. 72 años de operación, 85 vetas conocidas. Pilar histórico de la minería hondureña.',
    descriptionEn:
      'The New York and Honduras Rosario Mining Company operated from 1882-1954, producing over $60 million in gold and silver. 72 years of operation, 85 known veins. Foundational pillar of Honduran mining.',
    owner: 'NY & Honduras Rosario Mining Co. (defunct)',
    since: '1882–1954',
    commodities: ['Gold', 'Silver'],
  },
  {
    id: 'cobra-oro',
    name: 'Cobra Oro de Honduras',
    nameEs: 'Cobra Oro de Honduras',
    type: 'gold',
    status: 'inactive',
    coordinates: [-87.65, 14.45],
    department: 'Cortés',
    municipality: 'San Pedro Sula area',
    descriptionEs:
      'Planta de procesamiento de oro operada por Glen Eagle Resources (TSXV: GER). Modelo de molienda por contrato para mineros artesanales. Producción pausada en abril 2023.',
    descriptionEn:
      'Gold processing facility operated by Glen Eagle Resources (TSXV: GER). Toll milling model for artisanal miners. Production paused April 2023.',
    owner: 'Glen Eagle Resources Inc.',
    since: '2017',
    commodities: ['Gold'],
  },
  {
    id: 'el-quetzal',
    name: 'El Quetzal (Antimony)',
    nameEs: 'El Quetzal (Antimonio)',
    type: 'antimony',
    status: 'inactive',
    coordinates: [-88.9667, 14.7833],
    department: 'Copán',
    municipality: 'San Agustín',
    descriptionEs:
      'Mina de antimonio histórica. Producción de 4,800 toneladas en 1995, declinó a niveles insignificantes para 1999. Actualmente inactiva.',
    descriptionEn:
      'Historical antimony mine. Production of 4,800 tonnes in 1995, declined to negligible levels by 1999. Currently inactive.',
    owner: 'N/A (dormant)',
    since: '~1995',
    commodities: ['Antimony', 'Graphite'],
  },
  {
    id: 'la-pochota',
    name: 'La Pochota',
    nameEs: 'La Pochota',
    type: 'silver',
    status: 'historical',
    coordinates: [-87.6822, 13.7509],
    department: 'Choluteca',
    municipality: 'Distrito Clavo Rico',
    descriptionEs:
      'Yacimiento histórico de plata asociado al distrito minero de Clavo Rico. Explotación de origen colonial documentada en la región de El Corpus; sin operador actual.',
    descriptionEn:
      'Historical silver deposit associated with the Clavo Rico mining district. Colonial-era workings documented in the El Corpus region; no current operator.',
    since: 'Era colonial',
    commodities: ['Silver', 'Lead'],
  },
];

// Order shown in legend / filter chips. Matches `MineType` keys.
export const MINE_TYPE_ORDER: MineType[] = [
  'gold',
  'silver',
  'zinc',
  'lead',
  'iron',
  'antimony',
  'historical',
];

// Color by mineral type — bound to MAPE LEGAL Color Manual v1.0 tokens (DESIGN.md).
export const TYPE_COLORS: Record<MineType, string> = {
  gold: 'var(--amber)',
  zinc: 'var(--blue)',
  lead: 'var(--plum)',
  silver: 'var(--t3)',
  iron: 'var(--red)',
  antimony: 'var(--slate)',
  historical: 'var(--earth)',
};

export const TYPE_LABELS_ES: Record<MineType, string> = {
  gold: 'Oro',
  zinc: 'Zinc',
  lead: 'Plomo',
  silver: 'Plata',
  iron: 'Hierro',
  antimony: 'Antimonio',
  historical: 'Histórico',
};

export const TYPE_LABELS_EN: Record<MineType, string> = {
  gold: 'Gold',
  zinc: 'Zinc',
  lead: 'Lead',
  silver: 'Silver',
  iron: 'Iron',
  antimony: 'Antimony',
  historical: 'Historical',
};

// Lookup table for localizing free-form commodity strings stored on each site
// (e.g. 'Gold', 'Silver', 'Iron Oxide') back to the user's language.
export const COMMODITY_LABELS_ES: Record<string, string> = {
  Gold: 'Oro',
  Silver: 'Plata',
  Zinc: 'Zinc',
  Lead: 'Plomo',
  Iron: 'Hierro',
  'Iron Oxide': 'Óxido de hierro',
  Antimony: 'Antimonio',
  Graphite: 'Grafito',
  Copper: 'Cobre',
};

// Color by operational status — also tokenized. Surfaced only in the side panel,
// never on map markers (those are colored by mineral type).
export const STATUS_COLORS: Record<MineStatus, string> = {
  active: 'var(--green)',
  inactive: 'var(--t3)',
  contested: 'var(--red)',
  historical: 'var(--earth)',
};

export const STATUS_LABELS_ES: Record<MineStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  contested: 'En disputa',
  historical: 'Histórica',
};

export const STATUS_LABELS_EN: Record<MineStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  contested: 'Contested',
  historical: 'Historical',
};
