-- SPEC-218 (002-PI-118): índices aditivos para las agregaciones del dashboard
-- dinero-vs-valor (data-model.md). Cero DROP; IF NOT EXISTS por idempotencia.

CREATE INDEX IF NOT EXISTS "Suscripcion_estado_paisCliente_monedaLocal_createdAt_idx" ON "Suscripcion"("estado", "paisCliente", "monedaLocal", "createdAt");
CREATE INDEX IF NOT EXISTS "Pago_estado_createdAt_monedaLocal_idx" ON "Pago"("estado", "createdAt", "monedaLocal");
