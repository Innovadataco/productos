/**
 * SPEC-837 PR2 (D-121) · CANDADO del FK compuesto AlertaColegio→Identificador{Alumno,Profesor}(id,colegioId).
 * Pieza final de la cadena de AlertaColegio; mismo patrón e imposibilidad que 833/837-PR1.
 *
 * La base RECHAZA una alerta de ESTUDIANTE/PROFESOR cuyo identificador sea de OTRO colegio que la alerta.
 * Prueba la IMPOSIBILIDAD ESTRUCTURAL (el FK compuesto), no la intención: INSERT CRUDO ($executeRaw) que se
 * SALTA la derivación de colegioId que hace `alertas.ts` (colegioId = identificador.estudiante/profesor.colegioId).
 * Control positivo: con el colegioId que casa, la alerta ENTRA.
 *
 * SQL crudo ⇒ nombres de la BASE: `identificadorEstudianteId` @map→ columna "identificadorAlumnoId"; tabla
 * "AlertaColegio" (sin @@map). `tipoSujeto`/`estado`/`prioridad` son String (no enum) → sin casts. `ajeno` es un
 * colegio REAL (satisface el FK simple a Colegio; falla SOLO el compuesto). ACUDIENTE/INTEGRANTE quedan fuera del
 * FK (cross-colegio legítimo, A-66), así que no se prueban acá. Integración (toca BD) → requiere la migración
 * spec837_pr2 aplicada.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearProfesor,
    crearIdentificadorEstudiante,
    crearIdentificadorProfesor,
    crearPlataforma,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";

describe("SPEC-837 PR2 · FK compuesto AlertaColegio→Identificador{Alumno,Profesor}(id,colegioId)", () => {
    let colegioPropioId: string; // el del identificador
    let colegioAjenoId: string; // otro colegio REAL (pasa el FK simple a Colegio; falla el compuesto)
    let reporteId: string;
    let identEstId: string;
    let identProfId: string;

    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        const propio = await crearColegioConAdmin();
        const ajeno = await crearColegioConAdmin();
        colegioPropioId = propio.colegio.id;
        colegioAjenoId = ajeno.colegio.id;

        const curso = await crearCurso(colegioPropioId);
        const estudiante = await crearEstudiante(curso.id, colegioPropioId);
        identEstId = (await crearIdentificadorEstudiante(estudiante.id, { plataformaId: plataforma.id })).id;
        const profesor = await crearProfesor(colegioPropioId);
        identProfId = (await crearIdentificadorProfesor(profesor.id, colegioPropioId, { plataformaId: plataforma.id })).id;

        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: `+57${Date.now()}`,
                plataformaId: plataforma.id,
                texto: "candado SPEC-837 PR2",
                fechaIncidente: new Date("2026-09-01T10:00:00Z"),
                ciudad: propio.ciudad.nombre,
                pais: propio.pais.nombre,
                paisId: propio.pais.id,
                ciudadId: propio.ciudad.id,
                esAnonimo: true,
                estado: "CLASIFICADO",
                numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            },
        });
        reporteId = reporte.id;
    });

    /** INSERT CRUDO de una alerta de ESTUDIANTE con `colegioId` arbitrario (evita la derivación de alertas.ts). */
    function insertarAlertaAlumno(colegioId: string) {
        return prisma.$executeRaw`
            INSERT INTO "AlertaColegio"
                (id, "colegioId", "reporteId", "identificadorAlumnoId", "tipoSujeto", estado, prioridad, "vencimientoSla", "creadoEn", "actualizadoEn")
            VALUES (
                ${`alc-${Date.now()}-${Math.random().toString(36).slice(2)}`},
                ${colegioId}, ${reporteId}, ${identEstId}, 'ESTUDIANTE', 'nueva', 'media', NOW(), NOW(), NOW()
            )
        `;
    }
    /** INSERT CRUDO de una alerta de PROFESOR con `colegioId` arbitrario. */
    function insertarAlertaProfesor(colegioId: string) {
        return prisma.$executeRaw`
            INSERT INTO "AlertaColegio"
                (id, "colegioId", "reporteId", "identificadorProfesorId", "tipoSujeto", estado, prioridad, "vencimientoSla", "creadoEn", "actualizadoEn")
            VALUES (
                ${`alc-${Date.now()}-${Math.random().toString(36).slice(2)}`},
                ${colegioId}, ${reporteId}, ${identProfId}, 'PROFESOR', 'nueva', 'media', NOW(), NOW(), NOW()
            )
        `;
    }

    it("RECHAZA (FK) una alerta de ESTUDIANTE cuyo colegioId NO casa con el del identificador — imposibilidad", async () => {
        await expect(insertarAlertaAlumno(colegioAjenoId)).rejects.toThrow();
        expect(await prisma.alertaColegio.count({ where: { identificadorEstudianteId: identEstId } })).toBe(0);
    });

    it("CONTROL POSITIVO ESTUDIANTE: con el colegioId que SÍ casa (el del identificador), la alerta ENTRA", async () => {
        await expect(insertarAlertaAlumno(colegioPropioId)).resolves.toBeGreaterThanOrEqual(1);
        expect(
            await prisma.alertaColegio.count({ where: { identificadorEstudianteId: identEstId, colegioId: colegioPropioId } }),
        ).toBe(1);
    });

    it("RECHAZA (FK) una alerta de PROFESOR cuyo colegioId NO casa con el del identificador — imposibilidad", async () => {
        await expect(insertarAlertaProfesor(colegioAjenoId)).rejects.toThrow();
        expect(await prisma.alertaColegio.count({ where: { identificadorProfesorId: identProfId } })).toBe(0);
    });

    it("CONTROL POSITIVO PROFESOR: con el colegioId que SÍ casa (el del identificador), la alerta ENTRA", async () => {
        await expect(insertarAlertaProfesor(colegioPropioId)).resolves.toBeGreaterThanOrEqual(1);
        expect(
            await prisma.alertaColegio.count({ where: { identificadorProfesorId: identProfId, colegioId: colegioPropioId } }),
        ).toBe(1);
    });
});
