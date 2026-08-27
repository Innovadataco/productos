/**
 * Recorrido de Calidad · G · Vigilancia del admin (Campaña 5).
 *
 * Verifica que el ADMIN puede abrir y ver contenido en las 10 pantallas del recorrido G
 * del PLAN-PRUEBAS-INTEGRAL. No pasa por guardián de vigencia (SPEC-242) — el rol ADMIN
 * no es titular de suscripción — así que el bucle de I-141 no aplica aquí.
 *
 * Estrategia: no forzamos una única aserción "todo verde"; cada paso captura evidencia
 * (URL final, texto visible mínimo, screenshot) y anota si aparecen los patrones
 * documentados en incidencias vivas: I-98 (ficha colegio sin datos), I-104 (semáforos
 * sin leyenda), I-114 (operadores en cero pese a casos reales). Las asserts son
 * "smoke" — la pantalla renderiza y muestra un contenido plausible; los hallazgos
 * cualitativos se reportan en el R-008.
 */
import { test, expect } from "@playwright/test";

// La autenticación viene del setup project `calidad-auth.setup.ts`, que ya dejó
// el storageState cargado (config playwright.config.calidad.ts, projects).
const COLEGIO_ID = "cmtabxxrw005o9bnorhaqmcox"; // Sagrado corazon (BD prod, 2026-08-27)

interface Paso {
    id: string;
    ruta: string;
    esperar?: RegExp;
    notas?: string;
}

const PASOS: Paso[] = [
    { id: "G1", ruta: "/dashboard/admin/estadisticas/operacion", notas: "Semáforos del tablero operativo (I-104 hist.)" },
    { id: "G2a", ruta: "/dashboard/admin/estadisticas/salud-motor", notas: "Salud del motor de IA" },
    { id: "G2b", ruta: "/dashboard/admin/estadisticas/motor", notas: "Métricas del motor" },
    { id: "G3", ruta: "/dashboard/admin/ia", notas: "Config del motor / laboratorio IA (registros de actividad)" },
    { id: "G4", ruta: "/dashboard/admin/estadisticas/operacion?tab=colegios", notas: "Tablero colegios (I-104)" },
    { id: "G5", ruta: `/dashboard/admin/estadisticas/operacion/colegios/${COLEGIO_ID}`, notas: "Ficha de colegio (I-98)" },
    { id: "G6", ruta: "/dashboard/admin/operadores/asignar", notas: "Distribución de carga de operadores (I-114)" },
    { id: "G8", ruta: "/dashboard/admin/estadisticas/dinero-vs-valor", notas: "Análisis dinero vs valor" },
    { id: "G9", ruta: "/dashboard/admin/configuracion", notas: "Configuración de parámetros" },
    { id: "G10", ruta: "/dashboard/admin/operadores/auditoria", notas: "Bitácora de auditoría del operador" },
];

test.describe("Recorrido G · Vigilancia del admin", () => {
    for (const paso of PASOS) {
        test(`${paso.id} · ${paso.notas}`, async ({ page }) => {
            const resp = await page.goto(paso.ruta, { waitUntil: "domcontentloaded", timeout: 30_000 });
            // Dar 2s al render de client components tras DOMContentLoaded, sin bloquearse en polling.
            await page.waitForTimeout(2_000);
            expect(resp?.status(), `${paso.id} debe responder 200/307 pero dio ${resp?.status()}`).toBeLessThan(400);

            // Sin bucle: la URL final no debe ser una recarga infinita del layout.
            expect(page.url(), `${paso.id} no puede quedar en /login`).not.toContain("/login");

            // Snapshot mínimo — la pantalla renderiza (hay algún <main> o <h1>).
            const tieneMain = await page.locator("main").count();
            const tieneEncabezado = await page.locator("h1, h2").first().isVisible().catch(() => false);
            expect(tieneMain + Number(tieneEncabezado), `${paso.id} no muestra ningún <main>/<h1>/<h2>`).toBeGreaterThan(0);

            // Captura de evidencia (siempre, no solo en fallo).
            await page.screenshot({ path: `test-results/recorrido-g-${paso.id}.png`, fullPage: true });

            // Extraer texto visible del <main> (o body si no hay main) para dejar en el traza.
            const texto = await page.locator("main, body").first().innerText().catch(() => "");
            const primeros = texto.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8).join(" · ");
            console.log(`[${paso.id}] ${paso.ruta} → ${page.url()}`);
            console.log(`         texto visible (8 primeras líneas): ${primeros.slice(0, 400)}`);
        });
    }
});
