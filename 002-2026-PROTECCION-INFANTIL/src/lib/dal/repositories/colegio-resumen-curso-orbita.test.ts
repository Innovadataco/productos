/**
 * CANDADO · SPEC-965 (FORMA Órbita · capa 2) — ColegioResumenRepository.cursoOrbita (datos).
 *
 * Muere con el defecto:
 *   - «merecen mirada» = alerta ALTA viva (→ rubí) ∪ acudiente sin contacto (→ ámbar); el resto NO se
 *     dibuja, solo se cuenta («resto en calma»).
 *   - El rubí es SOLO alta VIVA: una alerta ALTA ya CERRADA no enciende rubí (filtro de estado), y una
 *     alerta MEDIA viva tampoco (filtro de prioridad). Mutación: quitar cualquiera de los dos filtros
 *     mueve el alumno a mirada y el test cae.
 *   - 404 si el curso es de otro colegio (tenant-first).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma, crearProfesor } from "@/lib/reporte-test-utils";
import { ColegioResumenRepository } from "./colegio-resumen";

let contador = 0;

async function sembrarReporte(plataformaId: string, tag: string) {
    contador += 1;
    return crearReporteFixture(prisma, {
        data: {
            identificador: `+57310${String(contador).padStart(7, "0")}`,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-965-${tag}-${contador}`,
            estado: "CLASIFICADO",
            eliminado: false,
        },
    });
}

async function sembrarEstudiante(colegioId: string, cursoId: string, opts: { conAcudiente?: boolean } = {}) {
    contador += 1;
    const estudiante = await prisma.estudiante.create({
        data: { cursoId, colegioId, nombre: `Est${contador}`, apellidos: "Prueba", documentoTipo: "TI", documentoNumero: `RES-965-${contador}`, estado: "activo" },
    });
    const identificador = await prisma.identificadorEstudiante.create({
        data: { estudianteId: estudiante.id, colegioId, tipo: "telefono", valor: `+57311${String(contador).padStart(7, "0")}`, etiquetaRelacion: "ESTUDIANTE", estado: "activo" },
    });
    if (opts.conAcudiente) {
        await prisma.acudienteEstudiante.create({
            data: { estudianteId: estudiante.id, orden: 1, nombre: "Acudiente Prueba", relacion: "madre" },
        });
    }
    return { estudiante, identificador };
}

async function sembrarAlerta(
    colegioId: string,
    identificadorId: string,
    reporteId: string,
    opts: { prioridad?: "alta" | "media" | "baja"; estado?: string } = {}
) {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            identificadorEstudianteId: identificadorId,
            estado: opts.estado ?? "nueva",
            creadoEn: new Date(),
            prioridad: opts.prioridad ?? "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
}

describe("SPEC-965 · ColegioResumenRepository.cursoOrbita", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("mirada = alta viva (rubí) ∪ sin contacto (ámbar); resto en calma; media y alta-cerrada NO son rubí", async () => {
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const prof = await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "Ruiz" });
        const curso = await crearCurso(colegio.id, { nombre: "A-1" });
        await prisma.curso.update({ where: { id: curso.id }, data: { profesorTitularId: prof.id } });

        const e1 = await sembrarEstudiante(colegio.id, curso.id, { conAcudiente: true }); // alta viva → rubí
        const e2 = await sembrarEstudiante(colegio.id, curso.id, { conAcudiente: false }); // sin contacto → ámbar
        const e3 = await sembrarEstudiante(colegio.id, curso.id, { conAcudiente: true }); // media viva → calma
        const e4 = await sembrarEstudiante(colegio.id, curso.id, { conAcudiente: true }); // alta CERRADA → calma

        const rA = await sembrarReporte(plataforma.id, "alta");
        await sembrarAlerta(colegio.id, e1.identificador.id, rA.id, { prioridad: "alta", estado: "nueva" });
        const rM = await sembrarReporte(plataforma.id, "media");
        await sembrarAlerta(colegio.id, e3.identificador.id, rM.id, { prioridad: "media", estado: "vista" });
        const rC = await sembrarReporte(plataforma.id, "alta-cerrada");
        await sembrarAlerta(colegio.id, e4.identificador.id, rC.id, { prioridad: "alta", estado: "cerrada" });

        const detalle = await new ColegioResumenRepository().cursoOrbita(colegio.id, curso.id);

        // Mirada: e1 (alta, rubí) primero, luego e2 (sin contacto, ámbar). e3 y e4 NO están.
        expect(detalle.alumnosMirada.map((a) => a.riesgo)).toEqual(["alta", "sin_contacto"]);
        expect(detalle.alumnosMirada[0]!.estudianteId).toBe(e1.estudiante.id);
        expect(detalle.alumnosMirada[1]!.estudianteId).toBe(e2.estudiante.id);
        // El resto (e3 media-viva con acudiente, e4 alta-CERRADA con acudiente) va a «en calma».
        expect(detalle.restoEnCalma).toBe(2);
        // Centro del curso: 3 reportes distintos en 30 días, umbral por defecto 1 → ámbar (nunca rubí).
        expect(detalle.curso.alertas30d).toBe(3);
        expect(detalle.curso.color).toBe("ambar");
        expect(detalle.titular?.nombre).toBe("Ana Ruiz");
    });

    it("404 si el curso es de otro colegio (tenant-first)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "B-1" });
        await expect(new ColegioResumenRepository().cursoOrbita(a.id, cursoB.id)).rejects.toThrow();
    });
});
