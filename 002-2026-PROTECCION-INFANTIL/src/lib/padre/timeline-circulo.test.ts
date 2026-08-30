/**
 * SPEC-306 (A-50): tests unitarios del ensamblado del timeline del círculo de
 * confianza.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { construirTimelineCirculo, severityDesdeCategoria, severityDesdeScoreGravedad } from "./timeline-circulo";
import { obtenerGruposCategoria } from "@/lib/categoria-grupos";

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
    categoria: CategoriaConducta | null,
    diasAtras = 0
) {
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
    const creadoEn = new Date();
    creadoEn.setDate(creadoEn.getDate() - diasAtras);

    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Reporte de prueba para timeline",
            textoOriginal: "Reporte de prueba para timeline",
            fechaIncidente: creadoEn,
            ciudad: "Bogotá",
            pais: "Colombia",
            estado,
            esAnonimo: false,
            creadoEn,
            ...(categoria
                ? {
                    clasificacion: {
                        create: {
                            categoria,
                            confianza: 0.85,
                            modeloUsado: "ornith:9b",
                            latenciaMs: 120,
                        },
                    },
                }
                : {}),
        },
    });
}

async function crearExpedienteConEvento(
    padreUsuarioId: string,
    identificadorReportado: string,
    scoreGravedad: "VERDE" | "AMARILLO" | "ROJO",
    diasAtrasEvento = 0,
    texto = "Evento de prueba en expediente"
) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId,
            identificadorReportado,
            fechaApertura: new Date(),
            estado: "ACTIVO",
            scoreGravedadActual: scoreGravedad,
        },
    });

    const fechaEvento = new Date();
    fechaEvento.setDate(fechaEvento.getDate() - diasAtrasEvento);

    const evento = await prisma.eventoExpediente.create({
        data: {
            expedienteId: expediente.id,
            ordenSecuencial: 1,
            fechaEvento,
            texto,
            categoriaDetectada: null,
        },
    });

    return { expediente, evento };
}

describe("src/lib/padre/timeline-circulo (SPEC-306)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("severityDesdeScoreGravedad", () => {
        it("mapea los scores de expediente a severity", () => {
            expect(severityDesdeScoreGravedad("ROJO")).toBe("ROJO");
            expect(severityDesdeScoreGravedad("AMARILLO")).toBe("AMARILLO");
            expect(severityDesdeScoreGravedad("VERDE")).toBe("VERDE");
        });
    });

    describe("severityDesdeCategoria", () => {
        it("asigna ROJO a categorías de alto riesgo", async () => {
            const grupos = await obtenerGruposCategoria();
            expect(severityDesdeCategoria("SOLICITUD_MATERIAL", grupos)).toBe("ROJO");
            expect(severityDesdeCategoria("EXTORSION", grupos)).toBe("ROJO");
        });

        it("asigna AMARILLO a categorías de riesgo medio", async () => {
            const grupos = await obtenerGruposCategoria();
            expect(severityDesdeCategoria("CONTACTO_INSISTENTE", grupos)).toBe("AMARILLO");
        });

        it("asigna VERDE a categorías de bajo riesgo o desconocidas", async () => {
            const grupos = await obtenerGruposCategoria();
            expect(severityDesdeCategoria("OTRO", grupos)).toBe("VERDE");
            expect(severityDesdeCategoria(null, grupos)).toBe("VERDE");
        });
    });

    describe("construirTimelineCirculo", () => {
        it("devuelve lista vacía cuando el usuario no tiene contactos", async () => {
            const padre = await crearUsuario("PARENT");
            const resultado = await construirTimelineCirculo(padre.id);
            expect(resultado).toEqual([]);
        });

        it("incluye solo eventos de los últimos 30 días", async () => {
            const padre = await crearUsuario("PARENT");
            await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");

            await crearReporteVisible("+573001111111", "CLASIFICADO", "CONTACTO_INSISTENTE", 5);
            await crearReporteVisible("+573001111111", "CLASIFICADO", "CONTACTO_INSISTENTE", 35);

            const resultado = await construirTimelineCirculo(padre.id);
            expect(resultado).toHaveLength(1);
            expect(resultado[0].identificador).toBe("+573001111111");
        });

        it("incluye eventos REPORTE y EXPEDIENTE de identificadores activos", async () => {
            const padre = await crearUsuario("PARENT");
            await crearContactoConIdentificador(padre.id, "Hija", "+573002222222");

            await crearReporteVisible("+573002222222", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);
            await crearExpedienteConEvento(padre.id, "+573002222222", "ROJO", 1, "Expediente abierto automáticamente");

            const resultado = await construirTimelineCirculo(padre.id);

            expect(resultado).toHaveLength(2);
            expect(resultado.some((e) => e.tipo === "REPORTE")).toBe(true);
            expect(resultado.some((e) => e.tipo === "EXPEDIENTE")).toBe(true);
        });

        it("ordena por fecha descendente y severity descendente en empate", async () => {
            const padre = await crearUsuario("PARENT");
            await crearContactoConIdentificador(padre.id, "Contacto", "+573003333333");

            // Misma fecha (hoy): ROJO debe ir primero.
            await crearReporteVisible("+573003333333", "CLASIFICADO", "CONTACTO_INSISTENTE", 0);
            await crearReporteVisible("+573003333333", "CLASIFICADO", "SOLICITUD_MATERIAL", 0);

            const resultado = await construirTimelineCirculo(padre.id);

            expect(resultado[0].severity).toBe("ROJO");
            expect(resultado[1].severity).toBe("AMARILLO");
        });

        it("no expone eventos de otro padre", async () => {
            const padre = await crearUsuario("PARENT");
            const otro = await crearUsuario("PARENT");
            await crearContactoConIdentificador(otro.id, "Otro", "+573004444444");
            await crearReporteVisible("+573004444444", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);

            const resultado = await construirTimelineCirculo(padre.id);
            expect(resultado).toHaveLength(0);
        });

        it("no incluye identificadores inactivos", async () => {
            const padre = await crearUsuario("PARENT");
            const contacto = await prisma.contactoConfianza.create({
                data: {
                    usuarioId: padre.id,
                    etiqueta: "Inactivo",
                    activo: true,
                    identificadores: {
                        create: {
                            valor: "+573005555555",
                            tipo: "telefono",
                            activo: false,
                        },
                    },
                },
            });
            await crearReporteVisible("+573005555555", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);

            const resultado = await construirTimelineCirculo(padre.id);
            expect(resultado).toHaveLength(0);
            expect(contacto.etiqueta).toBe("Inactivo");
        });

        it("expone expedienteId en eventos de reporte cuando existe expediente", async () => {
            const padre = await crearUsuario("PARENT");
            await crearContactoConIdentificador(padre.id, "Hijo", "+573006666666");
            const reporte = await crearReporteVisible("+573006666666", "CLASIFICADO", "CONTACTO_INSISTENTE", 2);
            const { expediente } = await crearExpedienteConEvento(
                padre.id,
                "+573006666666",
                "AMARILLO",
                1,
                "Seguimiento del reporte"
            );

            const resultado = await construirTimelineCirculo(padre.id);
            const eventoReporte = resultado.find((e) => e.tipo === "REPORTE" && e.id === `reporte-${reporte.id}`);

            expect(eventoReporte).toBeDefined();
            expect(eventoReporte?.expedienteId).toBe(expediente.id);
        });
    });
});
