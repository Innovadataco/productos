/**
 * SPEC-137 (E-5): atomicidad de POST /api/reportes.
 * (1) rollback: un fallo en el upsert del identificador aborta la tx (ni reporte
 *     ni incremento del agregado; respuesta 500 controlada).
 * (2) carrera REAL de concurrencia (condición ZEUS): 2 requests simultáneas del
 *     MISMO usuario autenticado contra el MISMO identificador → exactamente 1 reporte en BD y
 *     1 respuesta 200-oferta (SPEC-323 candado 26: padre autenticado recibe oferta, no 429).
 * (3) camino feliz intacto: 201 + reporte + agregado incrementado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { IdentificadorReportadoRepository } from "@/lib/dal/repositories/identificador-reportado";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import type { Usuario } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

const IDENTIFICADOR = "+57300ATOM001";
const TEXTO = "Un adulto contacta a una menor por chat insistiendo en pedirle fotos personales varias veces.";

function requestReporte(identificador = IDENTIFICADOR, texto = TEXTO): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify({
            identificador,
            plataforma: "whatsapp",
            texto,
            fechaIncidente: "2026-07-20T10:00:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
        }),
    });
}

async function setupUsuario(): Promise<Usuario> {
    const usuario = await crearUsuario("PARENT", `atom-${Date.now()}@test.local`);
    mockToken = await crearTokenUsuario(usuario.id, "PARENT");
    return usuario;
}

describe("SPEC-137 · POST /api/reportes — atomicidad", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        // La cola pg-boss persiste entre tests (resetDatabase no la limpia):
        // sin esto, el backpressure acumulado de otros tests hace la corrida no determinista.
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        vi.restoreAllMocks();
    });

    it("camino feliz intacto: 201 + reporte en BD + agregado incrementado", async () => {
        const usuario = await setupUsuario();

        const res = await POST(requestReporte());
        expect(res.status).toBe(201);
        const body = (await res.json()) as { reporte: { id: string; estado: string } };
        expect(body.reporte.estado).toBe("PENDIENTE");

        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.usuarioId).toBe(usuario.id);

        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: normalizarIdentificador(IDENTIFICADOR), plataformaId: plataforma.id } }, // SPEC-325: el agregado se keyea normalizado
        });
        expect(agregado?.totalReportes).toBe(1);
        expect(agregado?.reportesAutenticados).toBe(1);
    });

    it("rollback: fallo en el upsert del identificador → ni reporte ni agregado en BD (500 controlada)", async () => {
        await setupUsuario();
        const spy = vi
            .spyOn(IdentificadorReportadoRepository.prototype, "upsertIncrementoReporte")
            .mockRejectedValueOnce(new Error("fallo inyectado en el upsert"));

        const res = await POST(requestReporte());
        expect(res.status, "fallo dentro de la tx → 500 controlada").toBe(500);
        expect(spy).toHaveBeenCalledTimes(1);

        // §atomicidad: la tx abortó — ni el reporte ni el incremento del agregado quedan
        expect(await prisma.reporte.count(), "el reporte no debe quedar persistido tras el rollback").toBe(0);
        expect(await prisma.identificadorReportado.count(), "el agregado no debe quedar persistido tras el rollback").toBe(0);
    });

    // SPEC-323 (candado 26): padre autenticado recibe oferta, no 429.
    it("carrera real: 2 requests simultáneas mismo usuario+identificador → 1 reporte y 1 × 200-oferta", async () => {
        await setupUsuario();

        const [res1, res2] = await Promise.all([POST(requestReporte()), POST(requestReporte())]);
        const statuses = [res1.status, res2.status].sort();

        expect(statuses, "una crea (201) y la otra recibe oferta de vinculación (200)").toEqual([200, 201]);

        const ofertaRes = res1.status === 200 ? res1 : res2;
        const cuerpo = (await ofertaRes.json()) as { oferta: boolean; reporteExistenteId: string };
        expect(cuerpo.oferta, "la respuesta duplicada debe ser una oferta de vinculación").toBe(true);
        expect(cuerpo.reporteExistenteId, "debe referenciar el reporte que ganó la carrera").toBeTruthy();

        expect(await prisma.reporte.count(), "exactamente UN reporte en BD tras la carrera").toBe(1);
    });
});
