-- Inversiones · guardián del esquema. Lo corre el migrador (docker/migrar.sh) después de
-- `prisma migrate deploy` y antes de levantar la app: si falta o cambió un objeto, aborta y no se sirve.
--
-- Exige, en la base real, lo escrito a mano Y lo que Prisma crea pero de lo que depende la integridad:
--  - cada índice único (de Prisma: la idempotencia de las cargas depende de ellos) y cada índice parcial,
--    con su definición exacta (pg_get_indexdef), único si lo es, y válido, listo y vivo (indisvalid,
--    indisready, indislive); además, ningún índice del esquema puede quedar a medias, esté o no en la lista;
--  - cada llave primaria y foránea con su definición exacta (pg_get_constraintdef: columnas, tabla destino y
--    ON DELETE / ON UPDATE) y validada, y toda FK con un índice que empiece por sus columnas;
--  - cada CHECK y EXCLUDE con su definición exacta y validado, salvo los de `sin_validar`: nacieron NOT VALID
--    para no revisar filas existentes y se aceptan sin validar hasta que una migración posterior los valide
--    (antes, el dueño corre scripts/contar-sin-validar.sql, de solo lectura);
--  - cada disparador con su definición exacta (pg_get_triggerdef: tabla, BEFORE/AFTER, eventos, UPDATE OF,
--    FOR EACH ROW, WHEN y función) y habilitado (tgenabled O o A; D es deshabilitado, R solo en réplica);
--    ningún disparador de más en el esquema, y ninguno deshabilitado, ni siquiera los internos de las FK;
--  - las funciones escritas a mano: una sola por nombre, con el md5 exacto de su código, sin SECURITY DEFINER y con su
--    SET exacto (proconfig): un ALTER FUNCTION … SECURITY DEFINER no cambia el md5;
--  - que inv_app e inv_precios no sean miembros del dueño de precio_cierre ni de valor_unidad_fondo, ni de plan_version,
--    decision y enlace_decision_orden (los disparadores de integridad de precios y los de los instantes eximen al dueño);
--    ni inv_ia del de ninguna de ellas ni del de resumen_ia, ni inv_app o inv_precios del de resumen_ia (fase E: el
--    disparador de la hora del registro de los resúmenes con IA también exime al dueño); ni inv_app, inv_ia o inv_precios
--    del de config_ia (fase E, E8: el instante de la configuración de la IA), ni del de tarifa_comision (fase E, O5: el
--    instante de la tarifa de comisión), ni del de precio_intradia (precios cada minuto: la inserción del servicio);
--  - las extensiones btree_gist y citext.
-- Las definiciones son las canónicas de PostgreSQL 16 con search_path = public (sacadas de una base recién
-- migrada); el guardián fija ese search_path para que otro no dé un falso positivo. La lista de nombres sale de
-- prisma/migrations: tests/unit/produccion/verificar-esquema.test.ts exige que coincida, y
-- tests/integracion/guardian-esquema.test.ts (Mac y CI) y roles-base.test.ts (CI) lo corren contra PostgreSQL
-- real y lo rompen a propósito.
-- Para sumar un objeto nuevo, se copia su definición de una base de pruebas recién migrada, con
-- `SET search_path = public` y estas funciones: pg_get_indexdef(oid del índice), pg_get_constraintdef(oid de
-- la restricción; sin el sufijo ' NOT VALID'), pg_get_triggerdef(oid del disparador), md5(prosrc) y
-- array_to_string(proconfig, ';') de la función.
DO $$
DECLARE
  indices text[] := ARRAY[
    ['asignacion_venta', 'asignacion_venta_ordenVentaId_loteId_key', 'CREATE UNIQUE INDEX "asignacion_venta_ordenVentaId_loteId_key" ON public.asignacion_venta USING btree ("ordenVentaId", "loteId")'],
    ['certificacion', 'certificacion_cargaId_key', 'CREATE UNIQUE INDEX "certificacion_cargaId_key" ON public.certificacion USING btree ("cargaId")'],
    ['certificacion', 'certificacion_fechaCorte_key', 'CREATE UNIQUE INDEX "certificacion_fechaCorte_key" ON public.certificacion USING btree ("fechaCorte")'],
    ['certificacion', 'certificacion_id_fechaCorte_key', 'CREATE UNIQUE INDEX "certificacion_id_fechaCorte_key" ON public.certificacion USING btree (id, "fechaCorte")'],
    ['certificacion', 'certificacion_reemplazadaPorId_key', 'CREATE UNIQUE INDEX "certificacion_reemplazadaPorId_key" ON public.certificacion USING btree ("reemplazadaPorId")'],
    ['codigo_recuperacion', 'codigo_recuperacion_codigoHash_key', 'CREATE UNIQUE INDEX "codigo_recuperacion_codigoHash_key" ON public.codigo_recuperacion USING btree ("codigoHash")'],
    ['codigo_recuperacion', 'codigo_recuperacion_vigentes_idx', 'CREATE INDEX codigo_recuperacion_vigentes_idx ON public.codigo_recuperacion USING btree ("usuarioId") WHERE (("usadoEn" IS NULL) AND ("anuladoEn" IS NULL))'],
    ['config_ia', 'config_ia_version_key', 'CREATE UNIQUE INDEX config_ia_version_key ON public.config_ia USING btree (version)'],
    ['tarifa_comision', 'tarifa_comision_version_key', 'CREATE UNIQUE INDEX tarifa_comision_version_key ON public.tarifa_comision USING btree (version)'],
    ['precio_intradia', 'precio_intradia_instrumentoId_instante_fuente_key', 'CREATE UNIQUE INDEX "precio_intradia_instrumentoId_instante_fuente_key" ON public.precio_intradia USING btree ("instrumentoId", instante, fuente)'],
    ['decision', 'decision_reemplazaId_key', 'CREATE UNIQUE INDEX "decision_reemplazaId_key" ON public.decision USING btree ("reemplazaId")'],
    ['dividendo', 'dividendo_filaFuenteId_key', 'CREATE UNIQUE INDEX "dividendo_filaFuenteId_key" ON public.dividendo USING btree ("filaFuenteId")'],
    ['dividendo_decretado', 'dividendo_decretado_filaFuenteId_key', 'CREATE UNIQUE INDEX "dividendo_decretado_filaFuenteId_key" ON public.dividendo_decretado USING btree ("filaFuenteId")'],
    ['dividendo_decretado', 'dividendo_decretado_version_key', 'CREATE UNIQUE INDEX dividendo_decretado_version_key ON public.dividendo_decretado USING btree ("instrumentoId", "fechaAnuncio", tipo, cuota, version)'],
    ['dividendo_decretado', 'dividendo_decretado_vigente_key', 'CREATE UNIQUE INDEX dividendo_decretado_vigente_key ON public.dividendo_decretado USING btree ("instrumentoId", "fechaAnuncio", tipo, cuota) WHERE ("reemplazadoEn" IS NULL)'],
    ['enlace_decision_orden', 'enlace_decision_orden_id_ordenId_key', 'CREATE UNIQUE INDEX "enlace_decision_orden_id_ordenId_key" ON public.enlace_decision_orden USING btree (id, "ordenId")'],
    ['enlace_decision_orden', 'enlace_decision_orden_raiz_key', 'CREATE UNIQUE INDEX enlace_decision_orden_raiz_key ON public.enlace_decision_orden USING btree ("ordenId") WHERE ("reemplazaId" IS NULL)'],
    ['enlace_decision_orden', 'enlace_decision_orden_reemplazaId_ordenId_key', 'CREATE UNIQUE INDEX "enlace_decision_orden_reemplazaId_ordenId_key" ON public.enlace_decision_orden USING btree ("reemplazaId", "ordenId")'],
    ['evento_corporativo', 'evento_corporativo_pago_fraccion_key', 'CREATE UNIQUE INDEX evento_corporativo_pago_fraccion_key ON public.evento_corporativo USING btree ("destinoId", "fechaPagoFraccion") WHERE ("fechaPagoFraccion" IS NOT NULL)'],
    ['evento_corporativo', 'evento_corporativo_tipo_origenId_destinoId_fecha_key', 'CREATE UNIQUE INDEX "evento_corporativo_tipo_origenId_destinoId_fecha_key" ON public.evento_corporativo USING btree (tipo, "origenId", "destinoId", fecha)'],
    ['fila_fuente', 'fila_fuente_tipoFuente_claveNatural_ocurrencia_key', 'CREATE UNIQUE INDEX "fila_fuente_tipoFuente_claveNatural_ocurrencia_key" ON public.fila_fuente USING btree ("tipoFuente", "claveNatural", ocurrencia)'],
    ['fila_lote_av', 'fila_lote_av_filaFuenteId_key', 'CREATE UNIQUE INDEX "fila_lote_av_filaFuenteId_key" ON public.fila_lote_av USING btree ("filaFuenteId")'],
    ['instrumento', 'instrumento_codigoFic_key', 'CREATE UNIQUE INDEX "instrumento_codigoFic_key" ON public.instrumento USING btree ("codigoFic")'],
    ['instrumento', 'instrumento_nemotecnico_key', 'CREATE UNIQUE INDEX instrumento_nemotecnico_key ON public.instrumento USING btree (nemotecnico)'],
    ['instrumento', 'instrumento_nitFondo_key', 'CREATE UNIQUE INDEX "instrumento_nitFondo_key" ON public.instrumento USING btree ("nitFondo")'],
    ['instrumento', 'instrumento_simboloTrii_key', 'CREATE UNIQUE INDEX "instrumento_simboloTrii_key" ON public.instrumento USING btree ("simboloTrii")'],
    ['intento_ingreso', 'intento_ingreso_fallos_ip_idx', 'CREATE INDEX intento_ingreso_fallos_ip_idx ON public.intento_ingreso USING btree (ip, "ocurridoEn") WHERE (resultado <> ALL (ARRAY[''EXITO''::"ResultadoIngreso", ''CLAVE_DEFINIDA''::"ResultadoIngreso"]))'],
    ['intento_ingreso', 'intento_ingreso_reinicio_totp_idx', 'CREATE INDEX intento_ingreso_reinicio_totp_idx ON public.intento_ingreso USING btree ("usuarioId", "ocurridoEn" DESC) WHERE (resultado = ANY (ARRAY[''TOTP_EXITO''::"ResultadoIngreso", ''RECUPERACION_USADA''::"ResultadoIngreso", ''TOTP_ENROLADO''::"ResultadoIngreso", ''CODIGOS_REGENERADOS''::"ResultadoIngreso", ''TOTP_REINICIADO''::"ResultadoIngreso", ''CLAVE_DEFINIDA''::"ResultadoIngreso"]))'],
    ['intento_ingreso', 'intento_ingreso_ultimo_exito_idx', 'CREATE INDEX intento_ingreso_ultimo_exito_idx ON public.intento_ingreso USING btree ("usuarioId", "ocurridoEn" DESC) WHERE (resultado = ANY (ARRAY[''EXITO''::"ResultadoIngreso", ''CLAVE_DEFINIDA''::"ResultadoIngreso"]))'],
    ['lote', 'lote_escision_evento_key', 'CREATE UNIQUE INDEX lote_escision_evento_key ON public.lote USING btree ("eventoId") WHERE (origen = ''ESCISION''::"OrigenLote")'],
    ['lote', 'lote_ordenId_key', 'CREATE UNIQUE INDEX "lote_ordenId_key" ON public.lote USING btree ("ordenId")'],
    ['movimiento_caja', 'movimiento_caja_filaFuenteId_key', 'CREATE UNIQUE INDEX "movimiento_caja_filaFuenteId_key" ON public.movimiento_caja USING btree ("filaFuenteId")'],
    ['movimiento_fondo', 'movimiento_fondo_ajusteCajaId_key', 'CREATE UNIQUE INDEX "movimiento_fondo_ajusteCajaId_key" ON public.movimiento_fondo USING btree ("ajusteCajaId")'],
    ['movimiento_fondo', 'movimiento_fondo_constitucion_key', 'CREATE UNIQUE INDEX movimiento_fondo_constitucion_key ON public.movimiento_fondo USING btree ("fondoId") WHERE (tipo = ''CONSTITUCION''::"TipoMovimientoFondo")'],
    ['orden', 'orden_filaFuenteId_key', 'CREATE UNIQUE INDEX "orden_filaFuenteId_key" ON public.orden USING btree ("filaFuenteId")'],
    ['plan_version', 'plan_version_version_key', 'CREATE UNIQUE INDEX plan_version_version_key ON public.plan_version USING btree (version)'],
    ['precio_cierre', 'precio_cierre_dia_vigente_idx', 'CREATE INDEX precio_cierre_dia_vigente_idx ON public.precio_cierre USING btree (fecha, fuente) WHERE ("reemplazadoEn" IS NULL)'],
    ['precio_cierre', 'precio_cierre_vigente_key', 'CREATE UNIQUE INDEX precio_cierre_vigente_key ON public.precio_cierre USING btree ("instrumentoId", fecha, fuente) WHERE ("reemplazadoEn" IS NULL)'],
    ['regla_plan', 'regla_plan_id_planVersionId_key', 'CREATE UNIQUE INDEX "regla_plan_id_planVersionId_key" ON public.regla_plan USING btree (id, "planVersionId")'],
    ['rendimiento_fondo', 'rendimiento_fondo_ajusteCajaId_key', 'CREATE UNIQUE INDEX "rendimiento_fondo_ajusteCajaId_key" ON public.rendimiento_fondo USING btree ("ajusteCajaId")'],
    ['rendimiento_fondo', 'rendimiento_fondo_filaFuenteId_key', 'CREATE UNIQUE INDEX "rendimiento_fondo_filaFuenteId_key" ON public.rendimiento_fondo USING btree ("filaFuenteId")'],
    ['rendimiento_fondo', 'rendimiento_fondo_fondoId_fecha_tipo_key', 'CREATE UNIQUE INDEX "rendimiento_fondo_fondoId_fecha_tipo_key" ON public.rendimiento_fondo USING btree ("fondoId", fecha, tipo)'],
    ['resumen_ia', 'resumen_ia_publicado_key', 'CREATE UNIQUE INDEX resumen_ia_publicado_key ON public.resumen_ia USING btree (tipo, "fechaNegocio", "hechosHash", "promptHash", "modeloDigest") WHERE (estado = ''PUBLICADO''::"EstadoResumenIa")'],
    ['token_acceso', 'token_acceso_tokenHash_key', 'CREATE UNIQUE INDEX "token_acceso_tokenHash_key" ON public.token_acceso USING btree ("tokenHash")'],
    ['usuario', 'usuario_email_key', 'CREATE UNIQUE INDEX usuario_email_key ON public.usuario USING btree (email)'],
    ['valor_serie_oficial', 'valor_serie_oficial_vigente_key', 'CREATE UNIQUE INDEX valor_serie_oficial_vigente_key ON public.valor_serie_oficial USING btree (serie, desde) WHERE ("reemplazadoEn" IS NULL)'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_vigente_key', 'CREATE UNIQUE INDEX valor_unidad_fondo_vigente_key ON public.valor_unidad_fondo USING btree ("fondoId", "fechaValor") WHERE ("reemplazadoEn" IS NULL)']
  ];
  restricciones text[] := ARRAY[
    ['ajuste_caja', 'ajuste_caja_fraccion_chk', 'CHECK (((categoria = ''FRACCION_ESCISION''::"CategoriaAjusteCaja") = ("eventoId" IS NOT NULL)))'],
    ['ajuste_caja', 'ajuste_caja_monto_chk', 'CHECK ((monto <> (0)::numeric))'],
    ['ajuste_caja', 'ajuste_caja_rendimiento_fic_chk', 'CHECK (((categoria <> ''RENDIMIENTO_FIC''::"CategoriaAjusteCaja") OR ((monto > (0)::numeric) AND (monto <> ''NaN''::numeric))))'],
    ['asignacion_venta', 'asignacion_venta_cantidad_chk', 'CHECK (((cantidad > 0) AND ("costoBase" >= (0)::numeric)))'],
    ['certificacion', 'certificacion_retiro_chk', 'CHECK (((("retiradaEn" IS NULL) = ("reemplazadaPorId" IS NULL)) AND (("reemplazadaPorId" IS NULL) OR ("reemplazadaPorId" <> id))))'],
    ['certificacion', 'certificacion_referencia_efectivo_chk', 'CHECK ((("referenciaEfectivo" IS NULL) OR ("referenciaEfectivo" ~ ''^p[0-9]{1,3}:f[0-9]{1,5}$''::text)))'],
    ['certificacion_fondo', 'certificacion_fondo_referencia_chk', 'CHECK ((("referenciaPdf" IS NULL) OR ("referenciaPdf" ~ ''^p[0-9]{1,3}:f[0-9]{1,5}$''::text)))'],
    ['certificacion_fondo', 'certificacion_fondo_valores_chk', 'CHECK (((saldo >= (0)::numeric) AND ((unidades IS NULL) OR (unidades > (0)::numeric))))'],
    ['certificacion_posicion', 'certificacion_posicion_referencia_chk', 'CHECK ((("referenciaPdf" IS NULL) OR ((char_length("referenciaPdf") <= 4000) AND ("referenciaPdf" ~ ''^p[0-9]{1,3}:f[0-9]{1,5}(,p[0-9]{1,3}:f[0-9]{1,5})*$''::text))))'],
    ['certificacion_posicion', 'certificacion_posicion_valores_chk', 'CHECK (((cantidad > 0) AND ("precioValoracion" >= (0)::numeric) AND ("valorMercado" >= (0)::numeric)))'],
    ['codigo_recuperacion', 'codigo_recuperacion_fechas_chk', 'CHECK (((("usadoEn" IS NULL) OR ("usadoEn" >= "creadoEn")) AND (("anuladoEn" IS NULL) OR ("anuladoEn" >= "creadoEn"))))'],
    ['codigo_recuperacion', 'codigo_recuperacion_hash_chk', 'CHECK (("codigoHash" ~ ''^[0-9a-f]{64}$''::text))'],
    ['codigo_recuperacion', 'codigo_recuperacion_marca_chk', 'CHECK ((("usadoEn" IS NULL) OR ("anuladoEn" IS NULL)))'],
    ['config_ia', 'config_ia_destino_chk', 'CHECK (((("ollamaHost" IS NULL) = ("ollamaPuerto" IS NULL)) AND (("ollamaPuerto" IS NULL) OR (("ollamaPuerto" >= 1) AND ("ollamaPuerto" <= 65535))) AND (("ollamaHost" IS NULL) OR ("ollamaHost" ~ ''^100[.](6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$''::text))))'],
    ['config_ia', 'config_ia_esfuerzo_chk', 'CHECK (("esfuerzoNube" = ANY (ARRAY[''low''::text, ''medium''::text])))'],
    ['config_ia', 'config_ia_hora_chk', 'CHECK (("horaResumen" = ANY (ARRAY[''18:00''::text, ''19:00''::text, ''20:00''::text, ''21:00''::text])))'],
    ['config_ia', 'config_ia_limite_chk', 'CHECK ((("limiteSegundos" >= 10) AND ("limiteSegundos" <= 120)))'],
    ['config_ia', 'config_ia_modelo_nube_chk', 'CHECK (("modeloNube" = ANY (ARRAY[''claude-opus-5-5''::text, ''claude-sonnet-5-5''::text, ''claude-haiku-5-5''::text])))'],
    ['config_ia', 'config_ia_modo_chk', 'CHECK ((modo = ANY (ARRAY[''apagado''::text, ''local''::text, ''nube''::text, ''local-luego-nube''::text])))'],
    ['config_ia', 'config_ia_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['config_ia', 'config_ia_tareas_chk', 'CHECK (((jsonb_typeof(tareas) = ''object''::text) AND ((tareas - ARRAY[''DIARIO''::text, ''REGLAS''::text, ''ESCENARIOS''::text]) = ''{}''::jsonb) AND (tareas ?& ARRAY[''DIARIO''::text, ''REGLAS''::text, ''ESCENARIOS''::text]) AND ((NOT (tareas ? ''DIARIO''::text)) OR ((jsonb_typeof((tareas -> ''DIARIO''::text)) = ''object''::text) AND (((tareas -> ''DIARIO''::text) - ARRAY[''activo''::text, ''modeloLocal''::text]) = ''{}''::jsonb) AND (jsonb_typeof(((tareas -> ''DIARIO''::text) -> ''activo''::text)) = ''boolean''::text) AND ((NOT ((tareas -> ''DIARIO''::text) ? ''modeloLocal''::text)) OR (jsonb_typeof(((tareas -> ''DIARIO''::text) -> ''modeloLocal''::text)) = ''null''::text) OR ((jsonb_typeof(((tareas -> ''DIARIO''::text) -> ''modeloLocal''::text)) = ''string''::text) AND (((tareas -> ''DIARIO''::text) ->> ''modeloLocal''::text) ~ ''^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$''::text))))) AND ((NOT (tareas ? ''REGLAS''::text)) OR ((jsonb_typeof((tareas -> ''REGLAS''::text)) = ''object''::text) AND (((tareas -> ''REGLAS''::text) - ARRAY[''activo''::text, ''modeloLocal''::text]) = ''{}''::jsonb) AND (jsonb_typeof(((tareas -> ''REGLAS''::text) -> ''activo''::text)) = ''boolean''::text) AND ((NOT ((tareas -> ''REGLAS''::text) ? ''modeloLocal''::text)) OR (jsonb_typeof(((tareas -> ''REGLAS''::text) -> ''modeloLocal''::text)) = ''null''::text) OR ((jsonb_typeof(((tareas -> ''REGLAS''::text) -> ''modeloLocal''::text)) = ''string''::text) AND (((tareas -> ''REGLAS''::text) ->> ''modeloLocal''::text) ~ ''^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$''::text))))) AND ((NOT (tareas ? ''ESCENARIOS''::text)) OR ((jsonb_typeof((tareas -> ''ESCENARIOS''::text)) = ''object''::text) AND (((tareas -> ''ESCENARIOS''::text) - ARRAY[''activo''::text, ''modeloLocal''::text]) = ''{}''::jsonb) AND (jsonb_typeof(((tareas -> ''ESCENARIOS''::text) -> ''activo''::text)) = ''boolean''::text) AND ((NOT ((tareas -> ''ESCENARIOS''::text) ? ''modeloLocal''::text)) OR (jsonb_typeof(((tareas -> ''ESCENARIOS''::text) -> ''modeloLocal''::text)) = ''null''::text) OR ((jsonb_typeof(((tareas -> ''ESCENARIOS''::text) -> ''modeloLocal''::text)) = ''string''::text) AND (((tareas -> ''ESCENARIOS''::text) ->> ''modeloLocal''::text) ~ ''^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$''::text)))))))'],
    ['config_ia', 'config_ia_temperatura_chk', 'CHECK ((("temperaturaLocal" >= (0)::numeric) AND ("temperaturaLocal" <= (1)::numeric)))'],
    ['config_ia', 'config_ia_tope_chk', 'CHECK ((("topeMensualUsd" IS NULL) OR (("topeMensualUsd" >= 1.00) AND ("topeMensualUsd" <= 50.00))))'],
    ['config_ia', 'config_ia_usa_chk', 'CHECK ((((modo <> ALL (ARRAY[''local''::text, ''local-luego-nube''::text])) OR (("ollamaHost" IS NOT NULL) AND (NOT ((((tareas -> ''DIARIO''::text) -> ''activo''::text) = ''true''::jsonb) AND (jsonb_typeof(((tareas -> ''DIARIO''::text) -> ''modeloLocal''::text)) IS DISTINCT FROM ''string''::text))) AND (NOT ((((tareas -> ''REGLAS''::text) -> ''activo''::text) = ''true''::jsonb) AND (jsonb_typeof(((tareas -> ''REGLAS''::text) -> ''modeloLocal''::text)) IS DISTINCT FROM ''string''::text))) AND (NOT ((((tareas -> ''ESCENARIOS''::text) -> ''activo''::text) = ''true''::jsonb) AND (jsonb_typeof(((tareas -> ''ESCENARIOS''::text) -> ''modeloLocal''::text)) IS DISTINCT FROM ''string''::text))))) AND ((modo <> ALL (ARRAY[''nube''::text, ''local-luego-nube''::text])) OR ("topeMensualUsd" IS NOT NULL))))'],
    ['config_ia', 'config_ia_version_chk', 'CHECK ((version >= 1))'],
    ['tarifa_comision', 'tarifa_comision_cargos_chk', 'CHECK (((jsonb_typeof("otrosCargos") = ''array''::text) AND (jsonb_array_length("otrosCargos") <= 3) AND ((jsonb_array_length("otrosCargos") <= 0) OR ((jsonb_typeof(("otrosCargos" -> 0)) = ''object''::text) AND ((("otrosCargos" -> 0) - ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) = ''{}''::jsonb) AND (("otrosCargos" -> 0) ?& ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) AND (jsonb_typeof((("otrosCargos" -> 0) -> ''nombre''::text)) = ''string''::text) AND ((char_length((("otrosCargos" -> 0) ->> ''nombre''::text)) >= 1) AND (char_length((("otrosCargos" -> 0) ->> ''nombre''::text)) <= 60)) AND ((("otrosCargos" -> 0) ->> ''nombre''::text) ~ ''[^[:space:]]''::text) AND ((("otrosCargos" -> 0) ->> ''nombre''::text) !~ ''[[:cntrl:]]''::text) AND ((("otrosCargos" -> 0) ->> ''tipo''::text) = ANY (ARRAY[''PCT''::text, ''FIJO''::text])) AND (jsonb_typeof((("otrosCargos" -> 0) -> ''valor''::text)) = ''string''::text) AND ((("otrosCargos" -> 0) ->> ''valor''::text) ~ ''^[0-9]{1,8}([.][0-9]{1,4})?$''::text) AND (((("otrosCargos" -> 0) ->> ''tipo''::text) <> ''PCT''::text) OR ((("otrosCargos" -> 0) ->> ''valor''::text) ~ ''^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$''::text)))) AND ((jsonb_array_length("otrosCargos") <= 1) OR ((jsonb_typeof(("otrosCargos" -> 1)) = ''object''::text) AND ((("otrosCargos" -> 1) - ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) = ''{}''::jsonb) AND (("otrosCargos" -> 1) ?& ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) AND (jsonb_typeof((("otrosCargos" -> 1) -> ''nombre''::text)) = ''string''::text) AND ((char_length((("otrosCargos" -> 1) ->> ''nombre''::text)) >= 1) AND (char_length((("otrosCargos" -> 1) ->> ''nombre''::text)) <= 60)) AND ((("otrosCargos" -> 1) ->> ''nombre''::text) ~ ''[^[:space:]]''::text) AND ((("otrosCargos" -> 1) ->> ''nombre''::text) !~ ''[[:cntrl:]]''::text) AND ((("otrosCargos" -> 1) ->> ''tipo''::text) = ANY (ARRAY[''PCT''::text, ''FIJO''::text])) AND (jsonb_typeof((("otrosCargos" -> 1) -> ''valor''::text)) = ''string''::text) AND ((("otrosCargos" -> 1) ->> ''valor''::text) ~ ''^[0-9]{1,8}([.][0-9]{1,4})?$''::text) AND (((("otrosCargos" -> 1) ->> ''tipo''::text) <> ''PCT''::text) OR ((("otrosCargos" -> 1) ->> ''valor''::text) ~ ''^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$''::text)))) AND ((jsonb_array_length("otrosCargos") <= 2) OR ((jsonb_typeof(("otrosCargos" -> 2)) = ''object''::text) AND ((("otrosCargos" -> 2) - ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) = ''{}''::jsonb) AND (("otrosCargos" -> 2) ?& ARRAY[''nombre''::text, ''tipo''::text, ''valor''::text]) AND (jsonb_typeof((("otrosCargos" -> 2) -> ''nombre''::text)) = ''string''::text) AND ((char_length((("otrosCargos" -> 2) ->> ''nombre''::text)) >= 1) AND (char_length((("otrosCargos" -> 2) ->> ''nombre''::text)) <= 60)) AND ((("otrosCargos" -> 2) ->> ''nombre''::text) ~ ''[^[:space:]]''::text) AND ((("otrosCargos" -> 2) ->> ''nombre''::text) !~ ''[[:cntrl:]]''::text) AND ((("otrosCargos" -> 2) ->> ''tipo''::text) = ANY (ARRAY[''PCT''::text, ''FIJO''::text])) AND (jsonb_typeof((("otrosCargos" -> 2) -> ''valor''::text)) = ''string''::text) AND ((("otrosCargos" -> 2) ->> ''valor''::text) ~ ''^[0-9]{1,8}([.][0-9]{1,4})?$''::text) AND (((("otrosCargos" -> 2) ->> ''tipo''::text) <> ''PCT''::text) OR ((("otrosCargos" -> 2) ->> ''valor''::text) ~ ''^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$''::text))))))'],
    ['tarifa_comision', 'tarifa_comision_comisionista_chk', 'CHECK ((comisionista = ANY (ARRAY[''TRII''::text, ''AV''::text])))'],
    ['tarifa_comision', 'tarifa_comision_iva_chk', 'CHECK ((("ivaPct" >= (0)::numeric) AND ("ivaPct" <= (100)::numeric)))'],
    ['tarifa_comision', 'tarifa_comision_montos_chk', 'CHECK ((("minimoPorOrden" >= (0)::numeric) AND ("minimoPorOrden" < (100000000)::numeric) AND ("fijoPorOrden" >= (0)::numeric) AND ("fijoPorOrden" < (100000000)::numeric)))'],
    ['tarifa_comision', 'tarifa_comision_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['tarifa_comision', 'tarifa_comision_porcentaje_chk', 'CHECK (((porcentaje >= (0)::numeric) AND (porcentaje <= (100)::numeric)))'],
    ['tarifa_comision', 'tarifa_comision_version_chk', 'CHECK ((version >= 1))'],
    ['precio_intradia', 'precio_intradia_fuente_chk', 'CHECK ((fuente ~ ''^[a-z][a-z0-9:_.-]{0,39}$''::text))'],
    ['precio_intradia', 'precio_intradia_precio_chk', 'CHECK (((precio > (0)::numeric) AND (precio <= (10000000)::numeric)))'],
    ['control_conciliacion', 'control_conciliacion_motivo_chk', 'CHECK (((("codigoMotivo" IS NULL) OR ("codigoMotivo" ~ ''^[a-z0-9_]{1,40}$''::text)) AND ((resultado = ''CUADRA''::"ResultadoControl") OR ("codigoMotivo" IS NOT NULL))))'],
    ['control_conciliacion', 'control_conciliacion_tolerancia_chk', 'CHECK (((tolerancia IS NULL) OR (tolerancia >= (0)::numeric)))'],
    ['decision', 'decision_cantidad_chk', 'CHECK ((((cantidad IS NULL) OR (cantidad > 0)) AND ((accion <> ''NO_ACTUAR''::"AccionPlan") OR (cantidad IS NOT NULL))))'],
    ['decision', 'decision_excepcion_chk', 'CHECK (((NOT excepcion) OR ("reglaId" IS NOT NULL)))'],
    ['decision', 'decision_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['decision', 'decision_reemplazo_chk', 'CHECK ((("reemplazaId" IS NULL) OR ("reemplazaId" <> id)))'],
    ['dividendo', 'dividendo_bruto_chk', 'CHECK ((("montoBruto" IS NULL) OR ((retencion IS NOT NULL) AND (("montoBruto" - retencion) = "montoNeto"))))'],
    ['dividendo', 'dividendo_fraccion_chk', 'CHECK (((tipo = ''FRACCION_ESCISION''::"TipoDividendo") = ("eventoId" IS NOT NULL)))'],
    ['dividendo', 'dividendo_neto_chk', 'CHECK (("montoNeto" > (0)::numeric))'],
    ['dividendo', 'dividendo_retencion_chk', 'CHECK (((retencion IS NULL) OR (retencion >= (0)::numeric)))'],
    ['dividendo', 'dividendo_tasa_retencion_chk', 'CHECK ((("tasaRetencion" IS NULL) OR (("tasaRetencion" >= (0)::numeric) AND ("tasaRetencion" <= (1)::numeric))))'],
    ['dividendo', 'dividendo_viejas_nulas_chk', 'CHECK ((("montoBruto" IS NULL) AND (retencion IS NULL) AND ("tasaRetencion" IS NULL) AND ("decretadoId" IS NULL)))'],
    ['dividendo_decretado', 'dividendo_decretado_anulada_chk', 'CHECK (((NOT anulada) OR ((version >= 2) AND (nota IS NOT NULL) AND (nota ~ ''[^[:space:]]''::text))))'],
    ['dividendo_decretado', 'dividendo_decretado_cuota_chk', 'CHECK (((cuota >= 1) AND (cuota <= 12)))'],
    ['dividendo_decretado', 'dividendo_decretado_fechas_chk', 'CHECK ((isfinite("fechaAnuncio") AND isfinite("fechaPago") AND ("fechaAnuncio" <= "fechaEx") AND ("fechaEx" <= "fechaPago")))'],
    ['dividendo_decretado', 'dividendo_decretado_nota_chk', 'CHECK (((nota IS NULL) OR ((nota ~ ''[^[:space:]]''::text) AND (char_length(nota) <= 500))))'],
    ['dividendo_decretado', 'dividendo_decretado_referencia_chk', 'CHECK (((char_length("referenciaOficial") <= 500) AND (("referenciaOficial" ~ ''^https://www\.superfinanciera\.gov\.co/[A-Za-z0-9._~/?=&%#:+-]+$''::text) OR ("referenciaOficial" ~ ''^https://www\.bvc\.com\.co/[A-Za-z0-9._~/?=&%#:+-]+$''::text) OR ("referenciaOficial" ~ ''^sfc:[A-Za-z0-9._-]{1,60}$''::text))))'],
    ['dividendo_decretado', 'dividendo_decretado_tipo_chk', 'CHECK ((tipo <> ''FRACCION_ESCISION''::"TipoDividendo"))'],
    ['dividendo_decretado', 'dividendo_decretado_valor_chk', 'CHECK ((("valorPorAccion" > (0)::numeric) AND ("valorPorAccion" <> ''NaN''::numeric)))'],
    ['dividendo_decretado', 'dividendo_decretado_version_chk', 'CHECK ((version >= 1))'],
    ['enlace_decision_orden', 'enlace_decision_orden_motivo_chk', 'CHECK (((motivo IS NULL) OR (char_length(motivo) <= 2000)))'],
    ['enlace_decision_orden', 'enlace_decision_orden_reemplazo_chk', 'CHECK ((("reemplazaId" IS NULL) OR (("reemplazaId" <> id) AND (motivo IS NOT NULL) AND (motivo ~ ''[^[:space:]]''::text))))'],
    ['evento_corporativo', 'evento_corporativo_origen_destino_chk', 'CHECK (("origenId" <> "destinoId"))'],
    ['evento_corporativo', 'evento_corporativo_razon_chk', 'CHECK (((razon IS NULL) OR (razon > (0)::numeric)))'],
    ['fila_fuente', 'fila_fuente_ocurrencia_chk', 'CHECK ((ocurrencia >= 1))'],
    ['instrumento', 'instrumento_nit_fondo_chk', 'CHECK ((("nitFondo" IS NULL) OR ((tipo = ''FIC''::"TipoInstrumento") AND ("nitFondo" ~ ''^[0-9]{6,10}-[0-9]$''::text))))'],
    ['instrumento', 'instrumento_tipo_chk', 'CHECK ((((tipo = ''ACCION''::"TipoInstrumento") AND (nemotecnico IS NOT NULL)) OR ((tipo = ''FIC''::"TipoInstrumento") AND ("codigoFic" IS NOT NULL))))'],
    ['intento_ingreso', 'intento_ingreso_usuario_chk', 'CHECK ((((resultado = ''USUARIO_INEXISTENTE''::"ResultadoIngreso") AND ("usuarioId" IS NULL)) OR (resultado = ''TOKEN_INVALIDO''::"ResultadoIngreso") OR ((resultado <> ALL (ARRAY[''USUARIO_INEXISTENTE''::"ResultadoIngreso", ''TOKEN_INVALIDO''::"ResultadoIngreso"])) AND ("usuarioId" IS NOT NULL))))'],
    ['lote', 'lote_cantidad_chk', 'CHECK (((cantidad > 0) AND ("costoUnitario" >= (0)::numeric) AND ("costoTotal" >= (0)::numeric) AND (comision >= (0)::numeric)))'],
    ['lote', 'lote_origen_chk', 'CHECK ((((origen = ''COMPRA''::"OrigenLote") AND ("ordenId" IS NOT NULL) AND ("eventoId" IS NULL) AND ("loteOrigenId" IS NULL)) OR ((origen = ''ESCISION''::"OrigenLote") AND ("ordenId" IS NULL) AND ("eventoId" IS NOT NULL) AND ("loteOrigenId" IS NOT NULL))))'],
    ['movimiento_caja', 'movimiento_caja_monto_chk', 'CHECK ((monto > (0)::numeric))'],
    ['movimiento_fondo', 'movimiento_fondo_aporte_enlace_chk', 'CHECK (((tipo <> ALL (ARRAY[''CONSTITUCION''::"TipoMovimientoFondo", ''APORTE''::"TipoMovimientoFondo"])) OR (("ajusteCajaId" IS NOT NULL) AND (monto IS NOT NULL))))'],
    ['movimiento_fondo', 'movimiento_fondo_monto_chk', 'CHECK (((monto IS NULL) OR (monto > (0)::numeric)))'],
    ['movimiento_fondo', 'movimiento_fondo_unidades_chk', 'CHECK ((((tipo = ''AJUSTE''::"TipoMovimientoFondo") AND (unidades <> (0)::numeric)) OR ((tipo <> ''AJUSTE''::"TipoMovimientoFondo") AND (unidades > (0)::numeric))))'],
    ['orden', 'orden_aprobada_precio_chk', 'CHECK (((estado <> ''APROBADO''::"EstadoOrden") OR ("precioUnitario" > (0)::numeric)))'],
    ['orden', 'orden_cantidades_chk', 'CHECK ((("cantidadCompletada" >= 0) AND ("cantidadPendiente" >= 0)))'],
    ['orden', 'orden_fechas_chk', 'CHECK (("fechaLiquidacion" >= "fechaOperacion"))'],
    ['orden', 'orden_montos_chk', 'CHECK ((("precioUnitario" >= (0)::numeric) AND ("totalInvertido" >= (0)::numeric) AND (comision >= (0)::numeric) AND ("totalEstimado" >= (0)::numeric)))'],
    ['plan_version', 'plan_version_motivo_chk', 'CHECK (((motivo ~ ''[^[:space:]]''::text) AND (char_length(motivo) <= 2000)))'],
    ['plan_version', 'plan_version_version_chk', 'CHECK ((version >= 1))'],
    ['precio_cierre', 'precio_cierre_precio_chk', 'CHECK ((precio > (0)::numeric))'],
    ['regla_plan', 'regla_plan_cantidad_chk', 'CHECK (((cantidad IS NULL) OR (cantidad > 0)))'],
    ['regla_plan', 'regla_plan_detalle_chk', 'CHECK (((detalle ~ ''[^[:space:]]''::text) AND (char_length(detalle) <= 2000)))'],
    ['regla_plan', 'regla_plan_nivel_chk', 'CHECK ((((condicion = ANY (ARRAY[''NINGUNA''::"CondicionRegla", ''LIBRE''::"CondicionRegla"])) = (nivel IS NULL)) AND ((nivel IS NULL) OR (nivel > (0)::numeric))))'],
    ['rendimiento_fondo', 'rendimiento_fondo_enlace_chk', 'CHECK (((tipo = ''RENDIMIENTO''::"TipoRendimientoFondo") = ("ajusteCajaId" IS NOT NULL)))'],
    ['rendimiento_fondo', 'rendimiento_fondo_fecha_chk', 'CHECK (isfinite(fecha))'],
    ['rendimiento_fondo', 'rendimiento_fondo_valor_chk', 'CHECK (((valor > (0)::numeric) AND (valor <> ''NaN''::numeric)))'],
    ['resumen_ia', 'resumen_ia_conteos_chk', 'CHECK (((("latenciaMs" IS NULL) OR ("latenciaMs" >= 0)) AND (("tokensEntrada" IS NULL) OR ("tokensEntrada" >= 0)) AND (("tokensSalida" IS NULL) OR ("tokensSalida" >= 0))))'],
    ['resumen_ia', 'resumen_ia_estado_chk', 'CHECK ((((estado = ''PUBLICADO''::"EstadoResumenIa") = (texto IS NOT NULL)) AND ((estado = ''FALLIDO''::"EstadoResumenIa") = ("salidaModelo" IS NULL)) AND ((estado = ''FALLIDO''::"EstadoResumenIa") OR ((modelo IS NOT NULL) AND ("modeloDigest" IS NOT NULL))) AND ((estado <> ''FALLIDO''::"EstadoResumenIa") OR (("tokensEntrada" IS NULL) AND ("tokensSalida" IS NULL)))))'],
    ['resumen_ia', 'resumen_ia_formas_chk', 'CHECK ((("hechosHash" ~ ''^[0-9a-f]{64}$''::text) AND ("promptHash" ~ ''^[0-9a-f]{64}$''::text) AND ("hechosVersion" ~ ''^hechos-v[1-9][0-9]*$''::text) AND ("promptVersion" ~ ''^[a-z]+(-[a-z]+)*-v[1-9][0-9]*$''::text) AND ("validadorVersion" ~ ''^[a-z]+(-[a-z]+)*-v[1-9][0-9]*$''::text) AND ((modelo IS NULL) OR (modelo ~ ''^[!-~]{1,128}$''::text)) AND (("modeloDigest" IS NULL) OR ("modeloDigest" ~ ''^[!-~]{1,128}$''::text)) AND (jsonb_typeof(opciones) = ''object''::text) AND (octet_length((opciones)::text) <= 4096) AND isfinite("fechaNegocio")))'],
    ['resumen_ia', 'resumen_ia_hechos_chk', 'CHECK (((jsonb_typeof(hechos) = ''object''::text) AND (NOT ((hechos ->> ''hash''::text) IS DISTINCT FROM "hechosHash")) AND (NOT ((hechos ->> ''version''::text) IS DISTINCT FROM "hechosVersion")) AND (NOT ((hechos ->> ''tipo''::text) IS DISTINCT FROM (tipo)::text)) AND (NOT ((hechos ->> ''hoy''::text) IS DISTINCT FROM to_char(("fechaNegocio")::timestamp without time zone, ''YYYY-MM-DD''::text)))))'],
    ['resumen_ia', 'resumen_ia_motivos_chk', 'CHECK (((motivos IS NOT NULL) AND (array_position(motivos, NULL::text) IS NULL) AND (cardinality(motivos) <= 32) AND ((cardinality(motivos) = 0) OR (array_ndims(motivos) = 1)) AND (char_length(array_to_string(motivos, '',''::text)) <= 2079) AND (array_to_string(motivos, '',''::text) ~ ''^([A-Z]+(_[A-Z]+)*(,[A-Z]+(_[A-Z]+)*)*)?$''::text) AND (NOT (''''::text = ANY (motivos))) AND ((char_length(array_to_string(motivos, '',''::text)) - char_length(replace(array_to_string(motivos, '',''::text), '',''::text, ''''::text))) = GREATEST((cardinality(motivos) - 1), 0)) AND ((estado = ''PUBLICADO''::"EstadoResumenIa") = (cardinality(motivos) = 0)) AND ((estado <> ''FALLIDO''::"EstadoResumenIa") OR (motivos[1] = ANY (ARRAY[''MODELO_NO_DISPONIBLE''::text, ''TIEMPO_AGOTADO''::text, ''TOPE_MENSUAL''::text, ''PUERTA_APAGADA''::text, ''ERROR_PROVEEDOR''::text, ''VISTA_NO_CIEGA''::text]))) AND ((estado <> ''RECHAZADO''::"EstadoResumenIa") OR (NOT (motivos && ARRAY[''MODELO_NO_DISPONIBLE''::text, ''TIEMPO_AGOTADO''::text, ''TOPE_MENSUAL''::text, ''PUERTA_APAGADA''::text, ''ERROR_PROVEEDOR''::text, ''VISTA_NO_CIEGA''::text])))))'],
    ['resumen_ia', 'resumen_ia_puerta_chk', 'CHECK ((((puerta IS NULL) = (''VISTA_NO_CIEGA''::text = ANY (motivos))) AND ((puerta IS NOT NULL) OR ((estado = ''FALLIDO''::"EstadoResumenIa") AND (motivos[1] = ''VISTA_NO_CIEGA''::text)))))'],
    ['resumen_ia', 'resumen_ia_textos_chk', 'CHECK ((((texto IS NULL) OR ((char_length(texto) <= 16384) AND (texto ~ ''[^[:space:]]''::text))) AND (("salidaModelo" IS NULL) OR (char_length("salidaModelo") <= 65536))))'],
    ['simbolo_precio', 'simbolo_precio_sin_solape_excl', 'EXCLUDE USING gist ("instrumentoId" WITH =, proveedor WITH =, daterange("vigenteDesde", "vigenteHasta", ''[)''::text) WITH &&)'],
    ['simbolo_precio', 'simbolo_precio_vigencia_chk', 'CHECK ((("vigenteHasta" IS NULL) OR ("vigenteHasta" > "vigenteDesde")))'],
    ['token_acceso', 'token_acceso_hash_chk', 'CHECK (("tokenHash" ~ ''^[0-9a-f]{64}$''::text))'],
    ['token_acceso', 'token_acceso_vence_chk', 'CHECK ((("venceEn" > "creadoEn") AND ("venceEn" <= ("creadoEn" + ''00:30:00''::interval))))'],
    ['usuario', 'usuario_clave_hash_chk', 'CHECK ((("claveHash" IS NULL) OR ("claveHash" ~ ''^\$2[aby]\$12\$[./A-Za-z0-9]{53}$''::text)))'],
    ['usuario', 'usuario_presesion_hash_chk', 'CHECK ((("presesionHash" IS NULL) OR ("presesionHash" ~ ''^[0-9a-f]{64}$''::text)))'],
    ['usuario', 'usuario_sesion_version_chk', 'CHECK (("sesionVersion" >= 1))'],
    ['usuario', 'usuario_totp_chk', 'CHECK (((("totpActivadoEn" IS NULL) AND ("totpUltimoPaso" IS NULL)) OR (("totpActivadoEn" IS NOT NULL) AND ("totpUltimoPaso" IS NOT NULL) AND ("totpSecreto" IS NOT NULL))))'],
    ['usuario', 'usuario_totp_paso_chk', 'CHECK ((("totpUltimoPaso" IS NULL) OR ("totpUltimoPaso" >= 0)))'],
    ['usuario', 'usuario_totp_secreto_chk', 'CHECK ((("totpSecreto" IS NULL) OR ((jsonb_typeof("totpSecreto") = ''object''::text) AND ("totpSecreto" ?& ARRAY[''ct''::text, ''iv''::text, ''kid''::text, ''tag''::text, ''v''::text]) AND (("totpSecreto" - ARRAY[''ct''::text, ''iv''::text, ''kid''::text, ''tag''::text, ''v''::text]) = ''{}''::jsonb))))'],
    ['valor_serie_oficial', 'valor_serie_oficial_fuente_chk', 'CHECK ((fuente ~ ''^(sfc|banrep|dane):[A-Za-z0-9_.-]{1,80}$''::text))'],
    ['valor_serie_oficial', 'valor_serie_oficial_serie_chk', 'CHECK ((serie ~ ''^[A-Z][A-Z0-9_]{1,39}$''::text))'],
    ['valor_serie_oficial', 'valor_serie_oficial_sin_solape_excl', 'EXCLUDE USING gist (serie WITH =, daterange(desde, hasta, ''[]''::text) WITH &&) WHERE (("reemplazadoEn" IS NULL))'],
    ['valor_serie_oficial', 'valor_serie_oficial_valor_chk', 'CHECK (((valor > (0)::numeric) AND (valor <> ''NaN''::numeric)))'],
    ['valor_serie_oficial', 'valor_serie_oficial_vigencia_chk', 'CHECK ((isfinite(desde) AND (hasta >= desde) AND (hasta <= (desde + 31))))'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_valor_chk', 'CHECK (("valorUnidad" > (0)::numeric))']
  ];
  sin_validar text[] := ARRAY['dividendo_retencion_chk', 'dividendo_tasa_retencion_chk', 'evento_corporativo_origen_destino_chk', 'evento_corporativo_razon_chk', 'orden_fechas_chk'];
  llaves text[] := ARRAY[
    ['ajuste_caja', 'ajuste_caja_pkey', 'PRIMARY KEY (id)'],
    ['ajuste_caja', 'ajuste_caja_creadoPorId_fkey', 'FOREIGN KEY ("creadoPorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['ajuste_caja', 'ajuste_caja_eventoId_fkey', 'FOREIGN KEY ("eventoId") REFERENCES evento_corporativo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['asignacion_venta', 'asignacion_venta_pkey', 'PRIMARY KEY (id)'],
    ['asignacion_venta', 'asignacion_venta_loteId_fkey', 'FOREIGN KEY ("loteId") REFERENCES lote(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['asignacion_venta', 'asignacion_venta_ordenVentaId_fkey', 'FOREIGN KEY ("ordenVentaId") REFERENCES orden(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['calendario_bvc', 'calendario_bvc_pkey', 'PRIMARY KEY (dia)'],
    ['carga_archivo', 'carga_archivo_pkey', 'PRIMARY KEY (id)'],
    ['carga_archivo', 'carga_archivo_cargadoPorId_fkey', 'FOREIGN KEY ("cargadoPorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion', 'certificacion_pkey', 'PRIMARY KEY (id)'],
    ['certificacion', 'certificacion_cargaId_fkey', 'FOREIGN KEY ("cargaId") REFERENCES carga_archivo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion', 'certificacion_reemplazadaPorId_fkey', 'FOREIGN KEY ("reemplazadaPorId") REFERENCES certificacion(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion_fondo', 'certificacion_fondo_pkey', 'PRIMARY KEY ("certificacionId", "instrumentoId")'],
    ['certificacion_fondo', 'certificacion_fondo_certificacionId_fkey', 'FOREIGN KEY ("certificacionId") REFERENCES certificacion(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion_fondo', 'certificacion_fondo_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion_posicion', 'certificacion_posicion_pkey', 'PRIMARY KEY ("certificacionId", "instrumentoId")'],
    ['certificacion_posicion', 'certificacion_posicion_certificacionId_fkey', 'FOREIGN KEY ("certificacionId") REFERENCES certificacion(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['certificacion_posicion', 'certificacion_posicion_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['codigo_recuperacion', 'codigo_recuperacion_pkey', 'PRIMARY KEY (id)'],
    ['codigo_recuperacion', 'codigo_recuperacion_usuarioId_fkey', 'FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['conciliacion', 'conciliacion_pkey', 'PRIMARY KEY (id)'],
    ['conciliacion', 'conciliacion_certificacionId_fechaCorte_fkey', 'FOREIGN KEY ("certificacionId", "fechaCorte") REFERENCES certificacion(id, "fechaCorte") ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['config_ia', 'config_ia_pkey', 'PRIMARY KEY (id)'],
    ['config_ia', 'config_ia_autorId_fkey', 'FOREIGN KEY ("autorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['tarifa_comision', 'tarifa_comision_pkey', 'PRIMARY KEY (id)'],
    ['tarifa_comision', 'tarifa_comision_autorId_fkey', 'FOREIGN KEY ("autorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['precio_intradia', 'precio_intradia_pkey', 'PRIMARY KEY (id)'],
    ['precio_intradia', 'precio_intradia_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['control_conciliacion', 'control_conciliacion_pkey', 'PRIMARY KEY (id)'],
    ['control_conciliacion', 'control_conciliacion_conciliacionId_fkey', 'FOREIGN KEY ("conciliacionId") REFERENCES conciliacion(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['control_conciliacion', 'control_conciliacion_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['decision', 'decision_pkey', 'PRIMARY KEY (id)'],
    ['decision', 'decision_decididaPorId_fkey', 'FOREIGN KEY ("decididaPorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['decision', 'decision_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['decision', 'decision_planVersionId_fkey', 'FOREIGN KEY ("planVersionId") REFERENCES plan_version(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['decision', 'decision_reemplazaId_fkey', 'FOREIGN KEY ("reemplazaId") REFERENCES decision(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['decision', 'decision_reglaId_planVersionId_fkey', 'FOREIGN KEY ("reglaId", "planVersionId") REFERENCES regla_plan(id, "planVersionId") ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo', 'dividendo_pkey', 'PRIMARY KEY (id)'],
    ['dividendo', 'dividendo_decretadoId_fkey', 'FOREIGN KEY ("decretadoId") REFERENCES dividendo_decretado(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo', 'dividendo_eventoId_fkey', 'FOREIGN KEY ("eventoId") REFERENCES evento_corporativo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo', 'dividendo_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo', 'dividendo_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo_decretado', 'dividendo_decretado_pkey', 'PRIMARY KEY (id)'],
    ['dividendo_decretado', 'dividendo_decretado_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['dividendo_decretado', 'dividendo_decretado_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['enlace_decision_orden', 'enlace_decision_orden_pkey', 'PRIMARY KEY (id)'],
    ['enlace_decision_orden', 'enlace_decision_orden_creadoPorId_fkey', 'FOREIGN KEY ("creadoPorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['enlace_decision_orden', 'enlace_decision_orden_decisionId_fkey', 'FOREIGN KEY ("decisionId") REFERENCES decision(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['enlace_decision_orden', 'enlace_decision_orden_ordenId_fkey', 'FOREIGN KEY ("ordenId") REFERENCES orden(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['enlace_decision_orden', 'enlace_decision_orden_reemplazaId_ordenId_fkey', 'FOREIGN KEY ("reemplazaId", "ordenId") REFERENCES enlace_decision_orden(id, "ordenId") ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['evento_corporativo', 'evento_corporativo_pkey', 'PRIMARY KEY (id)'],
    ['evento_corporativo', 'evento_corporativo_destinoId_fkey', 'FOREIGN KEY ("destinoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['evento_corporativo', 'evento_corporativo_origenId_fkey', 'FOREIGN KEY ("origenId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_de_carga', 'fila_de_carga_pkey', 'PRIMARY KEY ("cargaId", "filaNo")'],
    ['fila_de_carga', 'fila_de_carga_cargaId_fkey', 'FOREIGN KEY ("cargaId") REFERENCES carga_archivo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_de_carga', 'fila_de_carga_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_fuente', 'fila_fuente_pkey', 'PRIMARY KEY (id)'],
    ['fila_fuente', 'fila_fuente_primeraCargaId_fkey', 'FOREIGN KEY ("primeraCargaId") REFERENCES carga_archivo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_lote_av', 'fila_lote_av_pkey', 'PRIMARY KEY (id)'],
    ['fila_lote_av', 'fila_lote_av_cargaId_fkey', 'FOREIGN KEY ("cargaId") REFERENCES carga_archivo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_lote_av', 'fila_lote_av_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_lote_av', 'fila_lote_av_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['fila_lote_av', 'fila_lote_av_loteId_fkey', 'FOREIGN KEY ("loteId") REFERENCES lote(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['instrumento', 'instrumento_pkey', 'PRIMARY KEY (id)'],
    ['intento_ingreso', 'intento_ingreso_pkey', 'PRIMARY KEY (id)'],
    ['intento_ingreso', 'intento_ingreso_usuarioId_fkey', 'FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['lote', 'lote_pkey', 'PRIMARY KEY (id)'],
    ['lote', 'lote_eventoId_fkey', 'FOREIGN KEY ("eventoId") REFERENCES evento_corporativo(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['lote', 'lote_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['lote', 'lote_loteOrigenId_fkey', 'FOREIGN KEY ("loteOrigenId") REFERENCES lote(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['lote', 'lote_ordenId_fkey', 'FOREIGN KEY ("ordenId") REFERENCES orden(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['movimiento_caja', 'movimiento_caja_pkey', 'PRIMARY KEY (id)'],
    ['movimiento_caja', 'movimiento_caja_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['movimiento_fondo', 'movimiento_fondo_pkey', 'PRIMARY KEY (id)'],
    ['movimiento_fondo', 'movimiento_fondo_ajusteCajaId_fkey', 'FOREIGN KEY ("ajusteCajaId") REFERENCES ajuste_caja(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['movimiento_fondo', 'movimiento_fondo_fondoId_fkey', 'FOREIGN KEY ("fondoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['orden', 'orden_pkey', 'PRIMARY KEY (id)'],
    ['orden', 'orden_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['orden', 'orden_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['plan_version', 'plan_version_pkey', 'PRIMARY KEY (id)'],
    ['plan_version', 'plan_version_aprobadaPorId_fkey', 'FOREIGN KEY ("aprobadaPorId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['precio_cierre', 'precio_cierre_pkey', 'PRIMARY KEY (id)'],
    ['precio_cierre', 'precio_cierre_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['regla_plan', 'regla_plan_pkey', 'PRIMARY KEY (id)'],
    ['regla_plan', 'regla_plan_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['regla_plan', 'regla_plan_planVersionId_fkey', 'FOREIGN KEY ("planVersionId") REFERENCES plan_version(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['rendimiento_fondo', 'rendimiento_fondo_pkey', 'PRIMARY KEY (id)'],
    ['rendimiento_fondo', 'rendimiento_fondo_ajusteCajaId_fkey', 'FOREIGN KEY ("ajusteCajaId") REFERENCES ajuste_caja(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['rendimiento_fondo', 'rendimiento_fondo_filaFuenteId_fkey', 'FOREIGN KEY ("filaFuenteId") REFERENCES fila_fuente(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['rendimiento_fondo', 'rendimiento_fondo_fondoId_fkey', 'FOREIGN KEY ("fondoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['resumen_ia', 'resumen_ia_pkey', 'PRIMARY KEY (id)'],
    ['simbolo_precio', 'simbolo_precio_pkey', 'PRIMARY KEY (id)'],
    ['simbolo_precio', 'simbolo_precio_instrumentoId_fkey', 'FOREIGN KEY ("instrumentoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['token_acceso', 'token_acceso_pkey', 'PRIMARY KEY (id)'],
    ['token_acceso', 'token_acceso_usuarioId_fkey', 'FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT'],
    ['usuario', 'usuario_pkey', 'PRIMARY KEY (id)'],
    ['valor_serie_oficial', 'valor_serie_oficial_pkey', 'PRIMARY KEY (id)'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_pkey', 'PRIMARY KEY (id)'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_fondoId_fkey', 'FOREIGN KEY ("fondoId") REFERENCES instrumento(id) ON UPDATE RESTRICT ON DELETE RESTRICT']
  ];
  disparadores text[] := ARRAY[
    ['ajuste_caja', 'ajuste_caja_solo_insercion', 'CREATE TRIGGER ajuste_caja_solo_insercion BEFORE DELETE OR UPDATE ON public.ajuste_caja FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['asignacion_venta', 'asignacion_venta_coherente', 'CREATE TRIGGER asignacion_venta_coherente BEFORE INSERT OR UPDATE OF "ordenVentaId", "loteId", cantidad ON public.asignacion_venta FOR EACH ROW EXECUTE FUNCTION inv_asignacion_coherente()'],
    ['carga_archivo', 'carga_archivo_reversion', 'CREATE TRIGGER carga_archivo_reversion BEFORE UPDATE ON public.carga_archivo FOR EACH ROW WHEN (((old.estado = ''REVERTIDO''::"EstadoCarga") OR (new.estado = ''REVERTIDO''::"EstadoCarga") OR (new."revertidaEn" IS DISTINCT FROM old."revertidaEn") OR (new."revertidaPorId" IS DISTINCT FROM old."revertidaPorId"))) EXECUTE FUNCTION inv_carga_reversion()'],
    ['certificacion', 'certificacion_solo_insercion', 'CREATE TRIGGER certificacion_solo_insercion BEFORE INSERT OR DELETE OR UPDATE ON public.certificacion FOR EACH ROW EXECUTE FUNCTION inv_certificacion_solo_retiro()'],
    ['certificacion_posicion', 'certificacion_posicion_solo_insercion', 'CREATE TRIGGER certificacion_posicion_solo_insercion BEFORE DELETE OR UPDATE ON public.certificacion_posicion FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['certificacion_posicion', 'certificacion_posicion_vigente', 'CREATE TRIGGER certificacion_posicion_vigente BEFORE INSERT ON public.certificacion_posicion FOR EACH ROW EXECUTE FUNCTION inv_certificacion_vigente()'],
    ['certificacion_fondo', 'certificacion_fondo_solo_encargo', 'CREATE TRIGGER certificacion_fondo_solo_encargo BEFORE DELETE OR UPDATE ON public.certificacion_fondo FOR EACH ROW EXECUTE FUNCTION inv_certificacion_fondo_solo_encargo()'],
    ['certificacion_fondo', 'certificacion_fondo_vigente', 'CREATE TRIGGER certificacion_fondo_vigente BEFORE INSERT ON public.certificacion_fondo FOR EACH ROW EXECUTE FUNCTION inv_certificacion_vigente()'],
    ['codigo_recuperacion', 'codigo_recuperacion_un_solo_uso', 'CREATE TRIGGER codigo_recuperacion_un_solo_uso BEFORE DELETE OR UPDATE ON public.codigo_recuperacion FOR EACH ROW EXECUTE FUNCTION inv_codigo_un_solo_uso()'],
    ['conciliacion', 'conciliacion_certificacion_vigente', 'CREATE TRIGGER conciliacion_certificacion_vigente BEFORE INSERT ON public.conciliacion FOR EACH ROW EXECUTE FUNCTION inv_certificacion_vigente()'],
    ['conciliacion', 'conciliacion_solo_insercion', 'CREATE TRIGGER conciliacion_solo_insercion BEFORE DELETE OR UPDATE ON public.conciliacion FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['config_ia', 'config_ia_instante', 'CREATE TRIGGER config_ia_instante BEFORE INSERT ON public.config_ia FOR EACH ROW EXECUTE FUNCTION inv_config_ia_instante()'],
    ['config_ia', 'config_ia_solo_insercion', 'CREATE TRIGGER config_ia_solo_insercion BEFORE DELETE OR UPDATE ON public.config_ia FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['tarifa_comision', 'tarifa_comision_instante', 'CREATE TRIGGER tarifa_comision_instante BEFORE INSERT ON public.tarifa_comision FOR EACH ROW EXECUTE FUNCTION inv_tarifa_comision_instante()'],
    ['tarifa_comision', 'tarifa_comision_solo_insercion', 'CREATE TRIGGER tarifa_comision_solo_insercion BEFORE DELETE OR UPDATE ON public.tarifa_comision FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['precio_intradia', 'precio_intradia_insercion', 'CREATE TRIGGER precio_intradia_insercion BEFORE INSERT ON public.precio_intradia FOR EACH ROW EXECUTE FUNCTION inv_precio_intradia_insercion()'],
    ['precio_intradia', 'precio_intradia_retiro', 'CREATE TRIGGER precio_intradia_retiro BEFORE DELETE OR UPDATE ON public.precio_intradia FOR EACH ROW EXECUTE FUNCTION inv_precio_intradia_retiro()'],
    ['control_conciliacion', 'control_conciliacion_solo_insercion', 'CREATE TRIGGER control_conciliacion_solo_insercion BEFORE DELETE OR UPDATE ON public.control_conciliacion FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['decision', 'decision_instante', 'CREATE TRIGGER decision_instante BEFORE INSERT ON public.decision FOR EACH ROW EXECUTE FUNCTION inv_decision_instante()'],
    ['decision', 'decision_solo_insercion', 'CREATE TRIGGER decision_solo_insercion BEFORE DELETE OR UPDATE ON public.decision FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['dividendo', 'dividendo_solo_insercion', 'CREATE TRIGGER dividendo_solo_insercion BEFORE DELETE OR UPDATE ON public.dividendo FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['dividendo_decretado', 'dividendo_decretado_retiro', 'CREATE TRIGGER dividendo_decretado_retiro BEFORE INSERT OR DELETE OR UPDATE ON public.dividendo_decretado FOR EACH ROW EXECUTE FUNCTION inv_solo_retiro(''registradoEn'')'],
    ['enlace_decision_orden', 'enlace_decision_orden_instante', 'CREATE TRIGGER enlace_decision_orden_instante BEFORE INSERT ON public.enlace_decision_orden FOR EACH ROW EXECUTE FUNCTION inv_enlace_decision_orden_instante()'],
    ['enlace_decision_orden', 'enlace_decision_orden_solo_insercion', 'CREATE TRIGGER enlace_decision_orden_solo_insercion BEFORE DELETE OR UPDATE ON public.enlace_decision_orden FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['fila_de_carga', 'fila_de_carga_solo_insercion', 'CREATE TRIGGER fila_de_carga_solo_insercion BEFORE DELETE OR UPDATE ON public.fila_de_carga FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['fila_fuente', 'fila_fuente_solo_insercion', 'CREATE TRIGGER fila_fuente_solo_insercion BEFORE DELETE OR UPDATE ON public.fila_fuente FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['intento_ingreso', 'intento_ingreso_solo_insercion', 'CREATE TRIGGER intento_ingreso_solo_insercion BEFORE DELETE OR UPDATE ON public.intento_ingreso FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['lote', 'lote_fijo', 'CREATE TRIGGER lote_fijo BEFORE UPDATE OF "instrumentoId", "fechaCompra", cantidad, "costoTotal" ON public.lote FOR EACH ROW EXECUTE FUNCTION inv_lote_fijo()'],
    ['movimiento_caja', 'movimiento_caja_solo_insercion', 'CREATE TRIGGER movimiento_caja_solo_insercion BEFORE DELETE OR UPDATE ON public.movimiento_caja FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['movimiento_fondo', 'movimiento_fondo_coherente', 'CREATE TRIGGER movimiento_fondo_coherente BEFORE INSERT OR UPDATE ON public.movimiento_fondo FOR EACH ROW EXECUTE FUNCTION inv_movimiento_fondo_coherente()'],
    ['movimiento_fondo', 'movimiento_fondo_solo_insercion', 'CREATE TRIGGER movimiento_fondo_solo_insercion BEFORE DELETE OR UPDATE ON public.movimiento_fondo FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['orden', 'orden_solo_insercion', 'CREATE TRIGGER orden_solo_insercion BEFORE DELETE OR UPDATE ON public.orden FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['plan_version', 'plan_version_instante', 'CREATE TRIGGER plan_version_instante BEFORE INSERT ON public.plan_version FOR EACH ROW EXECUTE FUNCTION inv_plan_version_instante()'],
    ['plan_version', 'plan_version_solo_insercion', 'CREATE TRIGGER plan_version_solo_insercion BEFORE DELETE OR UPDATE ON public.plan_version FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['precio_cierre', 'precio_cierre_insercion', 'CREATE TRIGGER precio_cierre_insercion BEFORE INSERT ON public.precio_cierre FOR EACH ROW EXECUTE FUNCTION inv_precio_cierre_insercion()'],
    ['precio_cierre', 'precio_cierre_retiro', 'CREATE TRIGGER precio_cierre_retiro BEFORE DELETE OR UPDATE ON public.precio_cierre FOR EACH ROW EXECUTE FUNCTION inv_retiro_vigente()'],
    ['regla_plan', 'regla_plan_solo_insercion', 'CREATE TRIGGER regla_plan_solo_insercion BEFORE DELETE OR UPDATE ON public.regla_plan FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['rendimiento_fondo', 'rendimiento_fondo_coherente', 'CREATE TRIGGER rendimiento_fondo_coherente BEFORE INSERT OR UPDATE ON public.rendimiento_fondo FOR EACH ROW EXECUTE FUNCTION inv_rendimiento_fondo_coherente()'],
    ['rendimiento_fondo', 'rendimiento_fondo_solo_insercion', 'CREATE TRIGGER rendimiento_fondo_solo_insercion BEFORE DELETE OR UPDATE ON public.rendimiento_fondo FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['resumen_ia', 'resumen_ia_instante', 'CREATE TRIGGER resumen_ia_instante BEFORE INSERT ON public.resumen_ia FOR EACH ROW EXECUTE FUNCTION inv_resumen_ia_instante()'],
    ['resumen_ia', 'resumen_ia_solo_insercion', 'CREATE TRIGGER resumen_ia_solo_insercion BEFORE DELETE OR UPDATE ON public.resumen_ia FOR EACH ROW EXECUTE FUNCTION inv_solo_insercion()'],
    ['token_acceso', 'token_acceso_un_solo_uso', 'CREATE TRIGGER token_acceso_un_solo_uso BEFORE DELETE OR UPDATE ON public.token_acceso FOR EACH ROW EXECUTE FUNCTION inv_token_un_solo_uso()'],
    ['usuario', 'usuario_transiciones', 'CREATE TRIGGER usuario_transiciones BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION inv_usuario_transiciones()'],
    ['valor_serie_oficial', 'valor_serie_oficial_retiro', 'CREATE TRIGGER valor_serie_oficial_retiro BEFORE INSERT OR DELETE OR UPDATE ON public.valor_serie_oficial FOR EACH ROW EXECUTE FUNCTION inv_solo_retiro(''traidoEn'')'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_insercion', 'CREATE TRIGGER valor_unidad_fondo_insercion BEFORE INSERT ON public.valor_unidad_fondo FOR EACH ROW EXECUTE FUNCTION inv_valor_unidad_fondo_insercion()'],
    ['valor_unidad_fondo', 'valor_unidad_fondo_retiro', 'CREATE TRIGGER valor_unidad_fondo_retiro BEFORE DELETE OR UPDATE ON public.valor_unidad_fondo FOR EACH ROW EXECUTE FUNCTION inv_retiro_vigente()']
  ];
  -- [nombre, md5(prosrc), proconfig unido con ';' ('' = sin SET)]. Ninguna puede ser SECURITY DEFINER.
  funciones text[] := ARRAY[
    ['inv_asignacion_coherente', 'e102cbd2ac508ce492a6081f44c8818d', ''],
    ['inv_carga_reversion', 'de8fc0662b39f8ccad6b91dd8bde5083', ''],
    ['inv_certificacion_fondo_solo_encargo', '0c694690f57d13c0fbd819a28130c975', ''],
    ['inv_certificacion_solo_retiro', '177e253d815166e075e30b75316c539a', ''],
    ['inv_certificacion_vigente', '4f29f5a78b3129f7ace16487160c5c4e', ''],
    ['inv_codigo_un_solo_uso', '6e20837f8ea30d38453ae6082f4e9301', ''],
    ['inv_config_ia_instante', 'abf0179024dd5f3151006171b5d76bb5', ''],
    ['inv_tarifa_comision_instante', 'abf0179024dd5f3151006171b5d76bb5', ''],
    ['inv_decision_instante', '0d4631b4ec6f4b4a688af968e5fb5a5d', ''],
    ['inv_enlace_decision_orden_instante', 'a7a550804fa3c435fa5553518e427de9', ''],
    ['inv_lote_fijo', '6906ddebe6b9194201de631eac40241a', ''],
    ['inv_movimiento_fondo_coherente', '53cb26c826f67c555b19e1b8ad9dffd0', ''],
    ['inv_plan_version_instante', 'abf0179024dd5f3151006171b5d76bb5', ''],
    ['inv_precio_cierre_insercion', '6bdf12a80eeee52cff6a412139ffe5c1', 'search_path=pg_catalog, public, pg_temp'],
    ['inv_precio_intradia_insercion', '02b4c0f2fb2317489ceb716f098290ec', 'search_path=pg_catalog, public, pg_temp'],
    ['inv_precio_intradia_retiro', '77a424acd02ce880d54449962caeaff7', 'search_path=pg_catalog, public, pg_temp'],
    ['inv_rendimiento_fondo_coherente', '9a6b541c07fa34227bf9a3476e9c48ca', ''],
    ['inv_resumen_ia_instante', '3225d295850c7feb0575a40ec4330442', ''],
    ['inv_retiro_vigente', '32c9d5c44cb3e2afe0a5ada4819d9a5f', 'search_path=pg_catalog, public, pg_temp'],
    ['inv_solo_insercion', '86053be6cc8c56d4cb328ac370f3cc77', ''],
    ['inv_solo_retiro', 'cabe3b51e599c2a5c6cdf4c16aadcb83', 'search_path=pg_catalog, pg_temp'],
    ['inv_token_un_solo_uso', 'eef69326d8da1a1ed8a4f5086d212546', ''],
    ['inv_usuario_transiciones', '368539024fbeaeb771669ff741aa7ed3', ''],
    ['inv_valor_unidad_fondo_insercion', '200c0ff4c9421344a810814a97568db0', 'search_path=pg_catalog, public, pg_temp']
  ];
  extensiones text[] := ARRAY['btree_gist', 'citext'];
  listados text[] := '{}';
  faltan text[] := '{}';
  distintos text[] := '{}';
  fila text[];
  x text;
  def text;
  unico boolean;
  sano boolean;
  valida boolean;
  habilitado "char";
  n_funciones int;
  definidor boolean;
  config text;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  FOREACH fila SLICE 1 IN ARRAY indices LOOP
    def := NULL;
    SELECT pg_get_indexdef(i.indexrelid), i.indisunique, (i.indisvalid AND i.indisready AND i.indislive) INTO def, unico, sano
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = fila[2] AND c.relnamespace = 'public'::regnamespace AND i.indrelid = to_regclass('public.' || quote_ident(fila[1]));
    IF def IS NULL THEN
      faltan := faltan || ('índice ' || fila[2]);
    ELSIF def <> fila[3] OR unico IS DISTINCT FROM (fila[3] LIKE 'CREATE UNIQUE INDEX %') OR NOT sano THEN
      distintos := distintos || ('índice ' || fila[2]);
    END IF;
  END LOOP;
  FOR x IN
    SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relnamespace = 'public'::regnamespace AND NOT (i.indisvalid AND i.indisready AND i.indislive) ORDER BY 1
  LOOP
    IF NOT ('índice ' || x) = ANY (distintos) THEN
      distintos := distintos || ('índice ' || x);
    END IF;
  END LOOP;

  FOREACH fila SLICE 1 IN ARRAY restricciones LOOP
    def := NULL;
    SELECT pg_get_constraintdef(c.oid), c.convalidated INTO def, valida
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass('public.' || quote_ident(fila[1])) AND c.conname = fila[2] AND c.contype IN ('c', 'x');
    IF def IS NULL THEN
      faltan := faltan || ('restricción ' || fila[2]);
    ELSIF NOT ((valida AND def = fila[3]) OR (NOT valida AND fila[2] = ANY (sin_validar) AND def = fila[3] || ' NOT VALID')) THEN
      distintos := distintos || ('restricción ' || fila[2]);
    END IF;
  END LOOP;

  FOREACH fila SLICE 1 IN ARRAY llaves LOOP
    def := NULL;
    SELECT pg_get_constraintdef(c.oid), c.convalidated INTO def, valida
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass('public.' || quote_ident(fila[1])) AND c.conname = fila[2] AND c.contype IN ('p', 'f');
    IF def IS NULL THEN
      faltan := faltan || ('llave ' || fila[2]);
    ELSIF def <> fila[3] OR NOT valida THEN
      distintos := distintos || ('llave ' || fila[2]);
    END IF;
  END LOOP;

  -- Toda FK con un índice que empiece por sus columnas (con RESTRICT, borrar o actualizar el padre la busca
  -- en la hija): si una migración o un DROP INDEX se lo quita, el despliegue se detiene.
  FOR x IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
    ORDER BY 1
  LOOP
    distintos := distintos || ('llave sin índice ' || x);
  END LOOP;

  FOREACH fila SLICE 1 IN ARRAY disparadores LOOP
    listados := listados || (fila[1] || '.' || fila[2]);
    def := NULL;
    SELECT pg_get_triggerdef(t.oid), t.tgenabled INTO def, habilitado
      FROM pg_trigger t
      WHERE t.tgrelid = to_regclass('public.' || quote_ident(fila[1])) AND t.tgname = fila[2] AND NOT t.tgisinternal;
    IF def IS NULL THEN
      faltan := faltan || ('disparador ' || fila[2]);
    ELSIF def <> fila[3] OR habilitado NOT IN ('O', 'A') THEN
      distintos := distintos || ('disparador ' || fila[2]);
    END IF;
  END LOOP;
  FOR x IN
    SELECT c.relname || '.' || t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal ORDER BY 1
  LOOP
    IF NOT x = ANY (listados) THEN
      distintos := distintos || ('disparador sobrante ' || x);
    END IF;
  END LOOP;
  FOR x IN
    SELECT DISTINCT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace AND t.tgenabled NOT IN ('O', 'A') ORDER BY 1
  LOOP
    distintos := distintos || ('disparadores deshabilitados en ' || x);
  END LOOP;

  -- Una sola por nombre (una sobrecarga no se cuela), con su md5, nunca SECURITY DEFINER (dentro, current_user sería
  -- el dueño: los disparadores de integridad de precios eximirían a todos) y con su SET exacto (el md5 no los ve).
  FOREACH fila SLICE 1 IN ARRAY funciones LOOP
    SELECT count(*), min(md5(p.prosrc)), bool_or(p.prosecdef), min(coalesce(array_to_string(p.proconfig, ';'), ''))
      INTO n_funciones, def, definidor, config
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fila[1];
    IF n_funciones = 0 THEN
      faltan := faltan || ('función ' || fila[1]);
    ELSIF n_funciones > 1 OR def <> fila[2] OR definidor OR config <> fila[3] THEN
      distintos := distintos || ('función ' || fila[1]);
    END IF;
  END LOOP;

  -- Los disparadores de integridad de precios y los de los instantes del plan (migración *_instantes_base) eximen a quien
  -- tenga los privilegios del dueño de la tabla: si inv_app o inv_precios fueran miembros de él (GRANT inv_dueno TO …),
  -- quedarían eximidos o, con SET ROLE, serían el dueño (y fijarían el instante del registro).
  FOR x IN
    SELECT r.rolname || ' en ' || c.relname FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname IN ('inv_app', 'inv_precios')
      AND c.oid IN (to_regclass('public.precio_cierre'), to_regclass('public.valor_unidad_fondo'), to_regclass('public.plan_version'), to_regclass('public.decision'), to_regclass('public.enlace_decision_orden'))
      AND pg_has_role(r.oid, c.relowner, 'MEMBER')
    ORDER BY 1
  LOOP
    distintos := distintos || ('rol con privilegios del dueño ' || x);
  END LOOP;
  -- Fase E: el disparador del instante de resumen_ia también exime al dueño. Ni inv_ia (el servicio de los resúmenes con
  -- IA) puede ser miembro del dueño de ninguna de estas tablas, ni inv_app o inv_precios del de resumen_ia.
  FOR x IN
    SELECT r.rolname || ' en ' || c.relname FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname IN ('inv_ia', 'inv_app', 'inv_precios')
      AND c.oid IN (to_regclass('public.precio_cierre'), to_regclass('public.valor_unidad_fondo'), to_regclass('public.plan_version'), to_regclass('public.decision'), to_regclass('public.enlace_decision_orden'), to_regclass('public.resumen_ia'))
      AND (r.rolname = 'inv_ia' OR c.oid = to_regclass('public.resumen_ia'))
      AND pg_has_role(r.oid, c.relowner, 'MEMBER')
    ORDER BY 1
  LOOP
    distintos := distintos || ('rol con privilegios del dueño ' || x);
  END LOOP;

  -- Fase E (E8): el disparador del instante de config_ia también exime al dueño. Ni inv_app (que la escribe), ni inv_ia (que
  -- la lee), ni inv_precios pueden ser miembros del dueño de config_ia.
  FOR x IN
    SELECT r.rolname || ' en ' || c.relname FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname IN ('inv_app', 'inv_ia', 'inv_precios')
      AND c.oid = to_regclass('public.config_ia')
      AND pg_has_role(r.oid, c.relowner, 'MEMBER')
    ORDER BY 1
  LOOP
    distintos := distintos || ('rol con privilegios del dueño ' || x);
  END LOOP;

  -- Fase E (O5): el disparador del instante de tarifa_comision también exime al dueño. Ni inv_app (que la escribe), ni
  -- inv_ia, ni inv_precios pueden ser miembros del dueño de tarifa_comision.
  FOR x IN
    SELECT r.rolname || ' en ' || c.relname FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname IN ('inv_app', 'inv_ia', 'inv_precios')
      AND c.oid = to_regclass('public.tarifa_comision')
      AND pg_has_role(r.oid, c.relowner, 'MEMBER')
    ORDER BY 1
  LOOP
    distintos := distintos || ('rol con privilegios del dueño ' || x);
  END LOOP;

  -- Precios cada minuto: el disparador de la inserción de precio_intradia también exime al dueño. Ni inv_app, ni inv_ia, ni
  -- inv_precios (que la escribe) pueden ser miembros del dueño de precio_intradia.
  FOR x IN
    SELECT r.rolname || ' en ' || c.relname FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname IN ('inv_app', 'inv_ia', 'inv_precios')
      AND c.oid = to_regclass('public.precio_intradia')
      AND pg_has_role(r.oid, c.relowner, 'MEMBER')
    ORDER BY 1
  LOOP
    distintos := distintos || ('rol con privilegios del dueño ' || x);
  END LOOP;

  FOREACH x IN ARRAY extensiones LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = x) THEN
      faltan := faltan || ('extensión ' || x);
    END IF;
  END LOOP;

  IF cardinality(faltan) > 0 OR cardinality(distintos) > 0 THEN
    RAISE EXCEPTION 'Guardián del esquema: faltan % y cambiaron % objeto(s). Faltan: %. Cambiaron: %',
      cardinality(faltan), cardinality(distintos), array_to_string(faltan, ', '), array_to_string(distintos, ', ');
  END IF;
  RAISE NOTICE 'Guardián del esquema: % índices, % restricciones (% sin validar), % llaves, % disparadores, % funciones y % extensiones en su lugar',
    cardinality(indices) / 3, cardinality(restricciones) / 3, cardinality(sin_validar), cardinality(llaves) / 3,
    cardinality(disparadores) / 3, cardinality(funciones) / 3, cardinality(extensiones);
END
$$;
