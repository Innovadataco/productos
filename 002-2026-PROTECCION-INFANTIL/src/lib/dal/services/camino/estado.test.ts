/**
 * SPEC-339 (A-67) — la derivación del paso pendiente.
 *
 * El progreso NO se guarda: se deriva de los hechos. Estos tests recorren los
 * cinco resultados posibles y los dos comportamientos que hacen que el camino
 * se sostenga solo: inactivar el único menor devuelve al Paso 3, y ningún dato
 * viejo hay que "revertir" para que eso pase.
 *
 * El guardián de consentimiento se mockea: tiene su propio test y su propia
 * definición de "vigente"; acá solo importa que el Paso 1 lo respete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    requiereConsentimientoActual: vi.fn(),
}));

vi.mock("@/lib/consentimiento/guard", () => ({
    requiereConsentimientoActual: mocks.requiereConsentimientoActual,
}));

import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { derivarPasoPendiente } from "./estado";

/** Completa el perfil del Paso 2 (los 7 campos que exige el brief §2.3). */
async function completarPerfil(usuarioId: string) {
    // El catálogo geográfico puede no estar sembrado en la BD de test.
    const paisId =
        (await prisma.pais.findFirst({ select: { id: true } }))?.id ??
        (await prisma.pais.create({ data: { nombre: "Colombia", codigo: "CO" } })).id;
    const ciudadId =
        (await prisma.ciudad.findFirst({ select: { id: true } }))?.id ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId } })).id;
    await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
            nombre: "Padre",
            apellidos: "De Prueba",
            documentoTipo: "CC",
            documentoNumero: "79000001",
            telefono: "+57 300 000 0001",
            paisId: paisId,
            ciudadId: ciudadId,
        },
    });
}

async function agregarMenor(usuarioId: string, documentoNumero = "1030000001") {
    return prisma.hijo.create({
        data: {
            usuarioId,
            nombre: "Menor",
            apellidos: "De Prueba",
            documentoTipo: "TI",
            documentoNumero,
        },
    });
}

async function crearSuscripcion(usuarioId: string, estado: "ACTIVA" | "PENDIENTE_AUTORIZACION") {
    const admin = await crearUsuario("ADMIN");
    const plan = await prisma.plan.create({
        data: {
            nombre: "Plan de prueba",
            tipoTitular: "PADRE",
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 0,
            // legacy: nullable en el schema pero NOT NULL en la BD de test.
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId,
            estado,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 86400000),
            codigoReferidoPropio: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
    });
}

describe("derivarPasoPendiente (SPEC-339)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mocks.requiereConsentimientoActual.mockResolvedValue(false);
    });

    it("sin consentimiento → permiso (Paso 1), sin importar lo demás", async () => {
        const padre = await crearUsuario("PARENT");
        mocks.requiereConsentimientoActual.mockResolvedValue(true);
        expect(await derivarPasoPendiente(padre.id)).toBe("permiso");
    });

    it("con consentimiento y perfil incompleto → datos (Paso 2)", async () => {
        const padre = await crearUsuario("PARENT");
        expect(await derivarPasoPendiente(padre.id)).toBe("datos");
    });

    it("un perfil al que le falta SOLO el documento sigue en el Paso 2", async () => {
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        await prisma.usuario.update({ where: { id: padre.id }, data: { documentoNumero: null } });
        expect(await derivarPasoPendiente(padre.id)).toBe("datos");
    });

    it("perfil completo y cero menores → hijos (Paso 3)", async () => {
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        expect(await derivarPasoPendiente(padre.id)).toBe("hijos");
    });

    it("un menor INACTIVO no cuenta: el padre lo apagó, no lo está cuidando", async () => {
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        const menor = await agregarMenor(padre.id);
        await prisma.hijo.update({ where: { id: menor.id }, data: { estado: "inactivo" } });
        expect(await derivarPasoPendiente(padre.id)).toBe("hijos");
    });

    it("un menor activo y ninguna suscripción → plan (Paso 4)", async () => {
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        await agregarMenor(padre.id);
        expect(await derivarPasoPendiente(padre.id)).toBe("plan");
    });

    it("CUALQUIER suscripción registrada cierra el Paso 4 — incluida una pendiente de autorización", async () => {
        // Decisión CEO 20:20 (bloqueo 3 de Calidad): un padre que eligió plan
        // pagado hizo su parte; no queda encerrado esperando el clic del admin.
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        await agregarMenor(padre.id);
        await crearSuscripcion(padre.id, "PENDIENTE_AUTORIZACION");
        expect(await derivarPasoPendiente(padre.id)).toBeNull();
    });

    it("el camino se sostiene solo: inactivar el único menor devuelve al Paso 3", async () => {
        const padre = await crearUsuario("PARENT");
        await completarPerfil(padre.id);
        const menor = await agregarMenor(padre.id);
        await crearSuscripcion(padre.id, "ACTIVA");
        expect(await derivarPasoPendiente(padre.id)).toBeNull();

        await prisma.hijo.update({ where: { id: menor.id }, data: { estado: "inactivo" } });
        expect(await derivarPasoPendiente(padre.id)).toBe("hijos");
    });
});
