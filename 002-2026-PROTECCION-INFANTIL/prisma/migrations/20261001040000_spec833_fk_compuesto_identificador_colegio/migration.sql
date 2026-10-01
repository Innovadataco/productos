-- SPEC-833 (D-121) · FK COMPUESTO: ata el `colegioId` denormalizado de IdentificadorAlumno al del
-- Alumno. Es el PRIMER FK compuesto del esquema (el barrido de «hecho escrito dos veces» encontró
-- CERO en todo el modelo → nada ataba las copias a su padre).
--
-- POR QUÉ: `IdentificadorAlumno.colegioId` es una COPIA de `Alumno.colegioId`, LOAD-BEARING (sostiene
-- la unicidad por-colegio del identificador, raw partial index). «Quitar la copia» no aplica. Nada en
-- la base impedía que divergiera → fuga cross-tenant del identificador de un MENOR a otro colegio. El
-- conteo en prod dio CERO divergencias (CEO · SPEC-833) → el FK entra DIRECTO, sin NOT VALID ni indulto.
--
-- RADIO (medido en el repo; la confirmación del catálogo VIVO —pg_depend/pg_publication/pg_constraint/
-- pg_index/pg_trigger— es carril del CEO):
--   · NO hay DROP COLUMN/TABLE — solo DROP de un CONSTRAINT (el FK simple viejo) + ADD de un índice y un
--     FK compuesto. `bi_replica` publica Alumno e IdentificadorAlumno POR COLUMNAS; índices y FK no se
--     publican y no se dropea ninguna columna → la publicación NO se toca (no es el radio de spec766).
--   · Sin triggers en estas tablas. Sin colisión de nombre (Alumno_id_colegioId_key es nuevo).
--   · NUNCA CASCADE en DELETE → ON DELETE RESTRICT. ON UPDATE CASCADE = default de Prisma, IGUAL que el
--     FK simple que reemplaza, y coherente: si se reasigna el colegioId del alumno, el hijo lo sigue.
--   · El índice único (id, colegioId) NO PUEDE fallar por duplicados: `id` ya es PK (único), así que
--     (id, *) es trivialmente único. Único costo: el lock de construcción del índice — si Alumno es una
--     tabla grande/con tráfico (medición del CEO · #2), evaluar CREATE UNIQUE INDEX CONCURRENTLY fuera de tx.

-- DropForeignKey
ALTER TABLE "IdentificadorAlumno" DROP CONSTRAINT "IdentificadorAlumno_alumnoId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_id_colegioId_key" ON "Alumno"("id", "colegioId");

-- AddForeignKey
ALTER TABLE "IdentificadorAlumno" ADD CONSTRAINT "IdentificadorAlumno_alumnoId_colegioId_fkey" FOREIGN KEY ("alumnoId", "colegioId") REFERENCES "Alumno"("id", "colegioId") ON DELETE RESTRICT ON UPDATE CASCADE;
