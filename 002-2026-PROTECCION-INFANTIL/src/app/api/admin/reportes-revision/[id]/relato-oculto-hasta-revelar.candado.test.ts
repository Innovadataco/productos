/**
 * SPEC-734 · CANDADO — el relato del reporte NO se ve sin revelar, y revelar deja fila.
 *
 * Refina (no revierte) el invariante de SPEC-701: «relato en el payload ⇒ fila de
 * auditoría» (nunca texto sin fila). Antes, abrir el detalle descifraba y mandaba el
 * «texto» de trabajo por DEFAULT (y escribía fila en CADA apertura); ahora el relato
 * viaja SOLO con `?revelar=true`, y ese descifrado —por la frontera auditada— deja
 * LecturaReporte. Sin revelar: ni relato en el payload, ni fila.
 *
 * Control positivo (texto sembrado): el relato aparece SOLO tras revelar; la fila se
 * escribe CON el revelar y NO con la carga normal. Si el reveal mandara el texto sin
 * dejar fila, la aserción «revelar ⇒ exactamente una fila» cae en rojo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";

let activeToken: string | null = null;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && activeToken ? { name: "token", value: activeToken } : undefined),
        set: vi.fn(),
    }),
}));

const RELATO = "Mi hija [NOMBRE] estudia en [COLEGIO] y su teléfono es [TELEFONO].";
const FRAGMENTO_INVARIANTE = "[COLEGIO]"; // literal del relato sembrado (no interpolado)

async function sembrarReporte() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: "+57300TEST734",
            plataformaId: plataforma!.id,
            texto: RELATO,
            textoOriginal: encryptParameter("Mi hija María, tel 3001234567."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REQUIERE_ANONIMIZACION",
            numeroSeguimiento: `RPT-734-${Date.now()}`,
        },
    });
    const row = await prisma.reporte.findUniqueOrThrow({ where: { id: reporte.id }, select: { contenidoId: true } });
    return { id: reporte.id, contenidoId: row.contenidoId };
}

function req(id: string, revelar: boolean) {
    const url = `http://localhost:5005/api/admin/reportes-revision/${id}${revelar ? "?revelar=true" : ""}`;
    return new Request(url, { method: "GET", headers: { cookie: `token=${activeToken}` } });
}

async function filasTexto(contenidoId: string) {
    return prisma.lecturaReporte.findMany({ where: { contenidoId, campo: "texto" } });
}

describe("SPEC-734 · el relato no se ve sin revelar (y revelar deja fila)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
    });

    it("SIN revelar: el payload NO trae el relato y NO deja fila de auditoría", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await sembrarReporte();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(req(reporte.id, false), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.reporte.texto ?? null).toBeNull();
        expect(body.reporte.textoOriginal).toBeUndefined();
        // Defensa en profundidad: el relato no viaja escondido en ningún otro campo.
        expect(JSON.stringify(body)).not.toContain(FRAGMENTO_INVARIANTE);
        // Abrir el caso sin revelar NO escribe fila (no se vio el texto).
        expect(await filasTexto(reporte.contenidoId)).toHaveLength(0);
    });

    it("CON ?revelar=true: el payload trae el relato Y deja UNA fila a nombre del admin", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await sembrarReporte();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(req(reporte.id, true), { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.reporte.texto).toBe(RELATO);
        const filas = await filasTexto(reporte.contenidoId);
        expect(filas, "relato en el payload ⇒ exactamente una fila (nunca texto sin fila)").toHaveLength(1);
        expect(filas[0]!.usuarioId).toBe(admin.id);
    });

    it("una apertura sin revelar seguida de un revelar: la ÚNICA fila es la del revelar", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await sembrarReporte();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        await GET(req(reporte.id, false), { params: Promise.resolve({ id: reporte.id }) }); // no deja fila
        await GET(req(reporte.id, true), { params: Promise.resolve({ id: reporte.id }) }); // deja fila

        expect(await filasTexto(reporte.contenidoId)).toHaveLength(1);
    });
});
