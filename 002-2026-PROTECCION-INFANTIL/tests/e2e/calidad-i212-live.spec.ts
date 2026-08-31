import { test, expect } from "@playwright/test";
test("I-212 live · comité aterriza en su panel (no /mis-reportes)", async ({ browser }) => {
  const email = process.env.E2E_COMITE_CONVIVENCIA_EMAIL, pw0 = process.env.E2E_COMITE_CONVIVENCIA_PASSWORD;
  expect(email && pw0, "Falta E2E_COMITE_CONVIVENCIA_*").toBeTruthy();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const login = await page.request.post("/api/auth/login", { data: { email, password: pw0 } });
  console.log(`[I-212L] login comité → ${login.status()}`);
  expect(login.ok()).toBeTruthy();
  // porteros A-56: si tiene clave temporal, cambiarla; aceptar consent
  const pw = `${pw0}Z9!`;
  const cp = await page.request.post("/api/auth/cambiar-password", { data: { passwordActual: pw0, passwordNueva: pw, passwordNuevaConfirmacion: pw } });
  if (cp.ok()) { await page.request.post("/api/auth/login", { data: { email, password: pw } }); }
  await page.request.post("/api/consentimiento/aceptar", { data: { documentoTipo: "CONVENIO_INSTITUCIONAL", esRepresentanteLegal: false } }).catch(() => {});
  // landing tras login (homeParaRol)
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`[I-212L] /dashboard → ${page.url().replace("https://pi.innovadataco.com","")}`);
  // panel del comité
  await page.goto("/dashboard/colegio/comite", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2000);
  const url = page.url().replace("https://pi.innovadataco.com","");
  const texto = await page.locator("main, body").first().innerText().catch(() => "");
  const enMisReportes = url.includes("/mis-reportes");
  const errorPadre = /no pudimos cargar tus reportes|ocurrió un problema al consultar/i.test(texto);
  console.log(`[I-212L] /dashboard/colegio/comite → ${url} · misReportes=${enMisReportes} · errorPadre=${errorPadre}`);
  console.log(`[I-212L] VEREDICTO: ${!enMisReportes && !errorPadre ? "CUMPLE (comité en su panel, no pantalla de padre)" : "🔴 NO CUMPLE"}`);
  await page.screenshot({ path: "test-results/i212-live.png", fullPage: true }).catch(() => {});
  await ctx.close();
  expect(enMisReportes, "no debe caer en /mis-reportes").toBeFalsy();
  expect(errorPadre, "no debe mostrar error de padre").toBeFalsy();
});
