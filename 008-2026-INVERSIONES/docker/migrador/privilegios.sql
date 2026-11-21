-- Inversiones · privilegios de inv_app y de inv_precios. Lo corre el migrador como inv_dueno (dueño de las tablas)
-- después de cada `migrate deploy`. Idempotente y en una sola transacción.
--
-- Mínimo privilegio: la app solo LEE (src/app solo lee), salvo lo que escriben el login (contrato del
-- frente login, migración 20261121050319_login) y el TOTP (migración 20261121060000_totp), por COLUMNA:
--   usuario             UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") y, del TOTP, ("totpSecreto",
--                       "totpActivadoEn", "totpUltimoPaso", "presesionHash"); también SELECT … FOR UPDATE
--   token_acceso        UPDATE ("usadoEn"); también SELECT … FOR UPDATE OF t
--   intento_ingreso     INSERT
--   codigo_recuperacion INSERT y UPDATE ("usadoEn", "anuladoEn") (un disparador admite una sola marca)
-- Nunca TRUNCATE, REFERENCES, TRIGGER ni DDL. Sin UPDATE ni DELETE en las tablas de solo inserción,
-- `SET LOCAL inv.reversion = 'on'` no le sirve a inv_app para saltarse sus disparadores.
-- El UPDATE por columna de usuario lo acota el disparador usuario_transiciones (migración
-- 20261121100100_usuario_transiciones_checks): sesionVersion nunca baja, cambiar o quitar la clave y apagar
-- el TOTP exigen subirla, y el último paso del TOTP nunca baja.
-- inv_dueno, el dueño, crea usuarios y tokens (crear-acceso-inicial.ts) y corre las cargas (Trii, precios,
-- fondo, plan), todo en el migrador.
-- Sin condiciones: si faltan las tablas o las columnas del login o del TOTP, el GRANT falla y el despliegue
-- se detiene.
--
-- inv_precios (el servicio de precios): solo si el rol existe (lo crea crear-roles-prod.sh cuando el archivo de
-- producción trae INV_PRECIOS_DATABASE_URL); si no, se omite con un aviso y el despliegue sigue igual. Parte de cero
-- en cada corrida y vuelve a dar solo esto, todo POR COLUMNA (lista única: tests/unit/produccion/permisos-precios.ts):
--   SELECT de las columnas que leen precios:actualizar (src/precios/actualizar.ts y guardar.ts) y actualizar-fondo
--          (src/fondo/actualizar.ts y clase.ts), medidas con el SQL que genera Prisma: de lote, solo "instrumentoId"
--          (el filtro de especies con lote); de la certificación, solo la fecha de corte y el precio de valoración;
--          de precio_cierre, todas (create() hace RETURNING de todas);
--   INSERT en precio_cierre y valor_unidad_fondo, sin "reemplazadoEn" (lo que inserta nace vigente);
--   UPDATE solo de "reemplazadoEn" en esas dos tablas (versionado y retiro).
-- Nada de usuario, órdenes, filas crudas, cantidades ni costos; sin DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL, y
-- sin privilegios por defecto: una tabla o columna nueva no le llega hasta que se agregue aquí.
-- Riesgo conocido: con UPDATE de "reemplazadoEn" puede retirar o reabrir vigentes (no hay disparador que lo acote).
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

  -- Escrituras del TOTP (contrato del frente TOTP, migración 20261121060000_totp), por columna. Sin DELETE:
  -- los códigos de recuperación no se borran, se marcan. (SELECT de codigo_recuperacion lo da el bucle de
  -- arriba; `--reiniciar-totp` corre como inv_dueno, el dueño, en el migrador.)
  GRANT INSERT ON TABLE public.codigo_recuperacion TO inv_app;
  GRANT UPDATE ("usadoEn", "anuladoEn") ON TABLE public.codigo_recuperacion TO inv_app;
  GRANT UPDATE ("totpSecreto", "totpActivadoEn", "totpUltimoPaso", "presesionHash") ON TABLE public.usuario TO inv_app;

  -- inv_precios: opcional. Sin el rol, el despliegue sigue igual.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios') THEN
    FOR t IN
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_precios', t.relname);
    END LOOP;
    FOR t IN
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S'
    LOOP
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_precios', t.relname);
    END LOOP;

    -- Lecturas: las especies y los fondos, sus símbolos y clases, el calendario y el precio de valoración del corte.
    GRANT SELECT (id, tipo, nemotecnico, activo, "codigoFic") ON TABLE public.instrumento TO inv_precios;
    GRANT SELECT ("instrumentoId") ON TABLE public.lote TO inv_precios;
    GRANT SELECT (id, "instrumentoId", proveedor, simbolo, "vigenteDesde", "vigenteHasta") ON TABLE public.simbolo_precio TO inv_precios;
    GRANT SELECT (dia, "esHabil") ON TABLE public.calendario_bvc TO inv_precios;
    GRANT SELECT (id, "fechaCorte") ON TABLE public.certificacion TO inv_precios;
    GRANT SELECT ("certificacionId", "instrumentoId", "precioValoracion") ON TABLE public.certificacion_posicion TO inv_precios;

    -- Cierres diarios (camino único de escritura, src/precios/guardar.ts).
    GRANT SELECT (id, "instrumentoId", fecha, precio, fuente, estado, "fuenteReferencia", "precioReferencia", "desviacionPct", "traidoEn", "reemplazadoEn", moneda) ON TABLE public.precio_cierre TO inv_precios;
    GRANT INSERT (id, "instrumentoId", fecha, precio, fuente, estado, "fuenteReferencia", "precioReferencia", "desviacionPct", "traidoEn", moneda) ON TABLE public.precio_cierre TO inv_precios;
    GRANT UPDATE ("reemplazadoEn") ON TABLE public.precio_cierre TO inv_precios;

    -- Valor de unidad del fondo (src/fondo/actualizar.ts).
    GRANT SELECT (id, "fondoId", "fechaValor", "valorUnidad", "valorFondo", "reemplazadoEn") ON TABLE public.valor_unidad_fondo TO inv_precios;
    GRANT INSERT (id, "fondoId", "fechaValor", "valorUnidad", "valorFondo", fuente, "traidoEn") ON TABLE public.valor_unidad_fondo TO inv_precios;
    GRANT UPDATE ("reemplazadoEn") ON TABLE public.valor_unidad_fondo TO inv_precios;
  ELSE
    RAISE NOTICE 'inv_precios no existe: se omiten sus privilegios (crear-roles-prod.sh lo crea cuando el archivo de producción trae su URL)';
  END IF;
END
$$;
