/**
 * SPEC-528 · CANDADO: el color de las acciones «dar de baja» va por
 * REVERSIBILIDAD (§7.1). El rubí sólido (`danger`) se reserva a la pérdida
 * IRREVERSIBLE; una baja reversible (toggle activo↔inactivo) NO es criticidad y
 * va en la variante SUTIL (neutra), sin acento sólido (ámbar/pino) ni rubí.
 *
 * Regla vigilada en el render de las 3 pantallas:
 *  - Un botón cuyo texto empieza por «Dar de baja» (o «Reactivar», el par
 *    reversible) NO puede ser sólido: prohibido `danger`/`primary`/`ambar`/`pino`.
 *  - El botón «Confirmar baja» (paso irreversible: borra embedding, purga dataset,
 *    ORDEN_LEGAL) DEBE ser `danger` — el único rubí.
 *
 * Verificado por MUTACIÓN: poner `danger` en un «Dar de baja» → rojo; quitar
 * `danger` de «Confirmar baja» → rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const GESTION = [
    "components/modules/profesionales-admin/ProfesionalesGestionClient.tsx",
    "components/modules/verificadores-admin/VerificadoresGestionClient.tsx",
];
const REPORTE = "components/modules/reporte-detalle/AccionesReporte.tsx";

const SOLIDO = ["danger", "primary", "ambar", "pino"];

type Boton = { variant: string; inner: string };

// Extrae cada <Button|BotonAccion …>…</…> con su variante y su texto interno.
// Salta los «>» dentro de `{() => …}` contando llaves.
function botones(code: string): Boton[] {
    const out: Boton[] = [];
    const re = /<(Button|BotonAccion)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
        const tag = m[1];
        let i = m.index + m[0].length;
        let llaves = 0;
        while (i < code.length) {
            const c = code[i];
            if (c === "{") llaves++;
            else if (c === "}") llaves--;
            else if (c === ">" && llaves === 0 && code[i - 1] !== "=") break;
            i++;
        }
        const openTag = code.slice(m.index, i + 1);
        const closeIdx = code.indexOf(`</${tag}>`, i);
        if (closeIdx === -1) continue;
        const inner = code.slice(i + 1, closeIdx);
        const vm = openTag.match(/variante?="([a-z]+)"/);
        const variant = vm ? vm[1] : tag === "BotonAccion" ? "neutral" : "primary";
        out.push({ variant, inner });
        re.lastIndex = closeIdx;
    }
    return out;
}

function leer(rel: string): Boton[] {
    return botones(fs.readFileSync(path.join(SRC, rel), "utf-8"));
}

describe("SPEC-528 · color de «dar de baja» por reversibilidad", () => {
    it("gestión (profesionales/verificadores): baja y reactivar reversibles NO son sólidas", () => {
        const malos: string[] = [];
        for (const rel of GESTION) {
            for (const b of leer(rel)) {
                const esBaja = b.inner.includes("Dar de baja");
                const esReactivar = b.inner.includes("Reactivar");
                if ((esBaja || esReactivar) && SOLIDO.includes(b.variant)) {
                    malos.push(`${rel} → «${esBaja ? "Dar de baja" : "Reactivar"}» en variante sólida «${b.variant}»`);
                }
            }
        }
        expect(malos, ["SPEC-528 — acción reversible en color sólido (debe ser neutra/sutil):", ...malos].join("\n")).toEqual([]);
    });

    it("reporte: «Dar de baja» (disparo) NO es danger/primary; «Confirmar baja» SÍ es danger", () => {
        const bs = leer(REPORTE);
        const confirmar = bs.filter((b) => b.inner.includes("Confirmar baja"));
        const disparo = bs.filter((b) => b.inner.includes("Dar de baja") && !b.inner.includes("Confirmar baja"));

        expect(confirmar.length, "no se encontró el botón «Confirmar baja»").toBeGreaterThan(0);
        for (const b of confirmar) {
            expect(b.variant, "«Confirmar baja» (irreversible) debe ser danger (§7.1)").toBe("danger");
        }
        expect(disparo.length, "no se encontró el botón «Dar de baja» de disparo").toBeGreaterThan(0);
        for (const b of disparo) {
            expect(["danger", "primary"].includes(b.variant), `«Dar de baja» (disparo) no puede ser ${b.variant}`).toBe(false);
        }
    });
});
