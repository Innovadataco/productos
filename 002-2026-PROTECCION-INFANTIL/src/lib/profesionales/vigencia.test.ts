import { describe, it, expect } from "vitest";
import {
    calcularVenceEn,
    puedeAparecerEnDirectorio,
    sellos,
    ultimaAprobacion,
    type VerificacionResumenInput,
} from "./vigencia";

// ── Ley 2375/2024 · el intervalo es CUATRO meses, no anual ───────────────
describe("calcularVenceEn — Ley 2375/2024 (SPEC-389)", () => {
    it("suma exactamente 4 meses a la fecha de revisión (día normal)", () => {
        const revisado = new Date("2026-03-15T10:00:00.000Z");
        expect(calcularVenceEn(revisado).toISOString()).toBe("2026-07-15T10:00:00.000Z");
    });

    it("cuando el día no existe en el mes destino, JS hace overflow al mes siguiente", () => {
        // 31-oct + 4m nominal ⇒ 31-feb, que no existe. JS ajusta al día
        // equivalente por overflow: 2-mar en años normales, 2-mar en 2028
        // (bisiesto, feb tiene 29 → 31 - 29 = 2 días extra ⇒ 2-mar).
        // El comportamiento importante para la ley: **la fecha existe y es
        // determinística**, no un 31-feb inventado.
        const revisado = new Date("2027-10-31T00:00:00.000Z");
        const vence = calcularVenceEn(revisado);
        expect(vence.getUTCMonth()).toBe(2); // marzo (index 2)
        expect(vence.getUTCFullYear()).toBe(2028);
    });

    it("año bisiesto: 29-oct-2027 + 4m = 29-feb-2028 (día exacto)", () => {
        const revisado = new Date("2027-10-29T12:00:00.000Z");
        // 29-feb-2028 existe (bisiesto).
        expect(calcularVenceEn(revisado).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    });

    it("cruza fin de año (UTC, sin desfase por TZ del proceso)", () => {
        const revisado = new Date("2026-11-01T00:00:00.000Z");
        expect(calcularVenceEn(revisado).toISOString()).toBe("2027-03-01T00:00:00.000Z");
    });

    it("NO es un año — 12 meses NO es el intervalo correcto (candado anti-regresión)", () => {
        const revisado = new Date("2026-01-01T00:00:00.000Z");
        // Si alguien cambia MESES_LEY_2375 a 12, este test cae.
        const vence = calcularVenceEn(revisado);
        const doceMesesDespues = new Date("2027-01-01T00:00:00.000Z");
        expect(vence.getTime()).toBeLessThan(doceMesesDespues.getTime());
    });
});

// ── Reserva legal del resultado (Ley 1918/2018 · art. 10) ────────────────
describe("sellos — reserva legal (SPEC-389)", () => {
    const claveReservadaJamas = ["resultado", "checklist", "autorizacionArchivoId", "notaInterna"];
    const perfilActivo = { estado: "ACTIVO" as const };

    function verifAprobada(diasVigencia = 60): VerificacionResumenInput {
        const revisado = new Date("2026-06-01T00:00:00.000Z");
        const vence = new Date(revisado.getTime() + diasVigencia * 24 * 60 * 60 * 1000);
        return { resultado: "APROBADO", revisadoEn: revisado, venceEn: vence };
    }

    it("SIN aprobaciones → sello AUSENTE", () => {
        const s = sellos(perfilActivo, [], new Date("2026-06-15T00:00:00.000Z"));
        expect(s.sello).toBe("AUSENTE");
        expect(s.fechaVerificacion).toBeUndefined();
        expect(s.venceEn).toBeUndefined();
    });

    it("aprobación vigente → APROBADO con fecha y vencimiento", () => {
        const s = sellos(perfilActivo, [verifAprobada(60)], new Date("2026-06-15T00:00:00.000Z"));
        expect(s.sello).toBe("APROBADO");
        expect(s.fechaVerificacion).toBe("2026-06-01T00:00:00.000Z");
        expect(s.venceEn).toBeDefined();
    });

    it("aprobación pasada de fecha → VENCIDO", () => {
        const s = sellos(perfilActivo, [verifAprobada(60)], new Date("2026-08-15T00:00:00.000Z"));
        expect(s.sello).toBe("VENCIDO");
    });

    it("perfil BORRADOR/EN_REVISION/RECHAZADO/SUSPENDIDO → AUSENTE aunque tenga aprobaciones", () => {
        for (const estado of ["BORRADOR", "EN_REVISION", "RECHAZADO", "SUSPENDIDO"] as const) {
            const s = sellos({ estado }, [verifAprobada(60)], new Date("2026-06-15T00:00:00.000Z"));
            expect(s.sello).toBe("AUSENTE");
        }
    });

    // Este es el candado que cita la ley: solo tres claves salen por el borde
    // público. Si alguien agrega `resultado`, `checklist`, `notaInterna` u otra
    // ventana al historial reservado, este test rojo lo dice antes del deploy.
    it("CANDADO: el sello público NO contiene claves reservadas (Ley 1918/2018)", () => {
        const s: unknown = sellos(perfilActivo, [verifAprobada(60)], new Date("2026-06-15T00:00:00.000Z"));
        const claves = Object.keys(s as Record<string, unknown>);
        expect(claves.sort()).toEqual(["fechaVerificacion", "sello", "venceEn"]);
        for (const reservada of claveReservadaJamas) {
            expect(claves, `«${reservada}» es información reservada por ley — jamás en el sello público`).not.toContain(
                reservada,
            );
        }
    });

    it("varias aprobaciones → gana la MÁS RECIENTE (historial preservado, sello vigente)", () => {
        const vieja = verifAprobada(60);
        const nueva: VerificacionResumenInput = {
            resultado: "APROBADO",
            revisadoEn: new Date("2026-08-01T00:00:00.000Z"),
            venceEn: new Date("2026-12-01T00:00:00.000Z"),
        };
        const s = sellos(perfilActivo, [vieja, nueva], new Date("2026-08-15T00:00:00.000Z"));
        expect(s.fechaVerificacion).toBe("2026-08-01T00:00:00.000Z");
    });

    it("aprobaciones intercaladas con rechazos/mas-info → ignora los no-APROBADO", () => {
        const rechazo: VerificacionResumenInput = {
            resultado: "RECHAZADO",
            revisadoEn: new Date("2026-05-01T00:00:00.000Z"),
            venceEn: new Date("2026-09-01T00:00:00.000Z"),
        };
        const aprobada = verifAprobada(60);
        expect(ultimaAprobacion([rechazo, aprobada])?.resultado).toBe("APROBADO");
    });
});

// ── Filtro del directorio abierto (L3) ──────────────────────────────────
describe("puedeAparecerEnDirectorio — L3 (SPEC-389)", () => {
    it("ACTIVO + sello vigente → true", () => {
        const perfil = { estado: "ACTIVO" as const };
        const verif: VerificacionResumenInput = {
            resultado: "APROBADO",
            revisadoEn: new Date("2026-06-01T00:00:00.000Z"),
            venceEn: new Date("2026-10-01T00:00:00.000Z"),
        };
        expect(puedeAparecerEnDirectorio(perfil, [verif], new Date("2026-08-15T00:00:00.000Z"))).toBe(true);
    });

    it("ACTIVO + sello vencido → false (defensa en profundidad antes del cron)", () => {
        const perfil = { estado: "ACTIVO" as const };
        const verif: VerificacionResumenInput = {
            resultado: "APROBADO",
            revisadoEn: new Date("2026-06-01T00:00:00.000Z"),
            venceEn: new Date("2026-10-01T00:00:00.000Z"),
        };
        expect(puedeAparecerEnDirectorio(perfil, [verif], new Date("2027-01-01T00:00:00.000Z"))).toBe(false);
    });

    it("estados distintos de ACTIVO → false, sin importar el sello", () => {
        const verif: VerificacionResumenInput = {
            resultado: "APROBADO",
            revisadoEn: new Date("2026-06-01T00:00:00.000Z"),
            venceEn: new Date("2027-01-01T00:00:00.000Z"),
        };
        for (const estado of ["BORRADOR", "EN_REVISION", "RECHAZADO", "VENCIDO", "SUSPENDIDO"] as const) {
            expect(puedeAparecerEnDirectorio({ estado }, [verif], new Date("2026-08-15T00:00:00.000Z"))).toBe(false);
        }
    });
});
