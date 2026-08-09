/**
 * SPEC-150 (T004, FR-003) — Sensibilidad elevada del aviso por observación
 * especial: con umbral estándar M=2, el estudiante OBSERVADO dispara
 * ESTUDIANTE_REPETIDO al PRIMER reporte (detalle "observación especial" en el
 * registro); desmarcado vuelve al umbral estándar; la idempotencia por día es
 * la misma de siempre. Cola y email MOCKEADOS (como avisos.test.ts).
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
import { enviarAvisoEstudianteRepetidoColegio } from "@/lib/email";
import { evaluarUmbralesPorAlerta, procesarEnvioAviso, diaBogota } from "./avisos";
import { EstudianteObservacionRepository } from "@/lib/dal/repositories/estudiante-observacion";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";

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

/** Escenario base: colegio + curso + estudiante + identificador (sin preferencias: defaults M=2/30d). */
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

async function crearAlertaNueva(colegioId: string, identificadorValor: string, plataformaId: string, identificadorId: string) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId,
            texto: "Texto confidencial del reporte",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            edadVictima: 12,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
    return prisma.alertaColegio.create({
        data: { colegioId, reporteId: reporte.id, identificadorEstudianteId: identificadorId, estado: "nueva" },
    });
}

const llamadasEstudianteRepetido = () =>
    vi.mocked(sendAvisoColegio).mock.calls.filter((c) => (c[0] as { tipoEvento: string }).tipoEvento === "ESTUDIANTE_REPETIDO");

describe("evaluarUmbralesPorAlerta con observación especial (SPEC-150)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(sendAvisoColegio).mockClear();
    });

    it("observado ⇒ aviso al PRIMER reporte (umbral efectivo 1) con detalle 'observación especial' en el job", async () => {
        const { colegio, admin, estudiante, identificador, plataforma } = await escenarioBase();
        await new EstudianteObservacionRepository().marcar(colegio.id, estudiante.id, { creadaPorId: admin.id });

        const a1 = await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);

        expect(llamadasEstudianteRepetido()).toHaveLength(1);
        expect(sendAvisoColegio).toHaveBeenCalledWith(
            expect.objectContaining({
                colegioId: colegio.id,
                tipoEvento: "ESTUDIANTE_REPETIDO",
                entidadId: estudiante.id,
                detalle: "observación especial: aviso al primer reporte",
            })
        );
    });

    it("NO observado ⇒ el primer reporte NO dispara (umbral estándar M=2); el segundo sí", async () => {
        const { colegio, estudiante, identificador, plataforma } = await escenarioBase();

        const a1 = await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);
        expect(llamadasEstudianteRepetido()).toHaveLength(0);

        const a2 = await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);
        await evaluarUmbralesPorAlerta(a2.id);
        expect(llamadasEstudianteRepetido()).toHaveLength(1);
        // Sin observación el job no lleva detalle.
        expect(llamadasEstudianteRepetido()[0]![0]).not.toHaveProperty("detalle");
        expect(sendAvisoColegio).toHaveBeenCalledWith(
            expect.objectContaining({ entidadId: estudiante.id })
        );
    });

    it("desmarcado ⇒ vuelve el umbral estándar: el primer reporte tras el desmarque NO dispara", async () => {
        const { colegio, admin, estudiante, identificador, plataforma } = await escenarioBase();
        const repo = new EstudianteObservacionRepository();
        await repo.marcar(colegio.id, estudiante.id, { creadaPorId: admin.id });
        await repo.desmarcar(colegio.id, estudiante.id, admin.id);

        const a1 = await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);
        await evaluarUmbralesPorAlerta(a1.id);
        expect(llamadasEstudianteRepetido()).toHaveLength(0);

        const a2 = await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);
        await evaluarUmbralesPorAlerta(a2.id);
        expect(llamadasEstudianteRepetido()).toHaveLength(1);
    });
});

describe("procesarEnvioAviso con observación especial (SPEC-150)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(enviarAvisoEstudianteRepetidoColegio).mockClear().mockResolvedValue(undefined);
    });

    it("el registro ENVIADO conserva el detalle 'observación especial' y la idempotencia por día sigue intacta", async () => {
        const { colegio, estudiante, identificador, plataforma } = await escenarioBase();
        // Una alerta real para que el conteo del estudiante tenga datos.
        await crearAlertaNueva(colegio.id, "+573001234567", plataforma.id, identificador.id);

        const job = {
            colegioId: colegio.id,
            tipoEvento: "ESTUDIANTE_REPETIDO" as const,
            entidadId: estudiante.id,
            dia: DIA_HOY().toISOString().slice(0, 10),
            detalle: "observación especial: aviso al primer reporte",
        };

        const primera = await procesarEnvioAviso(job);
        expect(primera).toEqual({ enviado: true, motivo: "enviado" });

        const registro = await new RegistroAvisoColegioRepository().buscar({
            colegioId: colegio.id,
            tipoEvento: "ESTUDIANTE_REPETIDO",
            entidadId: estudiante.id,
            dia: DIA_HOY(),
        });
        expect(registro?.estado).toBe("ENVIADO");
        expect(registro?.detalle).toBe("observación especial: aviso al primer reporte");

        // Otro reporte el MISMO día ⇒ el re-proceso es no-op: UNA fila, UN email.
        const segunda = await procesarEnvioAviso(job);
        expect(segunda.enviado).toBe(false);
        expect(enviarAvisoEstudianteRepetidoColegio).toHaveBeenCalledTimes(1);
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: colegio.id } })).toBe(1);
    });
});
