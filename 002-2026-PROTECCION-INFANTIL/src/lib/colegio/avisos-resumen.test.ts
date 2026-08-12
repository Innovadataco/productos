/**
 * SPEC-149 (T004, FR-005/FR-009) — Tests del resumen semanal del lunes.
 * El handler se invoca DIRECTAMENTE (sin schedule real). Email MOCKEADO
 * (cero Resend). Cubre: envío con KPIs D2 + "te espera" + pendientes de
 * digest, idempotencia por semana, copy positivo en semana tranquila,
 * preferencia deshabilitada y colegio vencido.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearParametrosReportes,
    crearPlataforma,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";
import { enviarResumenSemanalColegio } from "@/lib/email";
import { enviarResumenesSemanales, enviarResumenSemanalDeColegio } from "./avisos-resumen";
import { inicioSemanaBogota, diaBogota } from "./avisos";
import { PreferenciaAlertaColegioRepository } from "@/lib/dal/repositories/preferencia-alerta-colegio";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";

vi.mock("@/lib/email", () => ({
    enviarResumenSemanalColegio: vi.fn().mockResolvedValue(undefined),
}));

// Un lunes cualquiera a las 07:05 Bogotá (12:05 UTC) — la semana corre de lunes a lunes.
const LUNES_07H = new Date("2026-08-10T12:05:00.000Z"); // 2026-08-10 es lunes

async function crearReporteVisible(identificador: string, plataformaId: string) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial del reporte",
            fechaIncidente: new Date("2026-08-08T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId ?? null,
            ciudadId: ciudad?.id ?? null,
            esAnonimo: true,
            edadVictima: 12,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
}

describe("enviarResumenesSemanales (handler del schedule del lunes)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(enviarResumenSemanalColegio).mockClear().mockResolvedValue(undefined);
    });

    it("envía UN resumen por colegio con KPIs de la semana, 'te espera' y pendientes de digest; los digest quedan entregados", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "María Gómez" });
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const identificador = await crearIdentificadorEstudiante(estudiante.id, { valor: "+573001234567", plataformaId: plataforma.id });

        // 2 reportes esta semana, uno con alerta "nueva" (te espera).
        const r1 = await crearReporteVisible("+573001234567", plataforma.id);
        const r2 = await crearReporteVisible("+573001234567", plataforma.id);
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: r1.id, identificadorEstudianteId: identificador.id, estado: "nueva", prioridad: "media", vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: r2.id, identificadorEstudianteId: identificador.id, estado: "gestionada", prioridad: "media", vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000) } });

        // 2 eventos que el tope diario mandó al digest durante la semana.
        const registros = new RegistroAvisoColegioRepository();
        const ahora = new Date(); // las alertas de arriba quedan con creadoEn=ahora (dentro de los 7 días)
        const diaSemana = diaBogota(ahora);
        await registros.registrarSiAusente({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "rx-1", dia: diaSemana }, "PENDIENTE_DIGEST");
        await registros.registrarSiAusente({ colegioId: colegio.id, tipoEvento: "UMBRAL_CURSO", entidadId: curso.id, dia: diaSemana }, "PENDIENTE_DIGEST");

        const resultado = await enviarResumenesSemanales(ahora);

        expect(resultado).toEqual({ enviados: 1, omitidos: 0, fallidos: 0 });
        expect(enviarResumenSemanalColegio).toHaveBeenCalledTimes(1);
        expect(enviarResumenSemanalColegio).toHaveBeenCalledWith(admin.email, {
            reportesSemana: 2,
            teEsperan: 1,
            pendientesDigest: 2,
        });

        // Los pendientes quedaron entregados (no se repiten el próximo lunes).
        expect(await registros.pendientesDigest(colegio.id)).toHaveLength(0);

        // El resumen quedó registrado como ENVIADO y auditado.
        const lunes = inicioSemanaBogota(ahora);
        const registro = await registros.buscar({ colegioId: colegio.id, tipoEvento: "RESUMEN_SEMANAL", entidadId: "semanal", dia: lunes });
        expect(registro?.estado).toBe("ENVIADO");
        const audit = await prisma.auditLog.findFirst({ where: { accion: "COLEGIO_AVISO_ENVIADO", colegioId: colegio.id } });
        expect(audit).not.toBeNull();
    });

    it("idempotente por semana: la segunda corrida del mismo lunes es no-op (cero doble resumen)", async () => {
        const { colegio } = await crearColegioConAdmin();

        const primera = await enviarResumenesSemanales(LUNES_07H);
        const segunda = await enviarResumenesSemanales(new Date(LUNES_07H.getTime() + 60 * 60 * 1000));

        expect(primera).toEqual({ enviados: 1, omitidos: 0, fallidos: 0 });
        expect(segunda).toEqual({ enviados: 0, omitidos: 1, fallidos: 0 });
        expect(enviarResumenSemanalColegio).toHaveBeenCalledTimes(1);
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: colegio.id } })).toBe(1);
    });

    it("semana tranquila: igual llega el resumen (la calma se muestra) con conteos en cero", async () => {
        const { colegio, admin } = await crearColegioConAdmin();

        const resultado = await enviarResumenSemanalDeColegio(colegio.id, LUNES_07H);

        expect(resultado.resultado).toBe("enviado");
        expect(enviarResumenSemanalColegio).toHaveBeenCalledWith(admin.email, {
            reportesSemana: 0,
            teEsperan: 0,
            pendientesDigest: 0,
        });
    });

    it("preferencia RESUMEN_SEMANAL deshabilitada → OMITIDO registrado, no envía", async () => {
        const { colegio } = await crearColegioConAdmin();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "RESUMEN_SEMANAL", { habilitado: false });

        const resultado = await enviarResumenesSemanales(LUNES_07H);

        expect(resultado).toEqual({ enviados: 0, omitidos: 1, fallidos: 0 });
        expect(enviarResumenSemanalColegio).not.toHaveBeenCalled();
        const lunes = inicioSemanaBogota(LUNES_07H);
        const registro = await new RegistroAvisoColegioRepository().buscar({
            colegioId: colegio.id,
            tipoEvento: "RESUMEN_SEMANAL",
            entidadId: "semanal",
            dia: lunes,
        });
        expect(registro?.estado).toBe("OMITIDO");
    });

    it("colegio vencido no recibe resumen; fallo de email en un colegio no detiene a los demás", async () => {
        const { colegio: vencido } = await crearColegioConAdmin();
        // FIX-CI-5: la vigencia se compara contra el `ahora` que recibe el
        // schedule (LUNES_07H), no contra la fecha real del runner. El fin de
        // servicio debe quedar ANTES de ese `ahora` para que el colegio sea
        // efectivamente vencido de forma determinista.
        const ayer = new Date(LUNES_07H.getTime() - 24 * 60 * 60 * 1000);
        await prisma.colegio.update({ where: { id: vencido.id }, data: { finServicio: ayer } });

        const { colegio: sano } = await crearColegioConAdmin();
        const { colegio: falla } = await crearColegioConAdmin();
        vi.mocked(enviarResumenSemanalColegio).mockImplementation(async (email: string) => {
            const dueno = await prisma.usuario.findFirst({ where: { email }, select: { colegioId: true } });
            if (dueno?.colegioId === falla.id) throw new Error("Resend caído");
        });

        const resultado = await enviarResumenesSemanales(LUNES_07H);

        expect(resultado.enviados).toBe(1); // solo el colegio sano
        expect(resultado.fallidos).toBe(1); // el del proveedor caído
        expect(resultado.omitidos).toBe(0); // el vencido ni siquiera se evalúa
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: vencido.id } })).toBe(0);
        const lunes = inicioSemanaBogota(LUNES_07H);
        const registroFallido = await new RegistroAvisoColegioRepository().buscar({
            colegioId: falla.id,
            tipoEvento: "RESUMEN_SEMANAL",
            entidadId: "semanal",
            dia: lunes,
        });
        expect(registroFallido?.estado).toBe("FALLIDO");
        expect(sano.id).not.toBe(falla.id);
    });
});
