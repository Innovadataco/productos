-- SPEC-598 (08-09-2026): «Crear contraseña» para cuentas OAuth sin clave local.
-- Aditiva: columna nullable, nada se borra ni se reescribe.
-- Marca de cuándo el dueño eligió su contraseña local. Las cuentas que entraron
-- por Google (SPEC-587) tienen un hash aleatorio que NO es una clave propia:
-- este timestamp distingue «sin contraseña propia» (NULL) de «con contraseña
-- propia» (p. ej. creada por «¿Olvidaste tu contraseña?» o por este flujo).
ALTER TABLE "Usuario" ADD COLUMN "passwordCreadaEn" TIMESTAMPTZ(6);
