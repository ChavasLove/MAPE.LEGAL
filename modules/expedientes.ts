import { supabase } from '@/services/supabase';
import type { Expediente, ExpedienteStatus } from '@/modules/types';

export const allowedTransitions: Record<ExpedienteStatus, ExpedienteStatus[]> = {
  draft: ['submitted'],
  submitted: ['validated'],
  validated: ['approved'],
  approved: [],
};

export function canTransition(from: ExpedienteStatus, to: ExpedienteStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export async function validatePayment(expedienteId: string): Promise<boolean> {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('status', 'completed');

  return data !== null && data.length > 0;
}

export async function logAction(
  expedienteId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from('audit_logs').insert({
    expediente_id: expedienteId,
    action,
    metadata,
  });
}

export async function transitionExpediente(
  expediente: Expediente,
  nextStatus: ExpedienteStatus
): Promise<Expediente> {
  if (!canTransition(expediente.status, nextStatus)) {
    throw new Error(`Invalid transition: ${expediente.status} → ${nextStatus}`);
  }

  if (nextStatus === 'validated') {
    const isPaid = await validatePayment(expediente.id);
    if (!isPaid) {
      throw new Error('Payment not validated');
    }
  }

  const { error } = await supabase
    .from('expedientes')
    .update({ status: nextStatus })
    .eq('id', expediente.id);

  if (error) throw error;

  await logAction(expediente.id, 'STATUS_CHANGE', {
    from: expediente.status,
    to: nextStatus,
  });

  return { ...expediente, status: nextStatus };
}
