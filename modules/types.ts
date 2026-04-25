export interface Phase {
  id: string;
  name: string;
  order_index: number;
}

export interface Expediente {
  id: string;
  name: string;
  current_phase_id: string | null;
  created_at?: string;
  phase?: Phase;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface Payment {
  id: string;
  expediente_id: string;
  phase_id: string;
  amount: number;
  status: PaymentStatus;
  created_at?: string;
}

export type AuditAction = 'PHASE_TRANSITION' | 'PAYMENT_RECORDED' | 'EXPEDIENTE_CREATED';

export interface AuditLog {
  id: string;
  expediente_id: string;
  user_id: string | null;
  action: AuditAction | string;
  metadata: Record<string, unknown>;
  created_at?: string;
}
