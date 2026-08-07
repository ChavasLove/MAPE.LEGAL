'use client';

// Conversión por kilates — tabla pública derivada del mismo snapshot diario de
// las 8 AM que alimenta LivePricesWidget. Recibe el snapshot bubbled up vía
// onData (PreciosClient) y nunca hace fetch propio, así que no puede divergir
// del precio del día. Los valores vienen ya calculados del servidor
// (/api/precios/live → buildKaratPrices en services/pricingService.ts) y se
// renderizan tal cual — el cliente no recalcula nada.
//
// Unidades (regla R5, encargo Precio de Referencia): la expresión "por gramo" nunca va sin "de oro fino".
// El precio de referencia de la tarjeta de arriba es por gramo de oro fino;
// estas cifras son por unidad DE MATERIAL (gramo o penique) al kilataje
// indicado — son números distintos y la nota introductoria los contrasta de
// forma explícita. Las columnas usan unidades compactas ("USD/g", "L/dwt") y
// el pie aclara que la ley nominal es aritmética de referencia, no un ensaye.
//
// Toggle gramo/penique: el penique (pennyweight, dwt = 1.55517384 g) es la
// unidad de uso corriente en la compra de oro artesanal — mismas tres columnas
// de valores, solo cambia la unidad. Sin animaciones continuas (DESIGN §4).

import { useState, type CSSProperties } from 'react';
import { type LivePrices } from './LivePricesWidget';

const SHADOW_SM = '0 2px 6px rgba(31,42,56,0.05)';

// Placeholder SOLO para el estado pre-carga: la ley nominal (kilates ÷ 24) se
// conoce estáticamente, así que la tabla ya tiene forma antes de que llegue el
// snapshot y los valores muestran "—". Una vez cargado, las filas salen de
// data.kilates (servidor) — no de esta lista — para que agregar un kilataje a
// GOLD_KARATS en services/pricingService.ts aparezca aquí sin tocar el cliente.
const KARATS_PLACEHOLDER = [16, 18, 20, 22] as const;

type Unit = 'g' | 'dwt';

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
  const [unit, setUnit] = useState<Unit>('g');

  // Servidor manda cuando hay datos; el placeholder sólo da forma pre-carga.
  // Los campos dwt pueden faltar en respuestas cacheadas previas al rollout de
  // peniques — esa fila muestra "—" en modo penique hasta que el cache expire.
  const rows = data?.kilates?.length
    ? data.kilates.map((r) => ({
        kilates: r.kilates,
        ley: r.ley,
        oro_usd: unit === 'g' ? r.oro_usd_g : (r.oro_usd_dwt ?? null),
        oro_lps: unit === 'g' ? r.oro_lps_g : (r.oro_lps_dwt ?? null),
        referencia_lps: unit === 'g' ? r.referencia_lps_g : (r.referencia_lps_dwt ?? null),
      }))
    : KARATS_PLACEHOLDER.map((k) => ({
        kilates: k,
        ley: k / 24,
        oro_usd: null as number | null,
        oro_lps: null as number | null,
        referencia_lps: null as number | null,
      }));

  const u = unit === 'g' ? t('g', 'g') : 'dwt';

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--slate)',
          }}
        >
          {t('Conversión por kilates', 'Karat conversion')}
        </span>

        {/* Toggle de unidad — gramo / penique (dwt) */}
        <div
          role="group"
          aria-label={t('Unidad de peso', 'Weight unit')}
          style={{
            display: 'inline-flex',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {(
            [
              ['g', t('Por gramo', 'Per gram')],
              ['dwt', t('Por penique (dwt)', 'Per pennyweight (dwt)')],
            ] as Array<[Unit, string]>
          ).map(([value, label]) => {
            const active = unit === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setUnit(value)}
                style={{
                  padding: '7px 12px',
                  border: 'none',
                  cursor: active ? 'default' : 'pointer',
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? '#fff' : 'var(--t2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--t2)',
          fontFamily: 'var(--font-body)',
          maxWidth: 640,
        }}
      >
        {t(
          'A diferencia del precio de referencia de arriba, que es por gramo de oro fino, estas cifras son por unidad del material al kilataje indicado: el oro contenido según su ley nominal (kilates ÷ 24). 1 penique (dwt) = 1.5552 g. Se derivan del mismo precio del día, capturado a las 8:00 a.m. (Honduras).',
          'Unlike the reference price above, which is per gram of fine gold, these figures are per unit of material at the stated karat: the gold it contains at its nominal fineness (karats ÷ 24). 1 pennyweight (dwt) = 1.5552 g. Derived from the same daily price, captured at 8:00 a.m. (Honduras).',
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
                {t(`Oro internacional (USD/${u})`, `International gold (USD/${u})`)}
              </th>
              <th scope="col" style={thStyle}>
                {t(`Oro internacional (L/${u})`, `International gold (L/${u})`)}
              </th>
              <th scope="col" style={{ ...thStyle, borderRadius: '0 8px 8px 0' }}>
                {t(`Referencia MAPE.LEGAL (L/${u})`, `MAPE.LEGAL reference (L/${u})`)}
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
                  {row.oro_usd != null ? `$${fmtNum(row.oro_usd)}` : '—'}
                </td>
                <td style={tdStyle}>
                  {row.oro_lps != null ? `L ${fmtNum(row.oro_lps)}` : '—'}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--earth)' }}>
                  {row.referencia_lps != null ? `L ${fmtNum(row.referencia_lps)}` : '—'}
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
