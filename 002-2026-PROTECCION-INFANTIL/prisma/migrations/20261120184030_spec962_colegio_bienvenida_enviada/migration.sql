-- SPEC-962: pestillo de idempotencia del correo de bienvenida del rector.
-- Aditiva y NO destructiva: columna nullable. NO es fuente del progreso (eso se
-- deriva de los hechos en estado-colegio.ts); nombra lo que ES: la bienvenida ya
-- se envió para este colegio. El correo sale al TERMINAR el camino (SPEC-962).
ALTER TABLE "Colegio" ADD COLUMN "bienvenidaEnviadaEn" TIMESTAMPTZ(6);

-- Backfill (aditivo, acotado): los colegios que YA recibieron la bienvenida al
-- ACEPTAR (pre-SPEC-962) quedan marcados con la fecha de su notificación más vieja,
-- para que al TERMINAR el camino NO reciban una segunda. Solo toca filas con una
-- notificación `colegio.bienvenida_rector` dirigida a un usuario del colegio;
-- UPDATE por id, sin locks largos. `notificaciones` = @@map del modelo Notificacion.
UPDATE "Colegio" c
SET "bienvenidaEnviadaEn" = sub.primera
FROM (
    SELECT u."colegioId" AS colegio_id, MIN(n."createdAt") AS primera
    FROM "notificaciones" n
    JOIN "Usuario" u ON u.id = n."destinatarioUsuarioId"
    WHERE n.evento = 'colegio.bienvenida_rector' AND u."colegioId" IS NOT NULL
    GROUP BY u."colegioId"
) sub
WHERE c.id = sub.colegio_id AND c."bienvenidaEnviadaEn" IS NULL;
