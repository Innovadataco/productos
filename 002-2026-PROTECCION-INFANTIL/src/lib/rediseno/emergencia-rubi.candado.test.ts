/**
 * SPEC-475 (I-320 · regla Diseño §7.1): en una acción destructiva, el DISPARADOR es
 * Fantasma-rubí y el rubí SÓLIDO se reserva al CONFIRMAR del modal (el usuario ya
 * decidió ahí). `BotonActivarEmergencia` estaba invertido; este candado impide la recaída.
 *
 * Contraprueba (por mutación): poner `bg-rubi` sólido en el disparador → rojo del test 1;
 * quitar el `bg-rubi` sólido del confirmar → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
    resolve(__dirname, "..", "..", "components/modules/comite/consolidacion/BotonActivarEmergencia.tsx"),
    "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Aísla el bloque de un botón por el handler de su onClick. */
function bloqueBoton(handler: string): string {
    const i = src.indexOf(handler);
    if (i < 0) return "";
    // Retrocede al `<button`/`<Button` que abre, avanza hasta el cierre `>` de la etiqueta.
    const abre = Math.max(src.lastIndexOf("<button", i), src.lastIndexOf("<Button", i));
    const cierra = src.indexOf(">", i);
    return src.slice(abre, cierra);
}

describe("SPEC-475 · emergencia: disparador fantasma, confirmar sólido", () => {
    it("el DISPARADOR (abre el modal) NO usa rubí sólido — es Fantasma-rubí", () => {
        const disparador = bloqueBoton("setAbierto(true)");
        expect(disparador.length, "no encontré el disparador").toBeGreaterThan(0);
        expect(/bg-rubi\b/.test(disparador), "El disparador destructivo no puede ser rubí sólido.").toBe(false);
        expect(/variant="danger"/.test(disparador), "El disparador va en `danger` (Fantasma-rubí).").toBe(true);
    });
    it("el CONFIRMAR del modal SÍ es rubí sólido (la reserva)", () => {
        const confirmar = bloqueBoton("onClick={confirmar}");
        expect(confirmar.length, "no encontré el confirmar").toBeGreaterThan(0);
        expect(/bg-rubi\b/.test(confirmar), "El confirmar del modal es el único rubí sólido.").toBe(true);
    });
});
