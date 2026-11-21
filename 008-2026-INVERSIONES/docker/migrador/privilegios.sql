-- Inversiones · privilegios de inv_app. Lo corre el migrador como inv_dueno (dueño de las tablas)
-- después de cada `migrate deploy`. Idempotente y en una sola transacción.
--
-- Mínimo privilegio: la app solo LEE (src/app solo lee), salvo lo que el login escribe (contrato del
-- frente login, migración 20261121041537_login), por COLUMNA:
--   usuario         UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta"); también SELECT … FOR UPDATE
--   token_acceso    UPDATE ("usadoEn"); también SELECT … FOR UPDATE OF t
--   intento_ingreso INSERT
-- Nunca TRUNCATE, REFERENCES, TRIGGER ni DDL. Sin UPDATE ni DELETE en las tablas de solo inserción,
-- `SET LOCAL inv.reversion = 'on'` no le sirve a inv_app para saltarse sus disparadores.
-- inv_dueno, el dueño, crea usuarios y tokens (crear-acceso-inicial.ts) y corre las cargas (Trii, precios,
-- fondo, plan), todo en el migrador.
-- Sin condiciones: si faltan las tablas o las columnas del login, el GRANT falla y el despliegue se detiene.
DO $$
DECLARE
  t record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_app') THEN
    RAISE EXCEPTION 'Falta el rol inv_app: corra scripts/crear-roles-prod.sh antes de migrar';
  END IF;

  -- Se parte de cero en cada tabla y vista del esquema y se vuelve a dar solo lo permitido.
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_app', t.relname);
    IF t.relname <> '_prisma_migrations' THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO inv_app', t.relname);
    END IF;
  END LOOP;

  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_app', t.relname);
    EXECUTE format('GRANT USAGE ON SEQUENCE public.%I TO inv_app', t.relname);
  END LOOP;

  -- Escrituras del login (contrato con el frente login), por columna.
  GRANT UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") ON TABLE public.usuario TO inv_app;
  GRANT UPDATE ("usadoEn") ON TABLE public.token_acceso TO inv_app;
  GRANT INSERT ON TABLE public.intento_ingreso TO inv_app;

  -- TOTP (contrato del frente TOTP). PREPARADO y comentado: lo descomenta ese frente en el mismo PR que
  -- trae su migración. Hoy esas tablas y columnas no existen y un GRANT sobre ellas falla cerrado.
  -- (SELECT de codigo_recuperacion ya lo da el bucle de arriba; inv_dueno, el dueño, tiene todo.)
  --   GRANT INSERT ON TABLE public.codigo_recuperacion TO inv_app;
  --   GRANT UPDATE ("usadoEn", "anuladoEn") ON TABLE public.codigo_recuperacion TO inv_app;
  --   GRANT UPDATE ("totpSecreto", "totpActivadoEn", "totpUltimoPaso", "presesionHash") ON TABLE public.usuario TO inv_app;
END
$$;
