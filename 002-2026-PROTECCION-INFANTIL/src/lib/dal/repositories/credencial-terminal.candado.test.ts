/**
 * CANDADO · SPEC-783 — la credencial en `_sensibles` muere en el estado TERMINAL, y SOBREVIVE
 * en la falla intermedia (para que el reintento renderice). Integración (BD real + raw SQL).
 *
 * Las DOS direcciones (la segunda es la que se olvida):
 *  (a) TERMINAL (`marcarEnviada`, `marcarFallidaDefinitiva`) → la credencial YA NO ESTÁ, y el
 *      render ya no la muestra. Control positivo: ANTES de la limpieza, SÍ está y SÍ renderiza.
 *  (b) FALLA INTERMEDIA (`marcarFallida`) → la credencial SIGUE ahí y el reintento renderiza
 *      bien. Sin (b), el próximo «mejora» limpiando en toda falla y rompe el envío en silencio.
 *
 * Con la contraseña REAL plantada, no un placeholder: se busca el texto exacto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionRepository } from "./notificacion";
import { renderizarPlantilla } from "@/lib/notificaciones/renderer";

const CLAVE_REAL = "Cred-Real-7Kq2";
const PLANTILLA = "Tu contraseña temporal es {{tempPassword}}.";

async function crearConCredencial(estado: "ENCOLADA" | "ENVIANDO" | "REINTENTANDO") {
    return prisma.notificacion.create({
        data: {
            evento: "usuario.bienvenida.operador",
            destinatarioEmail: "op@test.local",
            plantillaClave: "usuario.bienvenida.operador.email",
            canal: "EMAIL",
            estado,
            enviarEn: new Date(),
            // La credencial vive bajo `_sensibles` (como la pone el motor); `email`/`urlLogin` sueltas.
            variables: { email: "op@test.local", urlLogin: "/login", _sensibles: { tempPassword: CLAVE_REAL } },
        },
    });
}

function credencialDe(variables: unknown): string | undefined {
    const v = variables as { _sensibles?: { tempPassword?: string } };
    return v?._sensibles?.tempPassword;
}

function renderiza(variables: unknown): string {
    return renderizarPlantilla(PLANTILLA, null, (variables ?? {}) as Record<string, unknown>).cuerpo;
}

describe("SPEC-783 · la credencial muere en el terminal, sobrevive en la falla intermedia", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("CONTROL POSITIVO: antes de cualquier limpieza, la credencial está y renderiza", async () => {
        const notif = await crearConCredencial("ENVIANDO");
        const leida = await prisma.notificacion.findUniqueOrThrow({ where: { id: notif.id } });
        expect(credencialDe(leida.variables)).toBe(CLAVE_REAL);
        expect(renderiza(leida.variables)).toContain(CLAVE_REAL);
    });

    it("(a) marcarEnviada (TERMINAL) → la credencial YA NO ESTÁ y el render no la muestra", async () => {
        const notif = await crearConCredencial("ENVIANDO");
        await new NotificacionRepository().marcarEnviada(notif.id, "resend-abc");
        const leida = await prisma.notificacion.findUniqueOrThrow({ where: { id: notif.id } });
        expect(leida.estado).toBe("ENVIADA");
        expect(credencialDe(leida.variables)).toBeUndefined();
        expect(renderiza(leida.variables)).not.toContain(CLAVE_REAL);
    });

    it("(a2) marcarFallidaDefinitiva (TERMINAL) → la credencial YA NO ESTÁ", async () => {
        const notif = await crearConCredencial("REINTENTANDO");
        await new NotificacionRepository().marcarFallidaDefinitiva(notif.id, 5, "límite de intentos");
        const leida = await prisma.notificacion.findUniqueOrThrow({ where: { id: notif.id } });
        expect(leida.estado).toBe("FALLIDA");
        expect(credencialDe(leida.variables)).toBeUndefined();
        expect(renderiza(leida.variables)).not.toContain(CLAVE_REAL);
    });

    it("(b) marcarFallida (INTERMEDIA) → la credencial SIGUE y el reintento renderiza bien", async () => {
        const notif = await crearConCredencial("ENVIANDO");
        await new NotificacionRepository().marcarFallida(notif.id, "timeout del proveedor", new Date(Date.now() + 60_000));
        const leida = await prisma.notificacion.findUniqueOrThrow({ where: { id: notif.id } });
        expect(leida.estado).toBe("REINTENTANDO");
        expect(credencialDe(leida.variables)).toBe(CLAVE_REAL); // NO se tocó
        expect(renderiza(leida.variables)).toContain(CLAVE_REAL); // el reintento renderiza la clave
    });
});
