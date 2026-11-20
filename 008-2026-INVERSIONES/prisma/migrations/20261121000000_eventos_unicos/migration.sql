
-- CreateIndex
CREATE UNIQUE INDEX "evento_corporativo_tipo_origenId_destinoId_fecha_key" ON "evento_corporativo"("tipo", "origenId", "destinoId", "fecha");

-- INV-SPEC-10: un mismo pago de fracción (especie destino + fecha) solo puede pertenecer a un evento;
-- si no, la importación de dividendos lo casaría con uno solo, en silencio.
CREATE UNIQUE INDEX "evento_corporativo_pago_fraccion_key" ON "evento_corporativo" ("destinoId", "fechaPagoFraccion") WHERE "fechaPagoFraccion" IS NOT NULL;
