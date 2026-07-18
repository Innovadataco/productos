import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import {
    contarContactosActivos,
    agregarContacto,
    actualizarContacto,
    listarContactos,
    obtenerDetalleContacto,
    obtenerVistaAgregada,
    determinarEstadoContacto,
    obtenerPreferenciasCirculo,
    toggleNotificacionesCirculo,
    notificarCambioCirculoSiCorresponde,
} from "./circulo-confianza";
import {
    crearUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "./reporte-test-utils";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

async function crearCirculoParams() {
    await prisma.parametroSistema.createMany({
        data: [
            {
                clave: "circulo.max_contactos",
                valor: "20",
                tipo: "INTEGER",
                categoria: "SECURITY",
                esPublico: false,
                descripcion: "",
            },
            {
                clave: "circulo.umbral_agregacion",
                valor: '{"contactosConReportes":2,"totalReportes":3}',
                tipo: "JSON",
                categoria: "SECURITY",
                esPublico: false,
                descripcion: "",
            },
            {
                clave: "circulo.notificaciones.enabled",
                valor: "true",
                tipo: "BOOLEAN",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
            {
                clave: "circulo.notificaciones.cooldown_horas",
                valor: "24",
                tipo: "INTEGER",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
        ],
    });
}

async function crearReporte(
    identificador: string,
    plataformaId: string,
    estado: EstadoReporte,
    categoria?: CategoriaConducta
) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId,
            ciudadId: ciudad?.id,
            esAnonimo: false,
            estado,
        },
    });
    if (categoria) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.8,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }
    return reporte;
}

describe("circulo-confianza", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearCirculoParams();
    });

    describe("agregarContacto", () => {
        it("crea un contacto activo", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificador: "+57300111111",
                plataformaId: plataforma!.id,
                etiqueta: "tío Carlos",
            });
            expect(contacto.identificador).toBe("+57300111111");
            expect(contacto.activo).toBe(true);
            expect(await contarContactosActivos(usuario.id)).toBe(1);
        });

        it("falla si se alcanza el tope de contactos activos", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await prisma.parametroSistema.update({
                where: { clave: "circulo.max_contactos" },
                data: { valor: "1" },
            });
            await agregarContacto(usuario.id, { identificador: "+57300111111", plataformaId: plataforma!.id });
            await expect(
                agregarContacto(usuario.id, { identificador: "+57300222222", plataformaId: plataforma!.id })
            ).rejects.toThrow("Límite");
        });

        it("falla si el contacto ya existe", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificador: "+57300111111", plataformaId: plataforma!.id });
            await expect(
                agregarContacto(usuario.id, { identificador: "+57300111111", plataformaId: plataforma!.id })
            ).rejects.toThrow("ya existe");
        });
    });

    describe("determinarEstadoContacto", () => {
        it("devuelve sin reportes", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const { estado } = await determinarEstadoContacto("+57300SIN", plataforma!.id);
            expect(estado).toBe("sinReportes");
        });

        it("detecta reporte en revisión", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearReporte("+57300REV", plataforma!.id, "REVISION_MANUAL");
            const { estado } = await determinarEstadoContacto("+57300REV", plataforma!.id);
            expect(estado).toBe("enRevision");
        });

        it("detecta reporte clasificado", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearReporte("+57300CLAS", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            const { estado } = await determinarEstadoContacto("+57300CLAS", plataforma!.id);
            expect(estado).toBe("clasificado");
        });

        it("ignora reportes eliminados", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await prisma.reporte.create({
                data: {
                    identificador: "+57300BAJA",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: false,
                    estado: "CLASIFICADO",
                    eliminado: true,
                },
            });
            const { estado } = await determinarEstadoContacto("+57300BAJA", plataforma!.id);
            expect(estado).toBe("sinReportes");
        });
    });

    describe("listarContactos", () => {
        it("devuelve resumen correcto", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificador: "+57300A", plataformaId: plataforma!.id });
            await agregarContacto(usuario.id, { identificador: "+57300B", plataformaId: plataforma!.id });
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            const { resumen } = await listarContactos(usuario.id);
            expect(resumen.activos).toBe(2);
            expect(resumen.clasificado).toBe(1);
            expect(resumen.sinReportes).toBe(1);
        });
    });

    describe("obtenerVistaAgregada", () => {
        it("devuelve insuficiente si no hay contactos", async () => {
            const usuario = await crearUsuario("PARENT");
            const resultado = await obtenerVistaAgregada(usuario.id);
            expect(resultado.insuficiente).toBe(true);
        });

        it("devuelve insuficiente si no alcanza umbral", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificador: "+57300B", plataformaId: plataforma!.id });
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            const resultado = await obtenerVistaAgregada(usuario.id);
            expect(resultado.insuficiente).toBe(true);
        });

        it("devuelve agregados si alcanza umbral", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificador: "+57300A", plataformaId: plataforma!.id });
            await agregarContacto(usuario.id, { identificador: "+57300B", plataformaId: plataforma!.id });
            await crearReporte("+57300A", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "EXTORSION");

            const resultado = await obtenerVistaAgregada(usuario.id);
            expect(resultado.insuficiente).toBe(false);
            const agregado = resultado as { totalReportes: number; porCategoria: { categoria: string; total: number }[] };
            expect(agregado.totalReportes).toBe(2);
            expect(agregado.porCategoria.length).toBe(2);
        });
    });

    describe("actualizarContacto", () => {
        it("inhabilita un contacto", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, { identificador: "+57300A", plataformaId: plataforma!.id });
            const actualizado = await actualizarContacto(contacto.id, usuario.id, { activo: false });
            expect(actualizado.activo).toBe(false);
            expect(await contarContactosActivos(usuario.id)).toBe(0);
        });
    });

    describe("preferencias", () => {
        it("toggle de notificaciones", async () => {
            const usuario = await crearUsuario("PARENT");
            const prefs = await obtenerPreferenciasCirculo(usuario.id);
            expect(prefs.notificacionesCirculo).toBe(true);

            await toggleNotificacionesCirculo(usuario.id, false);
            const actualizadas = await obtenerPreferenciasCirculo(usuario.id);
            expect(actualizadas.notificacionesCirculo).toBe(false);
        });
    });

    describe("notificarCambioCirculoSiCorresponde", () => {
        it("no falla si no hay contactos", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const reporte = await crearReporte("+57300X", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            await expect(notificarCambioCirculoSiCorresponde(reporte.id)).resolves.not.toThrow();
        });
    });
});
