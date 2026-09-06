/**
 * SPEC-308 (A-50): tests del flujo de notificación enriquecida del Círculo de
 * Confianza (`notificarCambioCirculoSiCorresponde`).
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
        where: {
            nombre_paisId: {
                nombre: "Bogotá",
                paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id,
            },
        },
    });
    const reporte = await prisma.reporte.create({
        data: {
            // SPEC-325: prod normaliza al crear el reporte; el helper lo replica.
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

describe("notificarCambioCirculoSiCorresponde (SPEC-308)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPaisCiudad();
        await crearCirculoParams();
        vi.mocked(enviarAlertaCirculoConfianzaEnriquecida).mockClear();
    });

    it("envía alerta enriquecida con el contexto correcto", async () => {
        const usuario = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await agregarContacto(usuario.id, {
            etiqueta: "sobrina Luisa",
            identificadores: [{ valor: "+57300ENRICH", plataformaId: plataforma!.id }],
        });
        const reporte = await crearReporte("+57300ENRICH", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

        await notificarCambioCirculoSiCorresponde(reporte.id);

        expect(enviarAlertaCirculoConfianzaEnriquecida).toHaveBeenCalledOnce();
        const args = vi.mocked(enviarAlertaCirculoConfianzaEnriquecida).mock.calls[0][0];
        expect(args.destinatario.email).toBe(usuario.email);
        expect(args.destinatario.usuarioId).toBe(usuario.id);
        expect(args.nombreContacto).toBe("sobrina Luisa");
        // SPEC-325: el identificador viaja normalizado (el sistema lo guarda canónico)
        expect(args.identificador).toBe("+57300enrich");
        expect(args.plataforma).toBe("WhatsApp");
        expect(args.categoria).toBe("OFRECIMIENTO_REGALOS");
        expect(args.totalReportes).toBe(1);
        expect(args.reporteId).toBe(reporte.id);
    });

    it("no envía alerta cuando el reporte está en estado no visible", async () => {
        const usuario = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await agregarContacto(usuario.id, {
            identificadores: [{ valor: "+57300HIDDEN", plataformaId: plataforma!.id }],
        });
        const reporte = await crearReporte("+57300HIDDEN", plataforma!.id, "PENDIENTE", "OFRECIMIENTO_REGALOS");

        await notificarCambioCirculoSiCorresponde(reporte.id);

        expect(enviarAlertaCirculoConfianzaEnriquecida).not.toHaveBeenCalled();
    });

    it("SPEC-544: en cooldown suprime el EMAIL pero manda el IN_APP (en la app se ve siempre)", async () => {
        const usuario = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await agregarContacto(usuario.id, {
            identificadores: [{ valor: "+57300COOL2", plataformaId: plataforma!.id }],
        });
        // El contacto ya recibió correo hace un instante → dentro de la ventana.
        await prisma.contactoConfianza.updateMany({
            where: { usuarioId: usuario.id },
            data: { ultimaNotificacionEmailEn: new Date(Date.now() - 1000) },
        });
        const reporte = await crearReporte("+57300COOL2", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

        await notificarCambioCirculoSiCorresponde(reporte.id);

        // El aviso SÍ sale (IN_APP no tiene cooldown), pero sin el canal EMAIL.
        expect(enviarAlertaCirculoConfianzaEnriquecida).toHaveBeenCalledOnce();
        const args = vi.mocked(enviarAlertaCirculoConfianzaEnriquecida).mock.calls[0][0];
        expect(args.canales).toEqual(["IN_APP"]);
    });
});
