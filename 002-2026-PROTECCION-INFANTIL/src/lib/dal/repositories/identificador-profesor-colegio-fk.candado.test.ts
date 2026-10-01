/**
 * SPEC-837 (D-121) · CANDADO del FK compuesto IdentificadorProfesor(profesorId,colegioId) →
 * Profesor(id,colegioId). PR 1 de la cadena de AlertaColegio; mismo patrón que el de Alumno (833).
 *
 * La base RECHAZA un IdentificadorProfesor cuyo colegioId no case con el del Profesor. Prueba la
 * IMPOSIBILIDAD ESTRUCTURAL (el FK), no la intención: INSERT CRUDO ($executeRaw) que se salta la
 * derivación de colegioId que hacen los escritores. Control positivo: con el colegioId que casa, entra.
 *
 * SQL crudo ⇒ nombres de la BASE: tabla "IdentificadorProfesor" / "Profesor" (sin @@map), y SIN enum
 * (IdentificadorProfesor no tiene etiquetaRelacion, a diferencia de Alumno) → no hay cast que mapear.
 * Es test de INTEGRACIÓN (toca la BD) → config por defecto; requiere la migración spec837 aplicada.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearProfesor } from "@/lib/reporte-test-utils";

describe("SPEC-837 · FK compuesto IdentificadorProfesor(profesorId,colegioId) → Profesor(id,colegioId)", () => {
    let profesorId: string;
    let colegioCorrectoId: string; // el del profesor
    let colegioAjenoId: string; // otro colegio REAL (satisface el FK simple a Colegio; falla el compuesto)

    beforeEach(async () => {
        await resetDatabase();
        const propio = await crearColegioConAdmin();
        const ajeno = await crearColegioConAdmin();
        colegioCorrectoId = propio.colegio.id;
        colegioAjenoId = ajeno.colegio.id;
        const profesor = await crearProfesor(colegioCorrectoId);
        profesorId = profesor.id;
    });

    /** INSERT CRUDO: evita la derivación de colegioId del repositorio, para medir el FK y no el código. */
    function insertarCrudo(colegioId: string) {
        return prisma.$executeRaw`
            INSERT INTO "IdentificadorProfesor"
                (id, "profesorId", "colegioId", tipo, valor, estado, "createdAt", "updatedAt")
            VALUES (
                ${`idpf-${Date.now()}-${Math.random().toString(36).slice(2)}`},
                ${profesorId}, ${colegioId}, 'telefono', ${`+57${Date.now()}`}, 'activo', NOW(), NOW()
            )
        `;
    }

    it("RECHAZA (FK) un colegioId que NO casa con el del profesor — imposibilidad estructural", async () => {
        await expect(insertarCrudo(colegioAjenoId)).rejects.toThrow();
        expect(await prisma.identificadorProfesor.count({ where: { profesorId } })).toBe(0);
    });

    it("CONTROL POSITIVO: con el colegioId que SÍ casa (el del profesor), la fila ENTRA", async () => {
        await expect(insertarCrudo(colegioCorrectoId)).resolves.toBeGreaterThanOrEqual(1);
        expect(
            await prisma.identificadorProfesor.count({ where: { profesorId, colegioId: colegioCorrectoId } }),
        ).toBe(1);
    });
});
