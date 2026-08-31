/**
 * SPEC-323 (T011/US2) · el expediente al 2º y 3er reporte vinculado.
 *
 * Hueco de cobertura que dejó pasar el bug: no existía ninguna prueba que
 * ejerciera una vinculación ACEPTADA (`reportePrevioId` en el body). `route.test.ts`
 * solo cubre la RESPUESTA de oferta (200), nunca lo que pasa después.
 *
 * (1) 2º reporte vinculado → nace el expediente con exactamente 2 eventos.
 * (2) 3er reporte vinculado → 3 eventos, NO 4. `findDuplicadoReciente` devuelve
 *     el reporte MÁS RECIENTE, así que al 3er reporte el `reportePrevioId` es el
 *     reporte #2, que ya entró como evento en la vinculación anterior. Sin guard
 *     de idempotencia se inserta dos veces y `numEventos` queda inflado.
 * (3) atomicidad: si falla el alta de un evento, no queda ni el reporte ni el
 *     expediente a medias (el bloque corre DENTRO de `withUnitOfWork`).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";

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

async function eventosDe(expedienteId: string) {
    return prisma.eventoExpediente.findMany({
        where: { expedienteId },
        orderBy: { ordenSecuencial: "asc" },
        select: { id: true, reporteId: true, ordenSecuencial: true },
    });
}

describe("SPEC-323 · POST /api/reportes — expediente por vinculación", { timeout: 30_000 }, () => {
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

    it("2º reporte vinculado: nace el expediente con los DOS reportes como eventos", async () => {
        const r1 = await reportar();
        const r2 = await reportar(r1.id);

        expect(r2.expedienteId, "el 201 del reporte vinculado debe devolver el expediente creado").toBeTruthy();

        const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id: r2.expedienteId! } });
        expect(expediente.identificadorReportado).toBe(IDENTIFICADOR);

        const eventos = await eventosDe(expediente.id);
        expect(eventos.map((e) => e.reporteId), "un evento por reporte, en orden").toEqual([r1.id, r2.id]);
        expect(expediente.numEventos, "`numEventos` debe coincidir con los eventos reales").toBe(2);
    });

    it("3er reporte vinculado: 3 eventos y numEventos=3 — el reporte previo NO se duplica", async () => {
        const r1 = await reportar();
        const r2 = await reportar(r1.id);
        // La oferta del 3er reporte referencia el reporte #2 (el más reciente),
        // que YA es un evento del expediente.
        const r3 = await reportar(r2.id);

        expect(r3.expedienteId, "el 3er reporte reutiliza el expediente activo").toBe(r2.expedienteId);

        const eventos = await eventosDe(r3.expedienteId!);
        expect(eventos.map((e) => e.reporteId), "exactamente un evento por reporte, sin repetir el #2").toEqual([
            r1.id,
            r2.id,
            r3.id,
        ]);
        expect(new Set(eventos.map((e) => e.reporteId)).size, "ningún reporte puede aparecer dos veces").toBe(3);

        const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id: r3.expedienteId! } });
        expect(expediente.numEventos, "`numEventos` inflado = contador del padre miente").toBe(3);
        expect(await prisma.reporte.count(), "los tres reportes se guardan igual").toBe(3);
    });

    it("atomicidad: si falla el alta de un evento, no queda ni el reporte ni el expediente a medias", async () => {
        const r1 = await reportar();

        vi.spyOn(ExpedienteRepository.prototype, "agregarEvento").mockRejectedValueOnce(
            new Error("fallo inyectado al agregar el evento retroactivo")
        );

        const res = await POST(requestReporte(r1.id));
        expect(res.status, "el fallo dentro de la tx → 500 controlada").toBe(500);

        expect(await prisma.reporte.count(), "el reporte vinculado no debe quedar persistido").toBe(1);
        expect(await prisma.expediente.count(), "el expediente no debe quedar creado sin sus eventos").toBe(0);
        expect(await prisma.eventoExpediente.count()).toBe(0);
    });
});
