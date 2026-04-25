export type ExpedienteStatus =
  | 'draft'
  | 'submitted'
  | 'validated'
  | 'approved';

export interface Expediente {
  id: string;
  name: string;
  status: ExpedienteStatus;
  created_at?: string;
}

export interface Payment {
  id: string;
  expediente_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at?: string;
}

export interface AuditLog {
  id: string;
  expediente_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}
