-- 02-pi-db-publicacion.sql
-- Ejecutar en pi-db (Jelkin desde su terminal en VPS) DESPUÉS de 01-pi-db-crear-usuario-replica.sql
-- Pre-requisito: wal_level=logical activo y pi-db reiniciado (Fase A)
-- 23 tablas OPERATIVAS verificadas en schema PI · sin PII (D-20 · Ley 1581)
-- Excluidas: Usuario (PII) · Password · Session

CREATE PUBLICATION bi_replica FOR TABLE
  "Reporte",
  "ClasificacionIA",
  "ClasificacionRubricaVoto",
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
