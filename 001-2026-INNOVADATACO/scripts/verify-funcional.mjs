/**
 * Verificación funcional sobre la app DESPLEGADA (Regla de Oro 4, D-067).
 *
 * Nace de una lección concreta: la noche del 2026-07-23 se entregaron tres
 * specs sin reconstruir la imagen. El contenedor servía un build anterior a los
 * commits, el CEO pulsó la tarjeta de proyecto, no pasó nada, y reportó I-011
 * como no resuelta — **estaba arreglada en el código y ausente del contenedor**.
 *
 * Esto comprueba en el navegador, contra el contenedor, lo que un usuario haría.
 *
 * Uso:  node scripts/verify-funcional.mjs [url]
 */
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE = process.argv[2] || "http://localhost:5001";
const USUARIO = process.env.VERIFY_USER || "admin";
const CLAVE = process.env.VERIFY_PASS || "admin123";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const capturas = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(capturas)) fs.mkdirSync(capturas, { recursive: true });

let fallos = 0;
const check = (etiqueta, ok, detalle = "") => {
  console.log(`  ${ok ? "OK   " : "FALLO"}  ${etiqueta}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

const abrirModulo = async (page, etiqueta) => {
  await page.evaluate((texto) => {
    const botones = Array.from(document.querySelectorAll("aside button"));
    botones.find((b) => b.textContent?.toUpperCase().includes(texto))?.click();
  }, etiqueta.toUpperCase());
  await dormir(900);
};

const abrirSubmodulo = async (page, titulo) => {
  await page.evaluate((texto) => {
    const pestanas = Array.from(document.querySelectorAll("button"));
    pestanas.find((b) => b.textContent?.trim().toUpperCase() === texto)?.click();
  }, titulo.toUpperCase());
  await dormir(1400);
};

const navegador = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await navegador.newPage();
await page.setViewport({ width: 1440, height: 900 });

console.log(`=== Verificación funcional contra ${BASE} ===\n`);

// ── 1 · El login entra ───────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("input[placeholder=admin]", USUARIO);
await page.type("input[type=password]", CLAVE);
await page.click("button[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle2" });
await dormir(1200);
check("el login entra", !page.url().includes("/login"), page.url());

// ── 2 · I-011: la tarjeta de proyecto abre la edición ────────────────────────
await abrirModulo(page, "Proyectos");
await abrirSubmodulo(page, "Listado");

const hayProyectos = await page.evaluate(
  () => document.body.textContent?.includes("No hay proyectos registrados") === false,
);

if (!hayProyectos) {
  check("I-011 · hay algún proyecto que probar", false, "el listado está vacío");
} else {
  // Se pulsa la FLECHA, que es exactamente lo que el CEO pulsó y no hacía nada.
  const pulsada = await page.evaluate(() => {
    const flecha = document.querySelector('button[aria-label^="Editar proyecto"]');
    if (!flecha) return false;
    flecha.click();
    return true;
  });
  await dormir(1200);

  const modal = await page.evaluate(() =>
    document.body.textContent?.includes("Editar Proyecto"),
  );
  check("I-011 · la flecha de la tarjeta existe", pulsada);
  check("I-011 · abre la edición del proyecto", Boolean(modal));

  // Gestión PM2 (spec 008, US3–US6): las cinco pestañas dentro de la edición.
  const pestanas = await page.evaluate(() => {
    const esperadas = ["Entregables", "Cronograma", "Presupuesto", "Recursos", "Lecciones"];
    const texto = document.body.textContent || "";
    return esperadas.filter((p) => texto.includes(p));
  });
  check("PM2 · las 5 colecciones están en la edición", pestanas.length === 5, pestanas.join(" · "));

  await page.screenshot({ path: path.join(capturas, "funcional-proyecto-edicion.png") });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const cerrar = Array.from(document.querySelectorAll("button")).find(
      (b) => b.querySelector("svg") && b.className.includes("text-[#444]"),
    );
    cerrar?.click();
  });
  await dormir(600);
}

// ── 3 · Base Oficial: lo no buscable se ve (spec 013) ────────────────────────
await abrirModulo(page, "Base Oficial");
await abrirSubmodulo(page, "Repositorio");

const repositorio = await page.evaluate(() => {
  const texto = document.body.textContent || "";
  return {
    hayDocumentos: !texto.includes("Sin documentos"),
    marcaNoBuscable: texto.includes("No buscable") || texto.includes("Indexando"),
    motivo: texto.includes("no aparecerá en las búsquedas"),
  };
});
check("spec 013 · el repositorio carga", repositorio.hayDocumentos);
check(
  "spec 013 · el documento no indexable está marcado",
  repositorio.marcaNoBuscable,
  repositorio.marcaNoBuscable ? "" : "ningún documento marcado (¿todos indexables?)",
);
check("spec 013 · con motivo en lenguaje llano", repositorio.motivo);
await page.screenshot({ path: path.join(capturas, "funcional-repositorio.png") });

await navegador.close();
console.log(`\n${fallos === 0 ? "=== TODO OK ===" : `=== ${fallos} FALLO(S) ===`}`);
process.exit(fallos === 0 ? 0 : 1);
