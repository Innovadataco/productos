/**
 * SPEC-307 (A-50): tests unitarios del motor de sugerencia proactiva del padre.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { EstadoReporte, CategoriaConducta, EstadoExpediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { construirSugerenciaProactiva } from "./sugerencia-proactiva";

async function crearContactoConIdentificador(
    usuarioId: string,
    etiqueta: string,
    valor: string
) {
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
    estado: EstadoReporte,
    categoria: CategoriaConducta,
    diasAtras = 0
) {
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
    const creadoEn = new Date();
    creadoEn.setDate(creadoEn.getDate() - diasAtras);

    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Reporte de prueba para sugerencia",
            textoOriginal: "Reporte de prueba para sugerencia",
            fechaIncidente: creadoEn,
            ciudad: "Bogotá",
            pais: "Colombia",
            estado,
            esAnonimo: false,
            creadoEn,
            clasificacion: {
                create: {
                    categoria,
                    confianza: 0.85,
                    modeloUsado: "ornith:9b",
                    latenciaMs: 120,
                },
            },
        },
    });
}

async function crearExpediente(
    padreUsuarioId: string,
    identificadorReportado: string,
    scoreGravedad: "VERDE" | "AMARILLO" | "ROJO",
    estado: EstadoExpediente = "ACTIVO",
    diasAtrasActualizacion = 0
) {
    const actualizadoEn = new Date();
    actualizadoEn.setDate(actualizadoEn.getDate() - diasAtrasActualizacion);

    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId,
            identificadorReportado,
            fechaApertura: new Date(),
            estado,
            scoreGravedadActual: scoreGravedad,
        },
    });

    // @updatedAt ignora el valor en create; forzamos con update.
    return prisma.expediente.update({
        where: { id: expediente.id },
        data: { updatedAt: actualizadoEn },
    });
}

describe("src/lib/padre/sugerencia-proactiva (SPEC-307)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("devuelve INVITAR_CONTACTOS cuando no hay contactos", async () => {
        const padre = await crearUsuario("PARENT");
        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("INVITAR_CONTACTOS");
        expect(sugerencia.accion.href).toBe("/dashboard/padre/circulo-confianza");
    });

    it("devuelve ROJO cuando hay contacto en rojo", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Hija", "+573001111111");
        await crearReporteVisible("+573001111111", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("ROJO");
        expect(sugerencia.metadata.contactosRojo).toBeGreaterThan(0);
    });

    it("devuelve AMBAR cuando hay contacto en ámbar", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Hijo", "+573002222222");
        await crearReporteVisible("+573002222222", "REVISION_MANUAL", "CONTACTO_INSISTENTE", 2);

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("AMBAR");
    });

    it("devuelve ROJO cuando hay expediente con score ROJO", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Sobrina", "+573003333333");
        await crearExpediente(padre.id, "+573003333333", "ROJO");

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("ROJO");
        expect(sugerencia.metadata.expedientesRojo).toBe(1);
    });

    it("devuelve AMBAR cuando hay expediente en revisión", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Primo", "+573004444444");
        await crearExpediente(padre.id, "+573004444444", "VERDE", "EN_ACLARACION");

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("AMBAR");
        expect(sugerencia.metadata.expedientesAmbar).toBe(1);
    });

    it("devuelve SIN_NOVEDADES cuando la última novedad tiene más de 7 días", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Tío", "+573005555555");
        await crearExpediente(padre.id, "+573005555555", "VERDE", "ACTIVO", 10);

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("SIN_NOVEDADES");
        expect(sugerencia.metadata.diasDesdeUltimaNovedad).toBeGreaterThan(7);
    });

    it("devuelve TODO_VERDE cuando todo está verde y hay novedades recientes", async () => {
        const padre = await crearUsuario("PARENT");
        await crearContactoConIdentificador(padre.id, "Amigo", "+573006666666");
        await crearExpediente(padre.id, "+573006666666", "VERDE", "ACTIVO", 1);

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("TODO_VERDE");
    });

    it("prioriza sin contactos sobre rojo", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        await crearContactoConIdentificador(otro.id, "Otro", "+573007777777");
        await crearReporteVisible("+573007777777", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);

        const sugerencia = await construirSugerenciaProactiva(padre.id);

        expect(sugerencia.tipo).toBe("INVITAR_CONTACTOS");
    });
});
