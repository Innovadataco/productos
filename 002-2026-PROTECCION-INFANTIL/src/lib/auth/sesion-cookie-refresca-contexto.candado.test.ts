/**
 * CANDADO · I-411 · ESTADO, no transición: «Ninguna respuesta que instala cookie
 * de sesión deja el AuthContext sin refrescar.»
 *
 * Origen (alta profesional que caminó Jelkin): tras crear la cuenta, la página
 * cliente hacía `router.push` —navegación BLANDA— hacia el panel. El servidor ya
 * había sellado la cookie de sesión en esa respuesta, pero un push blando conserva
 * el runtime cliente montado ANTES de que la cookie existiera: `AuthContext` seguía
 * en `null`, así que el menú decía «Iniciar sesión» sobre el panel del profesional
 * —y no había forma de cerrar sesión—. La enumeración destapó que NO era un camino
 * sino CUATRO (padre, profesional, rector, activar); Jelkin encontró el suyo porque
 * fue el que le tocó caminar. Los otros tres llevaban vivos sin que nadie los
 * caminara. El fix (I-411): navegación DURA (`window.location`), que remonta
 * `AuthProvider` con la cookie ya puesta y pinta el menú correcto al primer intento.
 *
 * POR QUÉ ESTE CANDADO Y NO UNA LISTA A MANO ([[ceo-el-candado-contra-listas-a-mano-empezo-siendo-una-lista]]):
 * si afirmara «estos cuatro archivos usan window.location», el QUINTO camino nace
 * roto con el candado verde. El candado tiene que DESCUBRIR el quinto solo. Por eso:
 *   1) DERIVA del árbol las rutas que llaman `setSessionCookie(` (no se enumeran).
 *   2) Halla todo componente CLIENTE (no test) que invoca una de esas rutas.
 *   3) Exige que cada llamador refresque el contexto (`useAuth`/`checkSession`/
 *      `setUser`) O navegue DURO (`window.location`) sin navegación blanda.
 * Una ruta nueva que instale sesión, o un llamador nuevo con `router.push`, cae solo.
 *
 * CONTROL POSITIVO DEL INSTRUMENTO ([[ceo-verificar-ausencia-exige-control-positivo]]):
 * un barrido que no encuentra nada no prueba nada hasta que demuestre que encuentra
 * algo cuando lo hay. Este candado FALLA si el barrido no descubre las rutas o los
 * llamadores conocidos, y auto-prueba que el detector distingue conducta buena de mala.
 *
 * Vigilancia por CONDUCTA, no por texto ([[dev-candado-conducta-no-palabras]]).
 * Escanea la FUENTE en disco; corre en CI (vive en src/).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Vitest corre desde la raíz del paquete; `src/` cuelga de ahí. (No import.meta.url:
// bajo jsdom no siempre es un file:// URL — mismo criterio que los demás candados.)
const SRC = path.resolve(process.cwd(), "src");

type Fuente = { ruta: string; texto: string; cliente: boolean };

/** Recorre src/ y devuelve cada .ts/.tsx (por defecto SIN tests: no son superficie). */
function fuentesDeSrc(incluirTests = false): Fuente[] {
    const out: Fuente[] = [];
    for (const e of fs.readdirSync(SRC, { withFileTypes: true, recursive: true })) {
        if (!e.isFile()) continue;
        if (!/\.tsx?$/.test(e.name)) continue;
        if (!incluirTests && /\.test\.tsx?$/.test(e.name)) continue;
        const dir =
            (e as unknown as { parentPath?: string; path?: string }).parentPath ??
            (e as unknown as { path?: string }).path ??
            SRC;
        const abs = path.join(dir, e.name);
        const texto = fs.readFileSync(abs, "utf-8");
        const ruta = path.relative(SRC, abs).split(path.sep).join("/");
        out.push({ ruta, texto, cliente: /["']use client["']/.test(texto) });
    }
    return out;
}

/** URL pública de un route.ts a partir de su ruta relativa a src/ (deriva del árbol). */
function urlDeRoute(rutaRel: string): string | null {
    const m = rutaRel.match(/^app\/(api\/.+)\/route\.tsx?$/);
    if (!m) return null;
    // Los grupos de ruta "(...)" de Next no aparecen en la URL.
    const segs = m[1].split("/").filter((s) => !/^\(.*\)$/.test(s));
    return "/" + segs.join("/");
}

const LLAMA_SET_COOKIE = /\bsetSessionCookie\s*\(/;

/** Índice del primer literal de la URL en la fuente (arranque del camino que instala la cookie); -1 si no está. */
function indiceDeLlamada(texto: string, url: string): number {
    const cands = [texto.indexOf(`"${url}"`), texto.indexOf(`'${url}'`), texto.indexOf("`" + url)].filter((i) => i >= 0);
    return cands.length ? Math.min(...cands) : -1;
}

/** ¿Un literal de esta URL aparece en la fuente (la invoca por fetch)? */
function invoca(texto: string, url: string): boolean {
    return indiceDeLlamada(texto, url) >= 0;
}

/**
 * LA INVARIANTE — apretada (SPEC-689, hallazgo del CEO revisando 688). Un llamador
 * cliente cumple si refresca el AuthContext (`useAuth`/`checkSession`/`setUser`) O
 * navega DURO (`window.location`) sin navegación blanda.
 *
 * La versión de 688 miraba `window.location` en CUALQUIER parte del archivo: un
 * componente que use `window.location.search` para leer un parámetro Y navegue
 * blando tras instalar la cookie pasaba VERDE sobre el defecto que vigila. Apretado:
 * la navegación (dura y blanda) se mide SOLO en el camino que sigue a la llamada a
 * la ruta que instala la cookie (el texto DESPUÉS del literal de la URL). Así, un
 * `window.location.search` arriba ya no salva a un `router.push` de abajo, y una
 * navegación blanda DESPUÉS de la llamada es roja aunque haya `window.location` en
 * otro lado. El refresco de contexto sí vale en cualquier parte: refresca el
 * AuthContext montado, no depende del orden.
 */
function cumpleInvariante(texto: string, url: string): boolean {
    const refrescaContexto = /\buseAuth\b|\bcheckSession\s*\(|\bsetUser\s*\(/.test(texto);
    const i = indiceDeLlamada(texto, url);
    const despues = i >= 0 ? texto.slice(i) : texto; // el camino tras instalar la cookie
    const navBlanda = /\brouter\.(?:push|replace)\s*\(/.test(despues);
    const navDura = /\bwindow\.location\b/.test(despues);
    return refrescaContexto || (navDura && !navBlanda);
}

describe("I-411 · toda ruta que instala cookie de sesión refresca el AuthContext en el cliente", () => {
    const fuentes = fuentesDeSrc();

    // (1) DERIVAR del árbol las rutas que instalan sesión.
    const rutasCookie = fuentes
        .filter((f) => /\/route\.tsx?$/.test(f.ruta) && LLAMA_SET_COOKIE.test(f.texto))
        .map((f) => urlDeRoute(f.ruta))
        .filter((u): u is string => !!u);

    // (2) Para cada ruta, los componentes CLIENTE (no test) que la invocan.
    const clientes = fuentes.filter((f) => f.cliente);
    const callers: { ruta: string; archivo: string; texto: string }[] = [];
    for (const r of rutasCookie) {
        for (const c of clientes) {
            if (invoca(c.texto, r)) callers.push({ ruta: r, archivo: c.ruta, texto: c.texto });
        }
    }

    it("CONTROL POSITIVO · el barrido DESCUBRE rutas que instalan sesión (no está ciego)", () => {
        // Si esto diera 0, el escaneo se rompió y todo lo demás pasaría en vacío.
        // Anclamos a rutas que HOY instalan sesión (los cuatro altas).
        expect(rutasCookie.length).toBeGreaterThan(0);
        expect(rutasCookie).toContain("/api/auth/registro/completar");
        expect(rutasCookie).toContain("/api/auth/registro-profesional/completar");
        expect(rutasCookie).toContain("/api/auth/registro-colegio/completar");
        expect(rutasCookie).toContain("/api/auth/activar");
    });

    it("CONTROL POSITIVO · el barrido ENCUENTRA los llamadores cliente conocidos", () => {
        // Si esto diera 0, la búsqueda de llamadores se rompió → un caller roto pasaría
        // inadvertido. Debe encontrar los cuatro altas (y su nombre real).
        const archivos = new Set(callers.map((c) => c.archivo));
        expect(archivos.size).toBeGreaterThanOrEqual(4);
        expect([...archivos].some((a) => a.includes("registro-profesional/crear-clave"))).toBe(true);
        expect([...archivos].some((a) => a.includes("ActivarForm"))).toBe(true);
    });

    it("CONTROL POSITIVO · el detector distingue conducta buena de mala (no está pegado en verde)", () => {
        // El detector mira conducta (router.push( / window.location / useAuth), no
        // el estilo de comillas: los ejemplos usan comillas simples adentro.
        const RUTA = "/api/x/completar";
        const MALO = "await fetch('/api/x/completar'); router.push('/panel');";
        const BUENO_DURO = "await fetch('/api/x/completar'); window.location.assign('/panel');";
        const BUENO_CTX = "const { login } = useAuth(); await fetch('/api/auth/login');";
        // GAP que apretó SPEC-689 (hallazgo del CEO): un `window.location.search`
        // ANTES de la llamada NO es la navegación del alta. El discriminador puro
        // —search arriba y NINGUNA nav dura después— daba VERDE en 688 (veía
        // `window.location` en cualquier parte) y ahora debe dar ROJO.
        const GAP_SEARCH_SIN_DURA = "const q = window.location.search; await fetch('/api/x/completar'); router.push('/panel');";
        const GAP_SEARCH_SOLA = "const q = window.location.search; await fetch('/api/x/completar');";
        expect(cumpleInvariante(MALO, RUTA)).toBe(false);
        expect(cumpleInvariante(BUENO_DURO, RUTA)).toBe(true);
        expect(cumpleInvariante(BUENO_CTX, "/api/auth/login")).toBe(true);
        expect(cumpleInvariante(GAP_SEARCH_SIN_DURA, RUTA), "search arriba no salva la nav blanda de después").toBe(false);
        expect(cumpleInvariante(GAP_SEARCH_SOLA, RUTA), "search arriba no cuenta como nav dura del alta (era el falso-verde de 688)").toBe(false);
        // Dura Y blanda mezcladas DESPUÉS de la llamada = ambiguo → falla.
        expect(cumpleInvariante(`${BUENO_DURO} router.replace('/otra');`, RUTA)).toBe(false);
    });

    // (3) LA INVARIANTE, una aserción por llamador real descubierto.
    for (const c of callers) {
        it(`«${c.archivo}» refresca AuthContext tras invocar ${c.ruta}`, () => {
            expect(
                cumpleInvariante(c.texto, c.ruta),
                `«${c.archivo}» invoca ${c.ruta} (instala cookie de sesión) pero navega BLANDO ` +
                    "sin refrescar el AuthContext. El menú quedará en «Iniciar sesión» sobre el " +
                    "panel (I-411). Use navegación DURA: window.location.assign(destino) — remonta " +
                    "AuthProvider con la cookie ya puesta — o refresque el contexto (useAuth/checkSession).",
            ).toBe(true);
        });
    }
});
