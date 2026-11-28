// Aviso de sección todavía no disponible. Server component, sin datos.
export default function EnImplementacion({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="max-w-2xl">
      <p style={{ color: 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
        En implementación
      </p>
      <h1 className="mt-2" style={{ color: 'var(--ink)', fontSize: 24, fontWeight: 600 }}>{titulo}</h1>
      <div className="mt-6 rounded-xl p-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--t2)', lineHeight: 1.6 }}>{detalle}</p>
      </div>
    </div>
  );
}
