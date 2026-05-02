-- 006: Roles, CMS content, system config, and notifications

-- ─── Dynamic roles table ─────────────────────────────────────────────────────
create table if not exists roles (
  id           uuid primary key default gen_random_uuid(),
  nombre       text unique not null,
  descripcion  text,
  permisos     jsonb not null default '[]',
  es_sistema   boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamp default now()
);

insert into roles (nombre, descripcion, permisos, es_sistema) values
  ('admin',             'Administrador con acceso completo',                          '["*"]',                                                                            true),
  ('abogado',           'Abogado CHT — gestión de expedientes',                       '["dashboard:read","expedientes:read","expedientes:write","documentos:verify"]',    true),
  ('tecnico_ambiental', 'Técnico Ambiental / PSA CHT — verificación documental',      '["dashboard:read","expedientes:read","mensajes:verify","documentos:verify"]',      true),
  ('cliente',           'Cliente/Minero — vista de su propio expediente',             '["portal:read"]',                                                                  true)
on conflict (nombre) do nothing;

-- ─── CMS content ─────────────────────────────────────────────────────────────
create table if not exists contenido_cms (
  id          uuid primary key default gen_random_uuid(),
  seccion     text not null,
  campo       text not null,
  valor       text,
  tipo        text not null default 'texto',  -- texto | html | imagen | url
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamp default now(),
  unique (seccion, campo)
);

-- Seed default landing page content (idempotent)
insert into contenido_cms (seccion, campo, valor, tipo) values
  ('hero',      'titulo',        'Formalización Minera en Honduras',                              'texto'),
  ('hero',      'subtitulo',     'Guiamos a mineros artesanales a través del proceso legal completo con certeza y transparencia.', 'texto'),
  ('hero',      'cta_primario',  'Iniciar trámite',                                              'texto'),
  ('hero',      'cta_secundario','Ver servicios',                                                'texto'),
  ('nosotros',  'titulo',        'Corporación Hondureña Tenka',                                  'texto'),
  ('nosotros',  'descripcion',   'Somos el primer operador privado autorizado en Honduras para gestionar permisos mineros MAPE de principio a fin.', 'texto'),
  ('contacto',  'direccion',     'Tegucigalpa, Honduras',                                        'texto'),
  ('contacto',  'email',         'gerencia@mape.legal',                                         'texto')
on conflict (seccion, campo) do nothing;

-- ─── System configuration ────────────────────────────────────────────────────
create table if not exists configuracion_sistema (
  clave       text primary key,
  valor       text,
  tipo        text not null default 'texto',  -- texto | secreto | url | boolean
  descripcion text,
  updated_at  timestamp default now()
);

insert into configuracion_sistema (clave, tipo, descripcion) values
  ('sendgrid_from_email',     'texto',   'Email remitente (ej: noreply@mape.legal)'),
  ('sendgrid_from_name',      'texto',   'Nombre del remitente en correos'),
  ('whatsapp_phone_display',  'texto',   'Número de WhatsApp visible (ej: +504 9999-0000)'),
  ('whatsapp_verify_token',   'secreto', 'Token de verificación para webhook Meta'),
  ('sistema_nombre',          'texto',   'Nombre del sistema'),
  ('sistema_url',             'url',     'URL base del sistema (ej: https://mape.legal)'),
  ('piloto_nombre',           'texto',   'Nombre del piloto activo (ej: Iriona 2026)'),
  ('tasa_bcH_usd',            'texto',   'Tipo de cambio HNL/USD (actualización manual)')
on conflict (clave) do nothing;

-- ─── Notifications log ───────────────────────────────────────────────────────
create table if not exists notificaciones (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid references expedientes(id) on delete cascade,
  destinatario_id uuid references auth.users(id) on delete set null,
  tipo            text not null,   -- email | whatsapp | interna
  asunto          text,
  cuerpo          text,
  estado          text not null default 'pendiente',  -- pendiente | enviado | fallido
  error           text,
  created_at      timestamp default now(),
  enviado_at      timestamp,
  constraint notificaciones_tipo_check  check (tipo   in ('email','whatsapp','interna')),
  constraint notificaciones_estado_check check (estado in ('pendiente','enviado','fallido'))
);

-- ─── RLS for new tables ──────────────────────────────────────────────────────
alter table roles                  enable row level security;
alter table contenido_cms          enable row level security;
alter table configuracion_sistema  enable row level security;
alter table notificaciones         enable row level security;

-- Roles: public read, admin write
create policy "Public read roles"
  on roles for select using (activo = true);

create policy "Admins manage roles"
  on roles for all
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo)
  );

-- CMS: public read (landing page), admin write
create policy "Public read cms"
  on contenido_cms for select using (true);

create policy "Admins manage cms"
  on contenido_cms for all
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo)
  );

-- Config: admin only
create policy "Admins manage config"
  on configuracion_sistema for all
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo)
  );

-- Notifications: admins and assigned professional
create policy "Admins manage notificaciones"
  on notificaciones for all
  using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.rol = 'admin' and ur.activo)
  );

create policy "Professionals read own notificaciones"
  on notificaciones for select
  using (destinatario_id = auth.uid());
