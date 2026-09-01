/**
 * SPEC-343 (I-232) · Test-candado de documentos legales SERVIDOS.
 * Falla si lo que el seed apunta (= lo que el servicio de consentimiento sirve
 * a padres y colegios) contiene notas internas de borrador. Protege contra:
 * editar el documento público con marcadores, o re-apuntar un parámetro a un
 * borrador interno.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const SEED = readFileSync(path.join(RAIZ, "prisma", "seed.ts"), "utf-8");
const MARCADORES_INTERNOS = ["[ABOGADO", "CERRADO internamente", "BORRADOR"] as const;

/** Extrae del fuente del seed el `valor` sembrado para una clave de parámetro. */
function valorSembrado(clave: string): string {
    const patron = new RegExp(
        `clave:\\s*"${clave.replace(/\./g, "\\.")}"[\\s\\S]{0,200}?valor:\\s*"([^"]+)"`
    );
    const match = SEED.match(patron);
    if (!match) throw new Error(`El seed no siembra la clave ${clave}`);
    return match[1];
}

const CLAVES_RUTA = [
    "consentimiento.padre.documento_ruta",
    "consentimiento.colegio.documento_ruta",
] as const;

describe("documentos legales servidos (SPEC-343 · candado I-232)", () => {
    for (const clave of CLAVES_RUTA) {
        describe(clave, () => {
            const ruta = valorSembrado(clave);
            const rutaAbsoluta = path.join(RAIZ, ruta);

            it("apunta bajo public/legal/", () => {
                expect(ruta.startsWith("public/legal/")).toBe(true);
            });

            it("el archivo existe y no está vacío", () => {
                expect(existsSync(rutaAbsoluta)).toBe(true);
                expect(readFileSync(rutaAbsoluta, "utf-8").trim().length).toBeGreaterThan(500);
            });

            it("no contiene marcadores internos de borrador", () => {
                const contenido = readFileSync(rutaAbsoluta, "utf-8");
                for (const marcador of MARCADORES_INTERNOS) {
                    expect(contenido, `marcador prohibido "${marcador}" en ${ruta}`).not.toContain(marcador);
                }
            });
        });
    }

    it("la versión vigente sembrada sigue siendo v0.4 (nadie re-firma)", () => {
        expect(valorSembrado("consentimiento.version_actual")).toBe("v0.4");
    });
});
