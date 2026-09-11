/**
 * CANDADO · SPEC-663 (I-396) — el home del padre EXPONE la señal del motor,
 * nunca la INVENTA.
 *
 * Contrato con SPEC-660 (Dev 1, que consume `estadoClasificador`): el payload
 * lleva `{ motorVivo, ultimaVerificacionEn }` tal cual lo produce `leerLatidoMotor`
 * (SPEC-670) — `ultimaVerificacionEn` es el último `ollama_smoke` verde o `null`,
 * JAMÁS «ahora» ni el latido del worker. Ese es el defecto de I-396: afirmar
 * frescura que no se tiene. Este candado muere si el orquestador reescribe,
 * redondea o inventa la marca de tiempo en vez de pasarla.
 *
 * Unit puro: se mockea `leerLatidoMotor` con un centinela de fecha PASADA y las
 * dependencias de BD, para que cualquier «= new Date()» se delate por no coincidir.
 * La honestidad de la fuente (que sale del smoke y no del heartbeat) la garantiza
 * el candado propio de `leerLatidoMotor`; acá se vigila el eslabón de exposición.
 */
import { describe, it, expect, vi } from "vitest";
import type { LatidoMotor } from "@/lib/monitoreo/latido-motor";

// Centinela: una fecha del pasado, concreta. Si el orquestador la sustituye por
// «ahora» o cualquier derivado, el toEqual cae.
const CENTINELA_CAIDO: LatidoMotor = {
    motorVivo: false,
    ultimaVerificacionEn: new Date("2026-09-11T20:00:00.000Z"),
};
const CENTINELA_VIVO: LatidoMotor = {
    motorVivo: true,
    ultimaVerificacionEn: new Date("2026-09-11T22:45:00.000Z"),
};

const leerLatidoMotorMock = vi.fn();
vi.mock("@/lib/monitoreo/latido-motor", () => ({
    leerLatidoMotor: (...args: unknown[]) => leerLatidoMotorMock(...args),
}));

// Dependencias de BD del orquestador, neutralizadas (sin contactos → payload mínimo).
vi.mock("@/lib/dal/services/padre-home", () => ({
    obtenerContactosActivos: vi.fn().mockResolvedValue([]),
    obtenerResumenReportesPorIdentificadores: vi.fn().mockResolvedValue([]),
}));
vi.mock("./home-semaforo", async (orig) => ({
    ...(await orig<typeof import("./home-semaforo")>()),
    calcularSemaforoHome: vi.fn().mockResolvedValue([]),
}));
vi.mock("./home-timeline", async (orig) => ({
    ...(await orig<typeof import("./home-timeline")>()),
    obtenerTimelineHome: vi.fn().mockResolvedValue([]),
}));

import { obtenerHomePadre } from "./home";

describe("SPEC-663 · el home del padre expone estadoClasificador, no lo inventa", () => {
    it("pasa `estadoClasificador` TAL CUAL lo da leerLatidoMotor (motor caído, con último éxito real)", async () => {
        leerLatidoMotorMock.mockResolvedValue(CENTINELA_CAIDO);
        const home = await obtenerHomePadre("padre-1", "Ana");
        // Deep-equal: si el orquestador reescribe cualquier campo, cae.
        expect(home.estadoClasificador).toEqual(CENTINELA_CAIDO);
        // El sello de I-396: la marca es el valor REAL del pasado, no «ahora».
        expect(home.estadoClasificador.ultimaVerificacionEn).toEqual(CENTINELA_CAIDO.ultimaVerificacionEn);
    });

    it("pasa también el caso VIVO sin tocar la marca", async () => {
        leerLatidoMotorMock.mockResolvedValue(CENTINELA_VIVO);
        const home = await obtenerHomePadre("padre-1", "Ana");
        expect(home.estadoClasificador).toEqual(CENTINELA_VIVO);
    });
});
