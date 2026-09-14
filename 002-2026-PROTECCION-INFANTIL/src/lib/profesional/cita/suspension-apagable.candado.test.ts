/**
 * SPEC-692 (I-417) · CANDADO — la suspensión automática es apagable, y viaja por
 * un parámetro que SE LEE. Las DOS direcciones:
 *   · apagado (0/ausente) → ni tres ni nueve vencidas seguidas cambian el estado.
 *   · en 3 → tres vencidas seguidas SÍ suspenden.
 *
 * La dirección «en 3» es la que atrapa el defecto silencioso: un parámetro que
 * nadie lee también pasaría la prueba apagada. Muere por mutación: si se quita el
 * guard `maxConsecutivas > 0`, `0 >= 0` vuelve a suspender → la prueba apagada
 * cae; si `evaluarSuspensionYAlarma` deja de leer el parámetro, la prueba «en 3»
 * (que lo pone en 3) cae.
 *
 * Todo mockeado (repos + parámetro + audit): sin base de datos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` se iza al tope; las funciones que usa deben venir de `vi.hoisted`.
const { cambiarEstado, contarConsecutivas, tasaVencimientos, getParam } = vi.hoisted(() => ({
    cambiarEstado: vi.fn(),
    contarConsecutivas: vi.fn(),
    tasaVencimientos: vi.fn(),
    getParam: vi.fn(),
}));

vi.mock("@/lib/dal/repositories/perfil-profesional", () => ({
    PerfilProfesionalRepository: class {
        cambiarEstado = cambiarEstado;
    },
}));
vi.mock("@/lib/dal/repositories/solicitud-cita", () => ({
    SolicitudCitaRepository: class {
        contarConsecutivasVencidasPorProfesional = contarConsecutivas;
        tasaVencimientos = tasaVencimientos;
    },
}));
vi.mock("@/lib/parametros", () => ({ getParametroSistemaValor: getParam }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { evaluarSuspensionYAlarma } from "./cita.service";

beforeEach(() => {
    vi.clearAllMocks();
    // la rama de alarma por tasa no debe interferir con el sujeto (suspensión).
    tasaVencimientos.mockResolvedValue({ total: 0, vencidas: 0, tasa: 0 });
});

describe("SPEC-692 · la suspensión automática es apagable (las dos direcciones)", () => {
    it("APAGADO (parámetro = 0): tres vencidas seguidas NO suspenden", async () => {
        getParam.mockResolvedValue("0");
        contarConsecutivas.mockResolvedValue(3);
        await evaluarSuspensionYAlarma("perfil-1");
        expect(cambiarEstado).not.toHaveBeenCalled();
    });

    it("AUSENTE (parámetro = null): ni nueve vencidas suspenden (fail-safe)", async () => {
        getParam.mockResolvedValue(null);
        contarConsecutivas.mockResolvedValue(9);
        await evaluarSuspensionYAlarma("perfil-1");
        expect(cambiarEstado).not.toHaveBeenCalled();
    });

    it("EN 3 (parámetro = 3): tres vencidas seguidas SÍ suspenden", async () => {
        getParam.mockResolvedValue("3");
        contarConsecutivas.mockResolvedValue(3);
        await evaluarSuspensionYAlarma("perfil-1");
        expect(cambiarEstado).toHaveBeenCalledWith("perfil-1", "SUSPENDIDO");
    });

    it("EN 3 pero solo 2 vencidas: NO suspende (el umbral se respeta)", async () => {
        getParam.mockResolvedValue("3");
        contarConsecutivas.mockResolvedValue(2);
        await evaluarSuspensionYAlarma("perfil-1");
        expect(cambiarEstado).not.toHaveBeenCalled();
    });
});
