// Cross-channel notifications fired by workflow events.
//
// All functions are fire-and-forget safe: any failure is logged and swallowed
// so notification problems never block a workflow transition or document
// verification. Lookups use the service-role client because RLS blocks reads
// from the workflow engine's anon context.

import { getAdminClient } from '@/services/adminSupabase';
import { notifyExpedienteAvance, notifyDocumentoVerificado } from '@/services/whatsappService';
import { emailExpedienteAvance, emailDocumentoRechazado } from '@/services/emailService';

interface ExpedienteContact {
  numero: string;
  cliente_nombre: string;
  email: string | null;
  telefono_whatsapp: string | null;
}

async function loadContact(expedienteId: string): Promise<ExpedienteContact | null> {
  const admin = getAdminClient();

  const { data: exp } = await admin
    .from('expedientes')
    .select('numero_expediente, cliente_id, cliente')
    .eq('id', expedienteId)
    .single<{ numero_expediente: string | null; cliente_id: string | null; cliente: string | null }>();

  if (!exp) return null;

  let cliente: { nombre: string | null; email: string | null; telefono_whatsapp: string | null } | null = null;

  if (exp.cliente_id) {
    const { data } = await admin
      .from('clientes')
      .select('nombre, email, telefono_whatsapp')
      .eq('id', exp.cliente_id)
      .single<{ nombre: string | null; email: string | null; telefono_whatsapp: string | null }>();
    cliente = data ?? null;
  }

  return {
    numero:            exp.numero_expediente ?? expedienteId,
    cliente_nombre:    cliente?.nombre ?? exp.cliente ?? 'Cliente',
    email:             cliente?.email ?? null,
    telefono_whatsapp: cliente?.telefono_whatsapp ?? null,
  };
}

export async function notifyPhaseAdvance(expedienteId: string, faseNuevaNombre: string): Promise<void> {
  try {
    const contact = await loadContact(expedienteId);
    if (!contact) return;

    if (contact.telefono_whatsapp) {
      notifyExpedienteAvance(contact.telefono_whatsapp, contact.cliente_nombre, contact.numero, faseNuevaNombre)
        .catch(err => console.error('[notify] whatsapp avance failed:', err));
    }
    if (contact.email) {
      emailExpedienteAvance(contact.email, contact.cliente_nombre, contact.numero, faseNuevaNombre)
        .catch(err => console.error('[notify] email avance failed:', err));
    }
  } catch (err) {
    console.error('[notify] phase advance lookup failed:', err);
  }
}

export async function notifyDocumentVerified(
  expedienteId: string,
  documentoNombre: string
): Promise<void> {
  try {
    const contact = await loadContact(expedienteId);
    if (!contact?.telefono_whatsapp) return;

    notifyDocumentoVerificado(contact.telefono_whatsapp, contact.cliente_nombre, contact.numero, documentoNombre)
      .catch(err => console.error('[notify] whatsapp verificado failed:', err));
  } catch (err) {
    console.error('[notify] document verified lookup failed:', err);
  }
}

export async function notifyDocumentRejected(
  expedienteId: string,
  documentoNombre: string,
  motivo?: string
): Promise<void> {
  try {
    const contact = await loadContact(expedienteId);
    if (!contact?.email) return;

    emailDocumentoRechazado(contact.email, contact.cliente_nombre, contact.numero, documentoNombre, motivo)
      .catch(err => console.error('[notify] email rechazado failed:', err));
  } catch (err) {
    console.error('[notify] document rejected lookup failed:', err);
  }
}
