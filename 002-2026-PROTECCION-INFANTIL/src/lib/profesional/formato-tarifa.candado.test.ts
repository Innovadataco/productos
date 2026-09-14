/**
 * CANDADO · SPEC-694 · La tarifa se VE con puntos de miles, se GUARDA/ENVÍA entera.
 *
 * Conducta (lo único que no se puede fingir): lo que sale de `tarifaDesdeTexto` es un
 * ENTERO (número), nunca la cadena con puntos; lo que produce `conPuntosDeMiles` es la
 * cadena con puntos para mostrar. Pegar «200.000» guarda `200000`; sin decimales (COP);
 * sin letras. Y el input real está cableado a estas funciones (no volvió a `type=number`).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tarifaDesdeTexto, conPuntosDeMiles } from "./formato-tarifa";

describe("SPEC-694 · tarifa: se ve con puntos, se guarda entera", () => {
    it("tarifaDesdeTexto: pegar «200.000» guarda el ENTERO 200000 (número, no cadena)", () => {
        const v = tarifaDesdeTexto("200.000");
        expect(v).toBe(200000);
        expect(typeof v).toBe("number");
        expect(Number.isInteger(v)).toBe(true);
    });

    it("tarifaDesdeTexto: sin letras, sin decimales; vacío → 0", () => {
        expect(tarifaDesdeTexto("200000")).toBe(200000);
        expect(tarifaDesdeTexto("$ 1.500 COP")).toBe(1500); // símbolos/letras fuera
        expect(tarifaDesdeTexto("1a2b3")).toBe(123);
        expect(tarifaDesdeTexto("")).toBe(0);
        expect(tarifaDesdeTexto("abc")).toBe(0);
        // siempre entero (COP no tiene decimales)
        for (const s of ["200.000", "1.500", "999", "10.000.000"]) {
            expect(Number.isInteger(tarifaDesdeTexto(s)), s).toBe(true);
        }
    });

    it("conPuntosDeMiles: el entero se MUESTRA con puntos; 0 → vacío", () => {
        expect(conPuntosDeMiles(200000)).toBe("200.000");
        expect(conPuntosDeMiles(1500)).toBe("1.500");
        expect(conPuntosDeMiles(999)).toBe("999");
        expect(conPuntosDeMiles(10_000_000)).toBe("10.000.000");
        expect(conPuntosDeMiles(0)).toBe("");
    });

    it("ida y vuelta: lo que se ve son puntos, lo que se guarda es el entero", () => {
        const guardado = tarifaDesdeTexto("200.000"); // lo que va al servidor
        const visto = conPuntosDeMiles(guardado); // lo que ve el usuario
        expect(guardado).toBe(200000);
        expect(visto).toBe("200.000");
        expect(visto).not.toBe(guardado); // uno es cadena con puntos, el otro entero
    });

    it("el input REAL está cableado a estas funciones (no volvió a type=number)", () => {
        const src = fs.readFileSync(
            path.resolve(process.cwd(), "src/app/perfil-profesional/completar/page.tsx"),
            "utf-8",
        );
        // El valor mostrado pasa por conPuntosDeMiles; lo guardado por tarifaDesdeTexto.
        expect(/value=\{conPuntosDeMiles\(tarifaConsultaCOP\)\}/.test(src)).toBe(true);
        expect(/setTarifaConsultaCOP\(tarifaDesdeTexto\(/.test(src)).toBe(true);
    });
});
