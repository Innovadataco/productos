-- 09-bi-db-limpieza-contenido.sql · Limpieza del SUSCRIPTOR tras la whitelist
-- Producto 006 · BI v2 · 2026-09-05
--
-- Contexto: la publicación bi_replica pasó de lista negra a LISTA BLANCA
-- (script 02). Las columnas de contenido/PII dejaron de publicarse del lado
-- de PI, pero los valores YA REPLICADOS siguen en bi-db hasta que se corra
-- este script. Es la otra mitad del corte: la lista blanca controla qué
-- entra; esto saca lo que ya había entrado.
--
-- ORDEN OBLIGATORIO (después de que el CEO corrió el DROP manual de
-- EmbeddingReporte + el script 02 en el master de PI):
--   1. CEO de PI: ALTER PUBLICATION bi_replica DROP TABLE public."EmbeddingReporte";
--      (paso deliberado: la tabla tiene datos y el guard B1 del script 02
--      aborta para que un humano decida — este script asume que ya se hizo)
--   2. CEO de PI: psql -f 02-pi-db-publicacion.sql  (reconcilia las 44 listas)
--   3. BI:        ALTER SUBSCRIPTION bi006_replica_sub REFRESH PUBLICATION;
--   4. BI:        psql -f 09-bi-db-limpieza-contenido.sql   ← ESTE ARCHIVO
--
-- Idempotente: todo IF EXISTS / TRUNCATE re-corrible.

-- ── 1. Columnas de contenido ya no publicadas: se eliminan del suscriptor ────
ALTER TABLE "SolicitudComite"      DROP COLUMN IF EXISTS motivo;
ALTER TABLE "SolicitudComite"      DROP COLUMN IF EXISTS resolucion;
ALTER TABLE "SolicitudComite"      DROP COLUMN IF EXISTS analisis;
ALTER TABLE "ClasificacionIA"      DROP COLUMN IF EXISTS "piiDetectada";
ALTER TABLE "ClasificacionIA"      DROP COLUMN IF EXISTS "rawResponse";
ALTER TABLE "CorreccionAdmin"      DROP COLUMN IF EXISTS motivo;
ALTER TABLE "TransicionReporte"    DROP COLUMN IF EXISTS motivo;
ALTER TABLE "TransicionReporte"    DROP COLUMN IF EXISTS metadatos;
ALTER TABLE "Reporte"              DROP COLUMN IF EXISTS "keywordsDetectadas";
ALTER TABLE "AuditLog"             DROP COLUMN IF EXISTS metadatos;
ALTER TABLE "worker_logs"          DROP COLUMN IF EXISTS mensaje;
ALTER TABLE "clasificacion_rubrica_votos" DROP COLUMN IF EXISTS "preguntasJson";
ALTER TABLE "demo_marcado"         DROP COLUMN IF EXISTS metadata;

-- ── 2. PerfilOperador: columnas bootstrap huérfanas (jamás viajaron por la
--       réplica — verificadas en 0 excepto creadoEn con 10 filas de un
--       bootstrap anterior a la columna canónica). La columna canónica
--       publicada queda intacta: id,usuarioId,cupoMaximo,esComite,
--       esRevisorDeApelaciones,actualizadoEn.
ALTER TABLE "PerfilOperador" DROP COLUMN IF EXISTS "notasInternas";
ALTER TABLE "PerfilOperador" DROP COLUMN IF EXISTS "creadoPorId";
ALTER TABLE "PerfilOperador" DROP COLUMN IF EXISTS "creadoEn";
ALTER TABLE "PerfilOperador" DROP COLUMN IF EXISTS "ultimoEmailNotificacionEn";

-- ── 3. EmbeddingReporte: fuera de la publicación (su `vector` es huella
--       revertible del texto — Ley 1581). Se conserva la tabla como shell
--       vacío: el índice HNSW "EmbeddingReporte_vector_idx" es uno de los 5
--       críticos del guardián scripts/verify-hnsw-indexes.ts (npm run
--       indices:check) y debe seguir existiendo. TRUNCATE quita los ~9k
--       vectores ya replicados; el shell queda disponible si un día PI
--       republica la tabla con una columna segura.
TRUNCATE TABLE "EmbeddingReporte";

-- ── 4. Catálogo del chat: las columnas cortadas se marcan excluidas (dato,
--       no despliegue; deny-by-default ya por tabla). Reversible: excluida =
--       false las rehabilita si algún día la publicación las repite.
UPDATE "bi_catalogo_columna" SET "excluida" = true
 WHERE "nombreFuente" IN (
   'motivo','resolucion','analisis','rawResponse','piiDetectada',
   'keywordsDetectadas','metadatos','mensaje','preguntasJson','metadata','vector'
 );
-- Y la tabla entera que sale de circulación:
UPDATE "bi_catalogo_tabla" SET "activo" = false
 WHERE "nombreFuente" = 'EmbeddingReporte';

-- ── 5. Verificación incluida: debe devolver 0 en todas las filas ────────────
SELECT 'contenido residual' AS chequeo, count(*) AS debe_ser_0
  FROM information_schema.columns
 WHERE (table_name, column_name) IN (
   ('SolicitudComite','motivo'), ('SolicitudComite','resolucion'),
   ('SolicitudComite','analisis'), ('ClasificacionIA','piiDetectada'),
   ('ClasificacionIA','rawResponse'), ('CorreccionAdmin','motivo'),
   ('TransicionReporte','motivo'), ('TransicionReporte','metadatos'),
   ('Reporte','keywordsDetectadas'), ('AuditLog','metadatos'),
   ('worker_logs','mensaje'), ('clasificacion_rubrica_votos','preguntasJson'),
   ('demo_marcado','metadata'), ('PerfilOperador','notasInternas'),
   ('PerfilOperador','creadoPorId')
 );
SELECT 'vectores residual' AS chequeo, count(*) AS debe_ser_0
  FROM "EmbeddingReporte";
