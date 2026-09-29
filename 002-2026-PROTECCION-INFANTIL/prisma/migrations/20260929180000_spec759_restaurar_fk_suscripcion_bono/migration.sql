-- SPEC-759 (D-121) · restaura DOS llaves foráneas que el esquema DECLARA y que
-- NINGUNA migración creó nunca — drift real medido contra la BD viva de producción.
--
-- CAUSA RAÍZ: la migración `20260822130816_pagos_modelos_base` creó
-- `Pago_autorizadoPorAdminId_fkey` (el hermano, sigue presente en todos lados) pero
-- OMITIÓ estas dos FK hermanas escritas a mano. El esquema las declara desde SPEC-245/246;
-- como no salen de ninguna migración, faltan en prod, en la BD de test compartida Y en un
-- CI fresco (CI arma la base desde las migraciones, que tampoco las tienen → nunca lo veía).
--
-- DAÑO MEDIDO (prod, `migrate diff` + conteo): CERO huérfanas.
--   Suscripcion.autorizadoPorAdminId    → 110 filas con valor, 110 apuntan a un Usuario existente.
--   BonoPromocional.beneficiarioUsuarioId → 0 filas con valor.
-- Por eso se restauran VALIDADAS (sin NOT VALID, sin corrector previo): no hay fila que indultar,
-- y `NOT VALID` indultaría filas viejas E inmovilizaría la restricción (verde en CI, bomba latente).
--
-- `ON DELETE SET NULL ON UPDATE CASCADE`: es lo que el esquema declara (relación OPCIONAL sin
-- onDelete explícito → default de Prisma para opcional = SetNull). NO traba ningún borrado que
-- hoy funcione: borrar un Usuario referenciado NULLea la referencia (hoy, sin FK, la deja colgando)
-- — es integridad ESTRICTAMENTE mejor, no un Restrict que bloquearía. SQL byte-equivalente al que
-- genera Prisma (`migrate diff --from-empty --to-schema-datamodel`). Aditiva: no toca datos ni el
-- esquema (que ya las declara); solo impone en la base la integridad que el código ya asume.

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_autorizadoPorAdminId_fkey" FOREIGN KEY ("autorizadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonoPromocional" ADD CONSTRAINT "BonoPromocional_beneficiarioUsuarioId_fkey" FOREIGN KEY ("beneficiarioUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
