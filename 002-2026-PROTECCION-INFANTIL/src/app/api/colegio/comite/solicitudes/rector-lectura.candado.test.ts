/**
 * CANDADO · SPEC-935 (I-448) — el rector LEE los casos del comité de SU colegio; escribir sigue siendo del comité.
 *
 * VEREDICTO CEO: el menú y `comite/casos` ya admitían al rector; solo la API de lista + detalle había quedado en
 * `COMITE_CONVIVENCIA` → pantalla con error. Por las rutas REALES y la BD:
 *   - rector lee los suyos (lista + detalle) → 200; la lista NO trae casos de otro colegio;
 *   - rector de OTRO colegio → detalle 404 (no 403: no confirma que el caso existe);
 *   - rector ESCRIBE (nota, análisis, recomendar informe, cierre/firma) → 403;
 *   - un rol ajeno (PARENT) → 403 en lectura.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearUsuario } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";
import { GET as LISTA } from "./route";
import { GET as DETALLE } from "./[id]/route";
import { POST as NOTA } from "./[id]/notas/route";
import { PUT as ANALISIS } from "./[id]/analisis/route";
import { POST as RECOMENDAR } from "./[id]/recomendar-informe/route";
import { POST as RESOLVER } from "./[id]/resolver/route";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

const BASE = "http://localhost:5005/api/colegio/comite/solicitudes";
const req = (url: string, method = "GET", body?: unknown) =>
    new Request(url, {
        method,
        headers: { cookie: `token=${mockToken}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

async function colegioConCaso(numero: string) {
    const { admin, colegio } = await crearColegioConAdmin();
    await crearComiteCuenta(colegio.id);
    const { alerta, reporte } = await crearAlertaEstudiante(colegio.id);
    const solicitud = await prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero,
            estado: "PENDIENTE",
            colegioId: colegio.id,
            alertaColegioId: alerta.id,
            creadoPorId: admin.id,
            motivo: "Caso de prueba",
        },
    });
    return { admin, solicitud };
}

describe("SPEC-935 · el rector lee los casos del comité; no escribe", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
    });

    it("rector lee los SUYOS: lista (sin casos ajenos) + detalle → 200", async () => {
        const propio = await colegioConCaso("SOL-PROPIO");
        await colegioConCaso("SOL-AJENO");
        mockToken = await crearTokenUsuario(propio.admin.id, "SCHOOL_ADMIN");

        const lista = await LISTA(req(BASE));
        expect(lista.status).toBe(200);
        expect((await lista.json()).items.map((i: { numero: string }) => i.numero)).toEqual(["SOL-PROPIO"]);

        const det = await DETALLE(req(`${BASE}/${propio.solicitud.id}`), { params: Promise.resolve({ id: propio.solicitud.id }) });
        expect(det.status).toBe(200);
        expect((await det.json()).solicitud.id).toBe(propio.solicitud.id);
    });

    it("rector de OTRO colegio → detalle 404", async () => {
        const ajeno = await colegioConCaso("SOL-AJENO");
        const { admin: otroRector } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(otroRector.id, "SCHOOL_ADMIN");
        const det = await DETALLE(req(`${BASE}/${ajeno.solicitud.id}`), { params: Promise.resolve({ id: ajeno.solicitud.id }) });
        expect(det.status).toBe(404);
    });

    it("rector ESCRIBE → 403 (nota, análisis, recomendar informe, cierre) y nada cambia", async () => {
        const { admin, solicitud } = await colegioConCaso("SOL-PROPIO");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const params = { params: Promise.resolve({ id: solicitud.id }) };
        const u = `${BASE}/${solicitud.id}`;

        expect((await NOTA(req(`${u}/notas`, "POST", { texto: "nota del rector" }), params)).status).toBe(403);
        expect((await ANALISIS(req(`${u}/analisis`, "PUT", { analisis: "análisis del rector" }), params)).status).toBe(403);
        expect((await RECOMENDAR(req(`${u}/recomendar-informe`, "POST", {}), params)).status).toBe(403);
        expect((await RESOLVER(req(`${u}/resolver`, "POST", { decision: "APROBAR", observacion: "x" }), params)).status).toBe(403);

        const despues = await prisma.solicitudComite.findUniqueOrThrow({ where: { id: solicitud.id } });
        expect(despues.estado).toBe("PENDIENTE");
    });

    it("rol ajeno (PARENT) → 403 en lectura", async () => {
        await colegioConCaso("SOL-PROPIO");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expect((await LISTA(req(BASE))).status).toBe(403);
    });
});
