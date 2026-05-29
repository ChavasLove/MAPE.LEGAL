// ─── Mining Junior Venture Marketplace Types ─────────────────────────────────

export type ProjectStage =
  | 'exploration' | 'pre_feasibility' | 'feasibility'
  | 'development' | 'production' | 'closure';

export type TenementStatus =
  | 'application' | 'granted' | 'renewal' | 'surrendered' | 'revoked';

export type DocumentType =
  | 'corporate_governance'
  | 'technical_report_43101'
  | 'exploration_geological'
  | 'permit_license'
  | 'environmental_social'
  | 'financial'
  | 'metallurgy_processing'
  | 'maps_spatial';

export type AccessTier = 'public' | 'registered' | 'nda_required' | 'authorized';

export type OCRStatus =
  | 'pending' | 'queued' | 'processing' | 'completed'
  | 'failed' | 'retrying' | 'skipped';

export type ChunkType = 'text' | 'table' | 'heading' | 'figure_caption' | 'summary';

export type ProjectStatus = 'active' | 'inactive' | 'archived';

// ─── Document Category Labels (UI) ──────────────────────────────────────────
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  corporate_governance:    'Corporativo y Gobernanza',
  technical_report_43101:  'Reportes Técnicos (43-101/JORC)',
  exploration_geological:  'Exploración y Geología',
  permit_license:          'Permisos y Licencias',
  environmental_social:    'Ambiental y Social',
  financial:               'Financiero',
  metallurgy_processing:   'Metalurgia y Procesamiento',
  maps_spatial:            'Mapas y Datos Espaciales',
};

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'corporate_governance',
  'technical_report_43101',
  'exploration_geological',
  'permit_license',
  'environmental_social',
  'financial',
  'metallurgy_processing',
  'maps_spatial',
];

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  exploration:      'Exploración',
  pre_feasibility:  'Pre-Factibilidad',
  feasibility:      'Factibilidad',
  development:      'Desarrollo',
  production:       'Producción',
  closure:          'Cierre',
};

export const TENEMENT_STATUS_LABELS: Record<TenementStatus, string> = {
  application: 'Solicitud',
  granted:     'Otorgada',
  renewal:     'Renovación',
  surrendered: 'Renunciada',
  revoked:     'Revocada',
};

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  public:       'Público',
  registered:   'Registrado',
  nda_required: 'Requiere NDA',
  authorized:   'Autorizado',
};

// Allowlists for server-side validation (mirror the CHECK constraints in 026).
export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPE_ORDER;
export const ACCESS_TIER_VALUES: AccessTier[] = ['public', 'registered', 'nda_required', 'authorized'];
export const PROJECT_STAGE_VALUES: ProjectStage[] = [
  'exploration', 'pre_feasibility', 'feasibility', 'development', 'production', 'closure',
];
export const TENEMENT_STATUS_VALUES: TenementStatus[] = [
  'application', 'granted', 'renewal', 'surrendered', 'revoked',
];

// ─── Database Row Types ─────────────────────────────────────────────────────
export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  country: string;
  region: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  commodity: string[] | null;
  project_stage: ProjectStage | null;
  tenement_status: TenementStatus | null;
  company_name: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocumentRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;
  document_subtype: string | null;
  original_filename: string;
  file_size_bytes: number | null;
  page_count: number | null;
  language: string;
  storage_bucket: string;
  storage_path: string;
  file_hash: string | null;
  permit_number: string | null;
  report_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  ocr_status: OCRStatus;
  ocr_engine: string | null;
  ocr_confidence: number | null;
  ocr_text: string | null;
  processing_metadata: Record<string, unknown> | null;
  content_summary: string | null;
  keywords: string[] | null;
  access_tier: AccessTier;
  version: string;
  version_notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Types ──────────────────────────────────────────────────────────────
// Slim shapes returned by the list endpoints (never the full row / never ocr_text).
export interface ProjectListItem {
  id: string;
  name: string;
  region: string | null;
  municipality: string | null;
  company_name: string | null;
  commodity: string[] | null;
  project_stage: ProjectStage | null;
  tenement_status: TenementStatus | null;
  status: string;
  created_at: string;
  document_count?: number;
}

export interface DocumentListItem {
  id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;
  document_subtype: string | null;
  ocr_status: OCRStatus;
  page_count: number | null;
  access_tier: AccessTier;
  version: string;
  report_date: string | null;
  effective_date: string | null;
  created_at: string;
  file_size_bytes: number | null;
}

export interface SearchResultChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  breadcrumb: string | null;
  section_title: string | null;
  page_number: number | null;
  similarity: number;
  rank: number | null;
  combined_score: number;
  is_table: boolean | null;
}
