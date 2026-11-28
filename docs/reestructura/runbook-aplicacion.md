# Runbook — cómo se aplicaría la reestructura (después de revisar)

Documento **interno**. **Nada de esto se ha ejecutado.** Lo ejecuta Willis, o
quien él designe, después de revisar y aprobar el PR. Las migraciones no se
aplican solas: el despliegue en Vercel no ejecuta SQL.

## 0. Antes de empezar

1. **Respaldo** de la base. Sin respaldo no se aplica nada.
2. El PR #245 debe estar resuelto: este trabajo está apilado sobre él.
3. Las migraciones 041, 042, 043 y 044 deben estar aplicadas y verificadas
   (ver `docs/estandar-privado-v2-bd.md` §0). La 045 falla a propósito si falta
   la 043.

## 1. Orden de aplicación

En Supabase Studio → SQL Editor, un archivo a la vez, en este orden. Cada uno se
puede volver a ejecutar sin efectos secundarios.

| # | Archivo | Comprobación inmediata |
|---|---|---|
| 1 | `045_acceso_otp_y_roles.sql` | `select pg_get_constraintdef(oid) from pg_constraint where conname = 'user_roles_rol_check';` debe listar `verificador` y `recepcion` |
| 2 | `046_perfiles_aprobacion.sql` | `select tgname from pg_trigger where tgrelid = 'public.lotes'::regclass and not tgisinternal order by tgname;` — `lote_evaluar_elegibilidad` antes de `lote_exigir_perfil_aprobado` |
| 3 | `047_recepcion_custodia.sql` | `select public.verificar_cadena_lote('<uuid de un lote existente>');` debe seguir dando `ok: true` |
| 4 | `048_organizaciones_membresias.sql` | `select column_name from information_schema.column_privileges where table_name = 'invitaciones_organizacion' and grantee = 'authenticated';` no debe incluir `token_hash` |
| 5 | `049_documentos_respaldo_rag_acl.sql` | `select grantee from information_schema.role_table_grants where table_name = 'documentos_fragmentos';` solo `service_role` |

Al final de cada archivo hay una sección "Verificación post-aplicación" con más
consultas de solo lectura.

### Efecto de la 046 que hay que decidir antes

Al aplicar la 046, **ningún titular existente tiene perfil**, así que no se
pueden crear lotes nuevos hasta que el personal cargue los perfiles y un
verificador los apruebe. Los lotes ya creados no cambian. **[POR CONFIRMAR]** si
los titulares existentes se cargan como aprobados en un acto único y
documentado; esa carga no está escrita.

## 2. Variables de entorno (solo nombres)

Se configuran en Vercel. Los valores no están en el repositorio.

| Variable | Para qué | Obligatoria |
|---|---|---|
| `AUTH_OTP_PEPPER` | Clave del HMAC con el que se identifica el control de cada correo. Al menos 16 caracteres aleatorios | Sí, para el acceso por código. Sin ella las rutas responden 500 y el acceso con contraseña sigue igual |
| `RESPALDO_DRIVE_HABILITADO` | `true` enciende el respaldo en Drive | No. Apagado por defecto |
| `GOOGLE_DRIVE_RESPALDO_FOLDER_ID` | Carpeta de destino | Solo si se enciende |
| `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | Cuenta de servicio (alcance mínimo `drive.file`) | Solo si se enciende |

## 3. Tareas manuales del acceso por código (OTP)

El código lo emite y lo canjea Supabase Auth. En el panel de Supabase
(Authentication), **no en el repositorio**:

1. **Longitud del código:** debe ser de 6 dígitos, igual que `OTP_CONFIG.longitud`.
2. **Vigencia del código en Supabase:** puede quedar más larga que la propia; la
   plataforma impone la suya (propuesta: 10 minutos) en `auth_otp_control`.
3. **Probar con un proyecto real antes de anunciarlo.** No había Supabase en el
   entorno de desarrollo, así que quedan dos puntos sin verificar en ejecución:
   - que `auth.admin.generateLink({ type: 'magiclink' })` devuelve `email_otp`
     para una cuenta existente;
   - que `auth.verifyOtp({ email, token, type: 'email' })` canjea ese código.
     Si el proyecto exige otro tipo, se cambia una línea en
     `lib/auth/otpSupabase.ts`.
4. Los valores propuestos (10 minutos, 5 intentos, 60 segundos de espera,
   6 dígitos) están en un solo lugar, `lib/auth/otp.ts`, y son **[POR CONFIRMAR]**.

## 4. Respaldo en Google Drive

Hoy está "en implementación": existe la interfaz, el adaptador en memoria para
pruebas y el esqueleto del adaptador de Drive, apagado. Para conectarlo hace
falta decidir carpeta, propietario, política de retención, cuenta de servicio y
alcance (**[POR CONFIRMAR]**) y completar `RespaldoGoogleDrive` en
`lib/documentos/respaldo.ts`. Hasta entonces la subida responde "en
implementación" y no se guarda nada.

## 5. Primeros datos, en orden

1. Asignar los roles `verificador` y `recepcion` desde `/admin/roles` (solo admin).
2. Dar de alta el laboratorio como organización de tipo `laboratorio`.
3. Crear los puntos de recepción y, si se quiere, las partes del flujo.
4. Cargar perfiles (personal) y aprobarlos (verificador distinto).
5. Recién entonces registrar recepciones.

## 6. Seguridad — tareas manuales pendientes

- Hacer privado el repositorio.
- Rotar `MARIA_ADMIN_PASSPHRASE`, las claves de Twilio, `APP_SECRET` y
  `CRON_SECRET`.

## 7. Si algo sale mal

Cada migración trae su "PLAN DE REVERSA" en la cabecera. Las tablas de
evidencia (bitácoras, aprobaciones, recepciones, membresías) no se eliminan:
se deja de escribir en ellas.
