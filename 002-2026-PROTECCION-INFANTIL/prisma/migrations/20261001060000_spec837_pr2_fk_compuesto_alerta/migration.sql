-- SPEC-837 PR2 (D-121) · FK COMPUESTO AlertaColegio→Identificador{Alumno,Profesor} — pieza final de la cadena
-- de AlertaColegio. Ata el `colegioId` de la alerta al del identificador de su sujeto (estudiante/profesor):
-- la base RECHAZA una alerta de estudiante/profesor cuyo identificador sea de OTRO colegio.
--
-- INVARIANTE (verificada en el código, no supuesta): para ESTUDIANTE y PROFESOR la creación DERIVA el
-- colegioId de la alerta del propio identificador — `alertas.ts`: colegioId = identificador.estudiante.colegioId
-- / identificador.profesor.colegioId. Así que alerta.colegioId == identificador.colegioId por construcción.
-- El caso cross-colegio (una alerta que referencia un identificador de OTRO colegio) es el de ACUDIENTE
-- (padre con hijos en varios colegios, trampa A-66 de borrar-colegio) → por eso ACUDIENTE e INTEGRANTE_COMITE
-- QUEDAN FUERA de este FK (un compuesto los rechazaría siendo legítimos).
--
-- onDelete RESTRICT (NO el viejo SET NULL): el `colegioId` del FK compuesto es NOT NULL → SET NULL es imposible
-- (no se puede anular una columna requerida), Prisma fuerza RESTRICT. Es un CAMBIO de conducta respecto del FK
-- simple viejo (SET NULL), pero SEGURO y medido: las cuatro rutas de borrado duro de identificadores
-- (borrar-colegio, purgar-demo, reset-piloto, borrar-demo) YA borran AlertaColegio ANTES de los identificadores
-- (eran FK-safe por A-66). RESTRICT además es más seguro que SET NULL (no deja la alerta huérfana en silencio).
-- NUNCA CASCADE en DELETE. ON UPDATE CASCADE = default de Prisma, igual que el FK simple que reemplaza.
--
-- El índice único (id, colegioId) en cada identificador NO puede fallar por duplicados (id es PK → trivial).
--
-- RADIO (medido en el repo; el catálogo VIVO pg_depend/pg_publication/pg_constraint/pg_index/pg_trigger es
-- carril del CEO): sin DROP COLUMN/TABLE (solo DROP de los 2 FK simples + ADD de índices y FK compuestos);
-- sin triggers en estas tablas; no se dropea ninguna columna publicada.
--
-- ⚠️ DRIFT (medición del CEO, PENDIENTE — mi carril read-only no alcanza prod): este FK entra DIRECTO (sin
-- NOT VALID) asumiendo 0 filas existentes de AlertaColegio de estudiante/profesor con alerta.colegioId distinto
-- del identificador. La creación lo garantiza para filas NUEVAS; un drift solo podría ser histórico. Si el
-- conteo del CEO da >0, agregar `NOT VALID` a los dos ADD CONSTRAINT de abajo (y planear el backfill/VALIDATE).

-- DropForeignKey
ALTER TABLE "AlertaColegio" DROP CONSTRAINT "AlertaColegio_identificadorAlumnoId_fkey";

-- DropForeignKey
ALTER TABLE "AlertaColegio" DROP CONSTRAINT "AlertaColegio_identificadorProfesorId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorProfesor_id_colegioId_key" ON "IdentificadorProfesor"("id", "colegioId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorAlumno_id_colegioId_key" ON "IdentificadorAlumno"("id", "colegioId");

-- AddForeignKey
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorAlumnoId_colegioId_fkey" FOREIGN KEY ("identificadorAlumnoId", "colegioId") REFERENCES "IdentificadorAlumno"("id", "colegioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorProfesorId_colegioId_fkey" FOREIGN KEY ("identificadorProfesorId", "colegioId") REFERENCES "IdentificadorProfesor"("id", "colegioId") ON DELETE RESTRICT ON UPDATE CASCADE;
