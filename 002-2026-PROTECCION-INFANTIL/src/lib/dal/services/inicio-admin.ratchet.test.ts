/**
 * SPEC-381 (I-269) — Candado: cada `ruta` que devuelve `inicio-admin.ts`
 * DEBE existir como `page.tsx` en el árbol de Next.
 *
 * Contexto: el "menú honesto" (existía como ratchet en `nav-items`) verifica
 * los hrefs PINTADOS en el nav — no las rutas devueltas EN RUNTIME por los
 * builders. Ese hueco dejó pasar `/dashboard/admin/notificaciones/salud`, que
 * Jelkin encontró rompiendo con 404 al hacer clic en «Ver» de una señal de
 * alarma (I-269). Este test escanea el módulo, extrae los literales de `ruta`
 * y afirma que TODOS tienen su page correspondiente.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const FUENTE = path.join(REPO, "src", "lib", "dal", "services", "inicio-admin.ts");
const APP_ROOT = path.join(REPO, "src", "app");

/**
 * Extrae toda ruta `/dashboard/...` que aparezca en el módulo como valor de
 * `ruta:` o como valor a la derecha de un `?:`/`:` inline. Simple y sin
 * dependencia de AST — el fichero se mantiene con este formato.
 */
function extraerRutasAdmin(fuente: string): string[] {
    const rutas = new Set<string>();
    // Casos: ruta: "/dashboard/..."   y   ? "/dashboard/..." : "/dashboard/..."
    const re = /"(\/dashboard\/[a-zA-Z0-9/_-]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente))) rutas.add(m[1]!);
    return [...rutas].sort();
}

/** Comprueba si Next puede resolver la ruta con un `page.tsx` (app router). */
function rutaTienePage(ruta: string): boolean {
    // `/dashboard/admin/comite` → `src/app/dashboard/admin/comite/page.tsx`
    const rel = ruta.replace(/^\//, "");
    return fs.existsSync(path.join(APP_ROOT, rel, "page.tsx"));
}

describe("inicio-admin.ts · candado del menú honesto (SPEC-381 · I-269)", () => {
    const fuente = fs.readFileSync(FUENTE, "utf-8");
    const rutas = extraerRutasAdmin(fuente);

    it("declara al menos una ruta (el módulo no está vacío)", () => {
        expect(rutas.length).toBeGreaterThan(0);
    });

    // Un it por ruta: si se rompe una sola, el mensaje dice cuál y sale el
    // atajo mental del CEO en el diagnóstico (no un test opaco).
    for (const ruta of rutas) {
        it(`${ruta} tiene page.tsx en src/app`, () => {
            expect(rutaTienePage(ruta), `Falta src/app${ruta}/page.tsx`).toBe(true);
        });
    }
});
