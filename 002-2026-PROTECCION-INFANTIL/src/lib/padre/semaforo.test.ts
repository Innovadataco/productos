/**
 * SPEC-305 (A-50): tests unitarios del cálculo del semáforo del círculo de confianza.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { listarSemaforosPorPadre, peorColor } from "./semaforo";

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
                create: {
                    valor,
                    tipo: "telefono",
                    activo: true,
                },
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
            texto: "Reporte de prueba para semáforo",
            textoOriginal: "Reporte de prueba para semáforo",
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

describe("src/lib/padre/semaforo (SPEC-305)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("peorColor", () => {
        it("elige el color de mayor severidad", () => {
            expect(peorColor("VERDE", "AMBAR")).toBe("AMBAR");
            expect(peorColor("AMBAR", "ROJO")).toBe("ROJO");
            expect(peorColor("ROJO", "VERDE")).toBe("ROJO");
            expect(peorColor("VERDE", "VERDE")).toBe("VERDE");
        });
    });

    describe("listarSemaforosPorPadre", () => {
        it("devuelve verde con total 0 para contacto sin reportes", async () => {
            const padre = await crearUsuario("PARENT");
            await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado).toHaveLength(1);
            expect(resultado[0].color).toBe("VERDE");
            expect(resultado[0].totalReportes).toBe(0);
            expect(resultado[0].categoriaDominante).toBeNull();
        });

        it("devuelve ámbar para reporte en revisión humana", async () => {
            const padre = await crearUsuario("PARENT");
            const contacto = await crearContactoConIdentificador(padre.id, "Hijo", "+573002222222");
            await crearReporteVisible("+573002222222", "REVISION_MANUAL", "CONTACTO_INSISTENTE");

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado[0].id).toBe(contacto.id);
            expect(resultado[0].color).toBe("AMBAR");
            expect(resultado[0].totalReportes).toBe(1);
        });

        it("devuelve rojo para reporte clasificado en categoría de alto riesgo", async () => {
            const padre = await crearUsuario("PARENT");
            const contacto = await crearContactoConIdentificador(padre.id, "Hija", "+573003333333");
            await crearReporteVisible("+573003333333", "CLASIFICADO", "SOLICITUD_MATERIAL");

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado[0].id).toBe(contacto.id);
            expect(resultado[0].color).toBe("ROJO");
            expect(resultado[0].categoriaDominante).toBe("SOLICITUD_MATERIAL");
        });

        it("devuelve rojo para 3 o más reportes clasificados en los últimos 30 días", async () => {
            const padre = await crearUsuario("PARENT");
            const contacto = await crearContactoConIdentificador(padre.id, "Sobrina", "+573004444444");
            await crearReporteVisible("+573004444444", "CLASIFICADO", "CONTACTO_INSISTENTE", 5);
            await crearReporteVisible("+573004444444", "CLASIFICADO", "CONTACTO_INSISTENTE", 10);
            await crearReporteVisible("+573004444444", "CLASIFICADO", "CONTACTO_INSISTENTE", 15);

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado[0].id).toBe(contacto.id);
            expect(resultado[0].color).toBe("ROJO");
            expect(resultado[0].reportes30Dias).toBe(3);
        });

        it("devuelve rojo si existe expediente abierto con score ROJO", async () => {
            const padre = await crearUsuario("PARENT");
            const contacto = await crearContactoConIdentificador(padre.id, "Primo", "+573005555555");
            await crearReporteVisible("+573005555555", "CLASIFICADO", "OTRO", 60);
            await prisma.expediente.create({
                data: {
                    padreUsuarioId: padre.id,
                    identificadorReportado: "+573005555555",
                    fechaApertura: new Date(),
                    estado: "ACTIVO",
                    scoreGravedadActual: "ROJO",
                },
            });

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado[0].id).toBe(contacto.id);
            expect(resultado[0].color).toBe("ROJO");
            expect(resultado[0].tieneExpedienteRojo).toBe(true);
        });

        it("ordena por severidad descendente", async () => {
            const padre = await crearUsuario("PARENT");
            const verde = await crearContactoConIdentificador(padre.id, "Verde", "+573006666660");
            const ambar = await crearContactoConIdentificador(padre.id, "Ambar", "+573006666661");
            const rojo = await crearContactoConIdentificador(padre.id, "Rojo", "+573006666662");

            await crearReporteVisible("+573006666661", "REVISION_MANUAL", "CONTACTO_INSISTENTE");
            await crearReporteVisible("+573006666662", "CLASIFICADO", "SOLICITUD_MATERIAL");

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado.map((c) => c.id)).toEqual([rojo.id, ambar.id, verde.id]);
        });

        it("no expone contactos de otro padre", async () => {
            const padre = await crearUsuario("PARENT");
            const otro = await crearUsuario("PARENT");
            const contacto = await crearContactoConIdentificador(otro.id, "Otro", "+573007777777");
            await crearReporteVisible("+573007777777", "CLASIFICADO", "SOLICITUD_MATERIAL");

            const resultado = await listarSemaforosPorPadre(padre.id);

            expect(resultado).toHaveLength(0);
            expect(resultado.some((c) => c.id === contacto.id)).toBe(false);
        });
    });
});
