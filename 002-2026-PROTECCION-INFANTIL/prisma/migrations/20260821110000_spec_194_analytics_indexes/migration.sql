-- SPEC-194 (002-PI-088): índices aditivos para analítica de colegios + vista PARENT.
-- Cero DROP. Estos índices aceleran agregaciones por colegio/tenant y por usuario.

CREATE INDEX IF NOT EXISTS "idx_reportes_tenant_creado_eliminado"
    ON "Reporte" ("tenantId", "creadoEn", "eliminado");

CREATE INDEX IF NOT EXISTS "idx_reportes_tenant_estado_eliminado"
    ON "Reporte" ("tenantId", "estado", "eliminado");

CREATE INDEX IF NOT EXISTS "idx_reportes_usuario_eliminado"
    ON "Reporte" ("usuarioId", "eliminado");

CREATE INDEX IF NOT EXISTS "idx_alertas_colegio_estado"
    ON "AlertaColegio" ("colegioId", "estado");

CREATE INDEX IF NOT EXISTS "idx_solicitudes_comite_colegio_estado"
    ON "SolicitudComite" ("colegioId", "estado");

CREATE INDEX IF NOT EXISTS "idx_integrantes_comite_colegio_estado"
    ON "IntegranteComite" ("colegioId", "estado");
