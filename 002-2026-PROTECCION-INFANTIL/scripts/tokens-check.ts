/**
 * SPEC-157 · `npm run tokens:check` — ratchet anti color crudo (D2, ZEUS 2026-08-03).
 *
 * Cuenta las ocurrencias de clases Tailwind con color crudo (escala numérica de una
 * familia de la paleta por defecto) en `src/**` PRODUCTIVO (excluye `*.test.ts(x)`).
 * Falla (exit 1) si el conteo SUBE del piso sembrado: el piso solo baja, porque las
 * pantallas migran a tokens por desgaste y el código nuevo tiene prohibido el color
 * crudo (candado SPEC-157, FR-007).
 *
 * Patrón contado (idéntico al de la medición):
 *   prefijos  text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|
 *             accent|decoration|stroke|fill|shadow
 *   familias  slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|
 *             emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose
 *   escala    -[0-9]{2,3} con sufijo opcional /NN (opacidad)
 *
 * Uso: `npx tsx scripts/tokens-check.ts` (o `npm run tokens:check`).
 */
import * as fs from "node:fs";
import * as path from "node:path";

// 2026-08-03 SPEC-157: piso medido con `grep -rEo '\b(text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(/[0-9]{1,3})?\b' src --include='*.ts' --include='*.tsx' --exclude='*.test.ts' --exclude='*.test.tsx' | wc -l` → 1166 (116 archivos)
// 2026-08-04 SPEC-146: el wizard reemplaza los PageClients de nuevo/ y carga/
// (redirects) — el conteo baja a 1135 y el piso baja con él (ratchet).
// 2026-08-25 SPEC-241: ModalConsentimiento migra dark:bg-slate-900/50 → dark:bg-tinta/50
// y accent-sky-600 ×2 → accent-cielo (D-74 · Padre = cielo).
// 2026-08-25 SPEC-243: PlanesAdminCRUD migra text-emerald-600/text-red-600 → text-pino/text-rubi
// y PlanesPagosTabs migra border-sky-600/text-sky-600 → border-ambar/text-ambar (Admin = ambar).
const PISO = 1092;

const PATRON =
    /\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

const RAIZ_SRC = path.resolve(__dirname, "..", "src");

function* recorrer(directorio: string): Generator<string> {
    for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
        const ruta = path.join(directorio, entrada.name);
        if (entrada.isDirectory()) {
            yield* recorrer(ruta);
        } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
            yield ruta;
        }
    }
}

let total = 0;
let archivos = 0;
for (const ruta of recorrer(RAIZ_SRC)) {
    const contenido = fs.readFileSync(ruta, "utf8");
    const coincidencias = contenido.match(PATRON);
    if (coincidencias && coincidencias.length > 0) {
        total += coincidencias.length;
        archivos += 1;
    }
}

console.log(`[Tokens:check] Color crudo en src/** productivo: ${total} ocurrencias en ${archivos} archivos (piso: ${PISO}).`);

if (total > PISO) {
    console.error(
        `[Tokens:check] ROJO: el conteo SUBIÓ del piso (${total} > ${PISO}). ` +
            "En código nuevo el color crudo está prohibido (SPEC-157, FR-007): usa tokens " +
            "(pino/cielo/ambar/rubi/papel/tinta y la capa semántica). Si migraste pantallas " +
            "a tokens y el conteo BAJÓ, actualiza la constante PISO con la nueva medición.",
    );
    process.exit(1);
}

console.log("[Tokens:check] VERDE: el conteo no sube del piso.");
