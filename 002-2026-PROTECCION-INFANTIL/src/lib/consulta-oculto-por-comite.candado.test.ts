/**
 * CANDADO · SPEC-937 (I-451) — lo que el comité oculta, ninguna superficie pública lo muestra.
 *
 * El defecto (medido por Calidad caminando el journey 936): el comité ACEPTA una apelación con solo
 * «Quitar la visibilidad pública» → `ocultoPorComiteEn` queda puesto y la bandeja dice «Se quitó la
 * visibilidad», pero `/api/consulta` seguía en `tieneReportes=true`: la consulta lee los REPORTES por
 * identificador y nunca la marca (solo se apagaba `esVisiblePublicamente`). Mismo hueco en el detalle,
 * las estadísticas públicas y el círculo de confianza (cualquier padre registrado lo ve).
 *
 * Este candado maneja el camino REAL (POST del comité al resolver) y afirma cada superficie pública,
 * con control positivo ANTES (el reporte sembrado SÍ se ve) para que el «oculto» no pase vacío. Y fija
 * la regla de SPEC-110: un reporte nuevo REAL levanta la marca; un SIMULACRO no (reporte-creation.ts).
 * Integración: usa la BD.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CategoriaConducta } from "@prisma/client";
import { POST as POSTResolver } from "@/app/api/admin/comite/apelaciones/[id]/resolver/route";
import { POST as POSTConsulta } from "@/app/api/consulta/route";
import { POST as POSTDetalle } from "@/app/api/consulta/detalle/route";
import { POST as POSTReporte } from "@/app/api/reportes/route";
import { GET as GETEstadisticas } from "@/app/api/estadisticas-publicas/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { crearApelacionConDocumento } from "@/lib/apelacion-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import { SemaforoRepository } from "@/lib/dal/repositories/semaforo-repository";
import { TimelineCirculoRepository } from "@/lib/dal/repositories/timeline-circulo-repository";
import { determinarEstadoContacto } from "@/lib/dal/services/circulo-confianza/estado";
import { listarContactos } from "@/lib/dal/services/circulo-confianza/contactos";
import { obtenerVistaAgregada } from "@/lib/dal/services/circulo-confianza/agregado";
import { ReporteCreationService } from "@/lib/dal/services/reporte-creation";
import * as auth from "@/lib/auth";

const storageDir = mkdtempSync(path.join(tmpdir(), "spec937-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

vi.mock("@/lib/queue", () => ({ sendReporte: vi.fn().mockResolvedValue({ encolado: true }) }));

const IDENT = normalizarIdentificador("+573009370001");
const NUNCA_REPORTADO = normalizarIdentificador("+573009379999");

async function plataformaId(clave = "whatsapp"): Promise<string> {
    return (await prisma.plataforma.findUniqueOrThrow({ where: { clave } })).id;
}

/** Reporte APROBADO (CLASIFICADO + clasificación válida) — el que la consulta pública cuenta. */
async function crearReporteAprobado(plataforma: string, categoria: CategoriaConducta = "CONTACTO_INSISTENTE") {
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: IDENT,
            plataformaId: plataforma,
            texto: "Texto anonimizado de prueba del reporte.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-937-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        },
    });
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria, confianza: 0.8, contienePii: false, piiDetectada: [], modeloUsado: "ornith:9b", latenciaMs: 1000 },
    });
    return reporte;
}

/** El agregado que crea el alta real (upsertIncrementoReporte); sin él la marca del comité no tiene dónde vivir. */
async function crearAgregado(plataforma: string) {
    await prisma.identificadorReportado.create({
        data: {
            identificador: IDENT, plataformaId: plataforma, totalReportes: 1, reportesAutenticados: 1,
            reportesAprobados: 1, autenticadosAprobados: 1, esVisiblePublicamente: false,
        },
    });
}

async function consulta(identificador: string) {
    const res = await POSTConsulta(new Request("http://localhost:5005/api/consulta", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identificador }),
    }));
    expect(res.status).toBe(200);
    return res.json();
}

async function detalle(identificador: string, padre: Awaited<ReturnType<typeof crearUsuario>>) {
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(padre);
    const res = await POSTDetalle(new Request("http://localhost:5005/api/consulta/detalle", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identificador }),
    }));
    expect(res.status).toBe(200);
    return res.json();
}

async function estadisticas() {
    return (await GETEstadisticas()).json();
}

/** El comité ACEPTA la apelación marcando SOLO «Quitar la visibilidad pública» (camino real del POST). */
async function comiteQuitaVisibilidad(plataforma: string) {
    const apelante = await crearUsuario("PARENT");
    const comite = await crearUsuario("COMITE_VALIDACION");
    const { apelacion } = await crearApelacionConDocumento({
        usuarioId: apelante.id, identificador: IDENT, plataformaId: plataforma, estado: "EN_REVISION", comiteId: comite.id,
    });
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
    const res = await POSTResolver(
        new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/resolver`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "ACEPTADA", motivacion: "Acredita titularidad; los reportes son de un tercero.", quitarVisibilidad: true }),
        }),
        { params: Promise.resolve({ id: apelacion.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).apelacion.quitoVisibilidad).toBe(true);
    const agregado = await prisma.identificadorReportado.findUniqueOrThrow({
        where: { identificador_plataformaId: { identificador: IDENT, plataformaId: plataforma } },
    });
    expect(agregado.ocultoPorComiteEn, "el comité debió dejar la marca").not.toBeNull();
}

describe("SPEC-937 · lo que el comité oculta, ninguna superficie pública lo muestra", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPlataforma("instagram", "Instagram", "red_social");
        await crearPaisCiudad();
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await prisma.$disconnect();
    });

    it("consulta + detalle: tras quitar visibilidad responde IGUAL que un identificador sin reportes (sin texto nuevo)", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        await crearReporteAprobado(pid);
        const padre = await crearUsuario("PARENT");

        // Control positivo: ANTES del comité el reporte SÍ es público (si no, el «oculto» de abajo sería vacío).
        const antes = await consulta(IDENT);
        expect(antes.tieneReportes).toBe(true);
        expect(antes.totalReportes).toBe(1);
        expect((await detalle(IDENT, padre)).tieneReportes).toBe(true);

        await comiteQuitaVisibilidad(pid);

        const despues = await consulta(IDENT);
        const vacio = await consulta(NUNCA_REPORTADO);
        expect(despues.tieneReportes).toBe(false);
        expect(despues.totalReportes).toBeUndefined();
        // MISMO camino que «sin reportes»: mismo mensaje y mismas claves, solo cambia el identificador.
        expect({ ...despues, identificador: "x" }).toEqual({ ...vacio, identificador: "x" });
        expect((await detalle(IDENT, padre)).tieneReportes).toBe(false);
    });

    it("estadísticas públicas: el par oculto deja de contar en reportes e identificadores únicos", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        await crearReporteAprobado(pid);

        const antes = await estadisticas();
        expect(antes.totales.reportes).toBe(1);
        expect(antes.totales.identificadoresUnicos).toBe(1);

        await comiteQuitaVisibilidad(pid);

        const despues = await estadisticas();
        expect(despues.totales.reportes).toBe(0);
        expect(despues.totales.identificadoresUnicos).toBe(0);
        expect(despues.porPlataforma).toEqual([]);
        expect(despues.porCategoria).toEqual([]);
    });

    it("círculo de confianza: un padre que tiene al identificador oculto como contacto lo ve sin reportes", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        await crearReporteAprobado(pid);
        const padre = await crearUsuario("PARENT");
        const contacto = await prisma.contactoConfianza.create({
            data: { usuarioId: padre.id, etiqueta: "Tío", identificadores: { create: { valor: IDENT, activo: true } } },
        });
        const desde = new Date("2000-01-01T00:00:00Z");

        // Los 5 lectores del círculo (estado, semáforo, timeline, listado, vista agregada) — control positivo ANTES.
        expect((await determinarEstadoContacto(contacto.id)).estado).toBe("clasificado");
        expect(await new SemaforoRepository().buscarReportesVisiblesPorIdentificadores([IDENT])).toHaveLength(1);
        expect(await new TimelineCirculoRepository().buscarReportesVisiblesRecientes([IDENT], desde)).toHaveLength(1);
        expect((await listarContactos(padre.id)).contactos[0]?.estado).toBe("clasificado");
        expect((await obtenerVistaAgregada(padre.id)).totalReportes).toBe(1);

        await comiteQuitaVisibilidad(pid);

        expect((await determinarEstadoContacto(contacto.id)).estado).toBe("sinReportes");
        expect(await new SemaforoRepository().buscarReportesVisiblesPorIdentificadores([IDENT])).toEqual([]);
        expect(await new TimelineCirculoRepository().buscarReportesVisiblesRecientes([IDENT], desde)).toEqual([]);
        expect((await listarContactos(padre.id)).contactos[0]?.estado).toBe("sinReportes");
        expect((await obtenerVistaAgregada(padre.id)).totalReportes).toBe(0);
    });

    it("la marca es por PAR: el mismo identificador en otra plataforma sigue su regla normal", async () => {
        const wa = await plataformaId("whatsapp");
        const ig = await plataformaId("instagram");
        await crearAgregado(wa);
        await crearReporteAprobado(wa);
        await crearReporteAprobado(ig);

        await comiteQuitaVisibilidad(wa);

        const r = await consulta(IDENT);
        expect(r.tieneReportes).toBe(true);
        expect(r.totalReportes).toBe(1); // solo el de instagram
    });

    it("internamente sigue completo: ocultar NO borra ni da de baja la evidencia", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        const reporte = await crearReporteAprobado(pid);

        await comiteQuitaVisibilidad(pid);

        const fila = await prisma.reporte.findUniqueOrThrow({ where: { id: reporte.id }, include: { clasificacion: true } });
        expect(fila.eliminado).toBe(false);
        expect(fila.estado).toBe("CLASIFICADO");
        expect(fila.clasificacion).not.toBeNull();
    });

    it("SPEC-110: un reporte nuevo REAL posterior levanta la marca → la consulta vuelve a mostrarlo", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        await crearReporteAprobado(pid);
        await comiteQuitaVisibilidad(pid);
        expect((await consulta(IDENT)).tieneReportes).toBe(false);

        const res = await POSTReporte(new Request("http://localhost:5005/api/reportes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identificador: IDENT, plataforma: "whatsapp",
                texto: "Contacto insistente hacia un menor durante varias semanas seguidas.",
                fechaIncidente: "2026-07-10T14:30:00Z", ciudad: "Bogotá", pais: "Colombia",
            }),
        }));
        expect(res.status).toBe(201);

        const agregado = await prisma.identificadorReportado.findUniqueOrThrow({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado.ocultoPorComiteEn).toBeNull();
        // El nuevo está PENDIENTE (no cuenta); el viejo aprobado vuelve a ser público por la regla vigente.
        expect((await consulta(IDENT)).tieneReportes).toBe(true);
    });

    it("SPEC-863: un SIMULACRO posterior NO levanta la marca (reporte-creation no toca el agregado)", async () => {
        const pid = await plataformaId();
        await crearAgregado(pid);
        await crearReporteAprobado(pid);
        await comiteQuitaVisibilidad(pid);

        const r = await new ReporteCreationService().crear({
            identificador: IDENT, plataformaId: pid, plataformaClave: "whatsapp",
            texto: "Simulacro de abuso para medir el pipeline sin tocar el agregado público.",
            fechaIncidente: "2026-07-10T14:30:00Z", ciudad: "Bogotá", pais: "Colombia",
            esAnonimo: true, usuarioId: null, tenantId: null, estadoInicial: "PENDIENTE",
            prioridadAlta: false, keywordsDetectadas: [], marcaSimulacro: { origen: "spec-937" },
        });
        expect(r.ok).toBe(true);

        const agregado = await prisma.identificadorReportado.findUniqueOrThrow({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado.ocultoPorComiteEn, "un simulacro no puede des-ocultar un identificador real").not.toBeNull();
        expect((await consulta(IDENT)).tieneReportes).toBe(false);
    });
});
