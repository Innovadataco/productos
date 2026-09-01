/**
 * SPEC-134 (E-1, O-4): tests del AlertaColegioRepository — tenant en lecturas Y
 * escrituras, filtro tipado de estado y conteos de estadísticas por colegio.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearPlataforma,
    crearProfesor,
    crearIdentificadorProfesor,
    crearEstudiante,
    crearAcudienteEstudiante,
    crearIdentificadorAcudiente,
} from "@/lib/reporte-test-utils";
import { AlertaColegioRepository } from "./alerta-colegio";

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO", "REVISION_MANUAL", "POSIBLE_SPAM", "REQUIERE_ANONIMIZACION"] as const;

async function sembrarAlerta(colegioId: string, plataformaId: string, tag: string, opts: { estadoAlerta?: string; estadoReporte?: "CLASIFICADO" | "PENDIENTE"; eliminado?: boolean } = {}) {
    const curso = await crearCurso(colegioId, { nombre: `Curso ${tag}` });
    const alumno = await prisma.estudiante.create({ data: { cursoId: curso.id, colegioId, nombre: `Alumno ${tag}`, documentoTipo: "TI", documentoNumero: `ALE-${tag}` } });
    const identificador = await prisma.identificadorEstudiante.create({
        data: { estudianteId: alumno.id, colegioId, tipo: "telefono", valor: `+57300${tag.replace(/\D/g, "").padEnd(7, "0")}`, plataformaId, etiquetaRelacion: "ESTUDIANTE" },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-${tag}`,
            estado: opts.estadoReporte ?? "CLASIFICADO",
            eliminado: opts.eliminado ?? false,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "rubrica:gemma2:27b",
            latenciaMs: 1000,
            categoriasSecundarias: [],
        },
    });
    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId: reporte.id,
            identificadorEstudianteId: identificador.id,
            estado: opts.estadoAlerta ?? "nueva",
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
    return { curso, alumno, identificador, reporte, alerta };
}

describe("AlertaColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorColegio filtra por tenant, por estado y excluye reportes eliminados", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const nueva = await sembrarAlerta(a.id, plataforma.id, "A1");
        await sembrarAlerta(a.id, plataforma.id, "A2", { estadoAlerta: "vista" });
        await sembrarAlerta(a.id, plataforma.id, "A3", { eliminado: true });
        const deB = await sembrarAlerta(b.id, plataforma.id, "B1");
        const repo = new AlertaColegioRepository();

        const todasA = await repo.listarPorColegio(a.id);
        expect(todasA.map((x) => x.id).sort(), "solo las de A con reporte vigente").toEqual(
            [nueva.alerta.id, (await repo.listarPorColegio(a.id, { estado: "vista" }))[0].id].sort()
        );
        expect(todasA.some((x) => x.id === deB.alerta.id), "la alerta de B no se cuela").toBe(false);
        expect(todasA[0].identificadorEstudiante?.valor, "incluye el identificador").toBeTruthy();
        expect(todasA[0].reporte.clasificacion?.categoria, "incluye la categoría").toBe("CONTACTO_INSISTENTE");

        const soloNuevas = await repo.listarPorColegio(a.id, { estado: "nueva" });
        expect(soloNuevas.map((x) => x.id)).toEqual([nueva.alerta.id]);
    });

    it("obtenerPorId y buscarExistente respetan el tenant", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const deB = await sembrarAlerta(b.id, plataforma.id, "B1");
        const repo = new AlertaColegioRepository();

        expect(await repo.obtenerPorId(b.id, deB.alerta.id)).not.toBeNull();
        expect(await repo.obtenerPorId(a.id, deB.alerta.id), "el id ajeno no es visible").toBeNull();

        const existente = await repo.buscarExistente(b.id, deB.reporte.id, {
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: deB.identificador.id,
        });
        expect(existente!.id).toBe(deB.alerta.id);
        expect(
            await repo.buscarExistente(a.id, deB.reporte.id, {
                tipoSujeto: "ESTUDIANTE",
                identificadorEstudianteId: deB.identificador.id,
            }),
            "otra combinación = null"
        ).toBeNull();
    });

    it("crear persiste la alerta en estado nueva", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const base = await sembrarAlerta(a.id, plataforma.id, "A1");
        const curso2 = await crearCurso(a.id, { nombre: "Curso A9" });
        const alumno2 = await prisma.estudiante.create({ data: { cursoId: curso2.id, colegioId: a.id, nombre: "Alumno A9", documentoTipo: "TI", documentoNumero: "ALE-A9" } });
        const ident2 = await prisma.identificadorEstudiante.create({
            data: { estudianteId: alumno2.id, colegioId: a.id, tipo: "telefono", valor: "+573009999999", plataformaId: plataforma.id, etiquetaRelacion: "ESTUDIANTE" },
        });
        const repo = new AlertaColegioRepository();

        const creada = await repo.crear({
            colegioId: a.id,
            reporteId: base.reporte.id,
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: ident2.id,
        });
        expect(creada.estado).toBe("nueva");
        expect(creada.colegioId).toBe(a.id);
        expect(creada.tipoSujeto).toBe("ESTUDIANTE");
    });

    it("crea alertas de profesor y acudiente con sus FKs", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const profesor = await crearProfesor(a.id, { nombre: "Carlos", apellidos: "López" });
        const identProf = await crearIdentificadorProfesor(profesor.id, a.id, {
            valor: "+57300PROF",
            plataformaId: plataforma.id,
        });
        const curso = await crearCurso(a.id, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, a.id, { nombre: "Ana" });
        const acudiente = await crearAcudienteEstudiante(alumno.id, { nombre: "Lucía Pérez", relacion: "madre" });
        const identAcu = await crearIdentificadorAcudiente(acudiente.id, a.id, {
            valor: "+57300ACU",
            plataformaId: plataforma.id,
        });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300BASE",
                plataformaId: plataforma.id,
                texto: "Reporte base",
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-BASE",
                estado: "CLASIFICADO",
            },
        });
        const repo = new AlertaColegioRepository();

        const alertaProf = await repo.crear({
            colegioId: a.id,
            reporteId: reporte.id,
            tipoSujeto: "PROFESOR",
            identificadorProfesorId: identProf.id,
        });
        expect(alertaProf.tipoSujeto).toBe("PROFESOR");
        expect(alertaProf.identificadorProfesorId).toBe(identProf.id);

        const alertaAcu = await repo.crear({
            colegioId: a.id,
            reporteId: reporte.id,
            tipoSujeto: "ACUDIENTE",
            identificadorAcudienteId: identAcu.id,
        });
        expect(alertaAcu.tipoSujeto).toBe("ACUDIENTE");
        expect(alertaAcu.identificadorAcudienteId).toBe(identAcu.id);
    });

    it("O-4: cambiarEstado por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const deB = await sembrarAlerta(b.id, plataforma.id, "B1");
        const repo = new AlertaColegioRepository();

        await expect(repo.cambiarEstado(a.id, deB.alerta.id, "gestionada")).rejects.toMatchObject({ statusCode: 404 });
        const intacta = await prisma.alertaColegio.findUnique({ where: { id: deB.alerta.id } });
        expect(intacta!.estado, "la alerta de B no fue tocada").toBe("nueva");

        const propia = await repo.cambiarEstado(b.id, deB.alerta.id, "vista");
        expect(propia.estado).toBe("vista");
    });

    it("contarVisiblesPorColegio y contarVisiblesPorCursoIds cuentan solo el propio tenant y reportes visibles", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const visible = await sembrarAlerta(a.id, plataforma.id, "A1");
        await sembrarAlerta(a.id, plataforma.id, "A2", { estadoReporte: "PENDIENTE" });
        await sembrarAlerta(a.id, plataforma.id, "A3", { eliminado: true });
        await sembrarAlerta(b.id, plataforma.id, "B1");
        const repo = new AlertaColegioRepository();

        expect(await repo.contarVisiblesPorColegio(a.id, [...ESTADOS_VISIBLES]), "solo visibles y de A").toBe(1);

        const porCurso = await repo.contarVisiblesPorCursoIds(a.id, [visible.curso.id], [...ESTADOS_VISIBLES]);
        expect(porCurso.get(visible.curso.id)).toBe(1);
    });

    // SPEC-353 (C6 · T001): cruce por VALOR del identificador en 7 días — solo conteos.
    it("identificadorCruzado7d cuenta el mismo valor en 2 estudiantes distintos y respeta tenant/7d", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new AlertaColegioRepository();

        // Fixture: mismo VALOR en dos alumnos distintos de A, cada uno con alerta reciente.
        const uno = await sembrarAlerta(a.id, plataforma.id, "C1");
        const dosBase = await sembrarAlerta(a.id, plataforma.id, "C2");
        await prisma.identificadorEstudiante.update({
            where: { id: dosBase.identificador.id },
            data: { valor: uno.identificador.valor, plataformaId: null },
        });

        // Contrafixture 1: DOS alertas del MISMO estudiante no cruzan (mismo alumnoId).
        const tres = await sembrarAlerta(a.id, plataforma.id, "C3");
        const reporteExtra = await prisma.reporte.create({
            data: {
                identificador: tres.identificador.valor,
                plataformaId: plataforma.id,
                texto: "Reporte C3-bis",
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-C3-bis",
                estado: "CLASIFICADO",
                eliminado: false,
            },
        });
        await prisma.alertaColegio.create({
            data: {
                colegioId: a.id,
                reporteId: reporteExtra.id,
                identificadorEstudianteId: tres.identificador.id,
                estado: "vista",
                prioridad: "media",
                vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
        });
        // Contrafixture 2: alerta vieja (>7 días) no cuenta para el cruce.
        const vieja = await sembrarAlerta(a.id, plataforma.id, "C4");
        await prisma.alertaColegio.update({
            where: { id: vieja.alerta.id },
            data: { creadoEn: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
        });

        const cruzadoA = await repo.identificadorCruzado7d(a.id);
        expect(cruzadoA.identificadores, "un solo valor cruzado").toBe(1);
        expect(cruzadoA.estudiantesMax, "toca 2 estudiantes").toBe(2);

        const cruzadoB = await repo.identificadorCruzado7d(b.id);
        expect(cruzadoB, "el colegio B no ve el cruce de A").toEqual({ identificadores: 0, estudiantesMax: 0 });
    });

    // SPEC-353 (C6 · T001): fecha de la alerta "nueva" más reciente, por tenant.
    it("ultimaAlertaSinAbrir devuelve la fecha de la nueva más reciente y null sin nuevas", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new AlertaColegioRepository();

        expect(await repo.ultimaAlertaSinAbrir(a.id), "colegio virgen → null").toBeNull();

        await sembrarAlerta(a.id, plataforma.id, "N1", { estadoAlerta: "vista" });
        expect(await repo.ultimaAlertaSinAbrir(a.id), "vista no cuenta").toBeNull();

        const nueva = await sembrarAlerta(a.id, plataforma.id, "N2");
        const fecha = await repo.ultimaAlertaSinAbrir(a.id);
        expect(fecha?.getTime()).toBe(nueva.alerta.creadoEn.getTime());
        expect(await repo.ultimaAlertaSinAbrir(b.id), "tenant B no ve la de A").toBeNull();
    });
});
