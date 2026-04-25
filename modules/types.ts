export interface Phase {
  id: string;
  name: string;
  order_index: number;
}

// Conditions stored in phase_transitions.condition (jsonb)
export interface TransitionCondition {
  requires_payment?: boolean;
  requires_documents?: string[];
}

export interface PhaseTransition {
  id: string;
  from_phase_id: string;
  to_phase_id: string;
  condition: TransitionCondition;
  to_phase?: Phase;
}

export interface Expediente {
  id: string;
  name: string;
  current_phase_id: string | null;
  created_at?: string;
  phase?: Phase;
}

// Full history record: one row per phase the expediente has been in
export interface ExpedientePhase {
  id: string;
  expediente_id: string;
  phase_id: string;
  entered_at: string;
  exited_at: string | null;
  entered_by: string | null;
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

// Structured blocking reason returned by getBlockingReasons
export interface BlockingReason {
  type: 'payment' | 'document';
  status: 'missing' | 'pending';
  name?: string; // populated for document blocks
}

// Shape returned by GET /expedientes/:id/next-actions
export interface NextActionsResult {
  can_advance: boolean;
  blocking: BlockingReason[];
  available_transitions: Array<{
    transition_id: string;
    to_phase: Phase;
  }>;
}
