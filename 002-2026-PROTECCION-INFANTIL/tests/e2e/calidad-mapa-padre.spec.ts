/**
 * Mapa de las DOS áreas del padre (D-021 · hallazgo de Jelkin).
 *
 * Jelkin (PARENT en vivo) reportó que /dashboard/padre/{circulo,notificaciones,perfil}
 * muestran "próximamente" mientras /dashboard/{...} sí funcionan. Además el redirect por
 * rol manda al área vieja (/dashboard), así que el home proactivo de /dashboard/padre no
 * se ve al entrar. Esto NO es un bug suelto: es una decisión de arquitectura (¿cuál es EL
 * área del padre?). Este spec produce el MAPA en vivo para que Jelkin decida con datos.
 *
 * No rompe: es diagnóstico. Marca cada ruta como PLACEHOLDER / FUNCIONAL / REDIRIGE.
 */
import { test, expect } from "@playwright/test";

const PLACEHOLDER = /pr[oó]ximamente|estar[aá] disponible|esta secci[oó]n/i;

const RUTAS = [
    // Zona NUEVA (/dashboard/padre/*) — donde vive lo de Kimi
    { zona: "padre", ruta: "/dashboard/padre", nota: "home proactivo (Kimi)" },
    { zona: "padre", ruta: "/dashboard/padre/circulo-confianza", nota: "" },
    { zona: "padre", ruta: "/dashboard/padre/notificaciones", nota: "" },
    { zona: "padre", ruta: "/dashboard/padre/perfil", nota: "" },
    { zona: "padre", ruta: "/dashboard/padre/reportar", nota: "" },
    { zona: "padre", ruta: "/dashboard/padre/suscripcion", nota: "" },
    { zona: "padre", ruta: "/dashboard/padre/expedientes", nota: "" },
    // Zona VIEJA (/dashboard/*) — a donde redirige el login
    { zona: "dashboard", ruta: "/dashboard", nota: "a donde cae el padre al entrar" },
    { zona: "dashboard", ruta: "/dashboard/circulo-confianza", nota: "" },
    { zona: "dashboard", ruta: "/dashboard/apelaciones", nota: "" },
    { zona: "dashboard", ruta: "/dashboard/mis-reportes", nota: "" },
];

test("MAPA · las dos áreas del padre (placeholder vs funcional)", async ({ browser }) => {
    const email = process.env.E2E_PADRE_EMAIL;
    const password = process.env.E2E_PADRE_PASSWORD;
    expect(email && password, "Falta E2E_PADRE_* en .env.e2e").toBeTruthy();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok(), `login PARENT status=${login.status()}`).toBeTruthy();

    console.log("\n================ MAPA DE LAS DOS ÁREAS DEL PADRE ================");
    for (const { zona, ruta, nota } of RUTAS) {
        const resp = await page.goto(ruta, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
        await page.waitForTimeout(1_800);
        const urlFinal = page.url().replace("https://pi.innovadataco.com", "");
        const texto = await page.locator("main, body").first().innerText().catch(() => "");
        const esPlaceholder = PLACEHOLDER.test(texto);
        const redirige = !urlFinal.startsWith(ruta);
        const status = resp?.status() ?? 0;
        let veredicto = "FUNCIONAL";
        if (redirige) veredicto = `REDIRIGE → ${urlFinal}`;
        else if (esPlaceholder) veredicto = "PLACEHOLDER (próximamente)";
        const primera = texto.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(2, 6).join(" · ").slice(0, 120);
        console.log(`[${zona}] ${ruta}${nota ? ` (${nota})` : ""}`);
        console.log(`        HTTP ${status} · ${veredicto} · muestra: ${primera}`);
    }
    console.log("================================================================\n");
    await ctx.close();
});
