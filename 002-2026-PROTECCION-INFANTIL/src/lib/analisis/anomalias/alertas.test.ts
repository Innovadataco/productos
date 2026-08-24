/**
 * SPEC-225 (FR-010, FR-016): tests unitarios del fail-open de alertas al CEO.
 * Motor Notif mockeado: un error de `programar` NUNCA se propaga al detector
 * y la ausencia de ADMINs activos devuelve 0 sin llamar al motor.
 */
import { describe, it, expect, vi } from "vitest";
import type { Anomalia } from "@prisma/client";
import type { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";

const programarMock = vi.fn();
vi.mock("@/lib/notificaciones", () => ({
    programar: (...args: unknown[]) => programarMock(...args),
}));

import { alertarAnomaliaAlta } from "./alertas";

const ANOMALIA = {
    id: "anomalia-1",
    tipo: "CAIDA_RECAUDO_CIUDAD",
    sujetoTipo: "Ciudad",
    sujetoId: "ciudad-1",
    severidad: "ALTA",
    descripcion: "El recaudo autorizado cayó 41% respecto a la semana anterior.",
    datosContexto: {},
    detectadaEn: new Date("2026-08-24T13:00:00Z"),
    resueltaEn: null,
    resueltaPorAdminId: null,
} as unknown as Anomalia;

function repoCon(admins: { id: string }[]): AnomaliaRepository {
    return { listarAdminsActivos: async () => admins } as unknown as AnomaliaRepository;
}

describe("alertarAnomaliaAlta (fail-open)", () => {
    it("si Motor Notif lanza, devuelve 0 y no propaga el error", async () => {
        programarMock.mockRejectedValueOnce(new Error("plantilla corrupta"));
        await expect(alertarAnomaliaAlta(ANOMALIA, repoCon([{ id: "u1" }]))).resolves.toBe(0);
    });

    it("sin ADMINs activos devuelve 0 sin llamar al motor", async () => {
        programarMock.mockClear();
        await expect(alertarAnomaliaAlta(ANOMALIA, repoCon([]))).resolves.toBe(0);
        expect(programarMock).not.toHaveBeenCalled();
    });

    it("publica el evento con un destinatario por ADMIN y las 5 variables del contrato", async () => {
        programarMock.mockClear();
        programarMock.mockResolvedValueOnce({ programadas: 4, canceladasPorReemplazo: 0 });
        const admins = [{ id: "u1" }, { id: "u2" }];
        const programadas = await alertarAnomaliaAlta(ANOMALIA, repoCon(admins));

        expect(programadas).toBe(4);
        expect(programarMock).toHaveBeenCalledTimes(1);
        const input = programarMock.mock.calls[0]![0] as {
            evento: string;
            sujetoTipo: string;
            sujetoId: string;
            destinatarios: { usuarioId: string; variables: Record<string, unknown> }[];
        };
        expect(input.evento).toBe("analisis.anomalia.detectada");
        expect(input.sujetoTipo).toBe("Anomalia");
        expect(input.sujetoId).toBe("anomalia-1");
        expect(input.destinatarios).toHaveLength(2);
        expect(input.destinatarios[0]!.variables).toMatchObject({
            tipoAnomalia: "CAIDA_RECAUDO_CIUDAD",
            severidad: "ALTA",
            descripcion: ANOMALIA.descripcion,
            fechaDeteccion: "2026-08-24T13:00:00.000Z",
        });
        expect(input.destinatarios[0]!.variables.urlAnomalia).toContain(
            "/dashboard/admin/estadisticas"
        );
    });
});
