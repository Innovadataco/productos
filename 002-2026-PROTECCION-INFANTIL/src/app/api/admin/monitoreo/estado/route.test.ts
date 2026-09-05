import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { SENALES_MONITOREO } from "@/lib/monitoreo/probes";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

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

    it("devuelve TODAS las señales declaradas en verde (tailscale no-aplica sin URL)", async () => {
        await autenticarAdmin();

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        // SPEC-449: se afirma contra `SENALES_MONITOREO` DERIVADO, no contra una
        // lista literal. La literal se desincronizaba cada vez que un worker
        // nuevo sumaba su señal —pasó con SPEC-427 y volvió a pasar acá—, y el
        // rojo salía en el shard 3 de CI a los 21 minutos en vez de en local.
        // Derivarlo conserva lo que este test debe vigilar (que el tablero
        // devuelva TODAS las señales) sin romperse porque se agregó una bien.
        expect(Object.keys(body.senales).sort()).toEqual([...SENALES_MONITOREO].sort());
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
