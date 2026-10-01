/**
 * SPEC-833 (D-121) · CANDADO del PRIMER FK COMPUESTO del esquema.
 *
 * La base RECHAZA un `IdentificadorAlumno` cuyo `colegioId` no case con el `colegioId` de su `Alumno`.
 * Prueba la IMPOSIBILIDAD ESTRUCTURAL (el FK), NO la intención del código: por eso inserta CRUDO
 * (`$executeRaw`), saltándose la derivación de colegioId que hoy hacen todos los escritores — y exige
 * que la BASE lo rechace. Un candado que insertara por el repositorio probaría la disciplina del
 * escritor, no el FK; este prueba el FK.
 *
 * Contexto: el barrido de escritores (SPEC-833) midió que hoy NINGÚN escritor diverge y el conteo en
 * prod dio 0 — por eso el FK entró directo, sin NOT VALID. Este candado cierra el hueco por el que un
 * FUTURO escritor podría colar la divergencia (fuga cross-tenant del identificador de un menor): deja
 * de depender de disciplina y pasa a impedirlo la base.
 *
 * Es test de INTEGRACIÓN (toca la BD) → corre bajo la config por defecto de integración, NO en la suite
 * unit. Requiere que la migración spec833 esté aplicada en la BD de prueba.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante } from "@/lib/reporte-test-utils";

describe("SPEC-833 · FK compuesto IdentificadorAlumno(alumnoId,colegioId) → Alumno(id,colegioId)", () => {
    let alumnoId: string;
    let colegioCorrectoId: string; // el del alumno
    let colegioAjenoId: string; // otro colegio REAL (satisface el FK simple a Colegio; falla el compuesto)

    beforeEach(async () => {
        await resetDatabase();
        const propio = await crearColegioConAdmin();
        const ajeno = await crearColegioConAdmin();
        colegioCorrectoId = propio.colegio.id;
        colegioAjenoId = ajeno.colegio.id;
        const curso = await crearCurso(colegioCorrectoId);
        const alumno = await crearEstudiante(curso.id, colegioCorrectoId);
        alumnoId = alumno.id;
    });

    /**
     * INSERT CRUDO: evita la derivación de colegioId del repositorio, para medir el FK y no el código.
     * SQL crudo ⇒ nombres de la BASE, NO de Prisma: tabla "IdentificadorAlumno" (@@map), y el enum va
     * como VALOR 'ALUMNO' (@map) casteado al TIPO "EtiquetaRelacionAlumno" (@@map). Con los nombres del
     * modelo (ESTUDIANTE / EtiquetaRelacionEstudiante) la base responde 42704 «type does not exist».
     * NO "corregir" a los nombres de Prisma.
     */
    function insertarCrudo(colegioId: string) {
        return prisma.$executeRaw`
            INSERT INTO "IdentificadorAlumno"
                (id, "alumnoId", "colegioId", tipo, valor, "etiquetaRelacion", estado, "createdAt", "updatedAt")
            VALUES (
                ${`idfk-${Date.now()}-${Math.random().toString(36).slice(2)}`},
                ${alumnoId}, ${colegioId}, 'telefono', ${`+57${Date.now()}`},
                ${"ALUMNO"}::"EtiquetaRelacionAlumno", 'activo', NOW(), NOW()
            )
        `;
    }

    it("RECHAZA (FK) un colegioId que NO casa con el del alumno — imposibilidad estructural", async () => {
        await expect(insertarCrudo(colegioAjenoId)).rejects.toThrow();
        // Y NO quedó fila: el rechazo es de la base, no un no-op silencioso.
        expect(await prisma.identificadorEstudiante.count({ where: { estudianteId: alumnoId } })).toBe(0);
    });

    it("CONTROL POSITIVO: con el colegioId que SÍ casa (el del alumno), la fila ENTRA", async () => {
        await expect(insertarCrudo(colegioCorrectoId)).resolves.toBeGreaterThanOrEqual(1);
        expect(
            await prisma.identificadorEstudiante.count({ where: { estudianteId: alumnoId, colegioId: colegioCorrectoId } }),
        ).toBe(1);
    });
});
