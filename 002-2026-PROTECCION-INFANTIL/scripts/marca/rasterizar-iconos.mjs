// SPEC-336 · rasteriza los PNG de PWA de "El Guardián" desde el símbolo (sharp).
// Tile pino con el escudo blanco y el niño recortado (muestra el pino de fondo).
// Se corre en la raíz del worktree del logo; escribe en public/icons/.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const PINO = "#0B6E5A";
const ESCUDO = "M50 8 82 20v29C82 69.4 68.4 85.6 50 91 31.6 85.6 18 69.4 18 49V20L50 8Z";
const NINO_MASK = "<rect width=\"100\" height=\"100\" fill=\"#fff\"/><g fill=\"#000\">"
  + "<circle cx=\"50\" cy=\"44\" r=\"7\"/>"
  + "<path d=\"M50 53c-7.2 0-12.7 5.3-12.7 12.5v6.2c0 1.2 1 2.2 2.2 2.2h21c1.2 0 2.2-1 2.2-2.2v-6.2C62.7 58.3 57.2 53 50 53Z\"/>"
  + "</g>";

// El escudo (0-100) se ubica nativo; el padding se logra ampliando el viewBox
// (sin escalar la máscara). `pad` = unidades de respiro por lado; `rx` = redondeo.
function tile(pad, rx) {
    const min = -pad, size = 100 + pad * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${min} ${min} ${size} ${size}">`
    + `<defs><mask id="h">${NINO_MASK}</mask></defs>`
    + `<rect x="${min}" y="${min}" width="${size}" height="${size}" rx="${rx}" fill="${PINO}"/>`
    + `<path mask="url(#h)" fill="#FFFFFF" d="${ESCUDO}"/>`
    + "</svg>";
}

// "any": respiro ~11%, esquinas redondeadas (tile pulido).
const anySvg = tile(14, 22);
// "maskable": respiro mayor (escudo dentro de la zona segura ~66%), full-bleed.
const maskableSvg = tile(28, 0);

async function png(svg, px, out) {
    const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
    await writeFile(out, buf);
    const m = await sharp(buf).metadata();
    console.log(`${out} · ${m.width}x${m.height} · ${buf.length} bytes`);
}

await png(anySvg, 192, "public/icons/icon-192x192.png");
await png(anySvg, 512, "public/icons/icon-512x512.png");
await png(maskableSvg, 192, "public/icons/maskable-icon-192x192.png");
console.log("listo");
