/**
 * SPEC-323 → SPEC-340 → SPEC-604 · la vinculación al 2º y 3er reporte.
 *
 * SPEC-604 (modelo EXPEDIENTE · cimientos) DEROGÓ la creación manual de
 * SPEC-340 (el botón): el expediente nace SOLO en el alta — el primer reporte
 * del padre sobre un identificador lo abre en la misma transacción y los
 * eventos siguientes se suman al existente. Estos tests afirman el modelo
 * nuevo Y la cadena (plana, SPEC-340 intacta):
 *
 * (1) 1er reporte → nace el expediente (ACTIVO, origen AUTOMATICO, 1 evento)
 *     y la respuesta lo trae.
 * (2) 2º reporte vinculado → entra a la cadena del 1º y se suma al MISMO
 *     expediente (sin duplicar nada).
 * (3) 3er reporte (cuyo previo es el #2, ya evento) → apunta al MISMO principal
 *     y el expediente queda con 3 eventos.
 * (4) previo inexistente → el dedup responde oferta y nada nuevo queda escrito.
 * (5) anónimo → NUNCA nace expediente (el modelo es solo del padre autenticado).
 * (La atomicidad de la tx la cubre route-atomicidad.test.ts de SPEC-137.)
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

// SPEC-591: el padre autenticado reporta siempre atado a una ficha activa.
let hijoIdDelTest: string | null = null;

function requestReporte(reportePrevioId?: string, conSesion = true): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(conSesion ? { cookie: `token=${mockToken}` } : {}),
        },
        body: JSON.stringify({
            identificador: IDENTIFICADOR,
            plataforma: "whatsapp",
            texto: TEXTO,
            fechaIncidente: "2026-07-20T10:00:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            ...(reportePrevioId ? { reportePrevioId } : {}),
            ...(conSesion && hijoIdDelTest ? { hijoId: hijoIdDelTest } : {}),
        }),
    });
}

/** Envía un reporte y devuelve su id; falla ruidosamente si no fue 201. */
async function reportar(reportePrevioId?: string, conSesion = true): Promise<{ id: string; expedienteId?: string }> {
    const res = await POST(requestReporte(reportePrevioId, conSesion));
    const body = (await res.json()) as { reporte?: { id: string }; expedienteId?: string; error?: unknown };
    expect(res.status, `el reporte debía crearse (respuesta: ${JSON.stringify(body)})`).toBe(201);
    return { id: body.reporte!.id, ...(body.expedienteId ? { expedienteId: body.expedienteId } : {}) };
}

describe("SPEC-604 · POST /api/reportes — la cadena nace con expediente (evento 1)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        // La cola pg-boss persiste entre tests (resetDatabase no la limpia).
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        hijoIdDelTest = null;
        vi.restoreAllMocks();

        const usuario = await crearUsuario("PARENT", `vinc-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(usuario.id, "PARENT");
        const hijo = await prisma.hijo.create({
            data: { usuarioId: usuario.id, nombre: "Valeria", apellidos: "Pérez", estado: "activo" },
        });
        hijoIdDelTest = hijo.id;
    });

    it("1er reporte: abre el expediente en la misma tx (ACTIVO · AUTOMATICO · 1 evento) y la respuesta lo trae", async () => {
        const r1 = await reportar();

        expect(r1.expedienteId, "la respuesta del padre trae el expediente abierto").toBeTruthy();
        const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id: r1.expedienteId! } });
        expect(expediente.estado).toBe("ACTIVO");
        expect(expediente.origenCreacion, "nace solo — el botón de SPEC-340 está derogado").toBe("AUTOMATICO");
        expect(expediente.numEventos).toBe(1);

        const eventos = await prisma.eventoExpediente.findMany({ where: { expedienteId: expediente.id } });
        expect(eventos).toHaveLength(1);
        expect(eventos[0].reporteId, "el evento 1 ES el primer reporte").toBe(r1.id);
        expect(await prisma.expediente.count(), "un solo expediente por (padre, identificador)").toBe(1);
    });

    it("2º reporte vinculado: entra a la CADENA del 1º y se suma al MISMO expediente", async () => {
        const r1 = await reportar();
        const r2 = await reportar(r1.id);

        expect(r2.expedienteId, "el 2º cae en el expediente que el 1º abrió").toBe(r1.expedienteId);
        expect(await prisma.expediente.count(), "no nace un segundo expediente").toBe(1);

        const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id: r1.expedienteId! } });
        expect(expediente.numEventos).toBe(2);
        const eventos = await prisma.eventoExpediente.findMany({
            where: { expedienteId: expediente.id },
            orderBy: { ordenSecuencial: "asc" },
        });
        expect(eventos.map((e) => e.reporteId)).toEqual([r1.id, r2.id]);

        const enBd = await prisma.reporte.findUniqueOrThrow({ where: { id: r2.id } });
        expect(enBd.reportePrincipalId, "el 2º apunta al 1º como principal (cadena SPEC-340 intacta)").toBe(r1.id);
        const principal = await prisma.reporte.findUniqueOrThrow({ where: { id: r1.id } });
        expect(principal.reportePrincipalId, "el principal no apunta a nadie").toBeNull();
    });

    it("3er reporte (previo = el #2, ya evento): MISMO principal y expediente con 3 eventos", async () => {
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
        expect(await prisma.expediente.count(), "sigue habiendo UN expediente").toBe(1);
        const expediente = await prisma.expediente.findFirstOrThrow();
        expect(expediente.numEventos, "los tres reportes son eventos del mismo expediente").toBe(3);
        expect(await prisma.reporte.count(), "los tres reportes se guardan igual").toBe(3);
    });

    it("previo inexistente: el dedup responde oferta (200) y NO escribe cadena ni evento nuevo", async () => {
        const r1 = await reportar();

        // El body trae un reportePrevioId que no existe: la vinculación no es
        // válida. El dedup del propio reporte reciente responde la oferta (200)
        // y NADA nuevo queda escrito — ni cadena colgando, ni evento de más.
        const res = await POST(requestReporte("id-inexistente-xyz"));
        expect(res.status).toBe(200);
        const body = (await res.json()) as { oferta?: boolean };
        expect(body.oferta).toBe(true);

        expect(await prisma.reporte.count(), "no se creó un segundo reporte").toBe(1);
        expect(
            await prisma.reporte.count({ where: { reportePrincipalId: { not: null } } }),
            "ninguna cadena quedó escrita"
        ).toBe(0);
        expect(await prisma.expediente.count(), "solo el expediente del primer reporte").toBe(1);
        const expediente = await prisma.expediente.findUniqueOrThrow({ where: { id: r1.expedienteId! } });
        expect(expediente.numEventos, "la oferta rechazada no sumó eventos").toBe(1);
    });

    it("anónimo: reporta como siempre y NUNCA nace expediente (el modelo no aplica)", async () => {
        const r1 = await reportar(undefined, false);

        expect(r1.expedienteId, "la respuesta del anónimo no trae expediente").toBeUndefined();
        expect(await prisma.expediente.count(), "el anónimo no cambia en nada").toBe(0);
        const reporte = await prisma.reporte.findUniqueOrThrow({ where: { id: r1.id } });
        expect(reporte.esAnonimo).toBe(true);
        expect(reporte.hijoId).toBeNull();
    });
});
