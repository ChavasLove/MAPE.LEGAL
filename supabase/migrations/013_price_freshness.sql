-- 013: Price freshness tracking
-- Add fetched_at timestamp to precios_diarios so we can distinguish
-- "stored today but with stale upstream data" from genuinely fresh prices.

alter table precios_diarios add column if not exists fetched_at timestamptz;

-- Vista para monitorear frescura de precios
create or replace view precios_frescura as
select
  fecha,
  oro,
  usd_hnl,
  fuente,
  fetched_at,
  created_at,
  case
    when fetched_at is null then 'DESCONOCIDO'
    when created_at > fetched_at + interval '5 minutes' then 'STORE_DELAYED'
    else 'OK'
  end as estado_frescura
from precios_diarios
order by fecha desc;
