// lib/documentos/acl.ts — control de acceso POR DOCUMENTO y por fragmento del
// índice. PURO. Réplica de puede_leer_fragmento() y buscar_fragmentos_acl()
// (migración 049).
//
// REGLA: el filtro de acceso se aplica ANTES de recuperar. Lo que un usuario no
// puede leer no entra a la búsqueda, no participa del ordenamiento y jamás
// llega al modelo. Nunca se filtra "después de generar la respuesta".

import type { Role } from '@/lib/userRoleLookup';
import type { NivelAcceso } from './respaldo';

export interface LectorDocumentos {
  rol: Role;
  userId: string;
  /** user_roles.organizacion_id (o null). */
  organizacionId: string | null;
  /** clientes.id del usuario si es titular (o null). */
  clienteId: string | null;
  /**
   * Solo para `recepcion`: titulares con recepciones en los puntos de su
   * organización. Un punto de acopio solo ve lo de su punto.
   */
  titularesDelPunto?: ReadonlySet<string>;
}

export interface AclDocumento {
  nivel_acceso: NivelAcceso;
  organizacion_id: string | null;
  titular_cliente_id: string | null;
  vigente: boolean;
}

const PERSONAL_GLOBAL = new Set<Role>(['admin', 'abogado', 'tecnico_ambiental', 'verificador']);

export function puedeLeerDocumento(lector: LectorDocumentos, doc: AclDocumento): boolean {
  if (!doc.vigente) return false; // revocado u obsoleto: nadie
  if (PERSONAL_GLOBAL.has(lector.rol)) return true;
  if (lector.rol === 'recepcion') {
    return lector.organizacionId !== null && doc.titular_cliente_id !== null
      && (lector.titularesDelPunto?.has(doc.titular_cliente_id) ?? false);
  }
  if (lector.rol === 'cliente') {
    return doc.nivel_acceso === 'titular' && lector.clienteId !== null && doc.titular_cliente_id === lector.clienteId;
  }
  if (lector.rol === 'comercializador' || lector.rol === 'planta' || lector.rol === 'auditor') {
    return doc.nivel_acceso === 'organizacion' && lector.organizacionId !== null && doc.organizacion_id === lector.organizacionId;
  }
  return false;
}

/** Sinónimo explícito para el índice. */
export const puedeLeerFragmento = puedeLeerDocumento;

export interface Fragmento extends AclDocumento {
  id: number;
  documento_id: string;
  expediente_id: string;
  titulo: string;
  version: number;
  fecha_documento: string | null;
  contenido: string;
}

export interface FragmentoRecuperado {
  fragmento_id: number; documento_id: string; expediente_id: string; titulo: string;
  version: number; fecha_documento: string | null; contenido: string; relevancia: number;
}

const tokens = (t: string): string[] => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) ?? [];

/**
 * Índice en memoria — SOLO pruebas. Reproduce el orden de operaciones de
 * buscar_fragmentos_acl(): 1) filtra por acceso, 2) busca, 3) ordena, 4) limita.
 */
export class IndiceEnMemoria {
  private fragmentos: Fragmento[] = [];
  /** Cuántos fragmentos llegaron a puntuarse en la última búsqueda. */
  ultimosEvaluados = 0;

  agregar(f: Fragmento): void {
    if (!f.vigente) throw new Error('No se indexa un documento revocado u obsoleto.');
    this.fragmentos.push({ ...f });
  }

  /** Retira del índice todos los fragmentos de un documento. */
  retirarDocumento(documentoId: string): number {
    const antes = this.fragmentos.length;
    this.fragmentos = this.fragmentos.filter((f) => f.documento_id !== documentoId);
    return antes - this.fragmentos.length;
  }

  get total(): number { return this.fragmentos.length; }

  buscar(lector: LectorDocumentos, consulta: string, limite = 5): FragmentoRecuperado[] {
    const q = new Set(tokens(consulta));
    if (q.size === 0) { this.ultimosEvaluados = 0; return []; }
    // 1) ACL primero.
    const permitidos = this.fragmentos.filter((f) => puedeLeerFragmento(lector, f));
    this.ultimosEvaluados = permitidos.length;
    // 2) y 3) búsqueda y orden, solo sobre lo permitido.
    return permitidos
      .map((f) => ({ f, relevancia: tokens(`${f.titulo} ${f.contenido}`).filter((t) => q.has(t)).length }))
      .filter((x) => x.relevancia > 0)
      .sort((a, b) => b.relevancia - a.relevancia || a.f.id - b.f.id)
      .slice(0, Math.min(Math.max(limite, 1), 10))
      .map(({ f, relevancia }) => ({
        fragmento_id: f.id, documento_id: f.documento_id, expediente_id: f.expediente_id, titulo: f.titulo,
        version: f.version, fecha_documento: f.fecha_documento, contenido: f.contenido, relevancia,
      }));
  }
}
