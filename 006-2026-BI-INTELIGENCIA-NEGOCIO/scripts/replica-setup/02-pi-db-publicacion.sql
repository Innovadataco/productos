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
--   100% de las columnas" a 40 tablas con COLUMN LISTS (PostgreSQL >= 15; el
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
--     · NUNCA quita tablas de forma permanente ni toca datos de PI.
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
--   exige pedirla por nombre y autorización de Jelkin. Las 40 tablas de abajo
--   son la lista canónica autorizada (23 originales D-20 del 005 + 17 nuevas
--   autorizadas para BI v2 el 2026-09-01).
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
-- TABLAS LEGACY (se mantienen por compatibilidad con la réplica ya activa;
--   hoy vacías o placeholder en PI): Subscription, BillingCycle,
--   FuenteReporte, AlertaSuscripcion.
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

  -- ── LISTA CANÓNICA (40 tablas) ─────────────────────────────────────────
  -- Cada fila: {tabla, columnas} · columnas = NULL → completa; si no, CSV
  -- exacto de columnas publicadas (orden libre; el script compara ordenado).
  canon text[][] := ARRAY[
    -- ── 23 originales (D-20 del 005) · 5 con recorte anti-PII ────────────
    -- Reporte: sin texto/textoOriginal (evidencia cifrada), sin identificador
    -- (nick del reportado = PII del presunto; la reincidencia agrega vía
    -- IdentificadorReportado), sin usuarioId/operadorId/comiteId/
    -- eliminadoPorId/anonimizacionValidadaPorId (personas), sin
    -- processingError/notaBaja (texto libre), sin ciudad/pais/otraPlataforma
    -- (texto libre del reportante; la geo viaja por paisId/ciudadId).
    -- Nota schema: Reporte usa `actualizadoEn` (no updatedAt) y NO tiene
    -- departamentoId ni colegioId.
    ARRAY['Reporte', 'id,plataformaId,fechaIncidente,paisId,ciudadId,ciudad,pais,otraPlataforma,estado,esAnonimo,edadVictima,origenRol,reporteOrigenId,numeroSeguimiento,tenantId,prioridadAlta,keywordsDetectadas,esRafaga,fuenteConfianza,eliminado,motivoBaja,eliminadoEn,anonimizacionValidadaEn,creadoEn,actualizadoEn'],
    ARRAY['ClasificacionIA', NULL],
    ARRAY['clasificacion_rubrica_votos', NULL],  -- @@map · nombre real en BD
    ARRAY['CorreccionAdmin', NULL],
    ARRAY['EmbeddingReporte', NULL],
    ARRAY['TransicionReporte', NULL],
    ARRAY['SolicitudComite', NULL],
    ARRAY['FuenteReporte', NULL],                -- LEGACY (vacía/placeholder)
    ARRAY['Subscription', NULL],                 -- LEGACY (vacía/placeholder)
    ARRAY['BillingCycle', NULL],                 -- LEGACY (vacía/placeholder)
    ARRAY['Plan', NULL],
    ARRAY['Tenant', NULL],
    -- Colegio: sin representanteLegalNombre/Identificacion/Email/Telefono
    -- (PII del representante legal).
    ARRAY['Colegio', 'id,nombre,nit,paisId,departamentoId,ciudadId,direccion,inicioServicio,finServicio,tipoPeriodo,estado,tenantId,creadoEn,actualizadoEn'],
    ARRAY['Curso', NULL],
    -- Alumno (@@map de Estudiante): NUNCA nombre/apellidos/documentoTipo/
    -- documentoNumero — PII de menor.
    ARRAY['Alumno', 'id,cursoId,colegioId,estado,createdAt,updatedAt'],
    -- IdentificadorAlumno (@@map de IdentificadorEstudiante): NUNCA valor.
    ARRAY['IdentificadorAlumno', 'id,alumnoId,colegioId,tipo,plataformaId,etiquetaRelacion,estado,createdAt,updatedAt'],
    ARRAY['AlertaColegio', NULL],
    ARRAY['AlertaSuscripcion', NULL],            -- LEGACY (vacía/placeholder)
    ARRAY['Plataforma', NULL],
    ARRAY['Pais', NULL],
    ARRAY['Departamento', NULL],
    ARRAY['Ciudad', NULL],
    -- AuditLog: sin ipAddress/userAgent (trazabilidad personal) ni
    -- valorAnterior/valorNuevo (pueden arrastrar valores PII).
    ARRAY['AuditLog', 'id,accion,tipoRecurso,recursoId,usuarioId,parametroId,colegioId,metadatos,creadoEn'],
    -- ── 17 nuevas autorizadas (BI v2 · 2026-09-01) ───────────────────────
    -- Profesor: NUNCA nombre/apellidos/tipoDocumento/numeroDocumento/email/
    -- telefono — PII de un adulto del colegio.
    ARRAY['Profesor', 'id,colegioId,anioNacimiento,sexo,estado,createdAt,updatedAt'],
    -- AcudienteEstudiante: NUNCA nombre/telefono/email (PII de tercero).
    ARRAY['AcudienteEstudiante', 'id,estudianteId,orden,relacion,estado,createdAt,updatedAt'],
    -- IdentificadorAcudiente: NUNCA valor. FK real = acudienteId.
    ARRAY['IdentificadorAcudiente', 'id,acudienteId,colegioId,tipo,plataformaId,estado,createdAt,updatedAt'],
    -- IdentificadorProfesor: NUNCA valor.
    ARRAY['IdentificadorProfesor', 'id,profesorId,colegioId,tipo,plataformaId,estado,createdAt,updatedAt'],
    -- Hijo (SPEC-325): NUNCA nombre/apellidos/documentoTipo/documentoNumero.
    ARRAY['Hijo', 'id,anioNacimiento,sexo,estado,creadoEn,actualizadoEn'],
    -- HijoPadre: completa (puente id,hijoId,usuarioId,creadoEn; usuarioId es
    -- cuid interno que no resuelve fuera — Usuario jamás se publica).
    ARRAY['HijoPadre', NULL],
    -- IdentificadorHijo: NUNCA valor.
    ARRAY['IdentificadorHijo', 'id,hijoId,tipo,plataformaId,activo,creadoEn,actualizadoEn'],
    -- ContactoConfianza: NUNCA nombre/etiqueta/nota (texto libre del padre).
    ARRAY['ContactoConfianza', 'id,usuarioId,parentesco,activo,creadoEn,actualizadoEn'],
    -- IdentificadorContacto: NUNCA valor. FK real = contactoId.
    ARRAY['IdentificadorContacto', 'id,contactoId,tipo,plataformaId,activo,creadoEn,actualizadoEn'],
    -- IdentificadorReportado: agregado público COMPLETO excepto
    -- `identificador` (nick en claro = PII del presunto reportado).
    ARRAY['IdentificadorReportado', 'id,plataformaId,totalReportes,reportesAutenticados,reportesAnonimos,reportesAprobados,autenticadosAprobados,esVisiblePublicamente,ocultoPorComiteEn,score,scoreAnonimo,scoreAutenticado,scoreAjustado,nivelRiesgo,ultimoReporteEn,creadoEn,actualizadoEn'],
    -- Suscripcion: sin contratoPDFUrl (documento firmado con datos del
    -- titular), sin codigoReferidoPropio/Usado (código único que identifica
    -- al titular persona), sin motivoCancelacion/referenciaPagoManual (texto
    -- libre). usuarioId/autorizadoPorAdminId son cuids internos.
    ARRAY['Suscripcion', 'id,tipoTitular,colegioId,usuarioId,estado,planActualId,fechaInicio,fechaFin,fechaCorteProgramado,esFreemium,freemiumFechaFin,monedaLocal,paisCliente,suspendidaEn,canceladaEn,canceladaPorUsuario,createdAt,updatedAt,origen,autorizadoPorAdminId,autorizadoEn,metodoPagoManual,montoRealPagado,fechaPagoReal'],
    ARRAY['patrones_institucionales', NULL],     -- @@map de PatronInstitucional
    ARRAY['eventos_match', NULL],                -- @@map de EventoMatch (solo metadatos agregados)
    ARRAY['score_clientes', NULL],               -- @@map de ScoreCliente
    ARRAY['DerivaMotorSnapshot', NULL],
    ARRAY['OnboardingColegio', NULL],
    ARRAY['TipoDocumento', NULL]
  ];

  -- ── TABLAS PROHIBIDAS (Ley 1581 · jamás en la publicación) ─────────────
  tablas_prohibidas text[] := ARRAY[
    'Usuario', 'Password', 'Session', 'TokenRecuperacion', 'CodigoVerificacion',
    'ParametroSistema', 'CargaRosterSesion', 'DatasetEntrenamiento',
    'DocumentoApelacion', 'AccesoDocumentoApelacion', 'block_list',
    'IntegranteComite', 'PerfilOperador', 'ContactoEmergencia',
    'contactos_emergencia', 'EventoExpediente', 'NotaSeguimiento',
    'AclaracionExpediente', 'aclaracion_expediente', 'InformeConsolidado',
    'informes_consolidados', 'Apelacion', 'AnalisisExpediente', 'InformePadre',
    'TokenRegistro', 'notificaciones', 'HealthProbe', 'worker_logs',
    'RateLimit', 'demo_marcado', 'simulacion_runs', 'simulacion_reportes',
    'simulacion_abuso_runs', 'sesiones_log', 'audit_consentimientos',
    -- PK = nick en claro del reportado: impublicable sin PII (ver cabecera).
    'senal_comunitaria_cache'
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
    ARRAY['Reporte', 'operadorId'], ARRAY['Reporte', 'comiteId'],
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
    ARRAY['senal_comunitaria_cache', 'identificadorReportado']
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
-- Esperado: 40 filas · tiene_column_list = t en las 15 tablas con recorte
-- (Reporte, Colegio, Alumno, IdentificadorAlumno, AuditLog, Profesor,
--  AcudienteEstudiante, IdentificadorAcudiente, IdentificadorProfesor, Hijo,
--  IdentificadorHijo, ContactoConfianza, IdentificadorContacto,
--  IdentificadorReportado, Suscripcion) · f en las 25 completas.
-- NUNCA deben aparecer las tablas prohibidas (ver cabecera §GUARDS).
