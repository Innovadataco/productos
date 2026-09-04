/**
 * SPEC-444 (I-310) · candado de CLASE — que la próxima vez avise sola.
 *
 * I-310 no fue un descuido de una ruta: fue una convención equivocada copiada
 * cuatro veces. Todos los modelos de PI generan el id con `@default(cuid())`
 * —verificado el 04-09-2026: cero `@default(uuid())` en `prisma/schema.prisma`—
 * así que un `z.string().uuid()` sobre un id de PI es un 400 permanente que
 * nadie ve hasta que un padre no puede pedir una cita.
 *
 * Este candado no arregla un caso: prohíbe la clase. Si aparece un
 * `z.string().uuid()` nuevo en el código de producción, este test se pone rojo
 * y obliga a declararlo abajo CON su razón. Es estático y sin base: cuesta
 * milisegundos y caza la recaída en el gate rápido.
 *
 * El radicado pedía cubrir `src/app/api/**`; el barrido va sobre TODO `src/`
 * porque los esquemas compartidos (`src/lib/schemas/**`) alimentan rutas y el
 * defecto se escapaba por ahí.
 *
 * Los archivos de prueba quedan fuera del barrido a propósito: un `uuid()` en
 * un test no valida entrada de producción, y este mismo archivo tiene que poder
 * nombrar el patrón que persigue.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../..");
const SRC = path.join(RAIZ, "src");

/**
 * Las ÚNICAS apariciones permitidas, cada una con la evidencia que la sostiene.
 * Agregar una línea acá es un acto deliberado y revisable en el diff, no un
 * descuido: si el id lo genera Prisma con `cuid()`, no hay justificación
 * posible y el arreglo es `cuidIdSchema`.
 */
const JUSTIFICADAS: ReadonlyArray<{ ruta: string; razon: string }> = [
    {
        ruta: "src/lib/schemas/base.ts",
        razon:
            "SPEC-173 (H02): `Materia` tiene ids MIXTOS en producción — uuid heredado " +
            "de antes de la migración + cuid nuevo. `materiaIdSchema` es la unión de " +
            "los dos. Es dato histórico real, no una convención a copiar.",
    },
];

/** Fuente sin comentarios: explicar el defecto no puede poner el gate en rojo. */
function leerCodigo(absoluto: string): string {
    return fs
        .readFileSync(absoluto, "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");
}

function archivosDeFuente(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            salida.push(...archivosDeFuente(completo));
            continue;
        }
        if (!/\.tsx?$/.test(entrada.name)) continue;
        if (/\.(test|spec)\.tsx?$/.test(entrada.name)) continue;
        salida.push(completo);
    }
    return salida;
}

const PATRON = /z\s*\.\s*string\s*\(\s*\)\s*\.\s*uuid\s*\(/;

describe("SPEC-444 · ningún identificador de PI se valida como uuid", () => {
    it("solo las apariciones declaradas usan z.string().uuid()", () => {
        const permitidas = new Set(JUSTIFICADAS.map((j) => j.ruta));

        const encontradas = archivosDeFuente(SRC)
            .filter((absoluto) => PATRON.test(leerCodigo(absoluto)))
            .map((absoluto) => path.relative(RAIZ, absoluto))
            .sort();

        const noDeclaradas = encontradas.filter((r) => !permitidas.has(r));

        expect(
            noDeclaradas,
            "Los ids de PI se generan con @default(cuid()): validarlos con uuid() " +
                "es un 400 permanente (I-310). Usá `cuidIdSchema` de " +
                "`@/lib/schemas/base`. Si de verdad hay uuid heredado en esa tabla, " +
                "declaralo en JUSTIFICADAS con la evidencia de producción.",
        ).toEqual([]);
    });

    it("cada justificación sigue existiendo — si el archivo se limpió, sobra la excepción", () => {
        for (const { ruta } of JUSTIFICADAS) {
            const absoluto = path.join(RAIZ, ruta);
            expect(fs.existsSync(absoluto), `${ruta} ya no existe`).toBe(true);
            expect(
                PATRON.test(leerCodigo(absoluto)),
                `${ruta} ya no usa z.string().uuid(): sacá su excepción de JUSTIFICADAS`,
            ).toBe(true);
        }
    });

    it("ningún modelo del esquema genera ids con uuid — la premisa del candado", () => {
        const esquema = fs.readFileSync(path.join(RAIZ, "prisma/schema.prisma"), "utf-8");
        expect(
            esquema.includes("@default(uuid())"),
            "Apareció un modelo con @default(uuid()): la premisa de SPEC-444 cambió y " +
                "hay que revisar caso por caso antes de seguir prohibiendo uuid().",
        ).toBe(false);
    });
});
