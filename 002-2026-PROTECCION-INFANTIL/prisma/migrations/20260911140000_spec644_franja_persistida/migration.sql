-- SPEC-644 (I-379) · Persistir la FRANJA declarada por el padre en vez de derivarla.
--
-- La franja es lo que el padre DIJO ("de mañana"); hoy se guarda solo la hora
-- representativa (el centro: 3/9/15/21 en Bogotá) + `horaAproximada`, y la lectura
-- RE-DERIVA la franja desde ese centro (`franjaDeInstante`). Esa derivación es unívoca
-- HOY solo porque los centros son esos cuatro: el día que se cambie un centro o se
-- agregue una 5ª franja, empieza a mentir en silencio. Se persiste la franja.
--
-- ORDEN OBLIGATORIO (un CHECK sobre una tabla con filas falla al crearse si alguna no
-- lo cumple): ADD COLUMN -> backfill -> CHECK. El CHECK va NOT VALID + VALIDATE para no
-- tomar un ACCESS EXCLUSIVE largo en una tabla grande (VALIDATE toma un lock más débil).

-- 1) El tipo (nuevo; aditivo). Espeja FranjaAproximada de la app (minúscula por
--    historia); el mapeo minúscula<->enum vive en src/lib/reportes/franja-aproximada.ts.
CREATE TYPE "FranjaHoraria" AS ENUM ('MADRUGADA', 'MANANA', 'TARDE', 'NOCHE');

-- 2) La columna, NULLABLE. NULL <=> hora exacta (horaAproximada=false).
ALTER TABLE "Reporte" ADD COLUMN "franjaHoraria" "FranjaHoraria";

-- 3) PRE-CHECK antes del backfill: toda fila con horaAproximada=true tiene que tener
--    una hora que sea un CENTRO de franja en Bogotá {3,9,15,21}; si no, la derivación
--    no la mapea (CASE -> NULL) y quedaría horaAproximada=true con franjaHoraria=NULL,
--    violando el CHECK. Preferimos ABORTAR ruidoso (dato inesperado que hay que mirar)
--    a crear un medio-estado. `fechaIncidente` es TIMESTAMPTZ: se extrae la hora EN
--    Bogota (AT TIME ZONE), no la del server, que fue justo el bug I-247b.
DO $$
DECLARE
    fuera_de_centro integer;
BEGIN
    SELECT count(*) INTO fuera_de_centro
    FROM "Reporte"
    WHERE "horaAproximada" = true
      AND (EXTRACT(HOUR FROM "fechaIncidente" AT TIME ZONE 'America/Bogota')::int) NOT IN (3, 9, 15, 21);
    IF fuera_de_centro > 0 THEN
        RAISE EXCEPTION 'SPEC-644: % fila(s) con horaAproximada=true cuya hora (Bogota) no es un centro de franja {3,9,15,21}; la derivacion no las mapea. Revisar esas filas ANTES de migrar (no se puede backfillear la franja de forma unica).', fuera_de_centro;
    END IF;
END $$;

-- 4) BACKFILL (última vez legítima de la derivación): la franja del centro guardado,
--    en hora de Bogotá. Solo las aproximadas; las exactas quedan NULL.
UPDATE "Reporte"
SET "franjaHoraria" = CASE EXTRACT(HOUR FROM "fechaIncidente" AT TIME ZONE 'America/Bogota')::int
        WHEN 3  THEN 'MADRUGADA'::"FranjaHoraria"
        WHEN 9  THEN 'MANANA'::"FranjaHoraria"
        WHEN 15 THEN 'TARDE'::"FranjaHoraria"
        WHEN 21 THEN 'NOCHE'::"FranjaHoraria"
    END
WHERE "horaAproximada" = true;

-- 5) El invariante como IMPOSIBILIDAD ESTRUCTURAL (no una regla que alguien recuerde):
--    horaAproximada y franjaHoraria no pueden discrepar. NOT VALID primero (barato),
--    luego VALIDATE sobre las filas ya backfilleadas.
ALTER TABLE "Reporte"
    ADD CONSTRAINT "Reporte_franjaHoraria_horaAproximada_check"
    CHECK ("horaAproximada" = ("franjaHoraria" IS NOT NULL)) NOT VALID;

ALTER TABLE "Reporte" VALIDATE CONSTRAINT "Reporte_franjaHoraria_horaAproximada_check";
