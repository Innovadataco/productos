-- SPEC-798 (paso 2b) · Extiende el CHECK del techo legal para cubrir REVOCACION.
-- REVOCACION toma el techo del «reclamo» (art. 15, plazoDias 1..15) HEREDADO de SUPRESION: 798 tipifica,
-- NO determina un plazo nuevo (si lo omitiera, una fila REVOCACION caería fuera del CHECK y la base la
-- rechazaría). Se EXTIENDE enumerando (REVOCACION se agrega a la lista IN), NO se reescribe la forma:
-- todo lo que el CHECK viejo prohibía sigue prohibido — CONSULTA fuera de 1..10, reclamo fuera de 1..15,
-- y el piso 0 (BETWEEN 1 AND …). Corre en transacción aparte del ADD VALUE (paso 2a), ya commiteado.
ALTER TABLE "SolicitudHabeasData" DROP CONSTRAINT "SolicitudHabeasData_plazo_techo_legal_check";
ALTER TABLE "SolicitudHabeasData" ADD CONSTRAINT "SolicitudHabeasData_plazo_techo_legal_check" CHECK (
    ("tipo" = 'CONSULTA' AND "plazoDias" BETWEEN 1 AND 10)
    OR ("tipo" IN ('RECTIFICACION', 'SUPRESION', 'REVOCACION') AND "plazoDias" BETWEEN 1 AND 15)
);
