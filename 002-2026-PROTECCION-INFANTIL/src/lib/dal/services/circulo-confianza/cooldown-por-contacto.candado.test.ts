/**
 * SPEC-544 (I-332) · CANDADO de conducta — mutación en las DOS direcciones.
 *
 * El cooldown de la alerta del Círculo de Confianza es POR CONTACTO vigilado (no por
 * usuario) y solo aplica al canal EMAIL. El canal IN_APP se ve SIEMPRE.
 *
 * Muere en los dos sentidos:
 *  (A) DOS contactos distintos del mismo padre, atacados dentro de la misma ventana:
 *      salen DOS correos (uno por contacto). Si el cooldown volviera a ser por
 *      usuario, el segundo contacto perdería su EMAIL → rojo.
 *  (B) EL MISMO contacto atacado dos veces en la ventana: UN solo correo, pero
 *      DOS avisos en la app. Si el cooldown suprimiera también IN_APP → rojo; si el
 *      EMAIL no respetara el cooldown por contacto → rojo (saldrían dos correos).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { notificarCambioCirculoSiCorresponde } from "./notificaciones";
import { agregarContacto } from "./index";
import { enviarAlertaCirculoConfianzaEnriquecida } from "@/lib/email";
import { crearUsuario, crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

vi.mock("@/lib/email", () => ({
    enviarAlertaCirculoConfianzaEnriquecida: vi.fn().mockResolvedValue(undefined),
}));

async function crearCirculoParams() {
    await prisma.parametroSistema.createMany({
        data: [
            { clave: "circulo.max_contactos", valor: "20", tipo: "INTEGER", categoria: "SECURITY", esPublico: false, descripcion: "" },
            { clave: "circulo.umbral_agregacion", valor: '{"contactosConReportes":2,"totalReportes":3}', tipo: "JSON", categoria: "SECURITY", esPublico: false, descripcion: "" },
            { clave: "circulo.notificaciones.enabled", valor: "true", tipo: "BOOLEAN", categoria: "EMAIL", esPublico: false, descripcion: "" },
            // Ventana amplia: los dos reportes de cada escenario caen dentro.
            { clave: "circulo.notificaciones.cooldown_horas", valor: "24", tipo: "INTEGER", categoria: "EMAIL", esPublico: false, descripcion: "" },
        ],
    });
}

async function crearReporte(identificador: string, plataformaId: string, estado: EstadoReporte, categoria: CategoriaConducta) {
    const pais = await prisma.pais.findUnique({ where: { codigo: "CO" } });
    const ciudad = await prisma.ciudad.findUnique({ where: { nombre_paisId: { nombre: "Bogotá", paisId: pais!.id } } });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: normalizarIdentificador(identificador),
            plataformaId,
            texto: "Texto de prueba",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId ?? null,
            ciudadId: ciudad?.id ?? null,
            esAnonimo: false,
            estado,
        },
    });
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria, confianza: 0.8, contienePii: false, piiDetectada: [], modeloUsado: "ornith:9b", latenciaMs: 1000 },
    });
    return reporte;
}

/** Canales de todas las llamadas al alertador, aplanados y ordenados por llamada. */
function canalesPorLlamada(): string[][] {
    return vi.mocked(enviarAlertaCirculoConfianzaEnriquecida).mock.calls.map((c) => c[0].canales ?? []);
}

describe("SPEC-544 · cooldown por contacto + IN_APP exento", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPaisCiudad();
        await crearCirculoParams();
        vi.mocked(enviarAlertaCirculoConfianzaEnriquecida).mockClear();
    });

    it("(A) dos contactos distintos atacados en la misma ventana → DOS correos (uno por contacto)", async () => {
        const padre = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await agregarContacto(padre.id, { etiqueta: "hija", identificadores: [{ valor: "+57300AAA", plataformaId: plataforma!.id }] });
        await agregarContacto(padre.id, { etiqueta: "sobrino", identificadores: [{ valor: "+57300BBB", plataformaId: plataforma!.id }] });

        const rA = await crearReporte("+57300AAA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
        const rB = await crearReporte("+57300BBB", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
        await notificarCambioCirculoSiCorresponde(rA.id);
        await notificarCambioCirculoSiCorresponde(rB.id);

        const llamadas = canalesPorLlamada();
        expect(llamadas.length).toBe(2);
        // Cada contacto recibe su EMAIL: el cooldown de uno no silencia al otro.
        expect(llamadas.filter((c) => c.includes("EMAIL")).length).toBe(2);
    });

    it("(B) el mismo contacto atacado dos veces en la ventana → UN correo, DOS avisos en la app", async () => {
        const padre = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await agregarContacto(padre.id, { etiqueta: "hija", identificadores: [{ valor: "+57300AAA", plataformaId: plataforma!.id }] });

        const r1 = await crearReporte("+57300AAA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
        await notificarCambioCirculoSiCorresponde(r1.id);
        const r2 = await crearReporte("+57300AAA", plataforma!.id, "CLASIFICADO", "CONTACTO_INSISTENTE");
        await notificarCambioCirculoSiCorresponde(r2.id);

        const llamadas = canalesPorLlamada();
        expect(llamadas.length).toBe(2);
        // EMAIL una sola vez (cooldown por contacto); IN_APP en las dos (sin cooldown).
        expect(llamadas.filter((c) => c.includes("EMAIL")).length).toBe(1);
        expect(llamadas.filter((c) => c.includes("IN_APP")).length).toBe(2);
    });
});
