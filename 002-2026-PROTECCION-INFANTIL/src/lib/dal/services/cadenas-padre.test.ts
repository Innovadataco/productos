/**
 * A-70 · F11 — "Mis reportes" debe mostrar el resultado REAL del motor.
 *
 * El foco de estos asserts es lo que agregó F11 (`analisisIa` + `ficha`) y,
 * sobre todo, el candado que lo hace honesto: mientras el reporte no está
 * clasificado NO se manda nada que la UI pueda pintar como si fuera análisis.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import type { EstadoReporte } from "@prisma/client";
import { listarCadenasPadre } from "./cadenas-padre";

async function crearReporte(
    usuarioId: string,
    plataformaId: string,
    datos: {
        estado: EstadoReporte;
        identificador?: string;
        pais?: string;
        ciudad?: string;
        edadVictima?: number;
    }
) {
    return crearReporteFixture(prisma, {
        data: {
            usuarioId,
            plataformaId,
            identificador: datos.identificador ?? "sospechoso_01",
            texto: "Relato de prueba con suficiente contenido para el reporte.",
            fechaIncidente: new Date("2026-08-30T21:00:00Z"),
            estado: datos.estado,
            esAnonimo: false,
            pais: datos.pais ?? "Colombia",
            ciudad: datos.ciudad ?? "Bogotá",
            ...(datos.edadVictima !== undefined ? { edadVictima: datos.edadVictima } : {}),
        },
    });
}

describe("listarCadenasPadre · análisis real (A-70 · F11)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("entrega la clasificación del motor con su confianza y sus secundarias", async () => {
        const padre = await crearUsuario("PARENT", `padre-f11-a-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const reporte = await crearReporte(padre.id, plataforma.id, {
            estado: "CLASIFICADO",
            edadVictima: 12,
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.91,
                categoriasSecundarias: [{ categoria: "SOLICITUD_MATERIAL", confianza: 0.42 }],
                modeloUsado: "llama3.1:8b",
                latenciaMs: 1200,
            },
        });

        const [cadena] = await listarCadenasPadre(padre.id);
        const analisis = cadena.eventos[0].analisisIa;

        expect(analisis).not.toBeNull();
        expect(analisis?.confianza).toBe(0.91);
        expect(analisis?.modeloUsado).toBe("llama3.1:8b");
        expect(analisis?.esManual).toBe(false);
        expect(analisis?.secundarias).toEqual([
            { categoriaLabel: expect.any(String), confianza: 0.42 },
        ]);
        // La ficha que va debajo del análisis (F11).
        expect(cadena.eventos[0].ficha).toEqual({
            pais: "Colombia",
            ciudad: "Bogotá",
            edadVictima: 12,
            origen: "padre",
        });
    });

    it("marca como manual lo que clasificó una persona (SPEC-359 · B2)", async () => {
        const padre = await crearUsuario("PARENT", `padre-f11-b-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const reporte = await crearReporte(padre.id, plataforma.id, { estado: "CORREGIDO" });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 1,
                modeloUsado: "manual:operador",
                latenciaMs: 0,
            },
        });

        const [cadena] = await listarCadenasPadre(padre.id);
        expect(cadena.eventos[0].analisisIa?.esManual).toBe(true);
    });

    it("sin clasificación no manda análisis: la UI dice la verdad, no una plantilla", async () => {
        const padre = await crearUsuario("PARENT", `padre-f11-c-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        await crearReporte(padre.id, plataforma.id, { estado: "REVISION_MANUAL" });

        const [cadena] = await listarCadenasPadre(padre.id);
        expect(cadena.eventos[0].analisisIa).toBeNull();
        expect(cadena.eventos[0].categoriaLabel).toBeNull();
        expect(cadena.eventos[0].explicacion).toBeNull();
    });

    it("una fila con secundarias de forma inesperada no tumba la pantalla", async () => {
        const padre = await crearUsuario("PARENT", `padre-f11-d-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const reporte = await crearReporte(padre.id, plataforma.id, { estado: "CLASIFICADO" });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.8,
                // Forma vieja/ajena: ni array de objetos ni los campos esperados.
                categoriasSecundarias: { algo: "raro" },
                modeloUsado: "llama3.1:8b",
                latenciaMs: 1200,
            },
        });

        const [cadena] = await listarCadenasPadre(padre.id);
        expect(cadena.eventos[0].analisisIa?.secundarias).toEqual([]);
        expect(cadena.eventos[0].analisisIa?.confianza).toBe(0.8);
    });

    it("el texto del relato JAMÁS viaja en el listado (research R-4)", async () => {
        const padre = await crearUsuario("PARENT", `padre-f11-e-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        await crearReporte(padre.id, plataforma.id, { estado: "CLASIFICADO" });

        const cadenas = await listarCadenasPadre(padre.id);
        expect(JSON.stringify(cadenas)).not.toContain("Relato de prueba");
        expect(cadenas[0].eventos[0].textoDisponible).toBe(true);
    });

    it("SPEC-591: el evento expone el nombre de la ficha a la que va dirigido (y null sin vínculo)", async () => {
        const padre = await crearUsuario("PARENT", `padre-591-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const hijo = await prisma.hijo.create({
            data: { usuarioId: padre.id, nombre: "Valeria", apellidos: "Pérez", estado: "activo" },
        });
        await crearReporte(padre.id, plataforma.id, { estado: "CLASIFICADO", identificador: "con_hijo_01" });
        await prisma.reporte.updateMany({
            where: { usuarioId: padre.id, identificador: "con_hijo_01" },
            data: { hijoId: hijo.id },
        });
        await crearReporte(padre.id, plataforma.id, { estado: "CLASIFICADO", identificador: "sin_hijo_01" });

        const cadenas = await listarCadenasPadre(padre.id);
        const conHijo = cadenas.find((c) => c.identificador === "con_hijo_01");
        const sinHijo = cadenas.find((c) => c.identificador === "sin_hijo_01");
        expect(conHijo?.eventos[0].hijoNombre).toBe("Valeria Pérez");
        expect(sinHijo?.eventos[0].hijoNombre).toBeNull();
    });
});
