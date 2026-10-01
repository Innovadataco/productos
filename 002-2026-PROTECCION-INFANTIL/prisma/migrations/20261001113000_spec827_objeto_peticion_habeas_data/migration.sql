-- SPEC-827 · El OBJETO de la petición de habeas data: sobre qué CLASE(S) de dato recae un
-- RECTIFICACION / SUPRESION. Campo de la PETICIÓN del titular (`clasesSolicitadas`), DISTINTO de
-- `clasesDatoAfectadas` (la RESOLUCIÓN del operador): «sobre qué pidió él» vs «sobre qué recayó lo que
-- hicimos». ADITIVA y NO destructiva.
--
-- ⚠️ D-121 (revisión de Datos) · es un ARRAY DE ENUM (`ClaseDatoTitular[]`). Tres trampas atendidas:
--  (a) el DEFAULT de un array de enum necesita CAST explícito → `DEFAULT ARRAY[]::"ClaseDatoTitular"[]`.
--      Sin el cast, Postgres no infiere el tipo del literal vacío. Lo da también Prisma por `@default([])`.
--  (b) Prisma es CIEGO al CHECK → la regla «objeto por tipo» va en CHECK, no solo en el `superRefine` de la
--      ruta, para que valga también contra escrituras CRUDAS (el candado de inserción la prueba).
--  (c) NOT VALID → la tabla ya puede tener filas previas a 827 (su objeto queda en `{}`). NOT VALID las
--      INDULTA sin reescribirlas; toda fila NUEVA —y todo UPDATE de una vieja— SÍ se valida. El service y la
--      ruta cortan antes del error crudo, así que un titular nunca ve el mensaje de la base.

ALTER TABLE "SolicitudHabeasData"
    ADD COLUMN "clasesSolicitadas" "ClaseDatoTitular"[] NOT NULL DEFAULT ARRAY[]::"ClaseDatoTitular"[];

-- OBJETO POR TIPO: CONSULTA no lleva objeto (vacío — «qué datos tienen sobre mí» no lo necesita);
-- RECTIFICACION / SUPRESION exigen ≥1 clase (sin objeto no son accionables y el plazo corre igual).
-- `cardinality` devuelve 0 para el array vacío (`array_length` daría NULL). NOT VALID por las filas previas.
ALTER TABLE "SolicitudHabeasData"
    ADD CONSTRAINT "SolicitudHabeasData_objeto_por_tipo_check" CHECK (
        ("tipo" = 'CONSULTA' AND cardinality("clasesSolicitadas") = 0)
        OR ("tipo" IN ('RECTIFICACION', 'SUPRESION') AND cardinality("clasesSolicitadas") >= 1)
    ) NOT VALID;
