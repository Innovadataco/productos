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
// Medición tras rebase sobre SPEC-241: 1083 ocurrencias en 121 archivos.
// 2026-09-03 SPEC-392: directorio del padre nace con tokens (cielo/ambar) desde
// el primer commit, sin escala sky-*/amber-*. Medición: 1077 (123 archivos).
// 2026-09-03 SPEC-392 (corrección): el 1077 se midió antes de rebasar sobre L1b
// (SPEC-391 · #299 mergeado con 1079). Al rebasar sobre main, el conteo real es
// 1079 sin que este PR haya sumado nada — mis archivos siguen en 0 raws. Piso
// vuelve a 1079 para reflejar el suelo real de main. Cuando alguien migre el
// próximo bloque de sky-*/amber-* a tokens el piso vuelve a bajar.
// 2026-09-04 SPEC-455: el mueble «la gráfica» (DonutChart + BarChart) migra su
// paleta a tokens (pino/cielo/ambar + color-mix; nunca rojo) y sus textos SVG a
// fill-current + text-muted/body. Salen 14 clases crudas (slate/sky/cyan) de las
// dos gráficas compartidas. Medición sobre origin/main fresco: 1065 (122 archivos).
// 2026-09-04 SPEC-456: la portada (hero) migra su piel a tokens — el gradiente
// `from-sky-500 to-cyan-600` + todos los sky/cyan del hero y el rojo del error
// salen (marca cielo/pino + rubi). Re-medido sobre el main que YA tiene SPEC-455
// (1065): los ~27 crudos del hero salen → 1038. Es el ratchet sobre main fresco,
// no el 1052 que midió la rama antes de rebasar sobre 455.
// 2026-09-04 SPEC-454 (OLA 1 del rediseño): el mueble «Button» migra su piel al
// Sistema de Diseño — las 17 clases crudas (sky/cyan/emerald/red/slate del
// `Button.tsx`) salen; la piel vive en globals.css por token (.css no cuenta en
// este ratchet). Medición sobre origin/main fresco (1038): 1038 − 17 = 1021.
const PISO = 1021;

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

function medir(): { total: number; archivos: number } {
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
    return { total, archivos };
}

const { total, archivos } = medir();

/**
 * SPEC-466 · Modo tensión. La tensión del ratchet NO la hace cada PR (eso
 * serializaba los merges: dos muebles que bajaban crudos distintos chocaban en
 * la línea del PISO). Un barrido periódico —o un PR-bot— corre `--tension`
 * sobre `origin/main` fresco y reescribe el PISO al mínimo real medido. Baja,
 * nunca sube. Los PR que migran a tokens NO tocan esta constante: pasan por el
 * guard `<=` mientras no suban.
 */
if (process.argv.includes("--tension")) {
    if (total < PISO) {
        const archivoScript = path.resolve(__dirname, "tokens-check.ts");
        const fuente = fs.readFileSync(archivoScript, "utf8");
        const reescrito = fuente.replace(/const PISO = \d+;/, `const PISO = ${total};`);
        fs.writeFileSync(archivoScript, reescrito);
        console.log(`[Tokens:check] TENSIÓN: piso apretado ${PISO} → ${total} (mínimo real medido).`);
        process.exit(0);
    }
    console.log(`[Tokens:check] TENSIÓN: nada que apretar (conteo ${total} = piso ${PISO}).`);
    process.exit(0);
}

console.log(`[Tokens:check] Color crudo en src/** productivo: ${total} ocurrencias en ${archivos} archivos (piso: ${PISO}).`);

// SPEC-466: el guard es `<=` — solo falla si el conteo SUBE del piso. Un PR que
// BAJA crudos pasa sin tocar la constante PISO (la aprieta el barrido `--tension`,
// no el PR). Así dos muebles paralelos mergean sin serializar en esta línea.
if (total > PISO) {
    console.error(
        `[Tokens:check] ROJO: el conteo SUBIÓ del piso (${total} > ${PISO}). ` +
            "En código nuevo el color crudo está prohibido (SPEC-157, FR-007): usa tokens " +
            "(pino/cielo/ambar/rubi/papel/tinta y la capa semántica). NO subas el PISO para " +
            "que pase: quita el crudo. Si migraste pantallas y el conteo BAJÓ, NO hace falta " +
            "tocar el PISO — el barrido `npx tsx scripts/tokens-check.ts --tension` lo aprieta.",
    );
    process.exit(1);
}

console.log("[Tokens:check] VERDE: el conteo no sube del piso.");
