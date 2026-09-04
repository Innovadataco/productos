/**
 * SPEC-403 (I-288) · candados de la comisión de la red.
 *
 * El número vivía quemado en el código (`= 15`) dentro de una ruta, invisible
 * para el resto. El correcto es **10** y lo cambia Jelkin sin desplegar. Estos
 * tests impiden las dos recaídas: que alguien lo vuelva a quemar, y que el
 * seed le pise el valor al admin en el próximo despliegue.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { desglosarTarifa, CLAVE_COMISION } from "./comision";

const RAIZ = path.resolve(__dirname, "../../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

describe("SPEC-403 · el porcentaje no vuelve al código", () => {
    it("nadie quema un porcentaje en los consumidores", () => {
        for (const ruta of [
            "src/app/api/padre/citas/route.ts",
            "src/lib/profesional/panel/panel.service.ts",
            "src/lib/profesional/cita/comision.ts",
        ]) {
            const codigo = leerCodigo(ruta);
            expect(codigo, `${ruta} no puede declarar el porcentaje`).not.toMatch(
                /PORCENTAJE_SERVICIO(_DEFAULT)?\s*=\s*\d+/,
            );
            expect(codigo, `${ruta} no puede pasar un literal como porcentaje`).not.toMatch(
                /porcentajeServicio:\s*\d+/,
            );
        }
    });

    it("los dos consumidores leen del MISMO parámetro", () => {
        expect(leerCodigo("src/app/api/padre/citas/route.ts")).toContain("obtenerPorcentajeServicio()");
        expect(leerCodigo("src/lib/profesional/panel/panel.service.ts")).toContain("obtenerPorcentajeServicio()");
        expect(CLAVE_COMISION).toBe("comision.porcentaje");
    });

    it("el candado detecta la forma vieja (contraprueba)", () => {
        const quema = (l: string) => /PORCENTAJE_SERVICIO(_DEFAULT)?\s*=\s*\d+/.test(l);
        expect(quema("const PORCENTAJE_SERVICIO_DEFAULT = 15;")).toBe(true);
        expect(quema("const porcentaje = await obtenerPorcentajeServicio();")).toBe(false);
    });
});

describe("SPEC-403 · el seed no le pisa el valor al admin", () => {
    const seed = leerCodigo("prisma/seed.ts");
    const bloque = seed.slice(seed.indexOf("async function seedComisionRed"));
    const cuerpo = bloque.slice(0, bloque.indexOf("\n}"));

    it("siembra 10, que es el número del brief", () => {
        expect(cuerpo).toContain('valor: "10"');
        expect(cuerpo).toContain('clave: "comision.porcentaje"');
    });

    it("usa `update: {}` — un despliegue NO reescribe lo que el admin ajustó", () => {
        // Con `update: { valor }` cada deploy le devolvería el número al default
        // sin decírselo. Es plata: tiene que quedarse como él lo dejó.
        expect(cuerpo).toContain("update: {}");
        expect(cuerpo).not.toMatch(/update:\s*\{\s*valor/);
    });

    it("se ejecuta desde main()", () => {
        expect(seed).toContain("await seedComisionRed();");
    });
});

describe("SPEC-403 · el desglose usa el redondeo del cobro", () => {
    it("al 10% del brief", () => {
        const d = desglosarTarifa(180000, 10);
        expect(d).toEqual({
            tarifaProfesional: 180000,
            servicioRed: 18000,
            pagaElPadre: 198000,
            porcentajeServicio: 10,
        });
    });

    it("una tarifa impar redondea como el motor (`round`, no `floor`)", () => {
        expect(desglosarTarifa(99999, 10).servicioRed).toBe(Math.round((99999 * 10) / 100));
        expect(desglosarTarifa(12345, 15).servicioRed).toBe(Math.round((12345 * 15) / 100));
    });

    it("al 0% el padre paga la tarifa y nada más", () => {
        const d = desglosarTarifa(180000, 0);
        expect(d.servicioRed).toBe(0);
        expect(d.pagaElPadre).toBe(180000);
    });
});
