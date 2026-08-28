-- 02-pi-db-publicacion.sql
-- HALLAZGO CANDADO 15 · @@map · Fase A 2026-08-28:
-- 3 modelos Prisma tienen @@map a nombre snake_case en BD:
--   ClasificacionRubricaVoto → clasificacion_rubrica_votos ← afecta esta PUBLICATION
--   SimulacionRun            → simulacion_runs             (no en D-20)
--   SimulacionReporte        → simulacion_reportes         (no en D-20)
-- Verificar futuros modelos con: grep '@@map' schema.prisma
-- Ejecutar en pi-db (Jelkin desde su terminal en VPS) DESPUÉS de 01-pi-db-crear-usuario-replica.sql
-- Pre-requisito: wal_level=logical activo y pi-db reiniciado (Fase A)
-- 23 tablas OPERATIVAS verificadas en schema PI · sin PII (D-20 · Ley 1581)
-- Excluidas: Usuario (PII) · Password · Session

CREATE PUBLICATION bi_replica FOR TABLE
  "Reporte",
  "ClasificacionIA",
  clasificacion_rubrica_votos,  -- @@map · nombre real BD · verificado Fase A 2026-08-28
  "CorreccionAdmin",
  "EmbeddingReporte",
  "TransicionReporte",
  "SolicitudComite",
  "FuenteReporte",
  "Subscription",
  "BillingCycle",
  "Plan",
  "Tenant",
  "Colegio",
  "Curso",
  "Alumno",
  "IdentificadorAlumno",
  "AlertaColegio",
  "AlertaSuscripcion",
  "Plataforma",
  "Pais",
  "Departamento",
  "Ciudad",
  "AuditLog";

-- Verificar publicación creada
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'bi_replica';
-- Esperado: bi_replica | f  (f = tablas específicas · correcto)

SELECT tablename FROM pg_publication_tables WHERE pubname = 'bi_replica' ORDER BY tablename;
-- Esperado: 23 filas con los nombres listados arriba
