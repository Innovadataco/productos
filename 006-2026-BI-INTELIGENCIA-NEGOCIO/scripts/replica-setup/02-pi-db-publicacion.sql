-- ==========================================================================
-- 02-pi-db-publicacion.sql · Producto 006 · BI v2
-- Publicación lógica `bi_replica` en el Postgres de PI (pg_logical).
--
-- DÓNDE CORRE: en el Postgres de PI (pi-db · PUBLICADOR), DESPUÉS de
--   01-pi-db-crear-usuario-replica.sql. Lo ejecuta Jelkin con autorización.
--   Pre-requisito: wal_level=logical activo en pi-db (Fase A del 005, ya
--   verificado con SHOW wal_level el 2026-08-28).
--
-- REESCRITURA (2026-09-01 · SPEC-006): la publicación pasa de "23 tablas al
--   100% de las columnas" a 37 tablas con COLUMN LISTS (PostgreSQL >= 15; el
--   master es pg16) que CORTAN PII EN ORIGEN: las columnas vetadas (nombres,
--   documentos y valores de identificadores de menores/acudientes/profesores,
--   textos de reportes, IPs, user-agents, etc.) ni siquiera salen de pi-db
--   por el slot de replicación. Defensa en profundidad: el script 01 ya
--   revocaba SELECT al rol bi_replica; ahora tampoco viaja por el WAL lógico.
--
-- ESTADO: la publicación `bi_replica` YA EXISTE en PI con las 23 tablas
--   originales SIN column lists. Este script es IDEMPOTENTE y RECONCILIA:
--     · crea la publicación solo si falta (vacía; el bucle la puebla);
--     · ADD TABLE para las canónicas que falten (con su column list);
--     · DROP TABLE + ADD TABLE para las existentes cuya column list difiera
--       de la canónica (incluye quitar la lista si la canónica es "completa");
--     · DROP TABLE para las publicadas que YA NO son canónicas (paso 3b),
--       con GUARD: solo si están vacías en el master — si tienen datos,
--       aborta EN VOZ ALTA (nunca quita datos de PI).
--
--   ⚠️ TRAMPA PG16 (verificada en vivo 2026-09-01): NO usar
--   `ALTER PUBLICATION ... SET TABLE t (cols)` para recortar — SET TABLE
--   REEMPLAZA LA LISTA COMPLETA de tablas de la publicación con solo `t`.
--   El cambio de column list de UNA tabla se hace con DROP TABLE + ADD TABLE
--   (como aquí). Nota operativa: si la suscripción del 006 ya existiera al
--   correr esto, aplicar después `ALTER SUBSCRIPTION bi006_replica_sub
--   REFRESH PUBLICATION` en bi-db para propagar el cambio de columnas.
--
-- GUARDS (fallan EN VOZ ALTA con RAISE EXCEPTION y ON_ERROR_STOP=1):
--     · B2: una tabla canónica no existe en el master → aborta antes de tocar
--       la publicación.
--     · Tablas PROHIBIDAS publicadas (PII/credenciales/config) → aborta.
--     · Columnas VETADAS publicadas (lista explícita tabla.columna) → aborta
--       listando el culpable. Cubre tanto tablas con column list como tablas
--       publicadas completas que contengan la columna vetada.
--
-- EXCLUSIÓN DOCUMENTADA (desviación deliberada): `senal_comunitaria_cache`
--   NO se publica. Su PK (`identificadorReportado`) ES el nick en claro del
--   reportado y PostgreSQL exige incluir la replica identity en la column
--   list — no hay forma de publicarla sin sacar PII. La reincidencia ya viaja
--   agregada por `IdentificadorReportado` (sin `identificador`) +
--   `eventos_match`. Queda VETADA como tabla completa (guard §4).
--
-- REGLA DE GOBIERNO (AGENTS.md §7): agregar una tabla nueva a la publicación
--   exige pedirla por nombre y autorización de Jelkin. Las 44 tablas de abajo
--   son la lista canónica autorizada (23 originales D-20 del 005 + 17 nuevas
--   autorizadas para BI v2 el 2026-09-01 − 3 legacy vacías retiradas el mismo
--   día: Subscription, BillingCycle, AlertaSuscripcion + 7 autorizadas el
--   2026-09-03 para los Lotes A·B·C: Pago, pasos_procesamiento,
--   ReintentoReporte, HealthProbe, worker_logs, IncidenteInfra, y
--   PerfilOperador canonizada tras su publicación manual del 2026-09-02).
--
-- HALLAZGO CANDADO 15 del 005 (se conserva): modelos Prisma con @@map a
--   nombre snake_case/legacy en BD — la publicación usa el nombre REAL:
--     Estudiante               → Alumno                       (en la lista)
--     IdentificadorEstudiante  → IdentificadorAlumno          (en la lista;
--                                 su FK estudianteId está @map("alumnoId"))
--     ClasificacionRubricaVoto → clasificacion_rubrica_votos  (en la lista)
--     PatronInstitucional      → patrones_institucionales     (en la lista)
--     EventoMatch              → eventos_match                (en la lista)
--     ScoreCliente             → score_clientes               (en la lista)
--     SenalComunitariaCache    → senal_comunitaria_cache      (VETADA, arriba)
--   Verificar futuros @@map con: grep '@@map' schema.prisma (en el repo PI).
--
-- TABLAS LEGACY RETIRADAS (2026-09-01 · Lote 3 higiene BI v2): Subscription,
--   BillingCycle y AlertaSuscripcion salieron del canon y de la publicación
--   (placeholder vacías del 005; verificado: 0 filas en PI y en la réplica).
--   El reconciliador (paso 3b) las quita de bi_replica SOLO si están vacías
--   en el master; si alguna tuviera datos, aborta EN VOZ ALTA. Las shells
--   vacías en bi-db se dropean con 07-bi-db-limpieza-legacy.sql.
--   NOTA: FuenteReporte iba en esta lista, pero el guard 3b la detectó con
--   19 filas reales (antifraude de PI activo desde 2026-09-02) — se queda.
-- ==========================================================================

DO $recon$
DECLARE
  par             text[];
  tabla           text;
  cols_esperadas  text[];   -- NULL = tabla completa (sin column list)
  cols_ordenadas  text[];
  cols_actuales   text[];
  tiene_lista     boolean;
  cols_sql        text;
  n_tablas        integer;
  pub_tabla       text;
  n_filas         bigint;

  -- ── LISTA CANÓNICA (44 tablas · LISTA BLANCA deny-by-default) ──────────
  -- 2026-09-05: TODA tabla publica columnas EXPLÍCITAS. Si PI agrega una
  -- columna nueva, NO viaja hasta que el canon la nombre. Cortadas por
  -- minimización (Ley 1581): contenido narrativo, JSON libre, vectores y
  -- PII destilado — ver notas por tabla y columnas_vetadas abajo.
  -- Cada fila: {tabla, CSV exacto de columnas publicadas} (orden libre; el
  -- script compara ordenado). NULL ya no se usa: deny-by-default total.
  canon text[][] := ARRAY[
    ARRAY['AcudienteEstudiante', 'id,estudianteId,orden,relacion,createdAt,updatedAt,estado'],
    ARRAY['AlertaColegio', 'id,colegioId,reporteId,identificadorAlumnoId,estado,creadoEn,actualizadoEn,patronInstitucionalId,identificadorProfesorId,identificadorAcudienteId,tipoSujeto,prioridad,vencimientoSla,asignadoAId,identificadorIntegranteComiteId'],
    ARRAY['Alumno', 'id,cursoId,colegioId,estado,createdAt,updatedAt'],
    ARRAY['AuditLog', 'id,accion,tipoRecurso,recursoId,usuarioId,parametroId,creadoEn,colegioId'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): metadatos
    ARRAY['Ciudad', 'id,nombre,paisId,esActivo,creadoEn,lat,lng,departamentoId,geonameId,nombreNormalizado,poblacion'],
    ARRAY['ClasificacionIA', 'id,reporteId,categoria,confianza,contienePii,modeloUsado,latenciaMs,promptTokens,responseTokens,creadoEn,categoriasSecundarias,modeloCascada,posibleAgresorPar,usoCascada,votos,overrideModeloUsado'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): piiDetectada, rawResponse
    ARRAY['Colegio', 'id,nombre,paisId,departamentoId,ciudadId,direccion,inicioServicio,finServicio,tipoPeriodo,estado,tenantId,creadoEn,actualizadoEn,nit'],
    ARRAY['ContactoConfianza', 'id,usuarioId,activo,creadoEn,actualizadoEn,parentesco'],
    ARRAY['CorreccionAdmin', 'id,clasificacionId,categoriaOriginal,categoriaCorregida,adminId,creadoEn,confirmada'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): motivo
    ARRAY['Curso', 'id,colegioId,nombre,grado,anioLectivo,estado,createdAt,updatedAt,profesorTitularId'],
    ARRAY['Departamento', 'id,codigo,nombre,paisId,esActivo,creadoEn,actualizadoEn'],
    ARRAY['DerivaMotorSnapshot', 'id,semanaInicio,categoria,total,correcciones,tasaCorreccion,accuracyBanco,brechaPp,alertada,creadoEn'],
    -- EmbeddingReporte: FUERA DEL CANON (whitelist 2026-09-05) — su `vector` es huella
    --   revertible del texto del reporte (PII destilado, Ley 1581) y BI jamás la
    --   lee. Se conserva en el suscriptor como shell vacío + índice HNSW
    --   (índice crítico del guardián scripts/verify-hnsw-indexes.ts).
    ARRAY['FuenteReporte', 'id,reporteId,ipHash,fingerprintHash,cuentaDiasAntiguedad,reportesPrevios,reportesConfirmados,reportesDescartados,pesoAplicado,creadoEn'],
    ARRAY['HealthProbe', 'id,senal,ok,latenciaMs,creadoEn,metodo'],
    ARRAY['Hijo', 'id,anioNacimiento,sexo,creadoEn,actualizadoEn,estado'],
    ARRAY['HijoPadre', 'id,hijoId,usuarioId,creadoEn'],
    ARRAY['IdentificadorAcudiente', 'id,acudienteId,colegioId,tipo,plataformaId,estado,createdAt,updatedAt'],
    ARRAY['IdentificadorAlumno', 'id,alumnoId,tipo,plataformaId,etiquetaRelacion,estado,createdAt,updatedAt,colegioId'],
    ARRAY['IdentificadorContacto', 'id,contactoId,tipo,plataformaId,activo,creadoEn,actualizadoEn'],
    ARRAY['IdentificadorHijo', 'id,hijoId,tipo,plataformaId,activo,creadoEn,actualizadoEn'],
    ARRAY['IdentificadorProfesor', 'id,profesorId,colegioId,tipo,plataformaId,estado,createdAt,updatedAt'],
    ARRAY['IdentificadorReportado', 'id,plataformaId,totalReportes,reportesAutenticados,reportesAnonimos,esVisiblePublicamente,ultimoReporteEn,creadoEn,actualizadoEn,nivelRiesgo,score,scoreAnonimo,scoreAutenticado,scoreAjustado,ocultoPorComiteEn,reportesAprobados,autenticadosAprobados'],
    ARRAY['IncidenteInfra', 'id,senal,estado,inicio,fin,creadoEn,actualizadoEn'],
    ARRAY['OnboardingColegio', 'id,colegioId,estado,pasoActual,completadoEn,creadoEn,actualizadoEn'],
    ARRAY['Pago', 'id,suscripcionId,duracionCubierta,montoBaseUSD,descuentoAplicadoUSD,montoNetoUSD,tasaCambioAplicada,montoLocalPagado,monedaLocal,metodoDeclarado,fechaReporte,fechaAutorizacion,estado,createdAt,updatedAt,montoReembolsoUSD'],
    ARRAY['Pais', 'id,codigo,nombre,esActivo,creadoEn'],
    ARRAY['PerfilOperador', 'id,usuarioId,cupoMaximo,esComite,esRevisorDeApelaciones,actualizadoEn'],
    --   ↑ columna publicada real (autorizada 2026-09-02). NOTAS: bi-db tenía
    --     columnas bootstrap huérfanas (notasInternas/creadoPorId/creadoEn/
    --     ultimoEmailNotificacionEn) que NUNCA viajaron por la réplica — se
    --     dropean del suscriptor en 09-bi-db-limpieza-contenido.sql.
    ARRAY['Plan', 'id,nombre,descripcion,precio,creadoEn,tipoTitular,duracion,anio,precioBaseUSD,descuentoAnualPct,activo,creadoPorAdminId,createdAt,updatedAt,precioBaseCOP,esFreemium,usosMaximosPorCliente'],
    ARRAY['Plataforma', 'id,clave,nombre,categoria,esActiva,creadoEn'],
    ARRAY['Profesor', 'id,colegioId,estado,createdAt,updatedAt,anioNacimiento,sexo'],
    ARRAY['ReintentoReporte', 'id,reporteId,intento,exitoso,creadoEn'],
    ARRAY['Reporte', 'id,plataformaId,fechaIncidente,ciudad,pais,estado,esAnonimo,reporteOrigenId,numeroSeguimiento,tenantId,creadoEn,actualizadoEn,paisId,ciudadId,otraPlataforma,edadVictima,prioridadAlta,esRafaga,eliminado,eliminadoEn,motivoBaja,fuenteConfianza,anonimizacionValidadaEn,origenRol,reportePrincipalId,operadorId'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): keywordsDetectadas
    ARRAY['SolicitudComite', 'id,reporteId,numero,estado,comiteId,operadorId,creadoEn,resueltoEn,alertaColegioId,colegioId,creadoPorId,integranteFirmanteId,analisisActualizadoEn,analisisPorId,recomendacionInformeEn,recomendacionPorId'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): analisis, motivo, resolucion
    ARRAY['Suscripcion', 'id,tipoTitular,colegioId,usuarioId,estado,planActualId,fechaInicio,fechaFin,fechaCorteProgramado,esFreemium,freemiumFechaFin,monedaLocal,paisCliente,suspendidaEn,canceladaEn,canceladaPorUsuario,createdAt,updatedAt,origen,autorizadoPorAdminId,autorizadoEn,metodoPagoManual,montoRealPagado,fechaPagoReal'],
    ARRAY['Tenant', 'id,nombre,estado,creadoEn'],
    ARRAY['TipoDocumento', 'id,clave,nombre,categoria,esActiva,creadoEn'],
    ARRAY['TransicionReporte', 'id,reporteId,estadoAnterior,estadoNuevo,responsableTipo,responsableId,creadoEn'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): metadatos, motivo
    ARRAY['clasificacion_rubrica_votos', 'id,clasificacionIAId,modelo,categoria,cumple,creadoEn'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): preguntasJson
    ARRAY['demo_marcado', 'id,entidad,entidadId,creadoEn'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): metadata
    ARRAY['eventos_match', 'id,identificadorId,reporteNuevoId,conteoAcumulado,ciudades,conductasCoincidentes,interCiudad,creadoEn'],
    ARRAY['pasos_procesamiento', 'id,reporteId,etapa,veredicto,latenciaMs,creadoEn'],
    ARRAY['patrones_institucionales', 'id,colegioId,periodo,grado,conducta,plataformaId,conteo,creadoEn,actualizadoEn'],
    ARRAY['score_clientes', 'id,suscripcionId,periodo,componenteReportes,componenteCasos,componenteAlertas,componenteSesiones,pesoReportes,pesoCasos,pesoAlertas,pesoSesiones,scoreTotal,percentilEnCohorte,calculadoEn'],
    ARRAY['worker_logs', 'id,servicio,nivel,creadoEn'],
    --   ↑ cortadas (contenido/PII · whitelist 2026-09-05): mensaje
  ];

  -- ── TABLAS PROHIBIDAS (Ley 1581 · jamás en la publicación) ─────────────
  tablas_prohibidas text[] := ARRAY[
    'Usuario', 'Password', 'Session', 'TokenRecuperacion', 'CodigoVerificacion',
    'ParametroSistema', 'CargaRosterSesion', 'DatasetEntrenamiento',
    'DocumentoApelacion', 'AccesoDocumentoApelacion', 'block_list',
    'IntegranteComite', 'ContactoEmergencia',
    'contactos_emergencia', 'EventoExpediente', 'NotaSeguimiento',
    'AclaracionExpediente', 'aclaracion_expediente', 'InformeConsolidado',
    'informes_consolidados', 'Apelacion', 'AnalisisExpediente', 'InformePadre',
    'TokenRegistro', 'notificaciones', 'RateLimit',
    'simulacion_runs', 'simulacion_reportes',
    'simulacion_abuso_runs', 'sesiones_log', 'audit_consentimientos',
    -- PK = nick en claro del reportado: impublicable sin PII (ver cabecera).
    'senal_comunitaria_cache'
    -- NOTA (2026-09-03): HealthProbe, worker_logs, Pago, pasos_procesamiento,
    -- ReintentoReporte e IncidenteInfra SALIERON de esta lista — autorizadas
    -- por Jelkin para los Lotes A·B·C (publicadas con column list, arriba).
  ];

  -- ── COLUMNAS VETADAS (tabla, columna) · defensa final anti-PII ─────────
  -- Si la tabla está publicada completa y CONTIENE la columna, o si la
  -- column list publicada la INCLUYE → EXCEPTION. Protege contra drift
  -- externo y contra errores al editar `canon` arriba.
  columnas_vetadas text[][] := ARRAY[
    ARRAY['Alumno', 'nombre'], ARRAY['Alumno', 'apellidos'],
    ARRAY['Alumno', 'documentoTipo'], ARRAY['Alumno', 'documentoNumero'],
    ARRAY['IdentificadorAlumno', 'valor'],
    ARRAY['Reporte', 'identificador'], ARRAY['Reporte', 'texto'],
    ARRAY['Reporte', 'textoOriginal'], ARRAY['Reporte', 'usuarioId'],
    ARRAY['Reporte', 'comiteId'],
    ARRAY['Reporte', 'eliminadoPorId'], ARRAY['Reporte', 'anonimizacionValidadaPorId'],
    ARRAY['Reporte', 'processingError'], ARRAY['Reporte', 'notaBaja'],
    ARRAY['Colegio', 'representanteLegalNombre'], ARRAY['Colegio', 'representanteLegalIdentificacion'],
    ARRAY['Colegio', 'representanteLegalEmail'], ARRAY['Colegio', 'representanteLegalTelefono'],
    ARRAY['AuditLog', 'ipAddress'], ARRAY['AuditLog', 'userAgent'],
    ARRAY['AuditLog', 'valorAnterior'], ARRAY['AuditLog', 'valorNuevo'],
    ARRAY['Profesor', 'nombre'], ARRAY['Profesor', 'apellidos'],
    ARRAY['Profesor', 'tipoDocumento'], ARRAY['Profesor', 'numeroDocumento'],
    ARRAY['Profesor', 'email'], ARRAY['Profesor', 'telefono'],
    ARRAY['AcudienteEstudiante', 'nombre'], ARRAY['AcudienteEstudiante', 'telefono'],
    ARRAY['AcudienteEstudiante', 'email'],
    ARRAY['IdentificadorAcudiente', 'valor'],
    ARRAY['IdentificadorProfesor', 'valor'],
    ARRAY['Hijo', 'nombre'], ARRAY['Hijo', 'apellidos'],
    ARRAY['Hijo', 'documentoTipo'], ARRAY['Hijo', 'documentoNumero'],
    ARRAY['IdentificadorHijo', 'valor'],
    ARRAY['ContactoConfianza', 'nombre'], ARRAY['ContactoConfianza', 'etiqueta'],
    ARRAY['ContactoConfianza', 'nota'],
    ARRAY['IdentificadorContacto', 'valor'],
    ARRAY['IdentificadorReportado', 'identificador'],
    ARRAY['Suscripcion', 'contratoPDFUrl'], ARRAY['Suscripcion', 'codigoReferidoPropio'],
    ARRAY['Suscripcion', 'codigoReferidoUsado'], ARRAY['Suscripcion', 'motivoCancelacion'],
    ARRAY['Suscripcion', 'referenciaPagoManual'],
    -- PerfilOperador (canonizada 2026-09-03): no publicar texto libre ni quién
    -- creó el perfil.
    ARRAY['PerfilOperador', 'notas'], ARRAY['PerfilOperador', 'creadoPor'],
    -- Lotes A·B·C (2026-09-03): vetadas de las 6 tablas nuevas.
    ARRAY['Pago', 'comprobanteAdjuntoUrl'], ARRAY['Pago', 'comprobanteMimeType'],
    ARRAY['Pago', 'comprobanteHashSha256'], ARRAY['Pago', 'autorizadoPorAdminId'],
    ARRAY['Pago', 'codigoReferidoUsado'], ARRAY['Pago', 'motivoRechazo'],
    ARRAY['Pago', 'motivoReembolso'], ARRAY['Pago', 'referenciaReembolso'],
    ARRAY['Pago', 'notasCliente'],
    ARRAY['pasos_procesamiento', 'detalle'],
    ARRAY['ReintentoReporte', 'error'],
    ARRAY['HealthProbe', 'detalle'],
    ARRAY['worker_logs', 'contextoJson'],
    ARRAY['IncidenteInfra', 'detalle'], ARRAY['IncidenteInfra', 'ultimoEmailEn'],
    ARRAY['senal_comunitaria_cache', 'identificadorReportado'],
    -- WHITELIST 2026-09-05 (minimización Ley 1581): contenido narrativo, PII
    -- destilado, JSON libre y vectores. Redundante con la lista blanca del
    -- canon (una columna vetada no puede estar publicada) — se conserva como
    -- tripwire contra re-ADD manuales.
    ARRAY['SolicitudComite', 'motivo'], ARRAY['SolicitudComite', 'resolucion'],
    ARRAY['SolicitudComite', 'analisis'],
    ARRAY['ClasificacionIA', 'rawResponse'], ARRAY['ClasificacionIA', 'piiDetectada'],
    ARRAY['CorreccionAdmin', 'motivo'],
    ARRAY['TransicionReporte', 'motivo'], ARRAY['TransicionReporte', 'metadatos'],
    ARRAY['Reporte', 'keywordsDetectadas'],
    ARRAY['AuditLog', 'metadatos'],
    ARRAY['worker_logs', 'mensaje'],
    ARRAY['clasificacion_rubrica_votos', 'preguntasJson'],
    ARRAY['demo_marcado', 'metadata'],
    ARRAY['EmbeddingReporte', 'vector'],
    -- PerfilOperador: columna canónica publicada (2026-09-02). Las columnas
    -- bootstrap del suscriptor (notasInternas/creadoPorId/creadoEn/
    -- ultimoEmailNotificacionEn) nunca viajaron por la réplica — se dropean
    -- en 09-bi-db-limpieza-contenido.sql.
    ARRAY['PerfilOperador', 'notasInternas'], ARRAY['PerfilOperador', 'creadoPorId']
  ];

  tabla_pii  text;
  par_vetado text[];
BEGIN
  -- 0. Column lists requieren PostgreSQL >= 15 (el master de PI es pg16).
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION '[02] Column lists en publicaciones requieren PostgreSQL >= 15 (master: %). Abortando.', current_setting('server_version');
  END IF;

  -- 1. GUARD B2: TODA tabla canónica debe existir en el master (falla antes
  --    de tocar la publicación).
  FOREACH par SLICE 1 IN ARRAY canon LOOP
    IF to_regclass(format('public.%I', par[1])) IS NULL THEN
      RAISE EXCEPTION '[02] Tabla canónica % NO existe en el master (schema public) — abortando sin tocar la publicación (B2). Verificar @@map en schema.prisma de PI.', par[1];
    END IF;
  END LOOP;

  -- 2. Crear la publicación SOLO si no existe (vacía; el paso 3 la puebla).
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'bi_replica') THEN
    EXECUTE 'CREATE PUBLICATION bi_replica';
    RAISE NOTICE '[02] Publicación bi_replica creada (vacía) — poblando con la lista canónica';
  ELSE
    RAISE NOTICE '[02] Publicación bi_replica ya existe — reconciliando tablas y column lists';
  END IF;

  -- 3. Reconciliar: ADD TABLE si falta · SET TABLE si la column list difiere.
  FOREACH par SLICE 1 IN ARRAY canon LOOP
    tabla := par[1];
    cols_esperadas := CASE WHEN par[2] IS NULL THEN NULL
                           ELSE string_to_array(par[2], ',') END;
    cols_ordenadas := CASE WHEN cols_esperadas IS NULL THEN NULL
                           ELSE (SELECT array_agg(c ORDER BY c) FROM unnest(cols_esperadas) AS c) END;

    -- Estado actual en la publicación (pg_publication_rel.prattrs: NULL = sin
    -- column list; si hay lista, se expande a nombres via pg_attribute).
    SELECT (pr.prattrs IS NOT NULL),
           CASE WHEN pr.prattrs IS NULL THEN NULL
                ELSE (SELECT array_agg(a.attname ORDER BY a.attname)
                        FROM pg_attribute a
                       WHERE a.attrelid = pr.prrelid
                         AND a.attnum = ANY (string_to_array(pr.prattrs::text, ' ')::smallint[])
                         AND NOT a.attisdropped)
           END
      INTO tiene_lista, cols_actuales
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.pubname = 'bi_replica' AND n.nspname = 'public' AND c.relname = tabla;

    IF cols_esperadas IS NOT NULL THEN
      cols_sql := (SELECT string_agg(quote_ident(c), ', ') FROM unnest(cols_esperadas) AS c);
    END IF;

    IF NOT FOUND THEN
      -- Falta: agregar (con column list si aplica).
      IF cols_esperadas IS NULL THEN
        EXECUTE format('ALTER PUBLICATION bi_replica ADD TABLE public.%I', tabla);
        RAISE NOTICE '[02] Tabla agregada a bi_replica (completa): %', tabla;
      ELSE
        EXECUTE format('ALTER PUBLICATION bi_replica ADD TABLE public.%I (%s)', tabla, cols_sql);
        RAISE NOTICE '[02] Tabla agregada a bi_replica (column list, % columnas): %', array_length(cols_esperadas, 1), tabla;
      END IF;
    ELSIF (tiene_lista <> (cols_ordenadas IS NOT NULL))
       OR (tiene_lista AND cols_ordenadas IS NOT NULL AND cols_actuales IS DISTINCT FROM cols_ordenadas) THEN
      -- Existe pero su column list difiere de la canónica: DROP + ADD.
      -- (PG16: SET TABLE reemplazaría TODA la lista de la publicación — trampa
      --  verificada en vivo; nunca usarlo para recortar una sola tabla.)
      EXECUTE format('ALTER PUBLICATION bi_replica DROP TABLE public.%I', tabla);
      IF cols_esperadas IS NULL THEN
        EXECUTE format('ALTER PUBLICATION bi_replica ADD TABLE public.%I', tabla);
        RAISE NOTICE '[02] Column list retirada (canónica = completa): %', tabla;
      ELSE
        EXECUTE format('ALTER PUBLICATION bi_replica ADD TABLE public.%I (%s)', tabla, cols_sql);
        RAISE NOTICE '[02] Column list corregida (% columnas): %', array_length(cols_esperadas, 1), tabla;
      END IF;
    END IF;
  END LOOP;

  -- 3b. Reconciliador inverso: DROP TABLE para las publicadas que YA NO son
  --     canónicas (ej. legacy retiradas). GUARD B1: solo si la tabla está
  --     VACÍA en el master; si tiene datos, aborta EN VOZ ALTA y no toca
  --     nada — quitar una tabla con datos de la publicación es decisión
  --     humana (implica decidir qué hacer con los datos ya replicados).
  FOR pub_tabla IN
    SELECT c.relname
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.pubname = 'bi_replica' AND n.nspname = 'public'
       AND c.relname NOT IN (SELECT canon[i][1] FROM generate_subscripts(canon, 1) AS i)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', pub_tabla) INTO n_filas;
    IF n_filas > 0 THEN
      RAISE EXCEPTION '[02] La tabla % está publicada pero ya NO es canónica y tiene % filas en el master — abortando. Decisión humana: o vuelve al canon, o se retira a mano sabiendo qué pasa con sus datos.', pub_tabla, n_filas;
    END IF;
    EXECUTE format('ALTER PUBLICATION bi_replica DROP TABLE public.%I', pub_tabla);
    RAISE NOTICE '[02] Tabla NO canónica retirada de bi_replica (vacía en master): %', pub_tabla;
  END LOOP;

  -- 4. GUARD PII tablas (Ley 1581 · B2): falla EN VOZ ALTA si hay una tabla
  --    prohibida publicada. Este script NUNCA la quita — retirarla a mano.
  FOREACH tabla_pii IN ARRAY tablas_prohibidas LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'bi_replica' AND schemaname = 'public' AND tablename = tabla_pii
    ) THEN
      RAISE EXCEPTION '[02] PII en publicación bi_replica: tabla % — PROHIBIDA por Ley 1581. Retirarla con ALTER PUBLICATION bi_replica DROP TABLE % antes de continuar.', tabla_pii, tabla_pii;
    END IF;
  END LOOP;

  -- 5. GUARD PII columnas: falla EN VOZ ALTA listando el culpable si una
  --    columna vetada quedó publicada (drift externo o error al editar canon).
  FOREACH par_vetado SLICE 1 IN ARRAY columnas_vetadas LOOP
    SELECT (pr.prattrs IS NOT NULL),
           CASE WHEN pr.prattrs IS NULL THEN NULL
                ELSE (SELECT array_agg(a.attname ORDER BY a.attname)
                        FROM pg_attribute a
                       WHERE a.attrelid = pr.prrelid
                         AND a.attnum = ANY (string_to_array(pr.prattrs::text, ' ')::smallint[])
                         AND NOT a.attisdropped)
           END
      INTO tiene_lista, cols_actuales
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.pubname = 'bi_replica' AND n.nspname = 'public' AND c.relname = par_vetado[1];

    IF FOUND AND (
         (tiene_lista AND par_vetado[2] = ANY (cols_actuales))
      OR (NOT tiene_lista AND EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = format('public.%I', par_vetado[1])::regclass
               AND a.attname = par_vetado[2]
               AND a.attnum > 0 AND NOT a.attisdropped))
    ) THEN
      RAISE EXCEPTION '[02] PII en publicación bi_replica: columna %.% — VETADA por Ley 1581. Corregir la column list con ALTER PUBLICATION bi_replica DROP TABLE % + ADD TABLE % (…) antes de continuar (NUNCA SET TABLE: reemplaza la lista completa).', par_vetado[1], par_vetado[2], par_vetado[1], par_vetado[1];
    END IF;
  END LOOP;

  -- 6. NOTICE con el total.
  SELECT count(*) INTO n_tablas FROM pg_publication_tables
   WHERE pubname = 'bi_replica' AND schemaname = 'public';
  RAISE NOTICE '[02] Reconciliación completa: % tablas en bi_replica (canónicas: %)', n_tablas, array_upper(canon, 1);
END $recon$;

-- ==========================================================================
-- Resumen final.
-- Nota técnica: el flag de column list (`prattrs`) vive en el catálogo
-- pg_publication_rel, NO en la vista pg_publication_tables — de ahí el join.
-- ==========================================================================
SELECT p.pubname, c.relname AS tablename, pr.prattrs IS NOT NULL AS tiene_column_list
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'bi_replica' AND n.nspname = 'public'
ORDER BY 2;
-- Esperado: 44 filas · tiene_column_list = t en las 22 tablas con recorte
-- (Reporte, Colegio, Alumno, IdentificadorAlumno, AuditLog, Profesor,
--  AcudienteEstudiante, IdentificadorAcudiente, IdentificadorProfesor, Hijo,
--  IdentificadorHijo, ContactoConfianza, IdentificadorContacto,
--  IdentificadorReportado, Suscripcion, Pago, pasos_procesamiento,
--  ReintentoReporte, HealthProbe, worker_logs, IncidenteInfra, PerfilOperador) · f en las 22
-- completas.
-- NUNCA deben aparecer las tablas prohibidas (ver cabecera §GUARDS) ni las
-- legacy retiradas (Subscription, BillingCycle, AlertaSuscripcion).
