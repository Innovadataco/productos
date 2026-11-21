-- Inversiones · guardián del esquema. Lo corre el migrador (docker/migrar.sh) después de
-- `prisma migrate deploy` y antes de levantar la app: si falta o cambió un objeto, aborta y no se sirve.
--
-- Prisma no ve lo escrito a mano en las migraciones. Este guardián exige, en la base real:
--  - cada índice parcial con su definición exacta (pg_get_indexdef), único si lo es;
--  - cada CHECK y EXCLUDE con su definición exacta (pg_get_constraintdef) y validado;
--  - cada disparador en su tabla (tgrelid), con su tipo (tgtype 27 = BEFORE UPDATE OR DELETE, por fila),
--    su función y habilitado (tgenabled O o A; D es deshabilitado);
--  - las funciones escritas a mano (solo inserción y token de un solo uso) con el md5 exacto de su código;
--  - las extensiones btree_gist y citext.
-- Las definiciones son las canónicas de PostgreSQL 16 (sacadas de una base recién migrada). La lista de
-- nombres sale de prisma/migrations: tests/unit/produccion/verificar-esquema.test.ts exige que coincida, y
-- roles-base.test.ts corre este guardián contra PostgreSQL real en el CI (y lo rompe a propósito).
DO $$
DECLARE
  indices_parciales text[] := ARRAY[
    ['enlace_decision_orden', 'enlace_decision_orden_raiz_key', 'CREATE UNIQUE INDEX enlace_decision_orden_raiz_key ON public.enlace_decision_orden USING btree ("ordenId") WHERE ("reemplazaId" IS NULL)'],
    ['evento_corporativo', 'evento_corporativo_pago_fraccion_key', 'CREATE UNIQUE INDEX evento_corporativo_pago_fraccion_key ON public.evento_corporativo USING btree ("destinoId", "fechaPagoFraccion") WHERE ("fechaPagoFraccion" IS NOT NULL)'],
    ['intento_ingreso', 'intento_ingreso_fallos_ip_idx', 'CREATE INDEX intento_ingreso_fallos_ip_idx ON public.intento_ingreso USING btree (ip, "ocurridoEn") WHERE (resultado <> ALL (ARRAY[''EXITO''::"ResultadoIngreso", ''CLAVE_DEFINIDA''::"ResultadoIngreso"]))'],
    ['intento_ingreso', 'intento_ingreso_ultimo_exito_idx', 'CREATE INDEX intento_ingreso_ultimo_exito_idx ON public.intento_ingreso USING btree ("usuarioId", "ocurridoEn" DESC) WHERE (resultado = ANY (ARRAY[''EXITO''::"ResultadoIngreso", ''CLAVE_DEFINIDA''::"ResultadoIngreso"]))'],
    ['lote', 'lote_escision_evento_key', 'CREATE UNIQUE INDEX lote_escision_evento_key ON public.lote USING btree ("eventoId") WHERE (origen = ''ESCISION''::"OrigenLote")'],
    ['precio_cierre', 'precio_cierre_vigente_key', 'CREATE UNIQUE INDEX precio_cierre_vigente_key ON public.precio_cierre USING btree ("instrumentoId", fecha, fuente) WHERE ("reemplazadoEn" IS NULL)'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_vigente_key', 'CREATE UNIQUE INDEX valor_unidad_fondo_vigente_key ON public.valor_unidad_fondo USING btree ("fondoId", "fechaValor") WHERE ("reemplazadoEn" IS NULL)']
  ];
  restricciones text[] := ARRAY[
    ['ajuste_caja', 'ajuste_caja_fraccion_chk', 'CHECK (((categoria = ''FRACCION_ESCISION''::"CategoriaAjusteCaja") = ("eventoId" IS NOT NULL)))'],
    ['ajuste_caja', 'ajuste_caja_monto_chk', 'CHECK ((monto <> (0)::numeric))'],
    ['asignacion_venta', 'asignacion_venta_cantidad_chk', 'CHECK (((cantidad > 0) AND ("costoBase" >= (0)::numeric)))'],
    ['decision', 'decision_cantidad_chk', 'CHECK ((((cantidad IS NULL) OR (cantidad > 0)) AND ((accion <> ''NO_ACTUAR''::"AccionPlan") OR (cantidad IS NOT NULL))))'],
    ['decision', 'decision_excepcion_chk', 'CHECK (((NOT excepcion) OR ("reglaId" IS NOT NULL)))'],
    ['decision', 'decision_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['decision', 'decision_reemplazo_chk', 'CHECK ((("reemplazaId" IS NULL) OR ("reemplazaId" <> id)))'],
    ['dividendo', 'dividendo_bruto_chk', 'CHECK ((("montoBruto" IS NULL) OR ((retencion IS NOT NULL) AND (("montoBruto" - retencion) = "montoNeto"))))'],
    ['dividendo_decretado', 'dividendo_decretado_valor_chk', 'CHECK (("valorPorAccion" > (0)::numeric))'],
    ['dividendo', 'dividendo_fraccion_chk', 'CHECK (((tipo = ''FRACCION_ESCISION''::"TipoDividendo") = ("eventoId" IS NOT NULL)))'],
    ['dividendo', 'dividendo_neto_chk', 'CHECK (("montoNeto" > (0)::numeric))'],
    ['enlace_decision_orden', 'enlace_decision_orden_motivo_chk', 'CHECK (((motivo IS NULL) OR (char_length(motivo) <= 2000)))'],
    ['enlace_decision_orden', 'enlace_decision_orden_reemplazo_chk', 'CHECK ((("reemplazaId" IS NULL) OR (("reemplazaId" <> id) AND (motivo IS NOT NULL) AND (motivo ~ ''[^[:space:]]''::text))))'],
    ['fila_fuente', 'fila_fuente_ocurrencia_chk', 'CHECK ((ocurrencia >= 1))'],
    ['instrumento', 'instrumento_tipo_chk', 'CHECK ((((tipo = ''ACCION''::"TipoInstrumento") AND (nemotecnico IS NOT NULL)) OR ((tipo = ''FIC''::"TipoInstrumento") AND ("codigoFic" IS NOT NULL))))'],
    ['intento_ingreso', 'intento_ingreso_usuario_chk', 'CHECK ((((resultado = ''USUARIO_INEXISTENTE''::"ResultadoIngreso") AND ("usuarioId" IS NULL)) OR (resultado = ''TOKEN_INVALIDO''::"ResultadoIngreso") OR ((resultado <> ALL (ARRAY[''USUARIO_INEXISTENTE''::"ResultadoIngreso", ''TOKEN_INVALIDO''::"ResultadoIngreso"])) AND ("usuarioId" IS NOT NULL))))'],
    ['lote', 'lote_cantidad_chk', 'CHECK (((cantidad > 0) AND ("costoUnitario" >= (0)::numeric) AND ("costoTotal" >= (0)::numeric) AND (comision >= (0)::numeric)))'],
    ['lote', 'lote_origen_chk', 'CHECK ((((origen = ''COMPRA''::"OrigenLote") AND ("ordenId" IS NOT NULL) AND ("eventoId" IS NULL) AND ("loteOrigenId" IS NULL)) OR ((origen = ''ESCISION''::"OrigenLote") AND ("ordenId" IS NULL) AND ("eventoId" IS NOT NULL) AND ("loteOrigenId" IS NOT NULL))))'],
    ['movimiento_caja', 'movimiento_caja_monto_chk', 'CHECK ((monto > (0)::numeric))'],
    ['orden', 'orden_aprobada_precio_chk', 'CHECK (((estado <> ''APROBADO''::"EstadoOrden") OR ("precioUnitario" > (0)::numeric)))'],
    ['orden', 'orden_cantidades_chk', 'CHECK ((("cantidadCompletada" >= 0) AND ("cantidadPendiente" >= 0)))'],
    ['orden', 'orden_montos_chk', 'CHECK ((("precioUnitario" >= (0)::numeric) AND ("totalInvertido" >= (0)::numeric) AND (comision >= (0)::numeric) AND ("totalEstimado" >= (0)::numeric)))'],
    ['plan_version', 'plan_version_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['plan_version', 'plan_version_version_chk', 'CHECK ((version >= 1))'],
    ['precio_cierre', 'precio_cierre_precio_chk', 'CHECK ((precio > (0)::numeric))'],
    ['regla_plan', 'regla_plan_cantidad_chk', 'CHECK (((cantidad IS NULL) OR (cantidad > 0)))'],
    ['regla_plan', 'regla_plan_detalle_chk', 'CHECK (((detalle ~ ''[^[:space:]]''::text) AND (char_length(detalle) <= 2000)))'],
    ['regla_plan', 'regla_plan_nivel_chk', 'CHECK ((((condicion = ANY (ARRAY[''NINGUNA''::"CondicionRegla", ''LIBRE''::"CondicionRegla"])) = (nivel IS NULL)) AND ((nivel IS NULL) OR (nivel > (0)::numeric))))'],
    ['simbolo_precio', 'simbolo_precio_sin_solape_excl', 'EXCLUDE USING gist ("instrumentoId" WITH =, proveedor WITH =, daterange("vigenteDesde", "vigenteHasta", ''[)''::text) WITH &&)'],
    ['simbolo_precio', 'simbolo_precio_vigencia_chk', 'CHECK ((("vigenteHasta" IS NULL) OR ("vigenteHasta" > "vigenteDesde")))'],
    ['token_acceso', 'token_acceso_hash_chk', 'CHECK (("tokenHash" ~ ''^[0-9a-f]{64}$''::text))'],
    ['token_acceso', 'token_acceso_vence_chk', 'CHECK ((("venceEn" > "creadoEn") AND ("venceEn" <= ("creadoEn" + ''00:30:00''::interval))))'],
    ['usuario', 'usuario_clave_hash_chk', 'CHECK ((("claveHash" IS NULL) OR ("claveHash" ~ ''^\$2[aby]\$12\$[./A-Za-z0-9]{53}$''::text)))'],
    ['usuario', 'usuario_sesion_version_chk', 'CHECK (("sesionVersion" >= 1))'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_valor_chk', 'CHECK (("valorUnidad" > (0)::numeric))']
  ];
  disparadores text[] := ARRAY[
    ['decision', 'decision_solo_insercion', '27', 'inv_solo_insercion'],
    ['dividendo', 'dividendo_solo_insercion', '27', 'inv_solo_insercion'],
    ['enlace_decision_orden', 'enlace_decision_orden_solo_insercion', '27', 'inv_solo_insercion'],
    ['fila_de_carga', 'fila_de_carga_solo_insercion', '27', 'inv_solo_insercion'],
    ['fila_fuente', 'fila_fuente_solo_insercion', '27', 'inv_solo_insercion'],
    ['intento_ingreso', 'intento_ingreso_solo_insercion', '27', 'inv_solo_insercion'],
    ['movimiento_caja', 'movimiento_caja_solo_insercion', '27', 'inv_solo_insercion'],
    ['orden', 'orden_solo_insercion', '27', 'inv_solo_insercion'],
    ['plan_version', 'plan_version_solo_insercion', '27', 'inv_solo_insercion'],
    ['regla_plan', 'regla_plan_solo_insercion', '27', 'inv_solo_insercion'],
    ['token_acceso', 'token_acceso_un_solo_uso', '27', 'inv_token_un_solo_uso']
  ];
  funciones text[] := ARRAY[
    ['inv_solo_insercion', '86053be6cc8c56d4cb328ac370f3cc77'],
    ['inv_token_un_solo_uso', 'eef69326d8da1a1ed8a4f5086d212546']
  ];
  extensiones text[] := ARRAY['btree_gist', 'citext'];
  faltan text[] := '{}';
  distintos text[] := '{}';
  fila text[];
  x text;
  def text;
  unico boolean;
  valida boolean;
  tipo text;
  funcion text;
  habilitado "char";
BEGIN
  FOREACH fila SLICE 1 IN ARRAY indices_parciales LOOP
    def := NULL;
    SELECT pg_get_indexdef(i.indexrelid), i.indisunique INTO def, unico
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = fila[2] AND c.relnamespace = 'public'::regnamespace AND i.indrelid = to_regclass('public.' || quote_ident(fila[1]));
    IF def IS NULL THEN
      faltan := faltan || ('índice parcial ' || fila[2]);
    ELSIF def <> fila[3] OR unico IS DISTINCT FROM (fila[3] LIKE 'CREATE UNIQUE INDEX %') THEN
      distintos := distintos || ('índice ' || fila[2]);
    END IF;
  END LOOP;
  FOREACH fila SLICE 1 IN ARRAY restricciones LOOP
    def := NULL;
    SELECT pg_get_constraintdef(c.oid), c.convalidated INTO def, valida
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass('public.' || quote_ident(fila[1])) AND c.conname = fila[2] AND c.contype IN ('c', 'x');
    IF def IS NULL THEN
      faltan := faltan || ('restricción ' || fila[2]);
    ELSIF def <> fila[3] OR NOT valida THEN
      distintos := distintos || ('restricción ' || fila[2]);
    END IF;
  END LOOP;
  FOREACH fila SLICE 1 IN ARRAY disparadores LOOP
    tipo := NULL;
    SELECT t.tgtype::text, t.tgfoid::regproc::text, t.tgenabled INTO tipo, funcion, habilitado
      FROM pg_trigger t
      WHERE t.tgrelid = to_regclass('public.' || quote_ident(fila[1])) AND t.tgname = fila[2] AND NOT t.tgisinternal;
    IF tipo IS NULL THEN
      faltan := faltan || ('disparador ' || fila[2]);
    ELSIF tipo <> fila[3] OR funcion <> fila[4] OR habilitado NOT IN ('O', 'A') THEN
      distintos := distintos || ('disparador ' || fila[2]);
    END IF;
  END LOOP;
  FOREACH fila SLICE 1 IN ARRAY funciones LOOP
    def := NULL;
    SELECT md5(p.prosrc) INTO def FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fila[1];
    IF def IS NULL THEN
      faltan := faltan || ('función ' || fila[1]);
    ELSIF def <> fila[2] THEN
      distintos := distintos || ('función ' || fila[1]);
    END IF;
  END LOOP;
  FOREACH x IN ARRAY extensiones LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = x) THEN
      faltan := faltan || ('extensión ' || x);
    END IF;
  END LOOP;
  IF cardinality(faltan) > 0 OR cardinality(distintos) > 0 THEN
    RAISE EXCEPTION 'Guardián del esquema: faltan % y cambiaron % objeto(s) escritos a mano. Faltan: %. Cambiaron: %',
      cardinality(faltan), cardinality(distintos), array_to_string(faltan, ', '), array_to_string(distintos, ', ');
  END IF;
  RAISE NOTICE 'Guardián del esquema: % índices parciales, % restricciones, % disparadores, % funciones y % extensiones en su lugar',
    cardinality(indices_parciales) / 3, cardinality(restricciones) / 3, cardinality(disparadores) / 4, cardinality(funciones) / 2, cardinality(extensiones);
END
$$;
