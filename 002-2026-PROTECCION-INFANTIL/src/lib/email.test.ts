/**
 * SPEC-296 (002-PI-197 · cierra I-152): tests de los wrappers de email.ts
 * post-migración al motor de notificaciones.
 *
 * Antes de la migración, cada wrapper llamaba `resend.emails.send()` directo
 * y el test verificaba `subject`/`text` literal. Ahora el envío pasa por
 * `programar()` del motor con `evento` + `variables`; el contenido literal
 * del email vive en las plantillas del seed. Estos tests mockean `programar`
 * y verifican que:
 *   - se llama con el evento correcto,
 *   - las `variables` llevan los valores esperados,
 *   - las variables NO acarrean PII/scores prohibidos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import {
    enviarAlertaRevision,
    enviarAlertaScoreCritico,
    enviarAvisoReporteNuevoColegio,
    enviarAvisoUmbralCursoColegio,
    enviarAvisoEstudianteRepetidoColegio,
    enviarResumenSemanalColegio,
} from "./email";
import * as motor from "./notificaciones/motor";
import { crearPlataforma } from "./reporte-test-utils";

// PII prohibida en el email (SPEC-149 · §3): el copy es ciego. Solo hoy son
// aceptables "reportes"/"aviso"; nunca "score", identificador crudo, ni nombres.
const PII_PROHIBIDA = [
    "+5730",
    "María",
    "score",
    "SCORE",
    "identificador",
    "texto del reporte",
    "notificación",
    "notificacion",
];

function ultimaLlamada() {
    const spy = motor.programar as unknown as { mock: { calls: unknown[][] } };
    const last = spy.mock.calls[spy.mock.calls.length - 1];
    return last ? (last[0] as {
        evento: string;
        sujetoTipo?: string;
        sujetoId?: string;
        destinatarios: Array<{ email?: string; variables: Record<string, unknown> }>;
    }) : null;
}

async function crearAdmin(email: string) {
    const { hashPassword } = await import("./auth");
    return prisma.usuario.create({
        data: {
            email,
            nombre: "Admin",
            passwordHash: await hashPassword("Admin123!"),
            rol: "ADMIN",
            estado: "activo",
        },
    });
}

describe("enviarAlertaRevision", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.spyOn(motor, "programar").mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0 });
    });

    it("no llama al motor si no hay administradores activos", async () => {
        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });
        expect(motor.programar).not.toHaveBeenCalled();
    });

    it("programa el evento `reporte.revision.requerida` para cada admin con las variables adecuadas", async () => {
        await crearAdmin("admin@example.com");
        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("reporte.revision.requerida");
        expect(llamada.sujetoTipo).toBe("Reporte");
        expect(llamada.sujetoId).toBe("reporte-1");
        expect(llamada.destinatarios).toHaveLength(1);
        expect(llamada.destinatarios[0].email).toBe("admin@example.com");
        const vars = llamada.destinatarios[0].variables;
        expect(vars.numeroSeguimiento).toBe("RPT-001");
        expect(vars.identificador).toBe("+573001234567");
        expect(vars.estado).toBe("REVISION_MANUAL");
    });

    it("no llama al motor cuando alerts.admin.enabled es false", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "alerts.admin.enabled",
                valor: "false",
                tipo: "BOOLEAN",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
        });
        await crearAdmin("admin@example.com");

        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });

        expect(motor.programar).not.toHaveBeenCalled();
    });
});

describe("enviarAlertaScoreCritico", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.spyOn(motor, "programar").mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0 });
    });

    it("programa `reporte.score_critico` con identificador, plataforma, score y nivelRiesgo", async () => {
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
        await crearAdmin("admin@example.com");

        await enviarAlertaScoreCritico({
            id: "reporte-1",
            identificador: "+57300999999",
            plataformaId: plataforma.id,
            score: 95,
            nivelRiesgo: "CRITICO",
        });

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("reporte.score_critico");
        expect(llamada.destinatarios).toHaveLength(1);
        const vars = llamada.destinatarios[0].variables;
        expect(vars.identificador).toBe("+57300999999");
        expect(vars.score).toBe(95);
        expect(vars.nivelRiesgo).toBe("CRITICO");
        expect(vars.plataforma).toBe("WhatsApp");
    });

    it("no llama al motor cuando alerts.critical_score.enabled es false", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "alerts.critical_score.enabled",
                valor: "false",
                tipo: "BOOLEAN",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
        });
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
        await crearAdmin("admin@example.com");

        await enviarAlertaScoreCritico({
            id: "reporte-1",
            identificador: "+57300999999",
            plataformaId: plataforma.id,
            score: 95,
            nivelRiesgo: "CRITICO",
        });

        expect(motor.programar).not.toHaveBeenCalled();
    });
});

/**
 * SPEC-149 (FR-006/FR-009) — Avisos del colegio: copy ciego humano en español
 * (terminología §3: "aviso"/"te avisamos"), cero PII/scores/identificadores
 * (I-28/I-29). Ahora se verifica que las `variables` que salen del wrapper
 * hacia el motor NO contienen PII prohibida. El contenido literal de la
 * plantilla está bajo control del seed (auditado en `email.migracion.test.ts`).
 */
describe("avisos del colegio (SPEC-149)", () => {
    beforeEach(() => {
        vi.spyOn(motor, "programar").mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0 });
    });

    function serializarVariables(vars: Record<string, unknown>): string {
        return JSON.stringify(vars);
    }

    it("aviso de reporte nuevo: programa `colegio.reporte_nuevo` con la URL a alertas, cero PII", async () => {
        await enviarAvisoReporteNuevoColegio("rector@colegio.edu.co");

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("colegio.reporte_nuevo");
        expect(llamada.destinatarios[0].email).toBe("rector@colegio.edu.co");
        const vars = llamada.destinatarios[0].variables;
        expect(vars.urlAlertas).toContain("/dashboard/colegio/alertas");
        const bytes = serializarVariables(vars);
        for (const termino of PII_PROHIBIDA) {
            expect(bytes).not.toContain(termino);
        }
    });

    it("aviso de umbral por curso: solo conteos, sin nombres ni PII", async () => {
        await enviarAvisoUmbralCursoColegio("rector@colegio.edu.co", { reportes: 3, dias: 7 });

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("colegio.curso.umbral");
        const vars = llamada.destinatarios[0].variables;
        expect(vars.reportes).toBe(3);
        expect(vars.dias).toBe(7);
        const bytes = serializarVariables(vars);
        for (const termino of PII_PROHIBIDA) {
            expect(bytes).not.toContain(termino);
        }
    });

    it("aviso de estudiante repetido: solo conteos, jamás el nombre del estudiante", async () => {
        await enviarAvisoEstudianteRepetidoColegio("rector@colegio.edu.co", { reportes: 2, dias: 30 });

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("colegio.estudiante.repetido");
        const vars = llamada.destinatarios[0].variables;
        expect(vars.reportes).toBe(2);
        expect(vars.dias).toBe(30);
        const bytes = serializarVariables(vars);
        for (const termino of PII_PROHIBIDA) {
            expect(bytes).not.toContain(termino);
        }
    });

    it("resumen semanal con actividad: cuerpo compuesto por 3 líneas, sin PII", async () => {
        await enviarResumenSemanalColegio("rector@colegio.edu.co", { reportesSemana: 2, teEsperan: 1, pendientesDigest: 3 });

        expect(motor.programar).toHaveBeenCalledOnce();
        const llamada = ultimaLlamada()!;
        expect(llamada.evento).toBe("colegio.resumen_semanal");
        const vars = llamada.destinatarios[0].variables;
        const cuerpo = String(vars.cuerpo ?? "");
        expect(cuerpo).toContain("2 reportes nuevos");
        expect(cuerpo).toContain("1 reporte que te espera");
        expect(cuerpo).toContain("3 avisos quedaron guardados");
        expect(cuerpo).not.toContain("Semana tranquila");
        const bytes = serializarVariables(vars);
        for (const termino of PII_PROHIBIDA) {
            expect(bytes).not.toContain(termino);
        }
    });

    it("resumen de semana tranquila: copy positivo (la calma se muestra como trabajo)", async () => {
        await enviarResumenSemanalColegio("rector@colegio.edu.co", { reportesSemana: 0, teEsperan: 0, pendientesDigest: 0 });

        expect(motor.programar).toHaveBeenCalledOnce();
        const cuerpo = String(ultimaLlamada()!.destinatarios[0].variables.cuerpo ?? "");
        expect(cuerpo).toContain("Semana tranquila");
        expect(cuerpo).toContain("la vigilancia siguió activa");
    });

    it("error del motor propaga la excepción (pg-boss reintenta desde el caller)", async () => {
        vi.spyOn(motor, "programar").mockRejectedValueOnce(new Error("motor down"));

        await expect(enviarAvisoReporteNuevoColegio("rector@colegio.edu.co")).rejects.toThrow(/motor down/);
    });
});
