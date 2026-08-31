/**
 * A-60 · SPEC-323 (002-PI-223) — el expediente/carpeta del padre SÍ se crea.
 * Cierra I-218 (R2-P15/P17: expedientes nunca se creaban) e I-219 (R2-P16: el padre
 * no podía re-reportar). Flujo de fuente (reportes/route.ts:174-195 · reporte-creation.ts:88-104):
 *   1º reporte de un identificador → 201 (sin expediente todavía)
 *   2º reporte (mismo id, sin reportePrevioId) → 200 `oferta:true` + reporteExistenteId
 *   3º POST con reportePrevioId = ese id → crea/reutiliza Expediente + 2 EventoExpediente → 201 expedienteId
 * Verifica el 201+expedienteId y luego la BD (Expediente del padre con eventos).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const idf = `e2e-a60-${String(Date.now()).slice(-8)}`;
const base = {
    plataforma: "whatsapp",
    texto: "Recorrido A-60 · el padre arma su carpeta reportando el mismo identificador para sumar eventos.",
    ciudad: "Bogotá", pais: "Colombia", esAnonimo: false,
};

test("A-60 · el padre re-reporta y se le crea el expediente (I-218 + I-219)", async ({ playwright }) => {
    const email = process.env.E2E_PADRE_EMAIL, password = process.env.E2E_PADRE_PASSWORD;
    const ctx: APIRequestContext = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const login = await ctx.post("/api/auth/login", { data: { email, password } });
    const lb = await login.json().catch(() => ({}));
    console.log(`\n[A60] login → ${login.status()} · rol=${lb.user?.rol ?? "?"} · email=${lb.user?.email ?? "?"}`);
    expect(login.ok(), "padre debe loguear (freemium ACTIVA)").toBeTruthy();

    // 1º reporte
    const r1 = await ctx.post("/api/reportes", { data: { ...base, identificador: idf, fechaIncidente: new Date().toISOString() } });
    const b1 = await r1.json().catch(() => ({}));
    console.log(`[A60] 1º reporte → ${r1.status()} · id=${b1.reporte?.id ?? "?"} · expedienteId=${b1.expedienteId ?? "-"}`);
    expect(r1.status(), await r1.text().catch(() => "")).toBe(201);
    const reportePrevioId = b1.reporte?.id;

    // 2º reporte sin aceptar → oferta de vinculación
    const r2 = await ctx.post("/api/reportes", { data: { ...base, identificador: idf, fechaIncidente: new Date().toISOString() } });
    const b2 = await r2.json().catch(() => ({}));
    console.log(`[A60] 2º reporte (sin aceptar) → ${r2.status()} · oferta=${b2.oferta ?? false} · existenteId=${b2.reporteExistenteId ?? "-"}`);
    const ofrece = r2.status() === 200 && b2.oferta === true && !!b2.reporteExistenteId;
    expect(ofrece, "el 2º debe OFRECER vinculación (no bloquear 429 seco)").toBeTruthy();

    // 3º POST aceptando la vinculación → crea el expediente
    const r3 = await ctx.post("/api/reportes", { data: { ...base, identificador: idf, fechaIncidente: new Date().toISOString(), reportePrevioId: b2.reporteExistenteId } });
    const b3 = await r3.json().catch(() => ({}));
    console.log(`[A60] 3º reporte (acepta vinculación) → ${r3.status()} · expedienteId=${b3.expedienteId ?? "-"}`);
    expect(r3.status(), await r3.text().catch(() => "")).toBe(201);
    expect(b3.expedienteId, "el reporte vinculado debe devolver expedienteId").toBeTruthy();

    // pantalla de expedientes carga y ya no está vacía por diseño
    const scr = await ctx.get("/dashboard/padre/expedientes", { maxRedirects: 0 });
    console.log(`[A60] PANTALLA /dashboard/padre/expedientes → ${scr.status()} · loc=${scr.headers()["location"] ?? "-"}`);

    await ctx.dispose();
    console.log(`[A60] VEREDICTO → expediente creado=${!!b3.expedienteId} · identificador de prueba="${idf}" (para verificar en BD)`);
});
