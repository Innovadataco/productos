/**
 * SPEC-323 → SPEC-340 (A-68) · la vinculación al 2º y 3er reporte.
 *
 * SPEC-340 DEROGÓ el expediente automático (decisión de Jelkin: el expediente
 * lo crea el padre con el botón). La vinculación ahora se materializa en la
 * CADENA (`Reporte.reportePrincipalId`). Estos tests afirmaban el expediente
 * automático; ahora afirman lo contrario Y la cadena:
 *
 * (1) 2º reporte vinculado → entra a la cadena del 1º; NO nace expediente.
 * (2) 3er reporte (cuyo previo es el #2, ya evento) → apunta al MISMO principal
 *     (la cadena es plana), sin duplicar nada.
 * (3) previo inexistente → el dedup responde oferta y nada queda escrito.
 *     (La atomicidad de la tx la cubre route-atomicidad.test.ts de SPEC-137;
 *     la escritura de la cadena vive dentro del mismo withUnitOfWork.)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

const IDENTIFICADOR = "+57300VINC001";
const TEXTO = "Un adulto contacta a una menor por chat insistiendo en pedirle fotos personales varias veces.";

function requestReporte(reportePrevioId?: string): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify({
            identificador: IDENTIFICADOR,
            plataforma: "whatsapp",
            texto: TEXTO,
            fechaIncidente: "2026-07-20T10:00:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            ...(reportePrevioId ? { reportePrevioId } : {}),
        }),
    });
}

/** Envía un reporte y devuelve su id; falla ruidosamente si no fue 201. */
async function reportar(reportePrevioId?: string): Promise<{ id: string; expedienteId?: string }> {
    const res = await POST(requestReporte(reportePrevioId));
    const body = (await res.json()) as { reporte?: { id: string }; expedienteId?: string; error?: unknown };
    expect(res.status, `el reporte debía crearse (respuesta: ${JSON.stringify(body)})`).toBe(201);
    return { id: body.reporte!.id, ...(body.expedienteId ? { expedienteId: body.expedienteId } : {}) };
}

describe("SPEC-340 · POST /api/reportes — la vinculación arma CADENA, no expediente", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        // La cola pg-boss persiste entre tests (resetDatabase no la limpia).
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        vi.restoreAllMocks();

        const usuario = await crearUsuario("PARENT", `vinc-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(usuario.id, "PARENT");
    });

    it("2º reporte vinculado: entra a la CADENA del 1º y NO nace ningún expediente (SPEC-340)", async () => {
        const r1 = await reportar();
        const r2 = await reportar(r1.id);

        expect(r2.expedienteId, "la respuesta ya no trae expedienteId").toBeUndefined();
        expect(await prisma.expediente.count(), "el expediente lo crea el padre con el botón, no el alta").toBe(0);

        const enBd = await prisma.reporte.findUniqueOrThrow({ where: { id: r2.id } });
        expect(enBd.reportePrincipalId, "el 2º apunta al 1º como principal").toBe(r1.id);
        const principal = await prisma.reporte.findUniqueOrThrow({ where: { id: r1.id } });
        expect(principal.reportePrincipalId, "el principal no apunta a nadie").toBeNull();
    });

    it("3er reporte (previo = el #2, ya evento): apunta al MISMO principal — cadena plana", async () => {
        const r1 = await reportar();
        const r2 = await reportar(r1.id);
        // La oferta del 3er reporte referencia el #2 (el más reciente), que ya
        // es evento de la cadena: debe resolverse al principal r1, no anidarse.
        const r3 = await reportar(r2.id);

        const tres = await prisma.reporte.findUniqueOrThrow({ where: { id: r3.id } });
        expect(tres.reportePrincipalId, "el 3º se resuelve al principal, no al #2").toBe(r1.id);

        const cadena = await prisma.reporte.findMany({
            where: { reportePrincipalId: r1.id },
            select: { id: true },
        });
        expect(cadena.map((r) => r.id).sort(), "la cadena del principal tiene exactamente 2 eventos").toEqual(
            [r2.id, r3.id].sort()
        );
        expect(await prisma.expediente.count(), "sigue sin nacer expediente alguno").toBe(0);
        expect(await prisma.reporte.count(), "los tres reportes se guardan igual").toBe(3);
    });

    it("previo inexistente: el dedup responde oferta (200) y NO escribe cadena ni expediente", async () => {
        await reportar();

        // El body trae un reportePrevioId que no existe: la vinculación no es
        // válida. El dedup del propio reporte reciente responde la oferta (200)
        // y NADA queda escrito — ni cadena colgando, ni expediente.
        const res = await POST(requestReporte("id-inexistente-xyz"));
        expect(res.status).toBe(200);
        const body = (await res.json()) as { oferta?: boolean };
        expect(body.oferta).toBe(true);

        expect(await prisma.reporte.count(), "no se creó un segundo reporte").toBe(1);
        expect(
            await prisma.reporte.count({ where: { reportePrincipalId: { not: null } } }),
            "ninguna cadena quedó escrita"
        ).toBe(0);
        expect(await prisma.expediente.count()).toBe(0);
    });
});
