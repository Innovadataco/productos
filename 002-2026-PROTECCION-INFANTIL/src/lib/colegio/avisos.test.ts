/**
 * SPEC-149 (T003/T004, FR-009) — Tests del pipeline de avisos del colegio.
 * Cola y email MOCKEADOS (cero pg-boss real, cero Resend real). Cubre:
 * encolado vs OMITIDO, idempotencia real por constraint (segunda corrida =
 * no-op), FALLIDO que no consume la idempotencia, tope diario con
 * PENDIENTE_DIGEST, umbrales que cruzan solo al llegar a N/M y ventana móvil.
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
import { sendAvisoColegio } from "@/lib/queue";
import {
    enviarAvisoReporteNuevoColegio,
    enviarAvisoUmbralCursoColegio,
    enviarAvisoEstudianteRepetidoColegio,
} from "@/lib/email";
import { registrarEventoAviso, procesarEnvioAviso, evaluarUmbralesPorAlerta, diaBogota } from "./avisos";
import { PreferenciaAlertaColegioRepository } from "@/lib/dal/repositories/preferencia-alerta-colegio";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";

vi.mock("@/lib/queue", () => ({
    sendAvisoColegio: vi.fn().mockResolvedValue("job-aviso-1"),
}));

vi.mock("@/lib/email", () => ({
    enviarAvisoReporteNuevoColegio: vi.fn().mockResolvedValue(undefined),
    enviarAvisoUmbralCursoColegio: vi.fn().mockResolvedValue(undefined),
    enviarAvisoEstudianteRepetidoColegio: vi.fn().mockResolvedValue(undefined),
    enviarResumenSemanalColegio: vi.fn().mockResolvedValue(undefined),
}));

const DIA_HOY = () => diaBogota(new Date());

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

async function crearReporte(identificador: string, plataformaId: string, estado: EstadoReporte, categoria?: CategoriaConducta) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial del reporte",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId ?? null,
            ciudadId: ciudad?.id ?? null,
            esAnonimo: true,
            edadVictima: 12,
            estado,
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

/** Escenario base: colegio + curso + estudiante + identificador. Devuelve todo para armar alertas. */
async function escenarioBase(valorIdentificador = "+573001234567") {
    const { colegio, admin } = await crearColegioConAdmin();
    const curso = await crearCurso(colegio.id, { nombre: "6A" });
    const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "María Gómez" });
    const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
    const identificador = await crearIdentificadorEstudiante(estudiante.id, {
        valor: valorIdentificador,
        plataformaId: plataforma.id,
        etiquetaRelacion: "ESTUDIANTE",
    });
    return { colegio, admin, curso, estudiante, plataforma, identificador };
}

async function crearAlerta(colegioId: string, reporteId: string, identificadorEstudianteId: string, creadoEn?: Date) {
    const alerta = await prisma.alertaColegio.create({
        data: { colegioId, reporteId, identificadorEstudianteId, estado: "nueva" },
    });
    if (creadoEn) {
        await prisma.alertaColegio.update({ where: { id: alerta.id }, data: { creadoEn } });
    }
    return alerta;
}

describe("registrarEventoAviso", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(sendAvisoColegio).mockClear();
    });

    it("sin fila de preferencia rigen los defaults: habilitado → ENCOLA (nunca envía inline)", async () => {
        const { colegio } = await escenarioBase();

        const resultado = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1" });

        expect(resultado).toEqual({ encolado: true, motivo: "encolado" });
        expect(sendAvisoColegio).toHaveBeenCalledTimes(1);
        expect(sendAvisoColegio).toHaveBeenCalledWith({
            colegioId: colegio.id,
            tipoEvento: "REPORTE_NUEVO",
            entidadId: "reporte-1",
            dia: DIA_HOY().toISOString().slice(0, 10),
        });
    });

    it("preferencia deshabilitada → NO encola y registra OMITIDO (auditable); la segunda corrida es duplicado", async () => {
        const { colegio } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "REPORTE_NUEVO", { habilitado: false });

        const resultado = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1" });

        expect(resultado).toEqual({ encolado: false, motivo: "omitido_preferencia" });
        expect(sendAvisoColegio).not.toHaveBeenCalled();
        const registro = await new RegistroAvisoColegioRepository().buscar({
            colegioId: colegio.id,
            tipoEvento: "REPORTE_NUEVO",
            entidadId: "reporte-1",
            dia: DIA_HOY(),
        });
        expect(registro?.estado).toBe("OMITIDO");

        const segunda = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1" });
        expect(segunda.motivo).toBe("duplicado");
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: colegio.id } })).toBe(1);
    });

    it("interruptor global en false → OMITIDO y no encola", async () => {
        await prisma.parametroSistema.update({
            where: { clave: "colegio.notificaciones.enabled" },
            data: { valor: "false" },
        });
        const { colegio } = await escenarioBase();

        const resultado = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1" });

        expect(resultado).toEqual({ encolado: false, motivo: "omitido_global" });
        expect(sendAvisoColegio).not.toHaveBeenCalled();
    });

    it("tope diario alcanzado → PENDIENTE_DIGEST (nunca se pierde) y no encola", async () => {
        await prisma.parametroSistema.create({
            data: { clave: "colegio.avisos.tope_diario", valor: "2", tipo: "INTEGER", categoria: "EMAIL", esPublico: false, descripcion: "" },
        });
        const { colegio } = await escenarioBase();
        const registros = new RegistroAvisoColegioRepository();
        await registros.registrarSiAusente({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "r-previo-1", dia: DIA_HOY() }, "ENVIADO");
        await registros.registrarSiAusente({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "r-previo-2", dia: DIA_HOY() }, "ENVIADO");

        const resultado = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-3" });

        expect(resultado).toEqual({ encolado: false, motivo: "pendiente_digest" });
        expect(sendAvisoColegio).not.toHaveBeenCalled();
        const pendiente = await registros.buscar({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-3", dia: DIA_HOY() });
        expect(pendiente?.estado).toBe("PENDIENTE_DIGEST");
    });

    it("una fila FALLIDO no consume la idempotencia: el evento se re-encola", async () => {
        const { colegio } = await escenarioBase();
        await new RegistroAvisoColegioRepository().registrarSiAusente(
            { colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1", dia: DIA_HOY() },
            "FALLIDO",
            "Resend caído"
        );

        const resultado = await registrarEventoAviso({ colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "reporte-1" });

        expect(resultado.encolado).toBe(true);
        expect(sendAvisoColegio).toHaveBeenCalledTimes(1);
    });
});

describe("procesarEnvioAviso (handler del worker)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(enviarAvisoReporteNuevoColegio).mockClear().mockResolvedValue(undefined);
        vi.mocked(enviarAvisoUmbralCursoColegio).mockClear().mockResolvedValue(undefined);
        vi.mocked(enviarAvisoEstudianteRepetidoColegio).mockClear().mockResolvedValue(undefined);
    });

    const jobDe = (colegioId: string, entidadId: string, tipoEvento: "REPORTE_NUEVO" | "UMBRAL_CURSO" | "ESTUDIANTE_REPETIDO" = "REPORTE_NUEVO") => ({
        colegioId,
        tipoEvento,
        entidadId,
        dia: DIA_HOY().toISOString().slice(0, 10),
    });

    it("envía UNA vez al SCHOOL_ADMIN por default, marca ENVIADO y audita; la segunda corrida es no-op (cero doble email)", async () => {
        const { colegio, admin } = await escenarioBase();

        const primera = await procesarEnvioAviso(jobDe(colegio.id, "reporte-1"));
        expect(primera).toEqual({ enviado: true, motivo: "enviado" });
        expect(enviarAvisoReporteNuevoColegio).toHaveBeenCalledTimes(1);
        expect(enviarAvisoReporteNuevoColegio).toHaveBeenCalledWith(admin.email);

        const registro = await new RegistroAvisoColegioRepository().buscar({
            colegioId: colegio.id,
            tipoEvento: "REPORTE_NUEVO",
            entidadId: "reporte-1",
            dia: DIA_HOY(),
        });
        expect(registro?.estado).toBe("ENVIADO");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_AVISO_ENVIADO", colegioId: colegio.id },
        });
        expect(audit).not.toBeNull();

        // Re-proceso del MISMO evento (retry de pg-boss o hook duplicado): no-op.
        const segunda = await procesarEnvioAviso(jobDe(colegio.id, "reporte-1"));
        expect(segunda.enviado).toBe(false);
        expect(enviarAvisoReporteNuevoColegio).toHaveBeenCalledTimes(1);
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: colegio.id } })).toBe(1);
    });

    it("emailDestino de la preferencia sobrescribe el email del SCHOOL_ADMIN", async () => {
        const { colegio } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "REPORTE_NUEVO", {
            habilitado: true,
            emailDestino: "rectoria@colegio.edu.co",
        });

        await procesarEnvioAviso(jobDe(colegio.id, "reporte-1"));

        expect(enviarAvisoReporteNuevoColegio).toHaveBeenCalledWith("rectoria@colegio.edu.co");
    });

    it("preferencia deshabilitada DESPUÉS del encolado → no envía y registra OMITIDO", async () => {
        const { colegio } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "REPORTE_NUEVO", { habilitado: false });

        const resultado = await procesarEnvioAviso(jobDe(colegio.id, "reporte-1"));

        expect(resultado.enviado).toBe(false);
        expect(enviarAvisoReporteNuevoColegio).not.toHaveBeenCalled();
        const registro = await new RegistroAvisoColegioRepository().buscar({
            colegioId: colegio.id,
            tipoEvento: "REPORTE_NUEVO",
            entidadId: "reporte-1",
            dia: DIA_HOY(),
        });
        expect(registro?.estado).toBe("OMITIDO");
    });

    it("fallo del proveedor → FALLIDO + throw (retry pg-boss); el retry exitoso ACTUALIZA la misma fila a ENVIADO", async () => {
        const { colegio } = await escenarioBase();
        vi.mocked(enviarAvisoReporteNuevoColegio).mockRejectedValueOnce(new Error("Resend caído"));

        await expect(procesarEnvioAviso(jobDe(colegio.id, "reporte-1"))).rejects.toThrow("Resend caído");

        const registros = new RegistroAvisoColegioRepository();
        const clave = { colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO" as const, entidadId: "reporte-1", dia: DIA_HOY() };
        const fallido = await registros.buscar(clave);
        expect(fallido?.estado).toBe("FALLIDO");

        // Retry: la fila FALLIDO no bloquea; el éxito la actualiza (1 fila, 1 ENVIADO).
        const retry = await procesarEnvioAviso(jobDe(colegio.id, "reporte-1"));
        expect(retry.enviado).toBe(true);
        expect(enviarAvisoReporteNuevoColegio).toHaveBeenCalledTimes(2);

        const filas = await prisma.registroAvisoColegio.findMany({ where: { colegioId: colegio.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toBe("ENVIADO");
        expect(filas[0].id).toBe(fallido!.id);
    });

    it("re-chequeo del tope a la hora del envío: tope alcanzado → PENDIENTE_DIGEST, no envía", async () => {
        await prisma.parametroSistema.create({
            data: { clave: "colegio.avisos.tope_diario", valor: "1", tipo: "INTEGER", categoria: "EMAIL", esPublico: false, descripcion: "" },
        });
        const { colegio } = await escenarioBase();
        await new RegistroAvisoColegioRepository().registrarSiAusente(
            { colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO", entidadId: "r-previo", dia: DIA_HOY() },
            "ENVIADO"
        );

        const resultado = await procesarEnvioAviso(jobDe(colegio.id, "reporte-2"));

        expect(resultado).toEqual({ enviado: false, motivo: "pendiente_digest" });
        expect(enviarAvisoReporteNuevoColegio).not.toHaveBeenCalled();
    });

    it("UMBRAL_CURSO envía el email de umbral con los reportes de la ventana", async () => {
        const { colegio, curso, identificador, plataforma } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "UMBRAL_CURSO", { habilitado: true, umbral: 2, ventanaDias: 7 });
        const r1 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const r2 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        await crearAlerta(colegio.id, r1.id, identificador.id);
        await crearAlerta(colegio.id, r2.id, identificador.id);

        const resultado = await procesarEnvioAviso(jobDe(colegio.id, curso.id, "UMBRAL_CURSO"));

        expect(resultado.enviado).toBe(true);
        expect(enviarAvisoUmbralCursoColegio).toHaveBeenCalledTimes(1);
        expect(enviarAvisoUmbralCursoColegio).toHaveBeenCalledWith(expect.any(String), { reportes: 2, dias: 7 });
    });
});

describe("evaluarUmbralesPorAlerta", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(sendAvisoColegio).mockClear();
    });

    const llamadasPorTipo = (tipo: string) =>
        vi.mocked(sendAvisoColegio).mock.calls.filter((c) => (c[0] as { tipoEvento: string }).tipoEvento === tipo);

    it("UMBRAL_CURSO cruza solo al LLEGAR a N: el 1º no dispara, el 2º sí (una vez por día y curso)", async () => {
        const { colegio, curso, identificador, plataforma } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "UMBRAL_CURSO", { habilitado: true, umbral: 2, ventanaDias: 7 });

        const r1 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const a1 = await crearAlerta(colegio.id, r1.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);
        expect(llamadasPorTipo("UMBRAL_CURSO")).toHaveLength(0);

        const r2 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const a2 = await crearAlerta(colegio.id, r2.id, identificador.id);
        await evaluarUmbralesPorAlerta(a2.id);
        expect(llamadasPorTipo("UMBRAL_CURSO")).toHaveLength(1);
        expect(sendAvisoColegio).toHaveBeenCalledWith(
            expect.objectContaining({ colegioId: colegio.id, tipoEvento: "UMBRAL_CURSO", entidadId: curso.id })
        );
    });

    it("ESTUDIANTE_REPETIDO: 2 reportes distintos sobre identificadores DISTINTOS del mismo estudiante disparan UNA vez", async () => {
        const { colegio, estudiante, identificador, plataforma } = await escenarioBase();
        const otroNick = await crearIdentificadorEstudiante(estudiante.id, {
            valor: "nick_distinto_99",
            plataformaId: plataforma.id,
            etiquetaRelacion: "ESTUDIANTE",
        });
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "ESTUDIANTE_REPETIDO", { habilitado: true, umbral: 2, ventanaDias: 30 });

        const r1 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const a1 = await crearAlerta(colegio.id, r1.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);
        expect(llamadasPorTipo("ESTUDIANTE_REPETIDO")).toHaveLength(0);

        // Segundo reporte sobre el OTRO nick del mismo estudiante.
        const r2 = await crearReporte("nick_distinto_99", plataforma.id, "CLASIFICADO");
        const a2 = await crearAlerta(colegio.id, r2.id, otroNick.id);
        await evaluarUmbralesPorAlerta(a2.id);
        expect(llamadasPorTipo("ESTUDIANTE_REPETIDO")).toHaveLength(1);
        expect(sendAvisoColegio).toHaveBeenCalledWith(
            expect.objectContaining({ colegioId: colegio.id, tipoEvento: "ESTUDIANTE_REPETIDO", entidadId: estudiante.id })
        );
    });

    it("la ventana móvil excluye reportes viejos: uno de hace 40 días no cuenta para M=2 en 30 días", async () => {
        const { colegio, estudiante, identificador, plataforma } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "ESTUDIANTE_REPETIDO", { habilitado: true, umbral: 2, ventanaDias: 30 });

        const rViejo = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        await crearAlerta(colegio.id, rViejo.id, identificador.id, new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));

        const rNuevo = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const aNuevo = await crearAlerta(colegio.id, rNuevo.id, identificador.id);
        await evaluarUmbralesPorAlerta(aNuevo.id);

        expect(llamadasPorTipo("ESTUDIANTE_REPETIDO")).toHaveLength(0);
    });

    it("preferencia de umbral deshabilitada → el evaluador ni siquiera cuenta ni encola", async () => {
        const { colegio, identificador, plataforma } = await escenarioBase();
        await new PreferenciaAlertaColegioRepository().upsertPreferencia(colegio.id, "UMBRAL_CURSO", { habilitado: false, umbral: 1, ventanaDias: 7 });

        const r1 = await crearReporte("+573001234567", plataforma.id, "CLASIFICADO");
        const a1 = await crearAlerta(colegio.id, r1.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);

        expect(llamadasPorTipo("UMBRAL_CURSO")).toHaveLength(0);
    });
});
