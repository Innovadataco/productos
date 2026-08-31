/**
 * SPEC-203 (002-PI-100): tests de helpers de preferencias de notificación.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { obtenerPreferenciasUsuario, actualizarPreferencia } from "./preferencias";

async function crearPlantilla(clave: string, canal: "EMAIL" | "IN_APP") {
    return prisma.notificacionPlantilla.create({
        data: { clave, canal, cuerpoMarkdown: "Cuerpo", asunto: canal === "EMAIL" ? "Asunto" : null },
    });
}

async function crearRegla(
    evento: string,
    rol: string,
    canal: "EMAIL" | "IN_APP",
    plantillaClave: string,
    obligatoria = false
) {
    return prisma.notificacionRegla.create({
        data: { evento, rol, offset: "+0m", canal, plantillaClave, obligatoria, activa: true },
    });
}

describe("obtenerPreferenciasUsuario", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("agrupa reglas por evento y respeta preferencia guardada", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        await crearRegla("reporte.resuelto", "PARENT", "EMAIL", plantilla.clave);
        await prisma.notificacionPreferencia.create({
            data: { usuarioId: user.id, eventoRegla: "reporte.resuelto.email", habilitado: false },
        });

        const grupos = await obtenerPreferenciasUsuario(user.id, "PARENT");
        expect(grupos).toHaveLength(1);
        expect(grupos[0].canales[0].habilitado).toBe(false);
    });

    it("ignora reglas de otros roles", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("caso.asignado.email", "EMAIL");
        await crearRegla("caso.asignado", "OPERADOR", "EMAIL", plantilla.clave);

        const grupos = await obtenerPreferenciasUsuario(user.id, "PARENT");
        expect(grupos).toHaveLength(0);
    });

    // SPEC-330 (I-221): el seed sembraba el rol del padre como "PADRE" (dominio),
    // que no existe en el enum RolUsuario. La pantalla filtra por el rol enum del
    // usuario ("PARENT") → el toggle quedaba oculto. Candado 26: reproducido.
    it("I-221: la regla con el rol legado 'PADRE' queda oculta; alineada al enum aparece", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        const regla = await crearRegla("reporte.resuelto", "PADRE", "EMAIL", plantilla.clave);

        // Bug: "PADRE" !== "PARENT" → el padre no ve el toggle.
        expect(await obtenerPreferenciasUsuario(user.id, "PARENT")).toHaveLength(0);

        // Fix (rol alineado al enum, como hace el seed + la migración de datos).
        await prisma.notificacionRegla.update({ where: { id: regla.id }, data: { rol: "PARENT" } });
        const grupos = await obtenerPreferenciasUsuario(user.id, "PARENT");
        expect(grupos).toHaveLength(1);
        expect(grupos[0].evento).toBe("reporte.resuelto");
    });
});

describe("actualizarPreferencia", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("actualiza preferencia no obligatoria", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        await crearRegla("reporte.resuelto", "PARENT", "EMAIL", plantilla.clave);

        const resultado = await actualizarPreferencia(user.id, "PARENT", "reporte.resuelto.email", false);
        expect(resultado).toEqual({ ok: true });
        const pref = await prisma.notificacionPreferencia.findUnique({
            where: { usuarioId_eventoRegla: { usuarioId: user.id, eventoRegla: "reporte.resuelto.email" } },
        });
        expect(pref?.habilitado).toBe(false);
    });

    it("rechaza regla obligatoria", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL");
        await crearRegla("suscripcion.por_vencer", "PARENT", "EMAIL", plantilla.clave, true);

        const resultado = await actualizarPreferencia(user.id, "PARENT", "suscripcion.por_vencer.email", false);
        expect(resultado).toEqual({ ok: false, error: "regla_obligatoria" });
    });

    it("rechaza regla inexistente", async () => {
        const user = await crearUsuario("PARENT");
        const resultado = await actualizarPreferencia(user.id, "PARENT", "no.existe.email", false);
        expect(resultado).toEqual({ ok: false, error: "regla_inexistente" });
    });

    // SPEC-330 (I-221): el segundo síntoma. actualizarPreferencia busca la regla con
    // findByEventoRolCanal(evento, user.rol, canal); con el rol legado "PADRE" no la
    // encuentra → "regla_inexistente" (el toggle tampoco se guarda). Candado 26.
    it("I-221: con el rol legado 'PADRE' el guardado falla; alineado al enum guarda", async () => {
        const user = await crearUsuario("PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        const regla = await crearRegla("reporte.resuelto", "PADRE", "EMAIL", plantilla.clave);

        expect(await actualizarPreferencia(user.id, "PARENT", "reporte.resuelto.email", false))
            .toEqual({ ok: false, error: "regla_inexistente" });

        await prisma.notificacionRegla.update({ where: { id: regla.id }, data: { rol: "PARENT" } });
        expect(await actualizarPreferencia(user.id, "PARENT", "reporte.resuelto.email", false))
            .toEqual({ ok: true });
    });
});
