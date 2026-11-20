/**
 * SPEC-955 · CANDADO del correo FUSIONADO del colegio (bienvenida + recibo).
 * FORMA-ONBOARDING-COLEGIO-CORREOS §A (Gestión 399ddc0a).
 *
 * El correo de «cuenta lista» se enviaba al CREAR la contraseña (completar),
 * ANTES de aceptar la Política. Ahora:
 *  - NO sale en completar (M2 eliminado).
 *  - En el envío M3 (aceptar) se BIFURCA por rol del aceptante, solo en la 1.ª
 *    aceptación:
 *      · SCHOOL_ADMIN 1.ª aceptación → UN `colegio.bienvenida_rector` fusionado, y
 *        NO el `consentimiento.aceptado` genérico (sin duplicado).
 *      · otros roles (o un colegio re-aceptando por bump) → `consentimiento.aceptado`.
 *  - re-aceptación de la misma versión → idempotente, no reenvía.
 *
 * Control positivo (muere con el defecto): quitar/mover el bifurcado de aceptar
 * pone rojos los casos del fusionado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearParametrosConsentimiento, crearEventoConsentimiento } from "@/lib/consentimiento-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken ? { name, value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function requestAceptar(token: string | undefined, body: Record<string, unknown>) {
    return new Request("http://localhost:5005/api/consentimiento/aceptar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { cookie: `token=${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
}

const EVENTO_FUSIONADO = "colegio.bienvenida_rector";
const EVENTO_GENERICO = "consentimiento.aceptado";

/** Siembra plantilla + regla (rol SCHOOL_ADMIN) del fusionado, como en prod (seed.ts:1152). */
async function sembrarReglaBienvenidaRector() {
    await prisma.notificacionPlantilla.upsert({
        where: { clave: `${EVENTO_FUSIONADO}.email` },
        update: { activa: true },
        create: {
            clave: `${EVENTO_FUSIONADO}.email`,
            canal: "EMAIL",
            asunto: "La cuenta de {{nombreColegio}} está lista",
            cuerpoMarkdown:
                "Hola,\n\nLa cuenta de {{nombreColegio}} quedó lista.\n\nAceptación v{{version}} el {{fechaAceptacion}}.\n\n[Entrar a mi panel]({{urlPanel}})",
            variablesSchema: {
                type: "object",
                properties: {
                    nombreColegio: { type: "string" },
                    version: { type: "string" },
                    fechaAceptacion: { type: "string" },
                    urlPanel: { type: "string" },
                },
            },
            activa: true,
        },
    });
    await prisma.notificacionRegla.upsert({
        where: {
            evento_canal_plantillaClave_rol: {
                evento: EVENTO_FUSIONADO,
                canal: "EMAIL",
                plantillaClave: `${EVENTO_FUSIONADO}.email`,
                rol: "SCHOOL_ADMIN",
            },
        },
        update: { activa: true },
        create: {
            evento: EVENTO_FUSIONADO,
            rol: "SCHOOL_ADMIN",
            canal: "EMAIL",
            plantillaClave: `${EVENTO_FUSIONADO}.email`,
            offset: "+0m",
            obligatoria: true,
            activa: true,
        },
    });
}

function contar(evento: string, usuarioId: string) {
    return prisma.notificacion.count({ where: { evento, destinatarioUsuarioId: usuarioId } });
}

describe("SPEC-955 · correo fusionado del colegio, bifurcado por rol en la 1.ª aceptación", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        await crearEventoConsentimiento();
        await sembrarReglaBienvenidaRector();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN 1.ª aceptación → UN fusionado y CERO genérico (sin duplicado)", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        expect(await contar(EVENTO_FUSIONADO, sa.id)).toBe(1);
        expect(await contar(EVENTO_GENERICO, sa.id)).toBe(0);
    });

    it("PARENT 1.ª aceptación → genérico `consentimiento.aceptado`, NUNCA el fusionado", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        expect(await contar(EVENTO_FUSIONADO, padre.id)).toBe(0);
        expect(await contar(EVENTO_GENERICO, padre.id)).toBeGreaterThanOrEqual(1);
    });

    it("SCHOOL_ADMIN re-aceptar la MISMA versión → idempotente: sigue 1 fusionado, 0 genérico", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        const res2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res2.status).toBe(200); // camino idempotente (versión ya vigente)

        expect(await contar(EVENTO_FUSIONADO, sa.id)).toBe(1);
        expect(await contar(EVENTO_GENERICO, sa.id)).toBe(0);
    });

    it("SCHOOL_ADMIN bump de versión → recibe el genérico (recibo), NO re-manda el fusionado", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));

        await prisma.parametroSistema.update({
            where: { clave: "consentimiento.version_actual" },
            data: { valor: "v0.5" },
        });
        const res2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res2.status).toBe(201);

        expect(await prisma.auditConsentimiento.count({ where: { usuarioId: sa.id } })).toBe(2);
        expect(await contar(EVENTO_FUSIONADO, sa.id)).toBe(1); // la bienvenida solo la 1.ª vez
        // el recibo genérico del bump SÍ sale (≥1: el motor tiene regla EMAIL + IN_APP).
        expect(await contar(EVENTO_GENERICO, sa.id)).toBeGreaterThanOrEqual(1);
    });

    it("estructural: completar NO llama ni importa la bienvenida (no se envía al crear la contraseña)", () => {
        const fuente = readFileSync(
            path.join(process.cwd(), "src/app/api/auth/registro-colegio/completar/route.ts"),
            "utf-8",
        );
        expect(fuente, "completar no debe INVOCAR la bienvenida").not.toMatch(/enviarBienvenidaRector\w*\s*\(/);
        expect(fuente, "completar no debe IMPORTAR la bienvenida").not.toMatch(/import\s*\{[^}]*enviarBienvenidaRector/);
    });
});
