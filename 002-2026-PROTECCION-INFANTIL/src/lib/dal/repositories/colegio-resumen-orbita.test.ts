/**
 * CANDADO · SPEC-964 (FORMA Órbita · capa 1) — ColegioResumenRepository.orbitaColegio.
 *
 * Muere con el defecto (mutación en los tres ejes que pidió el encargo):
 *   1. Trae TODOS los cursos activos (PARÁ 2): siembra 5 y vuelven 5 — no el top-3 de `homeRector`,
 *      incluidos los cursos de 0 reportes (pino). D2: un reporte con 2 alertas en el curso cuenta UNA vez.
 *   2. El color LEE el umbral sembrado (PARÁ 3): el MISMO curso cambia de color al mover el parámetro.
 *      Si el corte estuviera quemado, al subir el umbral el color no cambiaría y el test fallaría.
 *   3. Reusa `semaforo`/`casosComite` de `homeRector` (no duplica): salen idénticos a los de la home.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma } from "@/lib/reporte-test-utils";
import { ColegioResumenRepository } from "./colegio-resumen";
import { CLAVE_CURSO_MIRADA_UMBRAL } from "@/lib/colegio/curso-mirada";

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
            numeroSeguimiento: `RPT-964-${tag}-${contador}`,
            estado: "CLASIFICADO",
            eliminado: false,
        },
    });
}

async function sembrarEstudiante(colegioId: string, cursoId: string) {
    contador += 1;
    const estudiante = await prisma.estudiante.create({
        data: { cursoId, colegioId, nombre: `Est ${contador}`, apellidos: "Prueba", documentoTipo: "TI", documentoNumero: `RES-964-${contador}`, estado: "activo" },
    });
    const identificador = await prisma.identificadorEstudiante.create({
        data: { estudianteId: estudiante.id, colegioId, tipo: "telefono", valor: `+57311${String(contador).padStart(7, "0")}`, etiquetaRelacion: "ESTUDIANTE", estado: "activo" },
    });
    return { estudiante, identificador };
}

async function sembrarAlerta(colegioId: string, identificadorId: string, reporteId: string, estado = "vista") {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            identificadorEstudianteId: identificadorId,
            estado,
            creadoEn: new Date(),
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
}

async function fijarUmbral(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: CLAVE_CURSO_MIRADA_UMBRAL },
        update: { valor },
        create: { clave: CLAVE_CURSO_MIRADA_UMBRAL, valor, tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
    });
}

describe("SPEC-964 · ColegioResumenRepository.orbitaColegio", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("PARÁ 2: trae TODOS los cursos (siembra 5 → vuelven 5, no el top-3); D2 y nº de estudiantes exactos", async () => {
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const c1 = await crearCurso(colegio.id, { nombre: "A-1" });
        const c2 = await crearCurso(colegio.id, { nombre: "A-2" });
        const c3 = await crearCurso(colegio.id, { nombre: "A-3" });
        const c4 = await crearCurso(colegio.id, { nombre: "A-4" });
        const c5 = await crearCurso(colegio.id, { nombre: "A-5" });
        // Un curso inactivo NO debe aparecer.
        await crearCurso(colegio.id, { nombre: "Z-inactivo", estado: "inactivo" });

        // C1: 3 reportes distintos (2 estudiantes). C2: 1 reporte con 2 alertas → D2 cuenta 1.
        const e1a = await sembrarEstudiante(colegio.id, c1.id);
        const e1b = await sembrarEstudiante(colegio.id, c1.id);
        for (const tag of ["c1-a", "c1-b", "c1-c"]) {
            const r = await sembrarReporte(plataforma.id, tag);
            await sembrarAlerta(colegio.id, e1a.identificador.id, r.id);
        }
        const e2a = await sembrarEstudiante(colegio.id, c2.id);
        const e2b = await sembrarEstudiante(colegio.id, c2.id);
        const rC2 = await sembrarReporte(plataforma.id, "c2-unico");
        await sembrarAlerta(colegio.id, e2a.identificador.id, rC2.id);
        await sembrarAlerta(colegio.id, e2b.identificador.id, rC2.id); // mismo reporte → D2 = 1
        // C3/C4/C5: estudiantes pero 0 reportes.
        await sembrarEstudiante(colegio.id, c3.id);
        await sembrarEstudiante(colegio.id, c4.id);
        await sembrarEstudiante(colegio.id, c5.id);

        const repo = new ColegioResumenRepository();
        const orbita = await repo.orbitaColegio(colegio.id);
        const home = await repo.homeRector(colegio.id);

        // TODOS los cursos activos (5), NO el top-3 de la home.
        expect(orbita.cursos).toHaveLength(5);
        expect(home.cursosMirada.length).toBeLessThanOrEqual(3);
        expect(orbita.cursos.length).toBeGreaterThan(home.cursosMirada.length);

        const porId = new Map(orbita.cursos.map((c) => [c.cursoId, c]));
        expect(porId.get(c1.id)).toMatchObject({ alertas30d: 3, estudiantes: 2, color: "ambar" });
        expect(porId.get(c2.id)).toMatchObject({ alertas30d: 1, estudiantes: 2, color: "ambar" }); // D2
        expect(porId.get(c3.id)).toMatchObject({ alertas30d: 0, estudiantes: 1, color: "pino" });
        expect(porId.get(c4.id)!.color).toBe("pino");
        expect(porId.get(c5.id)!.color).toBe("pino");
        // Umbral por defecto (sin parámetro sembrado) = 1.
        expect(orbita.umbralMirada).toBe(1);
    });

    it("PARÁ 3: el color LEE el umbral sembrado — cambiar el parámetro cambia el color del MISMO curso", async () => {
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "B-1" });
        const e = await sembrarEstudiante(colegio.id, curso.id);
        // 2 reportes distintos en el curso.
        for (const tag of ["b1-a", "b1-b"]) {
            const r = await sembrarReporte(plataforma.id, tag);
            await sembrarAlerta(colegio.id, e.identificador.id, r.id);
        }
        const repo = new ColegioResumenRepository();

        await fijarUmbral("1");
        let orbita = await repo.orbitaColegio(colegio.id);
        expect(orbita.umbralMirada).toBe(1);
        expect(orbita.cursos[0]).toMatchObject({ alertas30d: 2, color: "ambar" });

        await fijarUmbral("3"); // ahora exige 3 → 2 reportes queda por debajo
        orbita = await repo.orbitaColegio(colegio.id);
        expect(orbita.umbralMirada).toBe(3);
        expect(orbita.cursos[0]).toMatchObject({ alertas30d: 2, color: "pino" });

        await fijarUmbral("2"); // justo en el umbral → cruza → ámbar
        orbita = await repo.orbitaColegio(colegio.id);
        expect(orbita.cursos[0]!.color).toBe("ambar");
    });

    it("reusa semaforo/casosComite de homeRector (no duplica): salen idénticos", async () => {
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "C-1" });
        const e = await sembrarEstudiante(colegio.id, curso.id);
        const r = await sembrarReporte(plataforma.id, "nueva");
        await sembrarAlerta(colegio.id, e.identificador.id, r.id, "nueva");

        const repo = new ColegioResumenRepository();
        const [orbita, home] = await Promise.all([repo.orbitaColegio(colegio.id), repo.homeRector(colegio.id)]);

        expect(orbita.semaforo.alertasNuevas).toBe(1); // valor no trivial
        expect(orbita.semaforo).toEqual(home.semaforo);
        expect(orbita.casosComite).toEqual(home.casosComite);
    });
});
