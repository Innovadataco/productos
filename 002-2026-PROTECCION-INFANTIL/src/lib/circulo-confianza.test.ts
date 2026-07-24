import { describe, it, expect, beforeEach, vi } from "vitest";
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
import { enviarAlertaCirculoConfianza } from "@/lib/email";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

vi.mock("@/lib/email", () => ({
    enviarAlertaCirculoConfianza: vi.fn().mockResolvedValue(undefined),
}));

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
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPlataforma("minecraft", "Minecraft", "juego");
        await crearPaisCiudad();
        await crearCirculoParams();
    });

    describe("agregarContacto", () => {
        it("crea un contacto activo con múltiples identificadores", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                etiqueta: "tío Carlos",
                identificadores: [{ valor: "+57300111111", tipo: "telefono", plataformaId: plataforma!.id }],
            });
            expect(contacto.identificadores).toHaveLength(1);
            expect(contacto.identificadores[0].valor).toBe("+57300111111");
            expect(contacto.activo).toBe(true);
            expect(await contarContactosActivos(usuario.id)).toBe(1);
        });

        it("falla si no se envía identificadores", async () => {
            const usuario = await crearUsuario("PARENT");
            await expect(agregarContacto(usuario.id, { etiqueta: "sin identificadores", identificadores: [] })).rejects.toThrow(
                "al menos un identificador"
            );
        });

        it("falla si se alcanza el tope de contactos activos", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await prisma.parametroSistema.update({
                where: { clave: "circulo.max_contactos" },
                data: { valor: "1" },
            });
            await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300111111", plataformaId: plataforma!.id }] });
            await expect(
                agregarContacto(usuario.id, { identificadores: [{ valor: "+57300222222", plataformaId: plataforma!.id }] })
            ).rejects.toThrow("Límite");
        });

        it("falla si hay identificador duplicado dentro del contacto", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await expect(
                agregarContacto(usuario.id, {
                    identificadores: [
                        { valor: "+57300111111", plataformaId: plataforma!.id },
                        { valor: "+57300111111", plataformaId: plataforma!.id },
                    ],
                })
            ).rejects.toThrow("duplicado");
        });
    });

    describe("determinarEstadoContacto", () => {
        it("devuelve sin reportes", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300SIN", plataformaId: plataforma!.id }],
            });
            const { estado } = await determinarEstadoContacto(contacto.id);
            expect(estado).toBe("sinReportes");
        });

        it("detecta reporte en revisión", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300REV", plataformaId: plataforma!.id }],
            });
            await crearReporte("+57300REV", plataforma!.id, "REVISION_MANUAL");
            const { estado } = await determinarEstadoContacto(contacto.id);
            expect(estado).toBe("enRevision");
        });

        it("spec 093-US1: SPAM/OTRO no cambia el estado del contacto (predicado de aprobación)", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300SPAMC", plataformaId: plataforma!.id }],
            });
            await crearReporte("+57300SPAMC", plataforma!.id, "CLASIFICADO", "SPAM");
            await crearReporte("+57300SPAMC", plataforma!.id, "CLASIFICADO", "OTRO");
            const { estado, totalReportes } = await determinarEstadoContacto(contacto.id);
            expect(estado).toBe("sinReportes");
            expect(totalReportes).toBe(0);
        });

        it("detecta reporte clasificado", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300CLAS", plataformaId: plataforma!.id }],
            });
            await crearReporte("+57300CLAS", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            const { estado } = await determinarEstadoContacto(contacto.id);
            expect(estado).toBe("clasificado");
        });

        it("ignora reportes eliminados", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300BAJA", plataformaId: plataforma!.id }],
            });
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
            const { estado } = await determinarEstadoContacto(contacto.id);
            expect(estado).toBe("sinReportes");
        });
    });

    describe("listarContactos", () => {
        it("devuelve resumen correcto", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300A", plataformaId: plataforma!.id }] });
            const c2 = await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300B", plataformaId: plataforma!.id }] });
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            const { resumen } = await listarContactos(usuario.id);
            expect(resumen.activos).toBe(2);
            expect(resumen.clasificado).toBe(1);
            expect(resumen.sinReportes).toBe(1);
            expect((await listarContactos(usuario.id)).contactos.find((c) => c.id === c2.id)?.totalReportes).toBe(1);
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
            await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300B", plataformaId: plataforma!.id }] });
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            const resultado = await obtenerVistaAgregada(usuario.id);
            expect(resultado.insuficiente).toBe(true);
        });

        it("devuelve agregados si alcanza umbral", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300A", plataformaId: plataforma!.id }] });
            await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300B", plataformaId: plataforma!.id }] });
            await crearReporte("+57300A", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "EXTORSION");
            await crearReporte("+57300B", plataforma!.id, "CLASIFICADO", "EXTORSION");

            const resultado = await obtenerVistaAgregada(usuario.id);
            expect(resultado.insuficiente).toBe(false);
            const agregado = resultado as { totalReportes: number; porCategoria: { categoria: string; total: number }[] };
            expect(agregado.totalReportes).toBe(3);
            expect(agregado.porCategoria.length).toBe(2);
        });
    });

    describe("actualizarContacto", () => {
        it("inhabilita un contacto y sus identificadores", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300A", plataformaId: plataforma!.id }],
            });
            const actualizado = await actualizarContacto(contacto.id, usuario.id, { activo: false });
            expect(actualizado?.activo).toBe(false);
            expect(actualizado?.identificadores).toHaveLength(0);
            expect(await contarContactosActivos(usuario.id)).toBe(0);
        });

        it("actualiza la lista de identificadores", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const contacto = await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300A", plataformaId: plataforma!.id }],
            });
            const actualizado = await actualizarContacto(contacto.id, usuario.id, {
                identificadores: [
                    { id: contacto.identificadores[0].id, valor: "+57300A", plataformaId: plataforma!.id },
                    { valor: "+57300B", plataformaId: plataforma!.id },
                ],
            });
            expect(actualizado?.identificadores).toHaveLength(2);
        });
    });

    describe("obtenerDetalleContacto", () => {
        it("muestra la alerta en el identificador de Minecraft cuando el reporte está en esa plataforma", async () => {
            const usuario = await crearUsuario("PARENT");
            const whatsapp = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const minecraft = await prisma.plataforma.findUnique({ where: { clave: "minecraft" } });

            const contacto = await agregarContacto(usuario.id, {
                etiqueta: "Tío",
                identificadores: [
                    { valor: "+57300111111", tipo: "telefono", plataformaId: whatsapp!.id },
                    { valor: "tio_minecraft_2026", tipo: "nick", plataformaId: minecraft!.id },
                ],
            });

            await crearReporte("tio_minecraft_2026", minecraft!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            const detalle = await obtenerDetalleContacto(contacto.id, usuario.id);

            expect(detalle.estado).toBe("clasificado");
            expect(detalle.totalReportes).toBe(1);
            const idMinecraft = detalle.identificadores.find((i) => i.valor === "tio_minecraft_2026");
            const idWhatsapp = detalle.identificadores.find((i) => i.valor === "+57300111111");
            expect(idMinecraft).toBeDefined();
            expect(idMinecraft?.estado).toBe("clasificado");
            expect(idMinecraft?.totalReportes).toBe(1);
            expect(idWhatsapp).toBeDefined();
            expect(idWhatsapp?.estado).toBe("sinReportes");
            expect(idWhatsapp?.totalReportes).toBe(0);
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
        beforeEach(() => {
            vi.mocked(enviarAlertaCirculoConfianza).mockClear();
        });

        it("no falla si no hay contactos", async () => {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const reporte = await crearReporte("+57300X", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
            await expect(notificarCambioCirculoSiCorresponde(reporte.id)).resolves.not.toThrow();
            expect(enviarAlertaCirculoConfianza).not.toHaveBeenCalled();
        });

        it("envía email ciego y actualiza timestamp cuando un contacto activo tiene reportes visibles", async () => {
            const usuario = await crearUsuario("PARENT");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, {
                etiqueta: "contacto de prueba",
                identificadores: [{ valor: "+57300NOTIF", plataformaId: plataforma!.id }],
            });
            const reporte = await crearReporte("+57300NOTIF", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            await notificarCambioCirculoSiCorresponde(reporte.id);

            expect(enviarAlertaCirculoConfianza).toHaveBeenCalledOnce();
            const args = vi.mocked(enviarAlertaCirculoConfianza).mock.calls[0];
            expect(args[0]).toBe(usuario.email);
            expect(args[1]).toBe(1);

            const actualizado = await prisma.usuario.findUnique({
                where: { id: usuario.id },
                select: { ultimaNotificacionCirculoEn: true },
            });
            expect(actualizado?.ultimaNotificacionCirculoEn).not.toBeNull();
        });

        it("respeta el cooldown y no re-notifica dentro de la ventana", async () => {
            const usuario = await crearUsuario("PARENT");
            await prisma.usuario.update({
                where: { id: usuario.id },
                data: { ultimaNotificacionCirculoEn: new Date(Date.now() - 1000) },
            });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300COOL", plataformaId: plataforma!.id }],
            });
            const reporte = await crearReporte("+57300COOL", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            await notificarCambioCirculoSiCorresponde(reporte.id);

            expect(enviarAlertaCirculoConfianza).not.toHaveBeenCalled();
        });

        it("respeta la preferencia del usuario desactivada", async () => {
            const usuario = await crearUsuario("PARENT");
            await toggleNotificacionesCirculo(usuario.id, false);
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await agregarContacto(usuario.id, {
                identificadores: [{ valor: "+57300OFF", plataformaId: plataforma!.id }],
            });
            const reporte = await crearReporte("+57300OFF", plataforma!.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

            await notificarCambioCirculoSiCorresponde(reporte.id);

            expect(enviarAlertaCirculoConfianza).not.toHaveBeenCalled();
        });
    });
});
