/**
 * SPEC-605 (pantalla madre del EXPEDIENTE) — candados del DTO:
 *
 *  · el menor se resuelve desde `Reporte.hijoId` (o la ficha que vigila el
 *    identificador) y viaja en la cabecera;
 *  · la línea de tiempo MEZCLA propios («tú») y ajenos blindados (fecha ·
 *    ciudad · categoría · «N familias más», agrupados por día+categoría), en
 *    orden cronológico descendente, sin que JAMÁS viaje texto (propio ni
 *    ajeno — mismo blindaje que SPEC-543);
 *  · la tendencia se deriva de los reportes llegados en los últimos 7 días;
 *  · la lista se ordena por URGENCIA (alta → media → baja → sin clasificar,
 *    cerrados al final) con sus contadores propios/comunidad;
 *  · «Consultar estado»: EN_PROCESO con eventos en cola, PROCESADO al terminar.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import type { CategoriaConducta, EstadoExpediente, EstadoReporte, Prisma, Reporte } from "@prisma/client";
import {
    detalleExpedientePadre,
    estadoFrescoExpediente,
    listarExpedientesPadreConUrgencia,
} from "./expediente-detalle";

const TEXTO_PROPIO = "Relato-SECRETO-del-padre-que-jamas-viaja-en-el-DTO";
const TEXTO_AJENO = "Relato-SECRETO-de-otra-familia-que-jamas-viaja-en-el-DTO";

async function crearExpediente(
    padreUsuarioId: string,
    identificador: string,
    estado: EstadoExpediente = "ACTIVO"
) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId,
            identificadorReportado: identificador,
            fechaApertura: new Date("2026-09-01T12:00:00Z"),
            estado,
        },
    });
}

async function crearReporte(opts: {
    usuarioId: string | null;
    plataformaId: string;
    identificador: string;
    estado: EstadoReporte;
    esAnonimo: boolean;
    texto?: string;
    ciudad?: string;
    categoria?: CategoriaConducta;
    confianza?: number;
    secundarias?: unknown;
    modeloUsado?: string;
    fechaIncidente?: Date;
    creadoEn?: Date;
    hijoId?: string;
}): Promise<Reporte> {
    const r = await prisma.$transaction((tx) =>
        crearReporteConTexto(tx, {
            texto: opts.texto ?? (opts.esAnonimo ? TEXTO_AJENO : TEXTO_PROPIO),
            reporte: {
                usuarioId: opts.usuarioId,
                plataformaId: opts.plataformaId,
                identificador: opts.identificador,
                fechaIncidente: opts.fechaIncidente ?? new Date("2026-09-05T15:00:00Z"),
                estado: opts.estado,
                esAnonimo: opts.esAnonimo,
                pais: "Colombia",
                ciudad: opts.ciudad ?? "Bogotá",
                ...(opts.creadoEn ? { creadoEn: opts.creadoEn } : {}),
                ...(opts.hijoId ? { hijoId: opts.hijoId } : {}),
            },
        })
    );
    if (opts.categoria) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: r.id,
                categoria: opts.categoria,
                confianza: opts.confianza ?? 0.9,
                ...(opts.secundarias !== undefined
                    ? { categoriasSecundarias: opts.secundarias as Prisma.InputJsonValue }
                    : {}),
                modeloUsado: opts.modeloUsado ?? "ornith:9b",
                latenciaMs: 100,
            },
        });
    }
    return r;
}

describe("detalleExpedientePadre", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("resuelve el menor desde el hijoId del reporte propio, con la edad derivada del año", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-hijo-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const anio = new Date().getFullYear() - 7;
        const hijo = await prisma.hijo.create({
            data: { usuarioId: padre.id, nombre: "Valentina", apellidos: "Gómez", anioNacimiento: anio, estado: "activo" },
        });
        const expediente = await crearExpediente(padre.id, "user_pixel99");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "user_pixel99",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
            hijoId: hijo.id,
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle).not.toBeNull();
        expect(detalle?.hijo).toEqual({ nombre: "Valentina Gómez", edad: 7 });
        expect(detalle?.ficha.menor).toBe("Valentina Gómez");
    });

    it("cae a la ficha que vigila el identificador cuando ningún reporte trae hijoId", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-vigilado-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const hijo = await prisma.hijo.create({
            data: { usuarioId: padre.id, nombre: "Laura", apellidos: "Ruiz", estado: "activo" },
        });
        await prisma.identificadorHijo.create({
            data: { hijoId: hijo.id, valor: "@lau.gmz", activo: true },
        });
        const expediente = await crearExpediente(padre.id, "@lau.gmz");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "@lau.gmz",
            estado: "PENDIENTE",
            esAnonimo: false,
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle?.hijo).toEqual({ nombre: "Laura Ruiz", edad: null });
    });

    it("arma la línea de tiempo unificada: propios marcados y ajenos blindados agrupados por día y categoría, en orden descendente", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-tl-${Date.now()}@test.local`);
        const otroPadre = await crearUsuario("PARENT", `padre-605-tl-b-${Date.now()}@test.local`);
        const tercerPadre = await crearUsuario("PARENT", `padre-605-tl-c-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "depredador_605");

        const primero = await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "depredador_605",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
            fechaIncidente: new Date("2026-09-02T18:00:00Z"),
        });
        const reciente = await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "depredador_605",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
            fechaIncidente: new Date("2026-09-08T15:00:00Z"),
        });
        await crearReporte({
            usuarioId: otroPadre.id,
            plataformaId: plataforma.id,
            identificador: "depredador_605",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
            ciudad: "Montería",
            fechaIncidente: new Date("2026-09-08T10:00:00Z"),
        });
        // Dos familias más el mismo día con la MISMA categoría → UN solo evento agregado.
        await crearReporte({
            usuarioId: tercerPadre.id,
            plataformaId: plataforma.id,
            identificador: "depredador_605",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
            ciudad: "Bogotá",
            fechaIncidente: new Date("2026-09-06T21:00:00Z"),
        });
        await crearReporte({
            usuarioId: null,
            plataformaId: plataforma.id,
            identificador: "depredador_605",
            estado: "DUPLICADO",
            esAnonimo: true,
            categoria: "CONTACTO_INSISTENTE",
            ciudad: "Cali",
            fechaIncidente: new Date("2026-09-06T20:00:00Z"),
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);
        const timeline = detalle!.timeline;

        // 4 ítems: 2 propios + 1 ajeno suelto + 1 grupo de dos familias. Descendente.
        expect(timeline.length).toBe(4);
        expect(timeline[0].esPropio).toBe(true);
        expect(timeline[0].reporteId).toBe(reciente.id);
        expect(timeline[0].categoriaLabel).toBe("Solicitud de material");
        expect(timeline[1].esPropio).toBe(false);
        expect(timeline[1].ciudades).toEqual(["Montería"]);
        // El grupo del 06: dos familias (un padre + un anónimo), dos ciudades.
        const grupo = timeline[2];
        expect(grupo.esPropio).toBe(false);
        expect(grupo.familias).toBe(2);
        expect(grupo.ciudades).toEqual(["Bogotá", "Cali"]);
        expect(grupo.reporteId).toBeNull();
        // El primer reporte propio queda marcado como la apertura del expediente.
        const apertura = timeline[3];
        expect(apertura.esPropio).toBe(true);
        expect(apertura.esPrimero).toBe(true);
        expect(apertura.reporteId).toBe(primero.id);

        // Blindaje estructural: ni el texto propio ni el ajeno viajan en el DTO.
        const payload = JSON.stringify(detalle);
        expect(payload).not.toContain(TEXTO_PROPIO);
        expect(payload).not.toContain(TEXTO_AJENO);
        // Pero la ciudad del anónimo SÍ está (prueba de que no se ocultó).
        expect(payload).toContain("Cali");
    });

    it("un ajeno clasificado SPAM u OTRO no entra a la línea de tiempo (ruido, no señal)", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-spam-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_spam");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_spam",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
        });
        await crearReporte({
            usuarioId: null,
            plataformaId: plataforma.id,
            identificador: "cuenta_spam",
            estado: "CLASIFICADO",
            esAnonimo: true,
            categoria: "SPAM",
            texto: "ruido spam",
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);
        expect(detalle!.timeline.length).toBe(1);
        expect(detalle!.timeline[0].esPropio).toBe(true);
        expect(detalle!.ficha.familiasQueReportan).toBe(1);
    });

    it("deriva la tendencia de los reportes llegados en los últimos 7 días", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-tend-${Date.now()}@test.local`);
        const otroPadre = await crearUsuario("PARENT", `padre-605-tend-b-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_tendencia");

        // 2 llegados esta semana (creadoEn = ahora por defecto) y 1 la anterior.
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_tendencia",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
        });
        await crearReporte({
            usuarioId: otroPadre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_tendencia",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
        });
        await crearReporte({
            usuarioId: otroPadre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_tendencia",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
            creadoEn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle?.tendencia.direccion).toBe("subiendo");
        expect(detalle?.tendencia.nuevosUltimos7).toBe(2);
        expect(detalle?.tendencia.previos7).toBe(1);
        expect(detalle?.tendencia.texto).toContain("2 reportes nuevos");
    });

    it("sin reportes nuevos en 7 días la tendencia queda estable y lo dice", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-tend2-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_quietecita");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_quietecita",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
            creadoEn: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle?.tendencia.direccion).toBe("estable");
        expect(detalle?.tendencia.texto).toContain("Sin reportes nuevos");
    });

    it("el análisis expone la dominante con su confianza y marca lo revisado por una persona", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-manual-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_manual");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_manual",
            estado: "CORREGIDO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
            confianza: 0.87,
            secundarias: [{ categoria: "EXTORSION", confianza: 0.4 }],
            modeloUsado: "manual:operador",
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle?.analisis?.clasificacionDominante).toBe("Solicitud de material");
        expect(detalle?.analisis?.confianza).toBe(0.87);
        expect(detalle?.analisis?.revisadoPorPersona).toBe(true);
        expect(detalle?.analisis?.tambienConsidero).toEqual(["Extorsión"]);
        // Semáforo en lenguaje sencillo, con presunción de inocencia.
        expect(detalle?.semaforo.nivel).toBe("alta");
        expect(detalle?.semaforo.titulo).toBe("Nivel alto");
        expect(detalle?.semaforo.explicacion).toMatch(/reportes? registrados?/);
        expect(detalle?.semaforo.explicacion).not.toContain("peligros");
    });

    it("si la dominante viene solo de la comunidad, la confianza es null (nunca un 0 % falso)", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-comun-${Date.now()}@test.local`);
        const otroPadre = await crearUsuario("PARENT", `padre-605-comun-b-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_comunitaria");
        // El propio sigue en cola (sin clasificar); la dominante la pone el ajeno.
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_comunitaria",
            estado: "PENDIENTE",
            esAnonimo: false,
        });
        await crearReporte({
            usuarioId: otroPadre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_comunitaria",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
        });

        const detalle = await detalleExpedientePadre(expediente.id, padre.id);

        expect(detalle?.analisis?.clasificacionDominante).toBe("Solicitud de material");
        expect(detalle?.analisis?.confianza).toBeNull();
        expect(detalle?.analisis?.revisadoPorPersona).toBe(false);
        expect(detalle?.semaforo.nivel).toBe("alta");
    });

    it("estado de reportes: EN_PROCESO con eventos en cola, PROCESADO al terminar", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-estado-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const expediente = await crearExpediente(padre.id, "cuenta_estado");
        const reporte = await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_estado",
            estado: "PENDIENTE",
            esAnonimo: false,
        });

        let fresco = await estadoFrescoExpediente(expediente.id, padre.id);
        expect(fresco?.estadoReportes).toBe("EN_PROCESO");
        expect(fresco?.procesando).toBe(1);

        await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "CLASIFICADO" } });
        fresco = await estadoFrescoExpediente(expediente.id, padre.id);
        expect(fresco?.estadoReportes).toBe("PROCESADO");
        expect(fresco?.procesando).toBe(0);

        // Un expediente ajeno no se expone (titularidad en el where).
        const otro = await crearUsuario("PARENT", `padre-605-estado-b-${Date.now()}@test.local`);
        expect(await estadoFrescoExpediente(expediente.id, otro.id)).toBeNull();
    });
});

describe("listarExpedientesPadreConUrgencia", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("ordena por urgencia (alta → baja → sin clasificar) y manda los cerrados al final, con los contadores propios/comunidad", async () => {
        const padre = await crearUsuario("PARENT", `padre-605-lista-${Date.now()}@test.local`);
        const otroPadre = await crearUsuario("PARENT", `padre-605-lista-b-${Date.now()}@test.local`);
        const tercerPadre = await crearUsuario("PARENT", `padre-605-lista-c-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        const hijo = await prisma.hijo.create({
            data: { usuarioId: padre.id, nombre: "Nicolás", apellidos: "Prada", estado: "activo" },
        });

        // Sin clasificar (evento en cola).
        await crearExpediente(padre.id, "cuenta_sin_clasificar");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_sin_clasificar",
            estado: "PENDIENTE",
            esAnonimo: false,
        });
        // Baja (CONTACTO_INSISTENTE = 30).
        await crearExpediente(padre.id, "cuenta_baja");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_baja",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "CONTACTO_INSISTENTE",
        });
        // Alta (SOLICITUD_MATERIAL = 80) con comunidad: 2 padres más + 1 anónimo.
        const expAlta = await crearExpediente(padre.id, "cuenta_alta");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_alta",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
            hijoId: hijo.id,
        });
        await crearReporte({
            usuarioId: otroPadre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_alta",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
        });
        await crearReporte({
            usuarioId: tercerPadre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_alta",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "SOLICITUD_MATERIAL",
        });
        await crearReporte({
            usuarioId: null,
            plataformaId: plataforma.id,
            identificador: "cuenta_alta",
            estado: "DUPLICADO",
            esAnonimo: true,
            categoria: "SOLICITUD_MATERIAL",
        });
        // Cerrado con severidad media: va al final aunque supere a baja/sin_clasificar.
        await crearExpediente(padre.id, "cuenta_cerrada", "CERRADO");
        await crearReporte({
            usuarioId: padre.id,
            plataformaId: plataforma.id,
            identificador: "cuenta_cerrada",
            estado: "CLASIFICADO",
            esAnonimo: false,
            categoria: "OFRECIMIENTO_REGALOS",
        });

        const items = await listarExpedientesPadreConUrgencia(padre.id);

        expect(items.map((i) => i.identificador)).toEqual([
            "cuenta_alta",
            "cuenta_baja",
            "cuenta_sin_clasificar",
            "cuenta_cerrada",
        ]);
        expect(items.map((i) => i.urgencia)).toEqual(["alta", "baja", "sin_clasificar", "media"]);

        const alta = items[0];
        expect(alta.expedienteId).toBe(expAlta.id);
        expect(alta.codigo).toMatch(/^EXP-[A-Z0-9]{6}$/);
        expect(alta.clasificacionDominante).toBe("Solicitud de material");
        expect(alta.eventosTuyos).toBe(1);
        // 2 padres distintos + 1 anónimo = 3 familias más; el texto jamás viaja.
        expect(alta.otrasFamilias).toBe(3);
        expect(alta.totalReportes).toBe(4);
        expect(alta.hijo?.nombre).toBe("Nicolás Prada");
        expect(JSON.stringify(items)).not.toContain(TEXTO_AJENO);
    });
});
