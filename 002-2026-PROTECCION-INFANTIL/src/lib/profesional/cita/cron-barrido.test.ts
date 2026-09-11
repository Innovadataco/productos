import { describe, it, expect } from "vitest";
import { cronBarridoCitas, CRON_BARRIDO_CITAS_DEFAULT, CLAVE_CRON_BARRIDO_CITAS } from "./cron-barrido";

/**
 * SPEC-657 · la cadencia del barrido de citas se lee del parámetro y cae al
 * default sin lanzar. fs-libre → unit.
 */
describe("SPEC-657 · cronBarridoCitas", () => {
    it("el default es cada 15 minutos", () => {
        expect(CRON_BARRIDO_CITAS_DEFAULT).toBe("*/15 * * * *");
    });

    it("un cron de 5 campos válido se respeta tal cual", () => {
        expect(cronBarridoCitas("*/15 * * * *")).toBe("*/15 * * * *");
        expect(cronBarridoCitas("0 * * * *")).toBe("0 * * * *");
        expect(cronBarridoCitas("*/5 * * * *")).toBe("*/5 * * * *");
        expect(cronBarridoCitas("  0,30 8-18 * * 1-5  ")).toBe("0,30 8-18 * * 1-5");
    });

    it.each([null, undefined, "", "   ", "*/15 * * *", "*/15 * * * * *", "cada rato", "0 0 * * L"])(
        "«%s» cae al default sin lanzar",
        (valor) => {
            expect(cronBarridoCitas(valor as string)).toBe(CRON_BARRIDO_CITAS_DEFAULT);
        },
    );

    it("NO comparte el parámetro con otro reloj (dominio propio)", () => {
        expect(CLAVE_CRON_BARRIDO_CITAS).toBe("cita.barrido.cron");
        expect(CLAVE_CRON_BARRIDO_CITAS).not.toContain("vigencia");
        expect(CLAVE_CRON_BARRIDO_CITAS).not.toContain("verificacion");
    });
});
