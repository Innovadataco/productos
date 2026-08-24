import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard estructural (spec 091 fix): la fuga del identificador a la URL está muerta.
 * 1. La página /consulta fue eliminada (404).
 * 2. Ningún href ni router.push deja el identificador en la URL (debe dar 0).
 */

const SRC = path.resolve(__dirname, "..");

/**
 * SPEC-233 (002-PI-133, diseño aprobado por ZEUS en compuerta): las vistas
 * autenticadas de búsqueda por identificador (`/dashboard/padre/identificador/[nick]`
 * y `/dashboard/admin/identificador/[nick]`) llevan en la URL el nick que el propio
 * usuario autenticado digitó — no es una fuga del área pública (spec 091 protegía
 * /consulta y /seguimiento). Estos 3 archivos quedan exentos SOLO de los checks de
 * href/router.push con el literal "identificador"; el resto de la guardia sigue
 * aplicándoles (fetch, área padre 093, email S-2). La lista SOLO ENCOGE.
 */
const EXENTOS_SPEC_233 = new Set([
    "components/modules/padre/IdentificadorBusquedaClient.tsx",
    "components/modules/admin/IdentificadorAdminClient.tsx",
    "components/modules/padre/ExpedienteDetalleClient.tsx",
]);

function esExentoSpec233(archivo: string): boolean {
    return EXENTOS_SPEC_233.has(path.relative(SRC, archivo).split(path.sep).join("/"));
}

function archivos(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            if (!["node_modules", ".next", "__pycache__"].includes(entrada.name)) {
                salida.push(...archivos(full));
            }
        } else if (/\.(ts|tsx)$/.test(entrada.name) && !entrada.name.endsWith(".test.ts") && !entrada.name.endsWith(".test.tsx")) {
            salida.push(full);
        }
    }
    return salida;
}

describe("privacidad URL del identificador (spec 091 fix)", () => {
    it("la página /consulta no existe (404)", () => {
        expect(fs.existsSync(path.join(SRC, "app", "consulta", "page.tsx"))).toBe(false);
    });

    it("ningún href deja el identificador en la URL", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            if (esExentoSpec233(archivo)) continue;
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (/href=\{[^}]*identificador/.test(contenido) || /href="[^"]*identificador=/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });

    it("ningún fetch() deja el identificador en la URL (query string)", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            const contenido = fs.readFileSync(archivo, "utf-8");
            // fetch(`/algo?identificador=` o fetch("/algo?identificador="
            if (/fetch\(`[^`]*\?[^`]*identificador=/.test(contenido) || /fetch\(["'][^"']*\?[^"']*identificador=/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });

    it("área del padre: ningún href/push/fetch deja identificador ni RPT en la URL (spec 093-US4)", () => {
        const areasPadre = ["src/app/dashboard/mis-reportes", "src/app/dashboard/circulo-confianza", "src/app/dashboard/page.tsx", "src/components/modules/MisReporte", "src/components/modules/DashboardUsuario", "src/components/modules/SeguimientoClient", "src/components/modules/CirculoConfianza"];
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            if (!areasPadre.some((a) => archivo.includes(a))) continue;
            if (archivo.includes("/admin/")) continue; // el área ADMIN no es el área del padre
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (/href=\{[^}]*\?[^}]*\$\{/.test(contenido) || /router\.push\(`[^`]*\?[^`]*\$\{/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });

    it("ningún router.push deja el identificador en la URL", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            if (esExentoSpec233(archivo)) continue;
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (/router\.push\([^)]*identificador/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });

    it("el email a suscriptores NUNCA lleva el identificador ni 'score' (S-2, 002-PI-052)", () => {
        const fuente = fs.readFileSync(path.join(SRC, "lib", "email.ts"), "utf-8");
        const inicio = fuente.indexOf("export async function enviarAlertasSuscriptores");
        expect(inicio).toBeGreaterThan(-1);
        // Solo el bloque del template (subject/text), sin comentarios del código.
        const envio = fuente.slice(inicio);
        const inicioTemplate = envio.indexOf("resend.emails.send({");
        expect(inicioTemplate).toBeGreaterThan(-1);
        const plantilla = envio.slice(inicioTemplate);

        // Ni en el asunto ni en URLs (la consulta pública es por POST, spec 091).
        expect(/subject:\s*`[^`]*identificador/.test(plantilla)).toBe(false);
        expect(plantilla).not.toContain("consulta=");
        expect(plantilla).not.toContain("encodeURIComponent(payload.identificador)");
        // Presunción de inocencia (§1.3): nunca "score" de cara al usuario.
        expect(/score/i.test(plantilla)).toBe(false);
    });
});
