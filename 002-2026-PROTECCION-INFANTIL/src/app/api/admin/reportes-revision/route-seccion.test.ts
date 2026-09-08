import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";
import type { EstadoReporte } from "@prisma/client";

// SPEC-595: separación de la bandeja en pendientes (accionables) y procesados
// (solo visualización). La asignación de estados la hace la ruta server-side.

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

let contador = 0;

async function crearReporteEnEstado(estado: EstadoReporte) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    contador += 1;
    return crearReporteFixture(prisma, {
        data: {
            identificador: `+57300SEC${String(contador).padStart(3, "0")}`,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para la sección de la bandeja.",
            textoOriginal: encryptParameter("Texto original de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado,
            numeroSeguimiento: `RPT-SEC${String(contador).padStart(4, "0")}`,
        },
    });
}

async function clasificar(reporteId: string, adminId: string, conCorreccion: boolean) {
    const clasificacion = await prisma.clasificacionIA.create({
        data: {
            reporteId,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.8,
            modeloUsado: "test-modelo",
            latenciaMs: 100,
        },
    });
    if (conCorreccion) {
        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: clasificacion.id,
                categoriaOriginal: "CONTACTO_INSISTENTE",
                categoriaCorregida: "CONTACTO_INSISTENTE",
                adminId,
                confirmada: true,
            },
        });
    }
    return clasificacion;
}

async function getBandeja(query = "") {
    const req = new Request(`http://localhost:5005/api/admin/reportes-revision${query}`, {
        method: "GET",
        headers: { cookie: `token=${activeToken}` },
    });
    return GET(req);
}

describe("GET /api/admin/reportes-revision · SPEC-595 secciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
    });

    it("sin seccion lista SOLO pendientes y devuelve los contadores por sección", async () => {
        const manual = await crearReporteEnEstado("REVISION_MANUAL");
        const requiereAnon = await crearReporteEnEstado("REQUIERE_ANONIMIZACION");
        const corregido = await crearReporteEnEstado("CORREGIDO");
        const spam = await crearReporteEnEstado("POSIBLE_SPAM");

        const res = await getBandeja("?pageSize=50");
        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = body.reportes.map((r: { id: string }) => r.id);
        expect(ids).toContain(manual.id);
        expect(ids).toContain(requiereAnon.id);
        expect(ids).not.toContain(corregido.id);
        expect(ids).not.toContain(spam.id);
        expect(body.secciones).toEqual({ pendientes: 2, procesados: 2 });
    });

    it("CLASIFICADO sin corrección es pendiente; con corrección humana es procesado", async () => {
        const admin = await prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN" } });
        const sinRevision = await crearReporteEnEstado("CLASIFICADO");
        const confirmado = await crearReporteEnEstado("CLASIFICADO");
        await clasificar(sinRevision.id, admin.id, false);
        await clasificar(confirmado.id, admin.id, true);

        const resPendientes = await getBandeja("?pageSize=50");
        const bodyPendientes = await resPendientes.json();
        const idsPendientes = bodyPendientes.reportes.map((r: { id: string }) => r.id);
        expect(idsPendientes).toContain(sinRevision.id);
        expect(idsPendientes).not.toContain(confirmado.id);

        const resProcesados = await getBandeja("?seccion=procesados&pageSize=50");
        expect(resProcesados.status).toBe(200);
        const bodyProcesados = await resProcesados.json();
        const idsProcesados = bodyProcesados.reportes.map((r: { id: string }) => r.id);
        expect(idsProcesados).toContain(confirmado.id);
        expect(idsProcesados).not.toContain(sinRevision.id);
        expect(bodyProcesados.secciones).toEqual({ pendientes: 1, procesados: 1 });
    });

    it("procesados incluye POSIBLE_SPAM y DUPLICADO; pendientes los excluye", async () => {
        const posibleSpam = await crearReporteEnEstado("POSIBLE_SPAM");
        const duplicado = await crearReporteEnEstado("DUPLICADO");
        const pendiente = await crearReporteEnEstado("PENDIENTE");

        const res = await getBandeja("?seccion=procesados&pageSize=50");
        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = body.reportes.map((r: { id: string }) => r.id);
        expect(ids).toContain(posibleSpam.id);
        expect(ids).toContain(duplicado.id);
        expect(ids).not.toContain(pendiente.id);
    });

    it("el filtro de estado coexiste con la sección", async () => {
        const corregidoA = await crearReporteEnEstado("CORREGIDO");
        await crearReporteEnEstado("CORREGIDO");
        await crearReporteEnEstado("POSIBLE_SPAM");
        const manual = await crearReporteEnEstado("REVISION_MANUAL");

        const res = await getBandeja("?seccion=procesados&estado=CORREGIDO&pageSize=50");
        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = body.reportes.map((r: { id: string }) => r.id);
        expect(ids).toContain(corregidoA.id);
        expect(ids).toHaveLength(2);
        expect(ids).not.toContain(manual.id);
    });

    it("rechaza una sección inválida", async () => {
        const res = await getBandeja("?seccion=todas");
        expect(res.status).toBe(400);
    });
});
