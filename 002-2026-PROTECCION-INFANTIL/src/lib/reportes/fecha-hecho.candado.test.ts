/**
 * SPEC-438 (I-305) · candados de la fecha del hecho — sin BD.
 *
 * El defecto: el formulario dejaba enviar sin hora y el cliente mandaba
 * `new Date()`. **El instante del envío quedaba guardado como la hora del
 * hecho.** Verificado en producción: `RPT-G0LVZS` con `fechaIncidente` igual a
 * su creación al milisegundo.
 *
 * No es un dato faltante: es un dato FALSO, indistinguible de uno verdadero,
 * alimentando la franja horaria que se le entrega al modelo, el patrón nocturno
 * y un informe con valor probatorio.
 *
 * Estos candados vigilan CONDUCTA: cada uno muere si el relleno vuelve.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");
const sinComentarios = (c: string) =>
    c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * ¿Este código le asigna a `fechaIncidente` un `new Date()` sin argumentos?
 * Cubre las dos formas que importan: la asignación directa y el ternario que
 * usaba el wizard (`fechaIncidente: x ? ... : new Date().toISOString()`).
 */
function inventaLaHora(codigo: string): boolean {
    const limpio = sinComentarios(codigo);
    // Asignación directa: `fechaIncidente: new Date()` / `new Date().toISOString()`
    if (/fechaIncidente\s*:\s*new Date\(\s*\)/.test(limpio)) return true;
    // Ternario cuya rama de respaldo fabrica la hora.
    if (/fechaIncidente\s*:[\s\S]*?\?[\s\S]*?:\s*new Date\(\s*\)/.test(limpio)) return true;
    return false;
}

/** Archivos de producción que participan en crear un reporte. */
const CAMINOS_DE_CREACION = [
    "src/components/modules/ReporteWizard.tsx",
    "src/components/modules/ReporteStepDetalle.tsx",
    "src/app/api/reportes/route.ts",
    "src/lib/dal/services/reporte-creation.ts",
];

describe("SPEC-438 · el sistema NUNCA rellena la hora del hecho", () => {
    it.each(CAMINOS_DE_CREACION)("%s no fabrica `fechaIncidente`", (rel) => {
        expect(inventaLaHora(leer(rel)), `${rel} le está inventando la hora al hecho`).toBe(false);
    });

    it("CONTRAPRUEBA · la forma exacta que tenía el wizard se detecta", () => {
        // Esto es literalmente lo que había en ReporteWizard.tsx:146-148.
        const viejo = `
            fechaIncidente: data.fechaIncidente
                ? new Date(data.fechaIncidente).toISOString()
                : new Date().toISOString(),
        `;
        expect(inventaLaHora(viejo), "el candado tiene que cazar el relleno viejo").toBe(true);
    });

    it("CONTRAPRUEBA · la asignación directa también se detecta", () => {
        expect(inventaLaHora("fechaIncidente: new Date(),")).toBe(true);
        // Y no se dispara con el uso legítimo: construir la fecha QUE ELIGIÓ el
        // reportante a partir de su valor.
        expect(inventaLaHora("fechaIncidente: new Date(data.fechaIncidente).toISOString(),")).toBe(false);
    });
});

describe("SPEC-438 · sin fecha y hora no se puede enviar", () => {
    it("el wizard no deja pasar del paso del detalle sin `fechaIncidente`", () => {
        const wizard = sinComentarios(leer("src/components/modules/ReporteWizard.tsx"));
        // La guardia del paso 2 tiene que exigir la fecha, no solo país/ciudad/texto.
        expect(wizard).toMatch(/step === 2 &&[\s\S]*!data\.fechaIncidente/);
    });

    it("el esquema del servidor la exige (no es opcional ni tiene default)", () => {
        const v = sinComentarios(leer("src/lib/validators.ts"));
        const i = v.indexOf("fechaIncidente:");
        const trozo = v.slice(i, i + 200);
        expect(trozo).toContain("z.string().datetime()");
        expect(trozo, "si fuera opcional, el servidor aceptaría un reporte sin hora").not.toMatch(
            /fechaIncidente:\s*z\.string\(\)\.datetime\(\)[^,]*\.optional\(\)/,
        );
    });
});

describe("SPEC-438 · una hora estimada queda MARCADA y llega al análisis", () => {
    it("el hecho que viaja al modelo lleva `horaAproximada`", () => {
        const payload = sinComentarios(leer("src/lib/expediente/analisis/armar-payload.ts"));
        expect(payload).toMatch(/horaAproximada:\s*boolean/);
    });

    it("el armador lo toma del reporte y NO asume precisión cuando no hay reporte", () => {
        const ejec = sinComentarios(leer("src/lib/expediente/analisis/ejecutar-analisis.ts"));
        // Sin Reporte la fecha es la del evento: no se puede afirmar precisión.
        expect(ejec).toMatch(/horaAproximada:\s*e\.reporte\?\.horaAproximada\s*\?\?\s*true/);
        // Y la consulta tiene que traerlo, o llegaría siempre `true`.
        expect(ejec).toMatch(/horaAproximada:\s*true,/);
    });
});
