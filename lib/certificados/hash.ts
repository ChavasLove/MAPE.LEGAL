import { createHash } from 'node:crypto';

// Huella criptográfica del documento del Certificado de Origen (T2.3,
// interoperabilidad Fase 1). Persistir el resultado en
// certificados_origen.hash_sha256 (migración 036) en el punto donde el flujo
// de emisión almacene el documento del certificado.
//
// Punto de enganche: PENDIENTE de Fase 2B — hoy el código no tiene flujo de
// emisión ni almacenamiento documental de certificados (solo lecturas vía la
// vista certificados_origen_publicos). Cuando exista, el flujo debe:
//   1. generar/recibir el documento (Buffer),
//   2. hash_sha256 = sha256Hex(buffer),
//   3. persistirlo junto al registro, y
//   4. (Fase 2B, con PDF) incrustar el QR a
//      https://mape.legal/verificar/<numero_certificado>.
export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
