import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    notificarColegioSiCorresponde,
    listarAlertasColegio,
    cambiarEstadoAlerta,
} from "./alertas";
import {
    crearParametrosReportes,
    crearPlataforma,
    crearColegioConAdmin,
    crearCurso,
    crearAlumno,
    crearIdentificadorAlumno,
} from "@/lib/reporte-test-utils";
import { enviarAlertaColegio } from "@/lib/email";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";

vi.mock("@/lib/email", () => ({
    enviarAlertaColegio: vi.fn().mockResolvedValue(undefined),
}));

async function crearReporte(
    identificador: string,
    plataformaId: string,
    estado: EstadoReporte,
    categoria?: CategoriaConducta,
    eliminado = false
) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial del reporte con datos sensibles del menor",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId,
            ciudadId: ciudad?.id,
            esAnonimo: true,
            edadVictima: 12,
            estado,
            eliminado,
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
    if (categoria) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.85,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }
    return reporte;
}

async function crearParametrosColegio() {
    await prisma.$executeRaw`
        INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
        VALUES
            (${crypto.randomUUID()}, ${"colegio.notificaciones.enabled"}, ${"true"}, ${"BOOLEAN"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW()),
            (${crypto.randomUUID()}, ${"colegio.notificaciones.cooldown_horas"}, ${"24"}, ${"INTEGER"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW())
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            "actualizadoEn" = NOW()
    `;
}

describe("src/lib/colegio/alertas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(enviarAlertaColegio).mockClear();
    });

    describe("notificarColegioSiCorresponde", () => {
        it("crea una alerta cuando un reporte visible menciona un identificador del colegio", async () => {
            const { colegio, admin } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+573001234567",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "ALUMNO",
            });

            const reporte = await crearReporte("+573001234567", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(1);
            expect(alertas[0].estado).toBe("nueva");
            expect(alertas[0].reporteId).toBe(reporte.id);

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "COLEGIO_ALERTA_CREADA", recursoId: alertas[0].id },
            });
            expect(audit).not.toBeNull();

            expect(enviarAlertaColegio).toHaveBeenCalledWith(admin.email, 1);
        });

        it("crea una alerta por cada colegio que tenga el identificador registrado", async () => {
            const { colegio: colegio1 } = await crearColegioConAdmin();
            const { colegio: colegio2 } = await crearColegioConAdmin();
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });

            const curso1 = await crearCurso(colegio1.id, { nombre: "6A" });
            const alumno1 = await crearAlumno(curso1.id, colegio1.id, { nombre: "Alumno 1" });
            await crearIdentificadorAlumno(alumno1.id, { valor: "+57300999999", plataformaId: plataforma!.id });

            const curso2 = await crearCurso(colegio2.id, { nombre: "7B" });
            const alumno2 = await crearAlumno(curso2.id, colegio2.id, { nombre: "Alumno 2" });
            await crearIdentificadorAlumno(alumno2.id, { valor: "+57300999999", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300999999", plataforma!.id, "CLASIFICADO", "CONTACTO_INSISTENTE");

            await notificarColegioSiCorresponde(reporte.id);

            const alertas1 = await prisma.alertaColegio.findMany({ where: { colegioId: colegio1.id } });
            const alertas2 = await prisma.alertaColegio.findMany({ where: { colegioId: colegio2.id } });
            expect(alertas1).toHaveLength(1);
            expect(alertas2).toHaveLength(1);
            expect(alertas1[0].reporteId).toBe(reporte.id);
            expect(alertas2[0].reporteId).toBe(reporte.id);
            expect(alertas1[0].id).not.toBe(alertas2[0].id);
        });

        it("no crea alerta si el identificador está inactivo", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300INACTIVO",
                plataformaId: plataforma!.id,
                estado: "inactivo",
            });

            const reporte = await crearReporte("+57300INACTIVO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(0);
        });

        it("no crea alerta si el colegio no está vigente", async () => {
            const { colegio } = await crearColegioConAdmin();
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });

            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300VENCIDO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300VENCIDO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(0);
        });

        it("no crea alerta si el reporte está eliminado", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300ELIMINADO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300ELIMINADO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS", true);
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(0);
        });

        it("no crea alerta si el reporte está en estado no visible", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300PENDIENTE", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300PENDIENTE", plataforma!.id, "PENDIENTE");
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(0);
        });

        it("no crea alertas duplicadas para el mismo colegio+reporte+identificador", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300DUP", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300DUP", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

            await notificarColegioSiCorresponde(reporte.id);
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(1);
        });

        it("hace matching case-insensitive y sin espacios", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300MIXED", plataformaId: plataforma!.id });

            const reporte = await crearReporte("  +57300MIXED  ", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await prisma.alertaColegio.findMany({ where: { colegioId: colegio.id } });
            expect(alertas).toHaveLength(1);
        });

        it("no envía email cuando las notificaciones están deshabilitadas", async () => {
            await prisma.parametroSistema.update({
                where: { clave: "colegio.notificaciones.enabled" },
                data: { valor: "false" },
            });

            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300NOMAIL", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300NOMAIL", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            expect(enviarAlertaColegio).not.toHaveBeenCalled();
        });
    });

    describe("listarAlertasColegio", () => {
        it("solo devuelve campos permitidos y no expone PII", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const identificador = await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300PRIV",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "MADRE",
            });

            const reporte = await crearReporte("+57300PRIV", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const alertas = await listarAlertasColegio(colegio.id);
            expect(alertas).toHaveLength(1);

            const alerta = alertas[0];
            expect(alerta.identificador).toBe("+57300PRIV");
            expect(alerta.relacion).toBe("MADRE");
            expect(alerta.categoria).toBe("OFRECIMIENTO_REGALOS");
            expect(alerta.estadoReporte).toBe("CLASIFICADO");
            expect(alerta.estadoAlerta).toBe("nueva");
            expect(alerta.creadoEn).toBeDefined();

            // Privacidad: no debe exponer PII
            const alertaKeys = Object.keys(alerta);
            expect(alertaKeys).not.toContain("texto");
            expect(alertaKeys).not.toContain("ciudad");
            expect(alertaKeys).not.toContain("pais");
            expect(alertaKeys).not.toContain("edadVictima");
            expect(alertaKeys).not.toContain("plataforma");
            expect(alertaKeys).not.toContain("identificadorDenunciante");
            expect(alertaKeys).not.toContain("textoAnonimizado");
        });

        it("oculta alertas de reportes dados de baja", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300BAJA", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300BAJA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            await prisma.reporte.update({ where: { id: reporte.id }, data: { eliminado: true } });

            const alertas = await listarAlertasColegio(colegio.id);
            expect(alertas).toHaveLength(0);
        });

        it("filtra por estado de alerta", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300FILTRO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300FILTRO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio.id } });
            await cambiarEstadoAlerta(alerta!.id, colegio.id, "vista");

            const nuevas = await listarAlertasColegio(colegio.id, "nueva");
            const vistas = await listarAlertasColegio(colegio.id, "vista");
            expect(nuevas).toHaveLength(0);
            expect(vistas).toHaveLength(1);
        });
    });

    describe("cambiarEstadoAlerta", () => {
        it("cambia el estado y registra auditoría", async () => {
            const { colegio } = await crearColegioConAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300ESTADO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300ESTADO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio.id } });

            const actualizada = await cambiarEstadoAlerta(alerta!.id, colegio.id, "gestionada");
            expect(actualizada.estado).toBe("gestionada");

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "COLEGIO_ALERTA_ESTADO", recursoId: alerta!.id },
            });
            expect(audit).not.toBeNull();
            expect(audit?.valorAnterior).toContain("nueva");
            expect(audit?.valorNuevo).toContain("gestionada");
        });

        it("rechaza cambiar estado de una alerta de otro colegio", async () => {
            const { colegio: colegio1 } = await crearColegioConAdmin();
            const { colegio: colegio2 } = await crearColegioConAdmin();
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });

            const curso = await crearCurso(colegio1.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio1.id, { nombre: "María Gómez" });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300AJENA", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300AJENA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio1.id } });

            await expect(cambiarEstadoAlerta(alerta!.id, colegio2.id, "vista")).rejects.toThrow("Alerta no encontrada");
        });
    });
});
