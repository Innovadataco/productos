-- SPEC-781 (D-121 · Decreto 1377 art. 12) · tabla AudienciaMenor — el HECHO de que el menor fue
-- OÍDO según su madurez (distinto de la autorización del representante). Desbloquea SPEC-751 (Dev 2).
--
-- Registra el HECHO, no el contenido: qué menor, cuándo, contra qué versión de consentimiento, quién
-- declaró. CERO texto de lo que el menor dijo (el texto es [ABOGADO], otra SPEC). El «grado de
-- madurez» NO es columna (criterio del representante, no dato del sistema).
--
-- Bloque CreateTable/Index/FK BYTE-EXACTO a Prisma (`migrate diff --from-empty`). Tabla NUEVA + vacía,
-- así que las FK y el UNIQUE quedan VALIDADOS sin filas que recorrer — nunca NOT VALID (indulta filas
-- y las inmoviliza).
--
-- FK `hijoId` → Hijo ON DELETE CASCADE: RETENCIÓN DERIVADA (conservación, no integridad). La fila no
-- tiene PII en columnas pero cuelga del menor, así que su conservación queda ATADA a la del menor (que
-- a su vez es Cascade del padre); al purgar al menor, la audiencia se va con él. El rastro DURABLE de
-- responsabilidad no se pierde: vive en AuditLog (ver el comentario de declaradoPor en el schema).
-- FK `declaradoPor` → Usuario ON DELETE SET NULL: es conveniencia, NO el registro de responsabilidad.

-- CreateTable
CREATE TABLE "AudienciaMenor" (
    "id" TEXT NOT NULL,
    "hijoId" TEXT NOT NULL,
    "consentimientoVersion" TEXT NOT NULL,
    "declaradoPor" TEXT,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienciaMenor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudienciaMenor_declaradoPor_idx" ON "AudienciaMenor"("declaradoPor");

-- CreateIndex · un hecho por (menor, versión de consentimiento): declarar dos veces no crea dos hechos.
CREATE UNIQUE INDEX "AudienciaMenor_hijoId_consentimientoVersion_key" ON "AudienciaMenor"("hijoId", "consentimientoVersion");

-- AddForeignKey
ALTER TABLE "AudienciaMenor" ADD CONSTRAINT "AudienciaMenor_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "Hijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaMenor" ADD CONSTRAINT "AudienciaMenor_declaradoPor_fkey" FOREIGN KEY ("declaradoPor") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
