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

    /**
     * Endurecimiento: los checks de arriba miran el `href=`/`router.push(` en el
     * sitio del uso, así que se evaden guardando la URL en una variable —
     * `const href = \`/reportar?identificador=${x}\`` y después `href={href}`.
     * Así se escapó la fuga de ConsultaVaciaBloque durante toda la spec 093.
     * Esta guardia mira la CONSTRUCCIÓN de la URL, no dónde se usa: si en el
     * fuente aparece un literal con `?…identificador=`, da igual en qué variable
     * termine. Aplica también a los exentos de SPEC-233: su excepción es llevar
     * el nick como segmento de ruta, nunca como query string.
     */
    it("ningún archivo arma una URL con el identificador en el query string (aunque el href viva en una variable)", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            const contenido = fs.readFileSync(archivo, "utf-8");
            // Un literal (backtick, comilla simple o doble) con `?` … `identificador=`.
            if (/[`"'][^`"'\n]*\?[^`"'\n]*identificador=/i.test(contenido)) {
                violaciones.push(archivo);
            }
            // Y la vía sin literal: searchParams.set("identificador", …). Se
            // exige que el receptor sea un contenedor de query string — un
            // `form.append("identificador", …)` de FormData viaja en el CUERPO
            // de un POST, no en la URL, y ese no es el riesgo que cuida esta
            // guardia (ApelacionesClient hace justamente eso, y está bien).
            if (/\b\w*(?:params|query|search|url|qs)\w*\.(?:set|append)\(\s*["'`]identificador/i.test(contenido)) {
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
        // SPEC-296 (002-PI-197): el envío pasó al motor de notificaciones.
        // La protección S-2 vive ahora en dos capas: (a) el wrapper en email.ts
        // NO pasa el identificador como variable al motor, (b) la plantilla
        // "suscriptores.reporte_publicado.email" del seed NO menciona identificador
        // ni "score" en asunto ni cuerpo.

        // (a) Wrapper: dentro del bloque `variables: { ... }` NO aparece "identificador".
        // El identificador sí se usa en el `where` de Prisma (para buscar suscripciones),
        // pero JAMÁS viaja como variable de plantilla al motor de notificaciones.
        const wrapper = fs.readFileSync(path.join(SRC, "lib", "email.ts"), "utf-8");
        const inicioWrap = wrapper.indexOf("export async function enviarAlertasSuscriptores");
        expect(inicioWrap).toBeGreaterThan(-1);
        const finWrap = wrapper.indexOf("export async function", inicioWrap + 1);
        const cuerpoWrap = wrapper.slice(inicioWrap, finWrap === -1 ? undefined : finWrap);
        // Extrae SOLO el bloque `variables: {…}` del wrapper para chequear su contenido.
        const matchVars = cuerpoWrap.match(/variables:\s*\{[\s\S]*?\n\s*\},/);
        expect(matchVars, "wrapper debe declarar un bloque variables: {…}").not.toBeNull();
        const bloqueVars = matchVars ? matchVars[0] : "";
        expect(/identificador/i.test(bloqueVars)).toBe(false);
        expect(/score/i.test(bloqueVars)).toBe(false);

        // (b) Plantilla seed: la plantilla suscriptores.reporte_publicado.email
        // puede mencionar la palabra "identificador" como contexto del copy, pero
        // NO puede interpolar `{{identificador}}` (el valor real jamás sale) ni
        // mencionar "score" ni "consulta=" en URL.
        const seed = fs.readFileSync(path.join(SRC, "..", "prisma", "seed.ts"), "utf-8");
        const idxPlantilla = seed.indexOf('clave: "suscriptores.reporte_publicado.email"');
        expect(idxPlantilla).toBeGreaterThan(-1);
        const plantilla = seed.slice(idxPlantilla, idxPlantilla + 800);
        expect(plantilla).not.toContain("{{identificador}}");
        expect(plantilla).not.toContain("consulta=");
        expect(/score/i.test(plantilla)).toBe(false);
    });
});
