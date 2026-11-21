-- TOTP · segunda migración (aditiva): índices parciales que usan valores del enum agregados en
-- 20261121060000_totp. Van aparte porque PostgreSQL no deja usar un valor de enum en la misma transacción
-- que lo agrega («unsafe use of new value»). Prisma no expresa índices parciales.

-- El último reinicio del conteo de fallos y bloqueos del segundo paso (src/auth/fallos-segundo-paso.ts):
-- el más reciente de estos resultados de la cuenta.
CREATE INDEX "intento_ingreso_reinicio_totp_idx" ON "intento_ingreso" ("usuarioId", "ocurridoEn" DESC)
  WHERE "resultado" IN ('TOTP_EXITO', 'RECUPERACION_USADA', 'TOTP_ENROLADO', 'CODIGOS_REGENERADOS', 'TOTP_REINICIADO', 'CLAVE_DEFINIDA');
