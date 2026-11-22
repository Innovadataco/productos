-- Inversiones · privilegios de inv_app, de inv_precios y de inv_ia. Lo corre el migrador como inv_dueno (dueño de las tablas)
-- después de cada `migrate deploy`. Idempotente y en una sola transacción.
--
-- Mínimo privilegio: la app LEE, salvo lo que escriben el login (contrato del frente login, migración
-- 20261121050319_login) y el TOTP (migración 20261121060000_totp), por COLUMNA, y el área de edición del plan:
--   usuario             UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") y, del TOTP, ("totpSecreto",
--                       "totpActivadoEn", "totpUltimoPaso", "presesionHash"); también SELECT … FOR UPDATE
--   token_acceso        UPDATE ("usadoEn"); también SELECT … FOR UPDATE OF t
--   intento_ingreso     INSERT
--   codigo_recuperacion INSERT y UPDATE ("usadoEn", "anuladoEn") (un disparador admite una sola marca)
--   plan_version, regla_plan, decision y enlace_decision_orden: solo INSERT, por COLUMNA y con todas las columnas de
--                       cada tabla MENOS sus instantes (fase B, el dueño edita el plan y el diario desde la web; migración
--                       20261121024044_plan_decisiones). Por columna, así una columna nueva no le llega hasta que se
--                       agregue aquí (falla cerrada). Son de solo inserción por sus disparadores: una versión nueva
--                       reemplaza entera a la anterior y una decisión se corrige con otra que la reemplaza. El candado
--                       de una decisión es consultivo (src/plan/bloqueos.ts): sin UPDATE, `SELECT … FOR UPDATE` no le
--                       está permitido. Quién escribe lo decide el guardián del dueño en cada ruta (exigirDuenoApi); la
--                       familia no. Los instantes ("creadaEn", "registradaEn", "creadoEn") los pone la base (migración
--                       20261122152704_instantes_base: DEFAULT clock_timestamp(), que Prisma ya no pisa porque el esquema
--                       los declara `dbgenerated`, y un disparador que los fija para todo rol que no sea el dueño): inv_app
--                       no los puede nombrar (42501), así que no puede antedatar nada. Riesgo residual: con la clave de
--                       inv_app se pueden insertar versiones, reglas, decisiones y enlaces falsos (con un autor que
--                       exista), con el id, el número de versión, la fecha de la decisión y la vigencia que quiera (una
--                       versión con un número mayor y una vigencia pasada pasa a ser la vigente de esos días: la app lo
--                       impide, VIGENCIA_RETROCEDE, la base no); lo que no puede es mentir sobre cuándo se registraron, y
--                       ese instante lo delata. Nada de lo que ya está se edita ni se borra.
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
--          (el filtro de especies con lote); de la certificación, solo la fecha de corte, si está retirada (la referencia
--          es solo la vigente) y el precio de valoración (las lee también el disparador precio_cierre_insercion, que es
--          SECURITY INVOKER: sin ellas, falla cerrado);
--          de precio_cierre, todas (create() hace RETURNING de todas);
--   INSERT en precio_cierre y valor_unidad_fondo, sin "reemplazadoEn" (lo que inserta nace vigente);
--   UPDATE solo de "reemplazadoEn" en esas dos tablas (versionado y retiro).
-- Nada de usuario, órdenes, filas crudas, cantidades ni costos; sin DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL, y
-- sin privilegios por defecto: una tabla o columna nueva no le llega hasta que se agregue aquí.
-- Lo acotan los disparadores de la migración 20261121231049_precios_integridad (para todo rol que no sea dueño): un
-- VERIFICADO solo si cuadra con la certificación de A&V de ese día (y referencias y desviación exactas), solo la fuente
-- del servicio, sin precios sobre el tope ni días futuros; traidoEn y reemplazadoEn los pone la base; solo se retira un
-- vigente, nunca se reabre, se vuelve a fechar ni se borra, y al retirar no cambia otra columna.
-- Riesgo residual: con su clave, un precio falso dentro del ±1 % de la valoración de A&V entra como VERIFICADO (la base
-- lo recalcula con el precio que recibe); se pueden insertar precios falsos NO_VERIFICADO, también en días con
-- certificación, de cualquier instrumento; retirar vigentes de cualquier fuente, también en masa y sin sucesor (la
-- historia queda, pero la valoración se queda sin cierre), e insertar valores de unidad falsos dentro del rango de la
-- SFC: la base no puede comparar contra Yahoo ni contra la SFC.
--
-- inv_ia (el servicio de los resúmenes con IA, fase E): solo si el rol existe, como inv_precios (existe desde que Jelk
-- corre crear-roles-prod.sh, NOLOGIN y sin clave mientras el archivo de producción no traiga INV_IA_DATABASE_URL; antes,
-- se omite con un aviso). Parte de cero en cada corrida y vuelve a dar solo esto, todo POR COLUMNA (lista única:
-- tests/unit/ia/registro/permisos-ia.ts):
--   SELECT de las columnas que leen los lectores de las entradas de los armadores de hechos (el tablero y su evolución,
--          la última conciliación, las series oficiales, los cierres, el calendario, los decretos, las proyecciones y la
--          historia del fondo), medidas con el SQL que genera Prisma, y de la versión vigente del plan y sus reglas SIN la
--          acción, la cantidad, el detalle ni el motivo (los lectores de la página del plan sí los leen: con inv_ia dan
--          42501, y el servicio lee con su propio `select`); de resumen_ia, solo lo de yaPublicado (la clave),
--          gastoDelMes (la puerta, la hora y los tokens) y el RETURNING (id y hora): ni el texto, ni la salida, ni los
--          hechos guardados (los lee la pantalla, inv_app, con ultimoPublicado);
--   INSERT en resumen_ia de todas sus columnas menos "generadoEn" (la pone la base: migración 20261122175656_resumen_ia).
-- Nada de usuario, filas crudas (crudo), el encargo, la certificación por especie, la caja, los símbolos ni el diario;
-- sin UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL, y sin privilegios por defecto: una tabla o columna nueva no le
-- llega hasta que se agregue aquí. resumen_ia es de solo inserción por su disparador.
-- Riesgo residual de inv_ia: con su clave se leen las cifras del portafolio (cantidades, costos, dividendos, cierres) y se
-- pueden insertar resúmenes falsos (un PUBLICADO con un texto cualquiera y un paquete que cuadre consigo mismo, o tokens
-- de más o de menos para el tope de la nube); no se puede editar, borrar ni fechar ninguno.
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

  -- Escrituras del plan y del diario (área de edición, fase B): solo INSERT, por columna (todas las de cada tabla menos los
  -- instantes, que pone la base; Prisma ya no los manda). Nada se edita ni se borra. (El RETURNING, también el de los
  -- instantes, lo cubre el SELECT de arriba.) El REVOKE ALL de cada tabla quita también los permisos de columna viejos.
  GRANT INSERT (id, version, "vigenteDesde", motivo, "aprobadaPorId") ON TABLE public.plan_version TO inv_app;
  GRANT INSERT (id, "planVersionId", "instrumentoId", condicion, nivel, accion, cantidad, "plazoHasta", detalle) ON TABLE public.regla_plan TO inv_app;
  GRANT INSERT (id, "planVersionId", "reglaId", "instrumentoId", accion, cantidad, excepcion, motivo, "decididaPorId", "fechaDecision", "reemplazaId") ON TABLE public.decision TO inv_app;
  GRANT INSERT (id, "ordenId", "decisionId", "reemplazaId", motivo, "creadoPorId") ON TABLE public.enlace_decision_orden TO inv_app;

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
    GRANT SELECT (id, "fechaCorte", "retiradaEn") ON TABLE public.certificacion TO inv_precios;
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

  -- inv_ia: solo si el rol existe (desde la primera corrida de crear-roles-prod.sh). Sin él, el despliegue sigue igual.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_ia') THEN
    FOR t IN
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM inv_ia', t.relname);
    END LOOP;
    FOR t IN
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S'
    LOOP
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM inv_ia', t.relname);
    END LOOP;

    -- Lecturas de los armadores de hechos y del registro, y la única escritura: INSERT en resumen_ia sin "generadoEn".
    GRANT SELECT (id, "ordenVentaId", "loteId", cantidad, "costoBase") ON TABLE public.asignacion_venta TO inv_ia;
    GRANT SELECT (dia, "esHabil") ON TABLE public.calendario_bvc TO inv_ia;
    GRANT SELECT ("tipoFuente", estado, "cargadoEn", "revertidaEn") ON TABLE public.carga_archivo TO inv_ia;
    GRANT SELECT (id, "fechaCorte", "retiradaEn") ON TABLE public.certificacion TO inv_ia;
    GRANT SELECT (id, "certificacionId", "fechaCorte", "calculadaEn", resultado) ON TABLE public.conciliacion TO inv_ia;
    GRANT SELECT (id, "instrumentoId", tipo, "fechaPago", "montoNeto", "decretadoId") ON TABLE public.dividendo TO inv_ia;
    GRANT SELECT (id, "instrumentoId", tipo, cuota, "valorPorAccion", "fechaAnuncio", "fechaEx", "fechaPago", "referenciaOficial", version, anulada, "reemplazadoEn") ON TABLE public.dividendo_decretado TO inv_ia;
    GRANT SELECT (id, tipo, fecha, "origenId", "destinoId", razon) ON TABLE public.evento_corporativo TO inv_ia;
    GRANT SELECT (id, tipo, nemotecnico, nombre) ON TABLE public.instrumento TO inv_ia;
    GRANT SELECT (id, "instrumentoId", "fechaCompra", cantidad, "costoTotal", "ordenId", origen) ON TABLE public.lote TO inv_ia;
    GRANT SELECT (id, "fondoId", fecha, unidades, tipo) ON TABLE public.movimiento_fondo TO inv_ia;
    GRANT SELECT (id, "instrumentoId", lado, estado, "fechaOperacion", "cantidadCompletada", "totalInvertido", "totalEstimado", comision) ON TABLE public.orden TO inv_ia;
    GRANT SELECT (id, version, "vigenteDesde", "creadaEn") ON TABLE public.plan_version TO inv_ia;
    GRANT SELECT (id, "instrumentoId", fecha, precio, fuente, estado, "traidoEn", "reemplazadoEn") ON TABLE public.precio_cierre TO inv_ia;
    GRANT SELECT (id, "planVersionId", "instrumentoId", condicion, nivel, "plazoHasta") ON TABLE public.regla_plan TO inv_ia;
    GRANT SELECT (id, tipo, "fechaNegocio", estado, puerta, "hechosHash", "promptHash", "modeloDigest", "tokensEntrada", "tokensSalida", "generadoEn") ON TABLE public.resumen_ia TO inv_ia;
    GRANT INSERT (id, tipo, "fechaNegocio", estado, puerta, texto, "salidaModelo", hechos, "hechosHash", "hechosVersion", modelo, "modeloDigest", opciones, "promptVersion", "promptHash", "validadorVersion", motivos, "latenciaMs", "tokensEntrada", "tokensSalida") ON TABLE public.resumen_ia TO inv_ia;
    GRANT SELECT (id, serie, desde, hasta, valor, fuente, "traidoEn", "reemplazadoEn") ON TABLE public.valor_serie_oficial TO inv_ia;
    GRANT SELECT (id, "fondoId", "fechaValor", "valorUnidad", "reemplazadoEn") ON TABLE public.valor_unidad_fondo TO inv_ia;
  ELSE
    RAISE NOTICE 'inv_ia no existe: se omiten sus privilegios (existe desde que se corre crear-roles-prod.sh una vez)';
  END IF;
END
$$;
