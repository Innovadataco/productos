/**
 * SPEC-698 (I-423) · Candado de CONDUCTA: «Olvidé mi contraseña» NUNCA reactiva una
 * cuenta que el admin desactivó, ni le emite un token para hacerlo. El login ya niega
 * a un `inactivo` (`autenticacion.ts:96`); el reset por correo no puede ser la puerta
 * trasera que lo reactive.
 *
 * Muere con el defecto (control positivo por remoción del discriminador):
 *  - con la línea `estado: "activo"` en `restablecerPassword`, un `bloqueado` que
 *    canjea un token queda `activo` → rojo.
 *  - sin la guardia de `inactivo` en `solicitarRecuperacion`, la cuenta desactivada
 *    recibe token → rojo.
 *
 * Nota de alcance: se niega SOLO `inactivo` (desactivación del admin), no `bloqueado`.
 * Bloquear `bloqueado` atraparía el reset más común (olvidó la clave → falló logins →
 * `bloqueado` → pide reset), y `bloqueado` solo se limpia con un login exitoso que esa
 * persona no puede hacer. Ver spec.md § «Por qué inactivo y NO estado ≠ activo».
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { EstadoUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";

async function sembrarUsuario(estado: EstadoUsuario) {
    const u = await crearUsuario("PARENT", `reset.${Date.now()}.${Math.random()}@ejemplo.local`);
    if (estado !== "activo") await prisma.usuario.update({ where: { id: u.id }, data: { estado } });
    return u;
}

async function sembrarTokenPara(email: string, usuarioId: string): Promise<string> {
    const token = generarTokenRecuperacion();
    await prisma.tokenRecuperacion.create({
        data: { email, tokenHash: await hashToken(token), expiraEn: new Date(Date.now() + 3_600_000), usuarioId },
    });
    return token;
}

describe("SPEC-698 · el reset NUNCA reactiva ni emite token a una cuenta desactivada", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("restablecerPassword desbloquea el lockout pero NO cambia el estado (un bloqueado queda bloqueado)", async () => {
        const u = await sembrarUsuario("bloqueado");
        await prisma.usuario.update({
            where: { id: u.id },
            data: { intentosFallidos: 5, bloqueadoHasta: new Date(Date.now() + 30 * 60_000) },
        });
        const token = await sembrarTokenPara(u.email, u.id);

        const res = await new AutenticacionService().restablecerPassword(token, "NuevaClave123");
        expect(res.ok).toBe(true);

        const despues = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
        // El reset limpia el mecanismo de lockout…
        expect(despues.intentosFallidos).toBe(0);
        expect(despues.bloqueadoHasta).toBeNull();
        // …pero NO reactiva el estado (el primer login exitoso lo pasará a activo).
        expect(despues.estado, "el reset no puede cambiar el estado de la cuenta").toBe("bloqueado");
    });

    it("restablecerPassword NO reactiva una cuenta inactiva aunque exista un token válido", async () => {
        const u = await sembrarUsuario("inactivo");
        const token = await sembrarTokenPara(u.email, u.id);

        const res = await new AutenticacionService().restablecerPassword(token, "NuevaClave123");
        expect(res.ok).toBe(true);

        const despues = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
        expect(despues.estado, "una cuenta desactivada por el admin NO se reactiva por el reset").toBe("inactivo");
    });

    it("solicitarRecuperacion NO emite token a una cuenta inactiva; un activo SÍ (control positivo)", async () => {
        const inactivo = await sembrarUsuario("inactivo");
        const rInactivo = await new AutenticacionService().solicitarRecuperacion(inactivo.email);
        // Respuesta genérica (no delata existencia ni estado)…
        expect(rInactivo.ok).toBe(true);
        // …pero SIN token: nada que canjear, nada que enviar.
        expect(rInactivo.tipo).not.toBe("ok");
        expect(await prisma.tokenRecuperacion.count({ where: { email: inactivo.email } })).toBe(0);

        const activo = await sembrarUsuario("activo");
        const rActivo = await new AutenticacionService().solicitarRecuperacion(activo.email);
        expect(rActivo.tipo).toBe("ok");
        expect(await prisma.tokenRecuperacion.count({ where: { email: activo.email } })).toBe(1);
    });
});
