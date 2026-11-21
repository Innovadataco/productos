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
-- inv_precios (el servicio de precios): solo si el rol existe. Existe desde que Jelk corre crear-roles-prod.sh una vez
-- (lo crea siempre, NOLOGIN y sin clave mientras el archivo de producción no traiga INV_PRECIOS_DATABASE_URL); antes,
-- se omite con un aviso y el despliegue sigue igual (decisión del CEO: el migrador no depende de ese script). Parte
-- de cero en cada corrida y vuelve a dar solo esto, todo POR COLUMNA (lista única: tests/unit/produccion/permisos-precios.ts):
--   SELECT de las columnas que leen precios:actualizar (src/precios/actualizar.ts y guardar.ts) y actualizar-fondo
--          (src/fondo/actualizar.ts y clase.ts), medidas con el SQL que genera Prisma: de lote, solo "instrumentoId"
--          (el filtro de especies con lote); de la certificación, solo la fecha de corte y el precio de valoración
--          (las lee también el disparador precio_cierre_insercion, que es SECURITY INVOKER: sin ellas, falla cerrado);
--          de precio_cierre, todas (create() hace RETURNING de todas);
--   INSERT en precio_cierre y valor_unidad_fondo, sin "reemplazadoEn" (lo que inserta nace vigente);
--   UPDATE solo de "reemplazadoEn" en esas dos tablas (versionado y retiro).
-- Nada de usuario, órdenes, filas crudas, cantidades ni costos; sin DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL, y
-- sin privilegios por defecto: una tabla o columna nueva no le llega hasta que se agregue aquí.
-- Lo acotan los disparadores de la migración 20261121231049_precios_integridad (para todo rol que no sea dueño): un
-- VERIFICADO solo si cuadra con la certificación de A&V de ese día (y referencias y desviación exactas), solo la fuente
-- del servicio, sin precios sobre el tope ni días futuros; traidoEn y reemplazadoEn los pone la base; solo se retira un
-- vigente, nunca se reabre, se vuelve a fechar ni se borra, y al retirar no cambia otra columna.
-- Riesgo residual: quien tenga su clave puede insertar precios falsos NO_VERIFICADO en días sin certificación,
-- retirar vigentes (la historia queda) e insertar valores de unidad falsos: la base no puede comparar contra Yahoo
-- ni contra la SFC.
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

  -- inv_precios: solo si el rol existe (desde la primera corrida de crear-roles-prod.sh). Sin él, el despliegue sigue igual.
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
    RAISE NOTICE 'inv_precios no existe: se omiten sus privilegios (existe desde que se corre crear-roles-prod.sh una vez)';
  END IF;
END
$$;
