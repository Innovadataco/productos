/**
 * SPEC-234 (002-PI-134): tests de la regla N1 de perpetrador serial.
 */
import { describe, it, expect } from "vitest";
import { crearEvento } from "../test-fixtures";
import { detectarPerpetradorSerial } from "./perpetrador-serial";

function eventos(n: number) {
    return Array.from({ length: n }, (_, i) =>
        crearEvento({
            ordenSecuencial: i + 1,
            fechaEvento: new Date(`2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
        })
    );
}

describe("detectarPerpetradorSerial", () => {
    it("dispara al alcanzar el umbral configurado", () => {
        const resultado = detectarPerpetradorSerial(eventos(5), 5);

        expect(resultado.detectado).toBe(true);
        expect(resultado.severidad).toBe("MEDIA");
        expect(resultado.datosContextoJson.tipoPatron).toBe("PERPETRADOR_SERIAL");
    });

    it("no dispara por debajo del umbral", () => {
        const resultado = detectarPerpetradorSerial(eventos(3), 5);

        expect(resultado.detectado).toBe(false);
        expect(resultado.severidad).toBe("BAJA");
    });
});
