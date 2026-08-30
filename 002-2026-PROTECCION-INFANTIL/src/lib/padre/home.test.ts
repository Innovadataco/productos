/**
 * SPEC-309 (A-50): tests de integración del orquestador del home del padre.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { CategoriaConducta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { obtenerHomePadre } from "./home";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

async function crearContactoConIdentificador(usuarioId: string, etiqueta: string, valor: string) {
    return prisma.contactoConfianza.create({
        data: {
            usuarioId,
            etiqueta,
            activo: true,
            identificadores: {
                create: { valor, tipo: "telefono", activo: true },
            },
        },
    });
}

async function crearReporteVisible(
    identificador: string,
    estado: "CLASIFICADO" | "REVISION_MANUAL",
    categoria: CategoriaConducta
) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Reporte de prueba",
            textoOriginal: "Reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado,
            esAnonimo: false,
            clasificacion: {
                create: { categoria, confianza: 0.85, modeloUsado: "ornith:9b", latenciaMs: 120 },
            },
        },
    });
}

describe("obtenerHomePadre", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPaisCiudad();
    });

    it("devuelve payload completo para un padre sin contactos", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        await prisma.usuario.update({ where: { id: padre.id }, data: { nombre: "Carlos" } });
        const home = await obtenerHomePadre(padre.id, "Carlos");

        expect(home.saludo).toContain("Carlos");
        expect(home.fechaHoy).toContain("2026");
        expect(home.resumen.totalContactos).toBe(0);
        expect(home.semaforo).toEqual([]);
        expect(home.timeline).toEqual([]);
        expect(home.sugerencia.accionHref).toBe("/dashboard/padre/circulo-confianza");
        expect(home.accesos.length).toBeGreaterThanOrEqual(3);
    });

    it("calcula resumen y semáforo con contactos y reportes", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");
        await crearReporteVisible("+573001111111", "CLASIFICADO", "SOLICITUD_MATERIAL");

        const home = await obtenerHomePadre(padre.id, "Carlos");

        expect(home.resumen.totalContactos).toBe(1);
        expect(home.resumen.clasificados).toBe(1);
        expect(home.semaforo).toHaveLength(1);
        expect(home.semaforo[0].color).toBe("AMBAR");
    });

    it("prioriza gracia sobre semáforo rojo", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");
        await crearReporteVisible("+573001111111", "CLASIFICADO", "SOLICITUD_MATERIAL");

        const home = await obtenerHomePadre(padre.id, "Carlos", { enPeriodoGracia: true });

        expect(home.sugerencia.prioridad).toBe("alta");
        expect(home.sugerencia.texto).toContain("período de gracia");
    });
});
