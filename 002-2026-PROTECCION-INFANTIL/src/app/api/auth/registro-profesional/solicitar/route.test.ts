/**
 * SPEC-419 (I-296) · el psicólogo puede recibir su enlace de registro.
 *
 * El defecto: SPEC-391 creó `email-profesional.ts` con dos eventos que fallan
 * en cerrado, y **el seed nunca recibió sus reglas ni sus plantillas**. La ruta
 * atrapa el throw, lo registra y responde 202 «te enviamos un enlace» igual —
 * así que el profesional llenaba el formulario y esperaba un correo que no
 * existía. **No es que no quisieran inscribirse: es que no podían.**
 *
 * El 202 NO se toca: es el anti-enumeración de SPEC-338, que exige respuesta
 * idéntica exista o no el correo. Por eso este test no mira el status —
 * mira **la fila en `notificaciones`**, que es lo único que distingue «se
 * mandó» de «se tragó el error».
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

vi.mock("@/lib/queue", () => ({
    sendNotificacionEnvio: vi.fn(async () => undefined),
    sendReporte: vi.fn(async () => undefined),
}));

/** Siembra SOLO lo que este camino necesita del catálogo del motor. */
async function sembrarReglaProfesional() {
    await prisma.notificacionPlantilla.create({
        data: {
            clave: "auth.registro_enlace_profesional.email",
            canal: "EMAIL",
            asunto: "Crea tu contraseña y empecemos",
            cuerpoMarkdown: "Abre este enlace: {{url}}",
            activa: true,
        },
    });
    await prisma.notificacionRegla.create({
        data: {
            evento: "auth.registro_enlace_profesional",
            rol: "PROFESIONAL",
            canal: "EMAIL",
            plantillaClave: "auth.registro_enlace_profesional.email",
            offset: "+0m",
            obligatoria: true,
            activa: true,
        },
    });
}

function pedir(email: string): Request {
    return new Request("http://localhost:5005/api/auth/registro-profesional/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
}

describe("POST /api/auth/registro-profesional/solicitar · SPEC-419 (I-296)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => prisma.$disconnect());

    it("con la regla sembrada, el enlace queda ENCOLADO para el profesional", async () => {
        await sembrarReglaProfesional();
        const email = `psicologa.${Date.now()}@ejemplo.local`;

        const res = await POST(pedir(email));
        expect(res.status).toBe(202);

        const encoladas = await prisma.notificacion.findMany({
            where: { evento: "auth.registro_enlace_profesional" },
        });
        expect(encoladas, "sin fila, el enlace nunca sale — eso es I-296").toHaveLength(1);
        expect(encoladas[0].destinatarioEmail).toBe(email);
        expect(encoladas[0].estado).toBe("ENCOLADA");
        // El enlace tiene que ir adentro: sin él el correo no sirve de nada.
        expect(JSON.stringify(encoladas[0].variables)).toContain("/registro-profesional/crear-clave/");
    });

    it("SIN la regla — el defecto — la respuesta es la MISMA 202 y no hay fila", async () => {
        // Es la reproducción exacta de I-296: la pantalla dice "revisá tu
        // correo", el profesional espera, y no hay nada. Por eso mirar el status
        // no alcanzaba para verlo, y por eso este test mira la tabla.
        const email = `psicologo.${Date.now()}@ejemplo.local`;

        const res = await POST(pedir(email));
        expect(res.status, "el 202 es anti-enumeración (SPEC-338): no cambia").toBe(202);
        expect((await res.json()).message).toContain("enlace");

        const encoladas = await prisma.notificacion.count({
            where: { evento: "auth.registro_enlace_profesional" },
        });
        expect(encoladas, "así se veía el defecto: 202 y cero correos").toBe(0);
    });

    it("el token del enlace queda creado igual: lo que faltaba era el correo", async () => {
        await sembrarReglaProfesional();
        const email = `psicologa2.${Date.now()}@ejemplo.local`;
        await POST(pedir(email));
        // El servicio de registro hizo su parte desde siempre; el agujero estaba
        // en el aviso. Se afirma para no atribuirle al servicio un defecto ajeno.
        expect(await prisma.tokenRegistro.count({ where: { email, rol: "PROFESIONAL" } })).toBeGreaterThan(0);
    });
});
