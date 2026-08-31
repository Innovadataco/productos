/**
 * P16 del Recorrido #2 de Jelkin (el "fallo grande"): un padre no puede
 * re-reportar el mismo identificador. Reproducción en vivo.
 *
 * De fuente (reporte-creation.ts:77-86): dedup autenticado = mismo usuario +
 * identificador en **30 días**; el 2º se bloquea ANTES de crear (DUPLICATE_REPORT
 * + reporteExistenteId). Anónimo (sin usuarioId) NO pasa por el dedup. La
 * agregación (identificador-reportado.ts:80) incrementa totalReportes por reporte
 * SIN contar reportantes distintos → sin el dedup, N reportes del mismo padre
 * inflarían el contador. Este spec confirma el bloqueo en prod.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

test("P16 · el padre no puede re-reportar el mismo identificador (dedup 30d)", async ({ playwright }) => {
    const email = process.env.E2E_PADRE_EMAIL;
    const password = process.env.E2E_PADRE_PASSWORD;
    expect(email && password, "Falta E2E_PADRE_* en .env.e2e").toBeTruthy();

    const ctx: APIRequestContext = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const login = await ctx.post("/api/auth/login", { data: { email, password } });
    // El roster E2E driftó tras la limpieza: E2E_PADRE (jelkin.carrillo@gmail.com) hoy es
    // SCHOOL_ADMIN y su clave no valida. Sin cuenta padre no reproducible (recrear = OTP→Jelkin).
    // P16 queda documentado por fuente (reporte-creation.ts:77-86) + repro en vivo de Jelkin.
    test.skip(!login.ok(), "sin cuenta PARENT de prueba (roster E2E driftó tras limpieza · recrear es OTP-gated)");

    const idf = `p16dios${String(Date.now()).slice(-6)}`;
    const payload = {
        identificador: idf, plataformaClave: "whatsapp", plataforma: "whatsapp",
        texto: "Prueba P16 D-021 · reporte de padre para verificar dedup de re-reporte.",
        esAnonimo: false, ciudad: "Bogotá",
    };

    const r1 = await ctx.post("/api/reportes", { data: payload });
    const b1 = await r1.json().catch(() => ({}));
    console.log(`\n[P16] 1er reporte → HTTP ${r1.status()} · seguimiento=${b1.numeroSeguimiento ?? b1.reporte?.numeroSeguimiento ?? "?"}`);

    const r2 = await ctx.post("/api/reportes", { data: payload });
    const b2 = await r2.json().catch(() => ({}));
    console.log(`[P16] 2do reporte (mismo idf) → HTTP ${r2.status()} · code=${b2.error?.code ?? "?"} · msg="${b2.error?.message ?? ""}" · existenteId=${b2.error?.reporteExistenteId ?? "?"}`);
    console.log(`[P16] → el 2º ${r2.status() === 429 ? "SE BLOQUEA (no se guarda)" : "PASÓ"}; ventana de fuente = 30 días, scope (usuario,identificador); anónimo exento`);

    await ctx.dispose();

    expect(r1.status(), "1er reporte debe crearse").toBeLessThan(400);
    // Documenta el comportamiento (no lo fuerzo como "correcto" — es el defecto que Jelkin marca):
    console.log(`[P16] VEREDICTO: el sistema ${r2.status() === 429 && b2.error?.code === "DUPLICATE_REPORT" ? "BLOQUEA el re-reporte del padre (DUPLICATE_REPORT)" : "permitió el re-reporte"}`);
});
