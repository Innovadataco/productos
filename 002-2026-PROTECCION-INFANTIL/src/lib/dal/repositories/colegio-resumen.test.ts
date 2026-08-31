/**
 * SPEC-143 (T001, FR-014, SC-001/002/003) — Tests de ColegioResumenRepository.homeRector:
 * - A/B tenant: el colegio B nunca ve datos de A (ni al revés).
 * - Cobertura exacta 70%/50% (fixture de 10 estudiantes: 7 con identificador, 5 con acudiente).
 * - Métrica D2: un reporte con 2 alertas cuenta UNA vez (COUNT DISTINCT reporteId).
 * - Periodos: semana / semana anterior / mes con delta.
 * - Top de cursos 30d con titular (y "sin titular" → null).
 * - Series 12/12/3 con huecos en cero; 0 estudiantes no rompe (sin NaN).
 * - UNA llamada: cada método de repo hijo se invoca una vez por carga.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma, crearProfesor } from "@/lib/reporte-test-utils";
import { ColegioResumenRepository } from "./colegio-resumen";
import { EstudianteRepository } from "./estudiante";
import { AlertaColegioRepository } from "./alerta-colegio";

const DIA_MS = 24 * 60 * 60 * 1000;

let contador = 0;

async function sembrarReporte(plataformaId: string, tag: string) {
    return prisma.reporte.create({
        data: {
            identificador: `+57310${String(contador).padStart(7, "0")}`,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-143-${tag}-${contador}`,
            estado: "CLASIFICADO",
            eliminado: false,
        },
    });
}

/** Estudiante activo con identificador activo; opcionalmente con acudiente. */
async function sembrarEstudiante(colegioId: string, cursoId: string, opts: { conAcudiente?: boolean } = {}) {
    contador += 1;
    const estudiante = await prisma.estudiante.create({
        data: { cursoId, colegioId, nombre: `Est ${contador}`, apellidos: "Prueba", documentoTipo: "TI", documentoNumero: `RES-${contador}`, estado: "activo" },
    });
    const identificador = await prisma.identificadorEstudiante.create({
        data: {
            estudianteId: estudiante.id,
            colegioId,
            tipo: "telefono",
            valor: `+57311${String(contador).padStart(7, "0")}`,
            etiquetaRelacion: "ESTUDIANTE",
            estado: "activo",
        },
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
    opts: { creadoEn?: Date; estado?: string } = {}
) {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            identificadorEstudianteId: identificadorId,
            estado: opts.estado ?? "vista",
            creadoEn: opts.creadoEn ?? new Date(),
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
}

describe("ColegioResumenRepository.homeRector", () => {
    // SPEC-283 (002-PI-180): reset POR PRUEBA. La migración a beforeAll rompe
    // con la suite completa porque vitest 3.2.x corre archivos concurrentemente
    // a pesar de fileParallelism:false: el mutex TestMutex serializa por test
    // (afterEach) → un beforeEach(reset) de OTRO archivo en otro fork limpia
    // los seeds del beforeAll antes de que corra el primer it. Aislado pasa,
    // en la suite falla (10 tests rojos, corridas 1 y 2 idénticas).
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("A/B tenant: B nunca ve datos de A y los KPIs cuentan solo activos", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        await crearCurso(a.id, { nombre: "Curso inactivo", estado: "inactivo" });
        await crearProfesor(a.id, { nombre: "María", apellidos: "López" });
        await crearProfesor(a.id, { nombre: "Inactivo", apellidos: "Prof", estado: "inactivo" });

        // Fixture de cobertura: 10 activos, 7 con identificador, 5 con acudiente (+1 inactivo que no cuenta).
        const conIdentificador: { identificador: { id: string } }[] = [];
        for (let i = 0; i < 10; i += 1) {
            const e = await sembrarEstudiante(a.id, cursoA.id, { conAcudiente: i < 5 });
            if (i < 7) conIdentificador.push(e);
            else {
                // 3 estudiantes SIN identificador: borrar el sembrado para el hueco exacto.
                await prisma.identificadorEstudiante.delete({ where: { id: e.identificador.id } });
            }
        }
        await prisma.estudiante.create({
            data: { cursoId: cursoA.id, colegioId: a.id, nombre: "Inactivo", apellidos: "Est", documentoTipo: "TI", documentoNumero: "RES-INACT-1", estado: "inactivo" },
        });

        // Actividad de A: un reporte con DOS alertas (cuenta UNA vez, D2) hoy;
        // otro hace 2 días (dentro de la ventana de 72 h del semáforo, sin borde);
        // otro hace 10 días (semana anterior); uno hace 40 días.
        const ahora = new Date();
        const reporteHoy = await sembrarReporte(plataforma.id, "hoy");
        await sembrarAlerta(a.id, conIdentificador[0]!.identificador.id, reporteHoy.id, { estado: "nueva" });
        await sembrarAlerta(a.id, conIdentificador[1]!.identificador.id, reporteHoy.id, { estado: "vista" });
        const reporte2d = await sembrarReporte(plataforma.id, "2d");
        await sembrarAlerta(a.id, conIdentificador[2]!.identificador.id, reporte2d.id, {
            creadoEn: new Date(ahora.getTime() - 2 * DIA_MS),
        });
        const reporte10d = await sembrarReporte(plataforma.id, "10d");
        await sembrarAlerta(a.id, conIdentificador[3]!.identificador.id, reporte10d.id, {
            creadoEn: new Date(ahora.getTime() - 10 * DIA_MS),
        });
        const reporte40d = await sembrarReporte(plataforma.id, "40d");
        await sembrarAlerta(a.id, conIdentificador[4]!.identificador.id, reporte40d.id, {
            creadoEn: new Date(ahora.getTime() - 40 * DIA_MS),
        });

        // Actividad de B (no debe cruzar a A).
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const deB = await sembrarEstudiante(b.id, cursoB.id, {});
        const reporteB = await sembrarReporte(plataforma.id, "deB");
        await sembrarAlerta(b.id, deB.identificador.id, reporteB.id);

        const repo = new ColegioResumenRepository();
        const homeA = await repo.homeRector(a.id);

        // KPIs solo activos de A.
        expect(homeA.kpis.estudiantes).toBe(10);
        expect(homeA.kpis.cursos).toBe(1);
        expect(homeA.kpis.profesores).toBe(1);

        // Cobertura exacta 70% / 50% con huecos en personas (SC-003).
        expect(homeA.cobertura.vigilancia).toBeCloseTo(0.7, 10);
        expect(homeA.cobertura.reaccion).toBeCloseTo(0.5, 10);
        expect(homeA.cobertura.sinRedes).toBe(3);
        expect(homeA.cobertura.sinContacto).toBe(5);

        // D2: reporteHoy con 2 alertas cuenta UNA vez → semana = 2 (hoy + 2d).
        expect(homeA.kpis.reportesSemana).toBe(2);
        expect(homeA.kpis.deltaSemana).toBe(1); // semana anterior = 1 (10d)
        // Mes en curso: depende del día del mes en que corre el test — se contrasta
        // con la MISMA ventana calculada directa al repo (wiring, no tautología de datos).
        const inicioMesUtc = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
        const esperadoMes = await new AlertaColegioRepository().contarReportesDistintos(a.id, inicioMesUtc);
        expect(homeA.kpis.reportesMes).toBe(esperadoMes);
        expect(homeA.kpis.reportesMes).toBeGreaterThanOrEqual(1);

        // Semáforo: 1 nueva (rubí) y 72h cubre hoy + 2d.
        expect(homeA.semaforo.alertasNuevas).toBe(1);
        expect(homeA.semaforo.alertas72h).toBe(3); // filas (hoy×2 + 2d), sin distinct
        expect(homeA.ultimaSenal).not.toBeNull();

        // SPEC-167: embudo por reporte distinto en el radar operativo.
        expect(homeA.embudo).toEqual({ recibidos: 4, cerrados: 0, enRevision: 3, teEsperan: 1 });

        // Series: 12/12/3 puntos, huecos en cero; el punto actual recoge la actividad.
        expect(homeA.tendencia.semanal).toHaveLength(12);
        expect(homeA.tendencia.mensual).toHaveLength(12);
        expect(homeA.tendencia.anual).toHaveLength(3);
        const totalSemanas = homeA.tendencia.semanal.reduce((s, p) => s + p.reportes, 0);
        expect(totalSemanas).toBe(4); // 12 semanas (~84 días) cubren los 4 reportes distintos de A
        // Los "dos últimos buckets semanales" son fecha-dependientes (en fin de
        // semana el reporte de 10d puede entrar al penúltimo bucket): se contrasta
        // con la MISMA frontera de date_trunc('week') calculada aquí (determinista).
        const lunesUtc = (d: Date) => {
            const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
            return t;
        };
        const fronteraPenultimoBucket = lunesUtc(ahora).getTime() - 7 * DIA_MS;
        const esperadoUltimosDos = [ahora.getTime(), ahora.getTime() - 2 * DIA_MS, ahora.getTime() - 10 * DIA_MS, ahora.getTime() - 40 * DIA_MS]
            .filter((ts) => ts >= fronteraPenultimoBucket).length;
        const ultimosDosBuckets = homeA.tendencia.semanal.slice(-2).reduce((s, p) => s + p.reportes, 0);
        expect(ultimosDosBuckets).toBe(esperadoUltimosDos);
        expect(homeA.tendencia.semanal.at(-1)!.reportes).toBeGreaterThanOrEqual(1);
        const totalAnios = homeA.tendencia.anual.reduce((s, p) => s + p.reportes, 0);
        expect(totalAnios).toBe(4); // los 4 reportes distintos de A caen en los últimos 3 años

        // Top cursos 30d: 8-B con 3 reportes distintos (hoy+3d+10d... 10d está dentro de 30d).
        expect(homeA.cursosMirada).toHaveLength(1);
        expect(homeA.cursosMirada[0]!.nombre).toBe("8-B");
        expect(homeA.cursosMirada[0]!.alertas30d).toBe(3);
        expect(homeA.cursosMirada[0]!.profesorTitular).toBeNull();

        // Tenant cruzado: B solo ve lo suyo (SC-001).
        const homeB = await repo.homeRector(b.id);
        expect(homeB.kpis.estudiantes).toBe(1);
        expect(homeB.kpis.reportesSemana).toBe(1);
        expect(homeB.cursosMirada.every((c) => c.nombre !== "8-B")).toBe(true);
        expect(homeB.kpis.profesores).toBe(0);
    });

    it("top cursos ordena por actividad 30d y trae el titular; colegio sin estudiantes no rompe (sin NaN)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: vacio } = await crearColegioConAdmin();
        const profesor = await crearProfesor(a.id, { nombre: "María", apellidos: "López" });
        const cursoTop = await crearCurso(a.id, { nombre: "8-B", profesorTitularId: profesor.id });
        const cursoSegundo = await crearCurso(a.id, { nombre: "10-A" });

        const e1 = await sembrarEstudiante(a.id, cursoTop.id, {});
        const e2 = await sembrarEstudiante(a.id, cursoSegundo.id, {});
        const r1 = await sembrarReporte(plataforma.id, "t1");
        const r2 = await sembrarReporte(plataforma.id, "t2");
        const r3 = await sembrarReporte(plataforma.id, "t3");
        await sembrarAlerta(a.id, e1.identificador.id, r1.id);
        await sembrarAlerta(a.id, e1.identificador.id, r2.id);
        await sembrarAlerta(a.id, e2.identificador.id, r3.id);

        const home = await new ColegioResumenRepository().homeRector(a.id);
        expect(home.cursosMirada.map((c) => c.nombre)).toEqual(["8-B", "10-A"]);
        expect(home.cursosMirada[0]!.profesorTitular).toBe("María López");
        expect(home.cursosMirada[0]!.alertas30d).toBe(2);
        expect(home.cursosMirada[1]!.profesorTitular).toBeNull();

        // Colegio vacío: cero divisiones por cero, series de ceros dibujables.
        const homeVacio = await new ColegioResumenRepository().homeRector(vacio.id);
        expect(homeVacio.kpis.estudiantes).toBe(0);
        expect(homeVacio.cobertura.vigilancia).toBe(0);
        expect(homeVacio.cobertura.reaccion).toBe(0);
        expect(homeVacio.cobertura.sinRedes).toBe(0);
        expect(homeVacio.ultimaSenal).toBeNull();
        expect(homeVacio.cursosMirada).toEqual([]);
        expect(homeVacio.tendencia.semanal.every((p) => p.reportes === 0)).toBe(true);
        expect(homeVacio.embudo).toEqual({ recibidos: 0, cerrados: 0, enRevision: 0, teEsperan: 0 });
    });

    it("UNA llamada: cada consulta del repo hijo se invoca una vez por carga (SC-002)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const espiaCobertura = vi.spyOn(EstudianteRepository.prototype, "contarCobertura");
        const espiaSemaforo = vi.spyOn(AlertaColegioRepository.prototype, "conteosSemaforo");
        const espiaSerie = vi.spyOn(AlertaColegioRepository.prototype, "serieReportesPorPeriodo");

        await new ColegioResumenRepository().homeRector(a.id);

        expect(espiaCobertura).toHaveBeenCalledTimes(1);
        expect(espiaSemaforo).toHaveBeenCalledTimes(1);
        expect(espiaSerie).toHaveBeenCalledTimes(3); // semana / mes / año
    });

    it("contarReportesDistintos respeta la ventana [desde, hasta) y el tenant", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const e = await sembrarEstudiante(a.id, cursoA.id, {});
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const eB = await sembrarEstudiante(b.id, cursoB.id, {});

        const ahora = new Date("2026-08-03T12:00:00Z");
        const r1 = await sembrarReporte(plataforma.id, "v1");
        await sembrarAlerta(a.id, e.identificador.id, r1.id, { creadoEn: new Date(ahora.getTime() - 2 * DIA_MS) });
        const r2 = await sembrarReporte(plataforma.id, "v2");
        await sembrarAlerta(a.id, e.identificador.id, r2.id, { creadoEn: new Date(ahora.getTime() - 9 * DIA_MS) });
        const rB = await sembrarReporte(plataforma.id, "vB");
        await sembrarAlerta(b.id, eB.identificador.id, rB.id, { creadoEn: new Date(ahora.getTime() - 1 * DIA_MS) });

        const repo = new AlertaColegioRepository();
        const hace7d = new Date(ahora.getTime() - 7 * DIA_MS);
        const hace14d = new Date(ahora.getTime() - 14 * DIA_MS);
        expect(await repo.contarReportesDistintos(a.id, hace7d)).toBe(1);
        expect(await repo.contarReportesDistintos(a.id, hace14d, hace7d)).toBe(1);
        expect(await repo.contarReportesDistintos(a.id, hace14d)).toBe(2);
        expect(await repo.contarReportesDistintos(b.id, hace7d)).toBe(1);
        expect(await repo.contarReportesDistintos(a.id, new Date(0))).toBe(2); // B no se cuela
    });
});
