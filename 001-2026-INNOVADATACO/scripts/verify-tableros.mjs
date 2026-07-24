/**
 * Verificación de I-014 sobre la app DESPLEGADA (spec 007, SC-012).
 *
 * Regla de Oro 4: no basta con que compile. Esto mide el tablero en el
 * contenedor, con un navegador real, a los tres anchos que exige SC-012, y
 * comprueba lo único que importaba del defecto: que **todas** las columnas se
 * ven sin desplazamiento horizontal.
 *
 * Uso:  node scripts/verify-tableros.mjs [url]
 * Por defecto http://localhost:5001
 */
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE = process.argv[2] || "http://localhost:5001";
const ANCHOS = [1280, 1440, 1920];
const USUARIO = process.env.VERIFY_USER || "admin";
const CLAVE = process.env.VERIFY_PASS || "admin123";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const capturas = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(capturas)) fs.mkdirSync(capturas, { recursive: true });

/** Mide el contenedor del tablero: ¿desborda?, ¿cuántas columnas y de qué ancho? */
function medirTablero() {
  // Se localiza por su ancla `data-testid`, NO por clases de maquetado: son
  // justo lo que la corrección cambia, y una heurística sobre el DOM acabó
  // midiendo la cabecera de la página y dando un verde falso.
  const contenedor = document.querySelector('[data-testid="kanban-tablero"]');
  if (!contenedor) return { encontrado: false };

  const columnas = Array.from(contenedor.querySelectorAll('[data-testid="kanban-columna"]'));
  if (columnas.length === 0) return { encontrado: false };

  return {
    encontrado: true,
    columnas: columnas.length,
    desbordaHorizontal: contenedor.scrollWidth > contenedor.clientWidth + 1,
    anchoContenedor: contenedor.clientWidth,
    anchoDesplazado: contenedor.scrollWidth,
    // Una columna "visible" es la que cabe entera dentro del contenedor.
    visiblesEnteras: columnas.filter((c) => {
      const col = c.getBoundingClientRect();
      const cont = contenedor.getBoundingClientRect();
      return col.left >= cont.left - 1 && col.right <= cont.right + 1;
    }).length,
    titulos: columnas.map((c) => c.querySelector("header span")?.textContent?.trim() || "?"),
    reparte: contenedor.getAttribute("data-reparte"),
  };
}

/** ¿Se sale algo del marco por la derecha? (FR-013) */
function medirDesbordeDeMarco() {
  const doc = document.documentElement;
  return {
    desbordaLaPagina: doc.scrollWidth > doc.clientWidth + 1,
    anchoPagina: doc.clientWidth,
    anchoDesplazadoPagina: doc.scrollWidth,
  };
}

async function abrirSubmodulo(page, modulo, submodulo) {
  await page.evaluate((etiqueta) => {
    const botones = Array.from(document.querySelectorAll("aside button"));
    botones.find((b) => b.textContent?.toUpperCase().includes(etiqueta))?.click();
  }, modulo.toUpperCase());
  await dormir(700);

  await page.evaluate((titulo) => {
    const pestanas = Array.from(document.querySelectorAll("button"));
    pestanas.find((b) => b.textContent?.trim().toUpperCase() === titulo)?.click();
  }, submodulo.toUpperCase());
  await dormir(1500);
}

let fallos = 0;
const check = (etiqueta, ok, detalle = "") => {
  console.log(`  ${ok ? "OK  " : "FALLO"}  ${etiqueta}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const navegador = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await navegador.newPage();

console.log(`=== I-014 · verificación de tableros contra ${BASE} ===\n`);

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("input[placeholder=admin]", USUARIO);
await page.type("input[type=password]", CLAVE);
await page.click("button[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle2" });
await dormir(1000);
console.log("Sesión iniciada.\n");

const TABLEROS = [
  { modulo: "Oportunidades", submodulo: "Tablero", archivo: "i014-oportunidades", columnasEsperadas: 5 },
  { modulo: "Proyectos", submodulo: "Fases PM²", archivo: "i014-proyectos", columnasEsperadas: 4 },
];

for (const tablero of TABLEROS) {
  console.log(`--- ${tablero.modulo} › ${tablero.submodulo} ---`);

  for (const ancho of ANCHOS) {
    await page.setViewport({ width: ancho, height: 900 });
    await dormir(400);
    await abrirSubmodulo(page, tablero.modulo, tablero.submodulo);

    const medida = await page.evaluate(medirTablero);
    const marco = await page.evaluate(medirDesbordeDeMarco);

    if (!medida.encontrado) {
      check(`${ancho}px · tablero localizado`, false, "no se encontró el contenedor");
      continue;
    }
    // Guarda contra el verde falso: si el número de columnas no es el esperado,
    // es que se midió otra cosa. Más vale fallar que dar por bueno lo que no se vio.
    check(
      `${ancho}px · se midió el tablero real`,
      medida.columnas >= tablero.columnasEsperadas,
      `${medida.columnas} columnas, se esperaban ${tablero.columnasEsperadas}`,
    );

    console.log(
      `  ${ancho}px → ${medida.columnas} columnas [${medida.titulos.join(" · ")}], ` +
        `contenedor ${medida.anchoContenedor}px / contenido ${medida.anchoDesplazado}px`,
    );
    // SC-012: todas las columnas visibles, sin desplazamiento horizontal.
    check(`${ancho}px · sin desplazamiento horizontal`, !medida.desbordaHorizontal);
    check(
      `${ancho}px · todas las columnas visibles enteras`,
      medida.visiblesEnteras === medida.columnas,
      `${medida.visiblesEnteras}/${medida.columnas}`,
    );
    // FR-013: nada del marco recortado.
    check(`${ancho}px · la página no desborda`, !marco.desbordaLaPagina);

    await page.screenshot({
      path: path.join(capturas, `${tablero.archivo}-${ancho}.png`),
      fullPage: false,
    });
  }
  console.log("");
}

await navegador.close();

console.log(fallos === 0 ? "=== TODO OK ===" : `=== ${fallos} FALLO(S) ===`);
process.exit(fallos === 0 ? 0 : 1);
