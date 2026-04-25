-- Migration: Rename all tables and domain columns to Spanish

-- 1. Tables
alter table phases             rename to fases;
alter table payments           rename to pagos;
alter table audit_logs         rename to registro_auditoria;
alter table phase_transitions  rename to transiciones_fase;
alter table expediente_phases  rename to expediente_fases;

-- 2. fases columns
alter table fases rename column name        to nombre;
alter table fases rename column order_index to orden;

-- 3. expedientes columns
alter table expedientes rename column name             to nombre;
alter table expedientes rename column current_phase_id to fase_actual_id;

-- 4. pagos columns
alter table pagos rename column phase_id to fase_id;
alter table pagos rename column amount   to monto;
alter table pagos rename column status   to estado;

-- 5. transiciones_fase columns
alter table transiciones_fase rename column from_phase_id to fase_origen_id;
alter table transiciones_fase rename column to_phase_id   to fase_destino_id;
alter table transiciones_fase rename column condition      to condicion;

-- Migrate condition key: requires_payment → requiere_pago
update transiciones_fase
set condicion = (condicion - 'requires_payment')
  || jsonb_build_object('requiere_pago', condicion -> 'requires_payment')
where condicion ? 'requires_payment';

-- 6. expediente_fases columns
alter table expediente_fases rename column phase_id    to fase_id;
alter table expediente_fases rename column entered_at  to entrada_en;
alter table expediente_fases rename column exited_at   to salida_en;
alter table expediente_fases rename column entered_by  to ingresado_por;

-- 7. registro_auditoria columns
alter table registro_auditoria rename column action to accion;
