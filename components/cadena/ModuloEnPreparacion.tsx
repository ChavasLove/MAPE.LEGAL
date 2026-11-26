// components/cadena/ModuloEnPreparacion.tsx — aviso que muestran las páginas
// del estándar privado (dashboard y portal) cuando las tablas de la migración
// 043 todavía no existen en la base de datos. Server component (sin hooks),
// tokens del Color Manual v1.0 únicamente. No es un error: es un estado
// previsto mientras un humano no aplique la 043 en Supabase Studio.

import type React from 'react';

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'var(--amber)',
};

export const MODULO_EN_PREPARACION_TITULO = 'Módulo en preparación';

export default function ModuloEnPreparacion({ detalle }: { detalle?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'color-mix(in oklch, var(--amber) 8%, white)',
        border: '1px solid color-mix(in oklch, var(--amber) 30%, white)',
        borderRadius: 12, padding: 24, maxWidth: 640,
      }}
    >
      <div style={EYEBROW}>Cadena de custodia</div>
      <h1 style={{ fontSize: 24, margin: '6px 0 10px', color: 'var(--ink)' }}>{MODULO_EN_PREPARACION_TITULO}</h1>
      <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.6, margin: 0 }}>
        {detalle ??
          'Este módulo del estándar privado de debida diligencia todavía no está habilitado en esta instalación: la base de datos no tiene aún sus tablas (migración 043). Cuando la administración de CHT lo habilite, esta pantalla quedará operativa sin que usted tenga que hacer nada.'}
      </p>
    </div>
  );
}
