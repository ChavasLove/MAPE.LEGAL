'use client';

// Conversión por kilates — tabla pública derivada del mismo snapshot diario de
// las 8 AM que alimenta LivePricesWidget. Recibe el snapshot bubbled up vía
// onData (PreciosClient) y nunca hace fetch propio, así que no puede divergir
// del precio del día. Los valores vienen ya calculados del servidor
// (/api/precios/live → buildKaratPrices en services/pricingService.ts) y se
// renderizan tal cual — el cliente no recalcula nada.
//
// Unidades (regla R5, encargo Precio de Referencia): "por gramo" nunca va a
// secas. El precio de referencia de la tarjeta de arriba es por gramo de oro
// FINO; estas cifras son por gramo DE MATERIAL al kilataje indicado — son
// números distintos y la nota introductoria los contrasta de forma explícita.
// Las columnas usan unidades compactas ("USD/g", "L/g") y el pie aclara que la
// ley nominal es aritmética de referencia, no un ensaye.

import { type CSSProperties } from 'react';
import { type LivePrices } from './LivePricesWidget';

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

// Placeholder SOLO para el estado pre-carga: la ley nominal (kilates ÷ 24) se
// conoce estáticamente, así que la tabla ya tiene forma antes de que llegue el
// snapshot y los valores muestran "—". Una vez cargado, las filas salen de
// data.kilates (servidor) — no de esta lista — para que agregar un kilataje a
// GOLD_KARATS en services/pricingService.ts aparezca aquí sin tocar el cliente.
const KARATS_PLACEHOLDER = [16, 18, 20, 22] as const;

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function KaratPricesTable({
  lang,
  data,
}: {
  lang: 'es' | 'en';
  data: LivePrices | null;
}) {
  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  // Servidor manda cuando hay datos; el placeholder sólo da forma pre-carga.
  const rows = data?.kilates?.length
    ? data.kilates.map((r) => ({
        kilates: r.kilates,
        ley: r.ley,
        oro_usd_g: r.oro_usd_g,
        oro_lps_g: r.oro_lps_g,
        referencia_lps_g: r.referencia_lps_g,
      }))
    : KARATS_PLACEHOLDER.map((k) => ({
        kilates: k,
        ley: k / 24,
        oro_usd_g: null as number | null,
        oro_lps_g: null as number | null,
        referencia_lps_g: null as number | null,
      }));

  const thStyle: CSSProperties = {
    background: 'var(--ink)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textAlign: 'right',
    padding: '10px 14px',
    whiteSpace: 'nowrap',
  };
  const tdStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    color: 'var(--t1)',
    textAlign: 'right',
    padding: '12px 14px',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: SHADOW_SM,
        padding: 'clamp(16px, 3vw, 22px)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--slate)',
          marginBottom: 8,
        }}
      >
        {t('Conversión por kilates', 'Karat conversion')}
      </div>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--t2)',
          fontFamily: 'var(--font-body)',
          maxWidth: 620,
        }}
      >
        {t(
          'A diferencia del precio de referencia de arriba, que es por gramo de oro fino, estas cifras son por gramo del material al kilataje indicado: el oro contenido según su ley nominal (kilates ÷ 24). Se derivan del mismo precio del día, capturado a las 8:00 a.m. (Honduras).',
          'Unlike the reference price above, which is per gram of fine gold, these figures are per gram of material at the stated karat: the gold it contains at its nominal fineness (karats ÷ 24). Derived from the same daily price, captured at 8:00 a.m. (Honduras).',
        )}
      </p>

      {/* Wide table scrolls inside its own container — the page never scrolls
          horizontally (regla de responsividad de la landing). */}
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label={t(
            'Conversión del precio del oro por kilates',
            'Gold price conversion by karat',
          )}
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}
        >
          <thead>
            <tr>
              <th scope="col" style={{ ...thStyle, textAlign: 'left', borderRadius: '8px 0 0 8px' }}>
                {t('Kilates', 'Karats')}
              </th>
              <th scope="col" style={thStyle}>
                {t('Ley (oro fino)', 'Fineness (fine gold)')}
              </th>
              <th scope="col" style={thStyle}>
                {t('Oro internacional (USD/g)', 'International gold (USD/g)')}
              </th>
              <th scope="col" style={thStyle}>
                {t('Oro internacional (L/g)', 'International gold (L/g)')}
              </th>
              <th scope="col" style={{ ...thStyle, borderRadius: '0 8px 8px 0' }}>
                {t('Referencia MAPE.LEGAL (L/g)', 'MAPE.LEGAL reference (L/g)')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.kilates} style={{ borderBottom: '1px solid var(--border)' }}>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  {row.kilates} k
                </td>
                <td style={{ ...tdStyle, color: 'var(--t2)' }}>{fmtNum(row.ley * 100, 1)} %</td>
                <td style={tdStyle}>
                  {row.oro_usd_g != null ? `$${fmtNum(row.oro_usd_g)}` : '—'}
                </td>
                <td style={tdStyle}>
                  {row.oro_lps_g != null ? `L ${fmtNum(row.oro_lps_g)}` : '—'}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--earth)' }}>
                  {row.referencia_lps_g != null ? `L ${fmtNum(row.referencia_lps_g)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        style={{
          margin: '12px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
          color: 'var(--t3)',
          maxWidth: 640,
        }}
      >
        {t(
          'La ley nominal es una referencia aritmética. En una compra real, el contenido de oro fino se determina por ensaye, no por el kilataje declarado.',
          'Nominal fineness is an arithmetic reference. In an actual purchase, the fine gold content is determined by assay, not by the declared karat.',
        )}
      </p>
    </div>
  );
}
