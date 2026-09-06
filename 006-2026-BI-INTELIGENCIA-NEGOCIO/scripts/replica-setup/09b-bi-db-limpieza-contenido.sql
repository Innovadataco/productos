\set ON_ERROR_STOP on
-- 09b-bi-db-limpieza-contenido.sql · FASE 3 · Limpieza del SUSCRIPTOR
-- Producto 006 · BI v2 · 2026-09-05
--
-- Contexto: la publicación bi_replica pasó de lista negra a LISTA BLANCA
-- (script 02). Las columnas de contenido/PII dejaron de publicarse del lado
-- de PI, pero los valores YA REPLICADOS siguen en bi-db hasta que se corra
-- este script. Es la otra mitad del corte: la lista blanca controla qué
-- entra; esto saca lo que ya había entrado.
--
-- ORDEN OBLIGATORIO — este archivo es la FASE 3 y corre ÚLTIMO:
--   FASE 1 · bi-db:  09a-bi-db-pre-corte.sql (DROP NOT NULL × 4 — ANTES de
--                    tocar PI; sin esto el apply worker entra en bucle y el
--                    WAL se acumula en el master de producción)
--   FASE 2 · pi-db:  1. CEO: ALTER PUBLICATION bi_replica DROP TABLE public."EmbeddingReporte";
--                       (paso deliberado: la tabla tiene datos y el guard B1
--                       del script 02 aborta para que un humano decida)
--                    2. CEO: psql -f 02-pi-db-publicacion.sql (reconcilia las 44 listas)
--   FASE 3 · bi-db:  3. ALTER SUBSCRIPTION bi006_replica_sub REFRESH PUBLICATION;
--                    4. psql -f 09b-bi-db-limpieza-contenido.sql   ← ESTE ARCHIVO
--   El DROP COLUMN va DESPUÉS del REFRESH: antes de él, el apply worker
--   exige las columnas ("missing replicated column") y reintenta en bucle.
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
-- IncidenteInfra.senal: en patrones coordinados era patron_coordinado:
-- sha256(texto del reporte) SIN salt — huella revertible (Ley 1581), misma
-- razón que EmbeddingReporte.vector. HealthProbe.senal NO se toca: es
-- vocabulario fijo del monitor (app/worker/bd/ollama_ping/ollama_smoke/
-- tailscale), distinta columna de otra tabla.
ALTER TABLE "IncidenteInfra"       DROP COLUMN IF EXISTS senal;

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
-- IncidenteInfra.senal se excluye SOLO en su tabla: 'senal' también existe en
-- HealthProbe (vocabulario fijo del monitor) y esa SE CONSERVA — el filtro es
-- por tablaId, no por nombre de columna.
UPDATE "bi_catalogo_columna" cc SET "excluida" = true
  FROM "bi_catalogo_tabla" ct
 WHERE cc."tablaId" = ct.id
   AND ct."nombreFuente" = 'IncidenteInfra'
   AND cc."nombreFuente" = 'senal';
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
   ('PerfilOperador','creadoPorId'), ('IncidenteInfra','senal')
 );
SELECT 'vectores residual' AS chequeo, count(*) AS debe_ser_0
  FROM "EmbeddingReporte";
-- Guarda cruzada: la columna homónima del monitor NO se tocó.
SELECT 'HealthProbe.senal conservada' AS chequeo, count(*) AS debe_ser_1
  FROM information_schema.columns
 WHERE table_name = 'HealthProbe' AND column_name = 'senal';
