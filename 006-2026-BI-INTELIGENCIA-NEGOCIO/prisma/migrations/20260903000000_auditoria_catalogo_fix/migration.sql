-- Migración: reconciliación del catálogo del chat con el esquema REAL de bi-db.
-- Auditoría BI vs PI 2026-09-03 · DEFECTO 2 (el chat respondía CERO con seguridad).
-- Toca SOLO metadata del catálogo (bi_catalogo_*); nunca datos operativos.
-- Cada cambio fue verificado contra information_schema de bi-db y la base de PI.
-- Nota: el seed (update:{} vacío, regla S3) no pisa estas filas — por eso la
-- corrección vive en migración: aplica una vez en la BD viva y el seed
-- actualizado replica el estado final en installs limpios.
-- Nota 2: bi_catalogo_columna/metrica/ejemplo NO tienen columna "actualizadoEn"
-- (solo creadoEn) — verificado en prisma/schema.prisma.

-- ── A. Tablas que se DESHABILITAN (activo=false; el chat solo ve tablas activas) ──
-- Subscription · BillingCycle: salieron de la publicación bi_replica el 01-09
--   (legacy vacío del 005). El catálogo las declaraba y cualquier consulta
--   moría con 42P01 → "sin datos" falso.
-- HijoPadre: PI dejó de escribirla el 31-08-2026 (SPEC-339: el vínculo pasó a
--   Hijo.usuarioId, columna deliberadamente no publicada). Quedó congelada con
--   2 filas del 31-08 — contarla reporta hoy un universo obsoleto (DEFECTO 1).
UPDATE bi_catalogo_tabla
   SET activo = false, "actualizadoEn" = now(),
       descripcion = descripcion || ' [DESHABILITADA 2026-09-03: tabla fuera de la publicación bi_replica]'
 WHERE "nombreFuente" IN ('Subscription', 'BillingCycle');

UPDATE bi_catalogo_tabla
   SET activo = false, "actualizadoEn" = now(),
       descripcion = descripcion || ' [DESHABILITADA 2026-09-03: PI dejó de escribirla (SPEC-339); el vínculo real es Hijo.usuarioId, no publicado]'
 WHERE "nombreFuente" = 'HijoPadre';

-- ── B. Tabla del jurado de IA: el catálogo declaraba el nombre del MODELO
--   Prisma (ClasificacionRubricaVoto) pero el nombre REAL en BD es
--   clasificacion_rubrica_votos (@@map de PI). Todo SQL del chat moría 42P01.
UPDATE bi_catalogo_tabla
   SET "nombreFuente" = 'clasificacion_rubrica_votos', "actualizadoEn" = now(),
       "nombreLegible" = 'Votos del jurado IA',
       descripcion = 'Votos de la rúbrica del jurado de IA por clasificación (modelo · categoría · cumple). Nombre real en BD (@@map de PI)'
 WHERE "nombreFuente" = 'ClasificacionRubricaVoto';

-- Columnas de la tabla del jurado: renombrar la FK al nombre real y retirar
-- votanteId (no existe: son votos del modelo, no de humanos). Las 3 columnas
-- nuevas se insertan con guarda WHERE EXISTS para no romper installs limpios
-- (donde el seed crea la tabla después de esta migración).
UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'clasificacionIAId',
       descripcion = 'FK a ClasificacionIA votada (nombre real en BD)'
 WHERE "nombreFuente" = 'clasificacionId'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'clasificacion_rubrica_votos');

DELETE FROM bi_catalogo_columna
 WHERE "nombreFuente" = 'votanteId'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'clasificacion_rubrica_votos');

INSERT INTO bi_catalogo_columna (id, "tablaId", "nombreFuente", "nombreLegible", descripcion, tipo, sinonimos, excluida, "creadoEn")
SELECT gen_random_uuid()::text, t.id, v."nombreFuente", v."nombreLegible", v.descripcion, v.tipo, '{}', false, now()
  FROM bi_catalogo_tabla t
  CROSS JOIN (VALUES
    ('modelo', 'Modelo jurado', 'Nombre del modelo del jurado que emitió el voto', 'String'),
    ('categoria', 'Categoría votada', 'Categoría de conducta evaluada por el voto (usar ::text en GROUP BY)', 'String'),
    ('cumple', 'Cumple rúbrica', 'Si el voto marcó que la clasificación cumple la rúbrica', 'Boolean')
  ) AS v("nombreFuente", "nombreLegible", descripcion, tipo)
 WHERE t."nombreFuente" = 'clasificacion_rubrica_votos'
   AND NOT EXISTS (SELECT 1 FROM bi_catalogo_columna c WHERE c."tablaId" = t.id AND c."nombreFuente" = v."nombreFuente");

-- ── C. Columnas renombradas: el catálogo declaraba nombres que NO existen en
--   la tabla real (verificado columna por columna contra information_schema). ──
UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'estado', "nombreLegible" = 'Estado',
       descripcion = 'activo | inactivo (baja lógica; filtrar estado=''activo'')'
 WHERE "nombreFuente" = 'activo'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'Alumno');

UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'tipoRecurso',
       descripcion = 'Tipo de recurso afectado (nombre real en BD; recursoId lleva el id)'
 WHERE "nombreFuente" = 'recurso'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'AuditLog');

UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'paisId',
       descripcion = 'FK Pais (id; no texto — sin JOIN la app no resuelve nombres)'
 WHERE "nombreFuente" = 'pais'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'Colegio');

UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'ciudadId',
       descripcion = 'FK Ciudad (id; no texto — sin JOIN la app no resuelve nombres)'
 WHERE "nombreFuente" = 'ciudad'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'Colegio');

-- CorreccionAdmin: el vínculo al reporte NO es directo — es por clasificacionId
-- → ClasificacionIA.reporteId. El catálogo declaraba reporteId (inexistente) y
-- categoriaCorrecta (la real es categoriaCorregida).
UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'clasificacionId', "nombreLegible" = 'Clasificación',
       descripcion = 'FK a ClasificacionIA corregida (el reporte se resuelve vía ClasificacionIA.reporteId)'
 WHERE "nombreFuente" = 'reporteId'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'CorreccionAdmin');

UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'categoriaCorregida'
 WHERE "nombreFuente" = 'categoriaCorrecta'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'CorreccionAdmin');

UPDATE bi_catalogo_columna
   SET "nombreFuente" = 'estado', "nombreLegible" = 'Estado',
       descripcion = 'activo | inactivo (baja lógica)'
 WHERE "nombreFuente" = 'activo'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'Tenant');

-- FuenteReporte.plataforma: la columna NO existe. La plataforma del reporte
-- vive en Reporte.plataformaId (FK Plataforma). Sin equivalente 1:1 → fuera.
DELETE FROM bi_catalogo_columna
 WHERE "nombreFuente" = 'plataforma'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'FuenteReporte');

-- ── D. Dominio de estados REAL (DEFECTO 2 · causa 1): el catálogo enseñaba al
--   modelo un dominio inventado (PENDIENTE · REVISION · CERRADO · RECHAZADO ·
--   COMITE). El dominio real de Reporte.estado es otro — con el dominio falso
--   todo filtro por estado devolvía 0 con tono normal. Verificado en PI:
--   CLASIFICADO 8.585 · REVISION_MANUAL 292 · POSIBLE_SPAM 183 · DUPLICADO 6. ──
UPDATE bi_catalogo_columna
   SET descripcion = 'Estado del reporte. Valores reales: CLASIFICADO · REVISION_MANUAL · POSIBLE_SPAM · DUPLICADO'
 WHERE "nombreFuente" = 'estado'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'Reporte');

UPDATE bi_catalogo_columna
   SET descripcion = 'Estado antes de la transición. Valores reales: PENDIENTE · CLASIFICADO · REVISION_MANUAL · POSIBLE_SPAM · DUPLICADO'
 WHERE "nombreFuente" = 'estadoAnterior'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'TransicionReporte');

UPDATE bi_catalogo_columna
   SET descripcion = 'Estado después de la transición. Valores reales: CLASIFICADO · REVISION_MANUAL · POSIBLE_SPAM · DUPLICADO'
 WHERE "nombreFuente" = 'estadoNuevo'
   AND "tablaId" = (SELECT id FROM bi_catalogo_tabla WHERE "nombreFuente" = 'TransicionReporte');

-- ── E. Métricas con fórmula rota (referenciaban columnas/tablas inexistentes
--   o un dominio de estados inventado) ──
UPDATE bi_catalogo_metrica
   SET "formulaSQL" = 'SELECT count(ca.id)::float / NULLIF(count(c.id),0) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId"=c.id WHERE c."creadoEn" >= now() - interval ''30 days'''
 WHERE nombre = 'tasa_correccion_ia';

UPDATE bi_catalogo_metrica
   SET "formulaSQL" = 'SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false'
 WHERE nombre = 'reportes_prioridad_alta';

-- 'CERRADO' no existe en el dominio real; el estado terminal del pipeline es CLASIFICADO.
UPDATE bi_catalogo_metrica
   SET "formulaSQL" = 'SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"=''CLASIFICADO'''
 WHERE nombre = 'tiempo_medio_resolucion_h';

-- Métricas comerciales legacy: apuntan a Subscription/BillingCycle, fuera de la
-- publicación. Nadie las usa en src (verificado con grep). Se deshabilitan; si
-- el negocio pide MRR/churn, se reconstruyen sobre Suscripcion (viva).
UPDATE bi_catalogo_metrica
   SET activa = false,
       descripcion = descripcion || ' [DESHABILITADA 2026-09-03: tablas Subscription/BillingCycle fuera de la publicación]'
 WHERE nombre IN ('mrr_actual', 'churn_mes', 'tenants_activos');

-- ── F. Ejemplos NL→SQL: corregir los que referenciaban columnas inexistentes
--   o el dominio inventado; borrar los 5 que apuntan a tablas fuera de la
--   publicación (el ejemplo es material de enseñanza del modelo — enseñar SQL
--   roto reproduce el defecto). ──
UPDATE bi_catalogo_ejemplo
   SET sql = 'SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false'
 WHERE "preguntaNL" = 'Reportes de prioridad alta abiertos';

UPDATE bi_catalogo_ejemplo
   SET sql = 'SELECT 1 - (count(ca.id)::float / NULLIF(count(c.id),0)) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId"=c.id WHERE c."creadoEn" >= now() - interval ''30 days'''
 WHERE "preguntaNL" = 'Cual es la precision del motor IA?';

UPDATE bi_catalogo_ejemplo
   SET sql = 'SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"=''CLASIFICADO'''
 WHERE "preguntaNL" = 'Tiempo medio de resolucion de reportes';

-- La plataforma del reporte vive en Reporte.plataformaId, no en FuenteReporte.
UPDATE bi_catalogo_ejemplo
   SET sql = 'SELECT p."nombre", count(*) FROM "FuenteReporte" fr JOIN "Reporte" r ON r.id=fr."reporteId" JOIN "Plataforma" p ON p."id"=r."plataformaId" WHERE r."creadoEn" >= now() - interval ''7 days'' AND r."eliminado"=false GROUP BY p."nombre"'
 WHERE "preguntaNL" = 'Reportes creados por fuente esta semana';

DELETE FROM bi_catalogo_ejemplo
 WHERE "preguntaNL" IN (
   'MRR del mes actual',
   'Cuanto facturamos el mes pasado?',
   'Cuantas suscripciones canceladas este mes?',
   'Suscripciones activas por plan',
   'Tenants activos totales'
 );
