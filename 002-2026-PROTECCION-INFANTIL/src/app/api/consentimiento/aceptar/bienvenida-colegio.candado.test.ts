/**
 * SPEC-962 · CANDADO (#1): aceptar la Política NO encola el correo de bienvenida
 * del rector.
 *
 * El correo «Su cuenta de {colegio} está lista» salía al ACEPTAR la Política
 * (SPEC-955), con el camino aún en el Paso 1 — dos caminos que se contradecían.
 * Ahora NACE del CIERRE del camino (ver completar-colegio.candado.test.ts). En la
 * aceptación, el rector no recibe NI la bienvenida NI el recibo genérico
 * `consentimiento.aceptado` (el motor no filtra por rol, SPEC-247, así que el
 * genérico SÍ le llegaría si cayera en el else — por eso el branch es explícito).
 *
 * Muere con el defecto: la regla de la bienvenida se SIEMBRA activa a propósito, de
 * modo que el `0` prueba que lo frena el CÓDIGO (el branch de aceptar), no una regla
 * faltante. Si alguien re-cableara el envío al aceptar (el bug de origen), el caso
 * del SCHOOL_ADMIN se pondría rojo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
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

const EVENTO_BIENVENIDA = "colegio.bienvenida_rector";
const EVENTO_GENERICO = "consentimiento.aceptado";

/** Siembra plantilla + regla (rol SCHOOL_ADMIN) de la bienvenida, como en prod
 *  (seed.ts:1152). Se siembra ACTIVA para que el 0 sea control positivo. */
async function sembrarReglaBienvenidaRector() {
    await prisma.notificacionPlantilla.upsert({
        where: { clave: `${EVENTO_BIENVENIDA}.email` },
        update: { activa: true },
        create: {
            clave: `${EVENTO_BIENVENIDA}.email`,
            canal: "EMAIL",
            asunto: "Su cuenta de {{nombreColegio}} está lista",
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
                evento: EVENTO_BIENVENIDA,
                canal: "EMAIL",
                plantillaClave: `${EVENTO_BIENVENIDA}.email`,
                rol: "SCHOOL_ADMIN",
            },
        },
        update: { activa: true },
        create: {
            evento: EVENTO_BIENVENIDA,
            rol: "SCHOOL_ADMIN",
            canal: "EMAIL",
            plantillaClave: `${EVENTO_BIENVENIDA}.email`,
            offset: "+0m",
            obligatoria: true,
            activa: true,
        },
    });
}

function contar(evento: string, usuarioId: string) {
    return prisma.notificacion.count({ where: { evento, destinatarioUsuarioId: usuarioId } });
}

describe("SPEC-962 · aceptar la Política NO encola la bienvenida del rector", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        await crearEventoConsentimiento();
        await sembrarReglaBienvenidaRector();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN 1.ª aceptación → CERO bienvenida y CERO genérico (nada al aceptar)", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        // #1 · muere con el defecto: la bienvenida NO sale al aceptar (nace del cierre).
        expect(await contar(EVENTO_BIENVENIDA, sa.id)).toBe(0);
        // El rector tampoco recibe el recibo genérico en su 1.ª aceptación.
        expect(await contar(EVENTO_GENERICO, sa.id)).toBe(0);
    });

    it("PARENT 1.ª aceptación → recibo genérico, NUNCA la bienvenida del rector", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        expect(await contar(EVENTO_BIENVENIDA, padre.id)).toBe(0);
        expect(await contar(EVENTO_GENERICO, padre.id)).toBeGreaterThanOrEqual(1);
    });

    it("SCHOOL_ADMIN bump de versión → recibo genérico, NUNCA la bienvenida", async () => {
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
        // La bienvenida NUNCA sale por la vía de aceptar (ni 1.ª ni bump).
        expect(await contar(EVENTO_BIENVENIDA, sa.id)).toBe(0);
        // El recibo genérico del bump SÍ sale (else branch; motor con regla EMAIL + IN_APP).
        expect(await contar(EVENTO_GENERICO, sa.id)).toBeGreaterThanOrEqual(1);
    });
});
