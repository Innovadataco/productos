/**
 * SPEC-955 · CANDADO del TIMING de la bienvenida del colegio.
 *
 * El correo «Su cuenta del colegio está lista» (`colegio.bienvenida_rector`) se
 * enviaba al CREAR la contraseña (registro-colegio/completar), ANTES de que el
 * rector aceptara la Política. Jelkin lo quiere DESPUÉS del clic en «Acepto».
 *
 * Invariantes (control positivo, mueren con el defecto):
 *  - NO sale en completar: el fuente de completar/route.ts ya no referencia la
 *    bienvenida (si alguien la re-cablea ahí → rojo).
 *  - SÍ sale tras la PRIMERA aceptación de un SCHOOL_ADMIN, exactamente UNA vez.
 *  - NO sale para un PARENT que acepta la política (acote por rol).
 *  - NO se reenvía en re-aceptación ni en bump de versión.
 * Mutar el call-site de vuelta a completar (quitarlo de aceptar) → los casos de
 * «SÍ sale tras la 1.ª aceptación» se ponen rojos.
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

const EVENTO_BIENVENIDA = "colegio.bienvenida_rector";

/** Siembra plantilla + regla (rol SCHOOL_ADMIN) del evento de bienvenida, como en prod (seed.ts:1152). */
async function sembrarReglaBienvenidaRector() {
    await prisma.notificacionPlantilla.upsert({
        where: { clave: `${EVENTO_BIENVENIDA}.email` },
        update: { activa: true },
        create: {
            clave: `${EVENTO_BIENVENIDA}.email`,
            canal: "EMAIL",
            asunto: "Su cuenta del colegio está lista",
            cuerpoMarkdown: "Hola,\n\nLa cuenta del {{nombreColegio}} quedó creada.\n\n[Entrar a mi cuenta]({{urlLogin}})",
            variablesSchema: { type: "object", properties: { nombreColegio: { type: "string" }, urlLogin: { type: "string" } } },
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

function contarBienvenidas(email: string) {
    return prisma.notificacion.count({ where: { evento: EVENTO_BIENVENIDA, destinatarioEmail: email } });
}

describe("SPEC-955 · bienvenida del colegio tras la 1.ª aceptación (no al crear la contraseña)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        await crearEventoConsentimiento();
        await sembrarReglaBienvenidaRector();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN: su PRIMERA aceptación dispara la bienvenida exactamente UNA vez", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        expect(await contarBienvenidas(sa.email)).toBe(1);
    });

    it("SCHOOL_ADMIN: re-aceptar la MISMA versión no reenvía (idempotente, sigue en 1)", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        const res2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res2.status).toBe(200); // camino idempotente: versión ya vigente

        expect(await contarBienvenidas(sa.email)).toBe(1);
    });

    it("SCHOOL_ADMIN: un BUMP de versión obliga a re-aceptar pero NO reenvía la bienvenida (sigue en 1)", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));

        // Sube la versión vigente: la próxima aceptación es real (no idempotente).
        await prisma.parametroSistema.update({
            where: { clave: "consentimiento.version_actual" },
            data: { valor: "v0.5" },
        });
        const res2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res2.status).toBe(201);

        const audits = await prisma.auditConsentimiento.count({ where: { usuarioId: sa.id } });
        expect(audits).toBe(2); // dos aceptaciones reales
        expect(await contarBienvenidas(sa.email)).toBe(1); // pero una sola bienvenida
    });

    it("PARENT: aceptar la política NO dispara la bienvenida del colegio (acote por rol)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        expect(await contarBienvenidas(padre.email)).toBe(0);
    });

    it("estructural: completar NO llama ni importa la bienvenida (no se envía al crear la contraseña)", () => {
        const fuente = readFileSync(
            path.join(process.cwd(), "src/app/api/auth/registro-colegio/completar/route.ts"),
            "utf-8",
        );
        // Una LLAMADA `enviarBienvenidaRector(` (no un comentario que nombre al helper nuevo).
        expect(fuente, "completar no debe INVOCAR la bienvenida").not.toMatch(/enviarBienvenidaRector\w*\s*\(/);
        // Ni IMPORTARLA desde email-colegio.
        expect(fuente, "completar no debe IMPORTAR la bienvenida").not.toMatch(/import\s*\{[^}]*enviarBienvenidaRector/);
    });
});
