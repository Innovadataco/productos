import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST as POSTTomar } from "../tomar/route";
import { POST as POSTResolver } from "./route";
import { POST as POSTReporte } from "@/app/api/reportes/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { crearApelacionConDocumento, crearReporteParaIdentificador } from "@/lib/apelacion-test-utils";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import * as auth from "@/lib/auth";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-resolver-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

vi.mock("@/lib/queue", () => ({
    sendReporte: vi.fn().mockResolvedValue({ encolado: true }),
}));

const IDENT = "+573009770001";

function reqResolver(id: string, body: unknown): Request {
    return new Request(`http://localhost:5005/api/admin/comite/apelaciones/${id}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function reqReporteAnonimo(identificador: string): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            identificador,
            plataforma: "whatsapp",
            texto: "Contacto insistente hacia un menor durante varias semanas seguidas.",
            fechaIncidente: "2026-07-10T14:30:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
        }),
    });
}

describe("POST /api/admin/comite/apelaciones/[id]/tomar y /resolver", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true });
        await prisma.$disconnect();
    });

    async function plataformaId(): Promise<string> {
        const p = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        return p!.id;
    }

    async function crearIdentificadorVisible() {
        const pid = await plataformaId();
        await prisma.identificadorReportado.create({
            data: {
                identificador: IDENT,
                plataformaId: pid,
                totalReportes: 5,
                reportesAutenticados: 5,
                esVisiblePublicamente: true,
            },
        });
        return pid;
    }

    async function setupCasoEnRevision() {
        const apelante = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const pid = await plataformaId();
        const { apelacion } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "EN_REVISION",
            comiteId: comite.id,
        });
        return { apelante, comite, pid, apelacion };
    }

    it("tomar: RECIBIDA → EN_REVISION asignado a sí; 409 si ya tomada", async () => {
        const apelante = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const otroComite = await crearUsuario("COMITE_VALIDACION");
        const pid = await plataformaId();
        const { apelacion } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "RECIBIDA",
        });

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res1 = await POSTTomar(
            new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/tomar`, { method: "POST" }),
            { params: Promise.resolve({ id: apelacion.id }) }
        );
        expect(res1.status).toBe(200);
        const actualizada = await prisma.apelacion.findUnique({ where: { id: apelacion.id } });
        expect(actualizada?.estado).toBe("EN_REVISION");
        expect(actualizada?.comiteId).toBe(comite.id);
        expect(actualizada?.asignadoEn).not.toBeNull();

        // Otro miembro no puede tomarla (409).
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(otroComite);
        const res2 = await POSTTomar(
            new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/tomar`, { method: "POST" }),
            { params: Promise.resolve({ id: apelacion.id }) }
        );
        expect(res2.status).toBe(409);
    });

    it("resolver ACEPTADA con quitarVisibilidad deja el identificador NO visible (efecto real)", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        await crearIdentificadorVisible();

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "ACEPTADA",
            motivacion: "Acredita titularidad; los reportes son de un tercero.",
            quitarVisibilidad: true,
        }), { params: Promise.resolve({ id: apelacion.id }) });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.apelacion.estado).toBe("ACEPTADA");
        expect(body.apelacion.quitoVisibilidad).toBe(true);

        const pid = await plataformaId();
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado?.ocultoPorComiteEn).not.toBeNull();
        expect(agregado?.esVisiblePublicamente).toBe(false);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_RESUELTA", recursoId: apelacion.id } });
        expect(audit).not.toBeNull();
    });

    it("un reporte NUEVO posterior levanta el ocultamiento (sin lista blanca permanente)", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        const pid = await crearIdentificadorVisible();

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        await POSTResolver(reqResolver(apelacion.id, {
            decision: "ACEPTADA",
            motivacion: "Acredita titularidad.",
            quitarVisibilidad: true,
        }), { params: Promise.resolve({ id: apelacion.id }) });

        let agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado?.esVisiblePublicamente).toBe(false);

        // Reporte nuevo anónimo sobre el mismo identificador: el upsert levanta la marca.
        const resReporte = await POSTReporte(reqReporteAnonimo(IDENT));
        expect(resReporte.status).toBe(201);

        agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado?.ocultoPorComiteEn).toBeNull();

        // El flag lo recalcula la dueña (como hace el worker tras procesar): con la
        // marca levantada y el umbral/ratio cumplidos, vuelve a ser visible (reglas normales).
        await actualizarVisibilidadPublica(IDENT, pid);
        agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado?.esVisiblePublicamente).toBe(true);
    });

    it("resolver ACEPTADA con reportesABajar da de baja el reporte por REPORTE_FALSO", async () => {
        const { comite, apelacion, pid } = await setupCasoEnRevision();
        const reporte = await crearReporteParaIdentificador({ identificador: IDENT, plataformaId: pid });

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "ACEPTADA",
            motivacion: "El reporte es falso.",
            reportesABajar: [reporte.id],
        }), { params: Promise.resolve({ id: apelacion.id }) });

        expect(res.status).toBe(200);
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.eliminado).toBe(true);
        expect(actualizado?.motivoBaja).toBe("REPORTE_FALSO");
        const apel = await prisma.apelacion.findUnique({ where: { id: apelacion.id } });
        expect(apel?.estado).toBe("ACEPTADA");
    });

    it("resolver RECHAZADA no cambia visibilidad ni reportes", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        await crearIdentificadorVisible();

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "RECHAZADA",
            motivacion: "No acredita titularidad suficiente.",
        }), { params: Promise.resolve({ id: apelacion.id }) });

        expect(res.status).toBe(200);
        const pid = await plataformaId();
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } },
        });
        expect(agregado?.esVisiblePublicamente).toBe(true);
        expect(agregado?.ocultoPorComiteEn).toBeNull();
    });

    it("rechaza resolver sin motivación (400)", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "RECHAZADA",
            motivacion: "",
        }), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(400);
    });

    it("rechaza ACEPTADA sin efecto (400)", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "ACEPTADA",
            motivacion: "Acepto pero sin efecto.",
        }), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(400);
    });

    it("rechaza baja de un reporte de otro identificador (400)", async () => {
        const { comite, apelacion } = await setupCasoEnRevision();
        const pid = await plataformaId();
        const ajeno = await crearReporteParaIdentificador({ identificador: "+573009770999", plataformaId: pid });

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "ACEPTADA",
            motivacion: "Intento de baja de reporte ajeno.",
            reportesABajar: [ajeno.id],
        }), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(400);

        const sigue = await prisma.reporte.findUnique({ where: { id: ajeno.id } });
        expect(sigue?.eliminado).toBe(false);
    });

    it("rechaza resolver un caso no tomado (409)", async () => {
        const apelante = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const pid = await plataformaId();
        const { apelacion } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "RECIBIDA",
        });

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "RECHAZADA",
            motivacion: "Sin tomar.",
        }), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(409);
    });

    it("rechaza resolver por un miembro del comité no asignado (403)", async () => {
        const { apelacion } = await setupCasoEnRevision();
        const otroComite = await crearUsuario("COMITE_VALIDACION");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(otroComite);
        const res = await POSTResolver(reqResolver(apelacion.id, {
            decision: "RECHAZADA",
            motivacion: "No soy el asignado.",
        }), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(403);
    });
});
