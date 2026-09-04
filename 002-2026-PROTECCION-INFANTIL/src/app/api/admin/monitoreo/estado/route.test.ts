import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SENALES_MONITOREO } from "@/lib/monitoreo/probes";

const URL = "http://localhost:5005/api/admin/monitoreo/estado";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

describe("GET /api/admin/monitoreo/estado (SPEC-171)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("403 con rol insuficiente", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("devuelve TODAS las señales del contrato en verde (tailscale no-aplica sin URL) y metadatos del tablero", async () => {
        await autenticarAdmin();

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        // El tablero devuelve EXACTAMENTE las señales del contrato. Se afirma
        // contra la fuente (`SENALES_MONITOREO`) y no un literal, para que
        // agregar la señal 17 no vuelva a partir este test — lo que importa es
        // que la respuesta cubra el contrato, no un número escrito a mano.
        expect(Object.keys(body.senales).sort()).toEqual([...SENALES_MONITOREO].sort());
        // Y que la señal del worker de citas (SPEC-427 · I-301) esté en el contrato.
        expect(SENALES_MONITOREO).toContain("citas");
        expect(body.senales.app).toEqual({ estado: "verde", ultimoProbeEn: null, detalle: null });
        expect(body.senales.ollama_ping.estado).toBe("verde");
        expect(body.senales.tailscale.estado).toBe("no-aplica");
        expect(body.autorefreshSeg).toBe(30);
        expect(body.monitoreoEnabled).toBe(true);
    });

    it("marca en rojo la señal con IncidenteInfra ABIERTO y el resto en verde", async () => {
        await autenticarAdmin();
        await prisma.incidenteInfra.create({ data: { senal: "ollama_ping", estado: "ABIERTO", detalle: "timeout" } });
        await prisma.incidenteInfra.create({
            data: { senal: "bd", estado: "RESUELTO", fin: new Date(), detalle: "viejo" },
        });

        const res = await GET(new Request(URL));
        const body = await res.json();

        expect(body.senales.ollama_ping.estado).toBe("rojo");
        expect(body.senales.bd.estado).toBe("verde"); // el incidente RESUELTO no mancha
        expect(body.senales.app.estado).toBe("verde");
    });

    it("tailscale con URL configurada reporta verde en vez de no-aplica", async () => {
        await autenticarAdmin();
        await prisma.parametroSistema.create({
            data: { clave: "monitoreo.tailscale.url", valor: "http://100.x.y.z:11434", tipo: "STRING", categoria: "SYSTEM", esPublico: false },
        });

        const res = await GET(new Request(URL));
        const body = await res.json();
        expect(body.senales.tailscale.estado).toBe("verde");
    });

    it("ultimoProbeEn y detalle salen del HealthProbe más reciente de la señal", async () => {
        await autenticarAdmin();
        const viejo = new Date(Date.now() - 10 * 60 * 1000);
        const reciente = new Date(Date.now() - 60 * 1000);
        await prisma.healthProbe.create({ data: { senal: "app", ok: false, latenciaMs: 9, detalle: "viejo", creadoEn: viejo } });
        await prisma.healthProbe.create({ data: { senal: "app", ok: true, latenciaMs: 5, detalle: null, creadoEn: reciente } });

        const res = await GET(new Request(URL));
        const body = await res.json();

        expect(body.senales.app.ultimoProbeEn).toBe(reciente.toISOString());
        expect(body.senales.app.detalle).toBeNull();
    });

    it("refleja monitoreo.enabled=false y el autorefresh configurado", async () => {
        await autenticarAdmin();
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "monitoreo.enabled", valor: "false", tipo: "BOOLEAN", categoria: "SYSTEM", esPublico: false },
                { clave: "monitoreo.autorefresh_seg", valor: "15", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
            ],
        });

        const res = await GET(new Request(URL));
        const body = await res.json();

        expect(body.monitoreoEnabled).toBe(false);
        expect(body.autorefreshSeg).toBe(15);
    });
});
