import * as fs from "node:fs";
import * as path from "node:path";
import { ARCHIVOS_GET_MUTA, SUPERFICIE_GET_MUTA } from "../../src/lib/auth/superficie-get-muta";

/**
 * SPEC-619 (I-371 · D-131) · Candado de CLASE: ningún GET-que-muta NUEVO fuera de la lista compartida.
 *
 * Hoy `SameSite=Strict` tapa la categoría «un GET puede mutar estado» POR ACCIDENTE (Strict no manda el
 * JWT en navegación cross-site). Nadie debería depender de un accidente: cuando entre `Lax` + el chequeo
 * `Sec-Fetch-Site` (Artefacto 1 de SPEC-619) la superficie tiene que estar acotada. Este candado
 * congela esa superficie: si aparece un handler GET (o una página Server Component que escribe al
 * render) que llama a un frontier de escritura y NO está en `SUPERFICIE_GET_MUTA`, → rojo en CI.
 *
 * Detecta `detectado ⊆ lista` — no exige `lista ⊆ detectado`: algunas entradas (Tier B) mutan vía un
 * servicio con NOMBRE de lectura (`obtenerDetalleConsolidacion` descifra dentro) y NO son visibles a un
 * scan de cuerpo; están en la lista para el chequeo Sec-Fetch-Site y como documentación.
 *
 * LÍMITE DECLARADO (como los demás scanners heurísticos de arch:check): detecta el frontier CONOCIDO
 * llamado en el cuerpo del GET (o el render de la página). Una mutación alcanzada por un helper con
 * nombre de lectura no listado se le escapa — por eso el cierre REAL de la clase es el chequeo
 * Sec-Fetch-Site por construcción; este candado es el aviso temprano y el ratchet de la lista.
 */
const RAIZ = path.resolve(__dirname, "../..");
const DIR_APP = path.join(RAIZ, "src", "app");
// Árbol donde el control positivo exige que el regex de cada frontier SIGA PEGANDO en una llamada viva
// (no en una definición: un shim `const viejo = nuevo` es definición pero el regex ya no pega). Se barre
// todo `src/` porque un frontier se llama desde donde sea (p.ej. `registrarInicioSesion` desde un POST).
const DIR_SRC = path.join(RAIZ, "src");

// Frontier que SIEMPRE muta si aparece en el cuerpo del GET / render. Son funciones NOMBRADAS de
// escritura, no `.create/.update/.delete` genéricos: en un route/página no hay prisma directo (lo
// garantiza la frontera del DAL, `dal-frontera.test.ts`), y el `.update()` de `createHash()` o el
// `.delete()` de `cookies` darían falsos positivos. El prisma directo, si alguien lo mete, lo caza
// esa otra frontera; acá cazamos cómo la mutación llega HOY a un GET.
//
// Los NOMBRES viven en estas listas y de acá se DERIVAN los regex de detección: son la única fuente.
// El control positivo `frontierSinCallsite()` exige que el regex de cada uno SIGA PEGANDO en ≥1 llamada
// viva en `src/`. Un rename que mueva la función y sus llamadas (total, o parcial dejando un shim
// `export const viejo = nuevo`) deja el regex sin pegar → el scanner ciego a ese frontier con arch:check
// en verde; el control lo pone rojo. (Caso real: `leerTextoConSesion` → `leerExpedienteConSesion`, SPEC-610.)
// LO QUE NO GARANTIZA (por eso NO es el cierre de la clase): no distingue un HOMÓNIMO —otra función/método
// con el mismo nombre llamado en otro lado deja el regex pegando—, ni que la llamada esté CABLEADA a la
// frontera correcta. El cierre real por construcción es el chequeo Sec-Fetch-Site; esto es aviso temprano.
const NOMBRES_FRONTIER_SIEMPRE = [
    "logAudit",
    "logAuditNuevaAccion",
    "registrarInformePadre",
    "registrarInicioSesion",
    "registrarAuditoriaExport",
] as const;
// Frontier de DESCIFRADO que escribe LecturaReporte SALVO opt-out explícito `registrarLectura:false`.
const NOMBRES_FRONTIER_LECTURA = ["descifrarCampoReporte", "descifrarCamposReporte", "leerExpedienteConSesion"] as const;

// `$executeRaw(...)` es un método del cliente Prisma (framework), NO una función de nuestro árbol: va
// hardcoded en el regex y queda FUERA de las listas de nombres → exento del control positivo por
// construcción (no es un nombre nuestro que deba tener callsite). Los regex se construyen desde las listas.
// La exención de prisma directo es TRANSITIVA sobre `dal-frontera.test.ts`: vale MIENTRAS la allowlist de
// esa frontera no tenga rutas con prisma directo. El día que se allowlistee una y haga `.create()` en un
// GET, este candado queda ciego a esa mutación (la caza `dal-frontera`, no éste) — revisar las dos juntas.
const FRONTIER_SIEMPRE = new RegExp(`\\b(${NOMBRES_FRONTIER_SIEMPRE.join("|")})\\s*\\(|\\$executeRaw(?:Unsafe)?\\b`);
const FRONTIER_LECTURA = new RegExp(`\\b(${NOMBRES_FRONTIER_LECTURA.join("|")})\\s*\\(`);
const OPT_OUT_LECTURA = /registrarLectura\s*:\s*false/;

export interface InfractorGetMuta {
    archivo: string;
    linea: number;
    patron: string;
}

function* caminar(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name !== "node_modules") yield* caminar(full);
        } else if (/\.tsx?$/.test(e.name)) {
            yield full;
        }
    }
}

/** Quita comentarios de bloque y de línea para no falsear con `.create` citado en un comentario. */
function sinComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Cuerpo del handler GET: balancea llaves desde el `{` que abre la función, así EXCLUYE helpers que
 * vengan después (aunque los use un PATCH — ésa era la trampa de `padre/perfil`, cuyo `logAudit` vive
 * en un helper de PATCH, no en el GET). Recibe el contenido ya SIN comentarios.
 */
/** Índice tras balancear el grupo de paréntesis que abre en `pOpen` (los params). */
function finParams(s: string, pOpen: number): number {
    let d = 0;
    for (let i = pOpen; i < s.length; i++) {
        if (s[i] === "(") d++;
        else if (s[i] === ")" && --d === 0) return i + 1;
    }
    return s.length;
}

/** Salta un `: TipoRetorno` (con `<>`/`()`/`[]` anidados que pueden traer `{`) hasta la `{` del cuerpo. */
function saltarTipoHastaLlave(s: string, desde: number): number {
    let a = 0;
    let p = 0;
    let b = 0;
    for (let i = desde; i < s.length; i++) {
        const c = s[i];
        if (c === "<") a++;
        else if (c === ">" && a > 0) a--;
        else if (c === "(") p++;
        else if (c === ")" && p > 0) p--;
        else if (c === "[") b++;
        else if (c === "]" && b > 0) b--;
        else if (c === "{" && a === 0 && p === 0 && b === 0) return i;
    }
    return s.length;
}

/** Desde `i` (tras los params), índice de la `{` que abre el CUERPO: salta `: Tipo` y/o `=>`. */
function indiceLlaveCuerpo(s: string, i: number): number {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === ":") return saltarTipoHastaLlave(s, i + 1);
    const arrow = s.slice(i).match(/^=>\s*/);
    if (arrow) i += arrow[0].length;
    while (i < s.length && s[i] !== "{") i++;
    return i;
}

/**
 * Cuerpo del handler GET, balanceando llaves desde la `{` real del cuerpo. Balancea PRIMERO los
 * paréntesis de params (así el `{ params }` destructurado no se confunde con la llave del cuerpo —
 * esa trampa dejó pasar `registrarInformePadre`) y salta el tipo de retorno. Recibe contenido SIN
 * comentarios. Excluye helpers definidos DESPUÉS del cuerpo (aunque los use un PATCH).
 */
function cuerpoGet(limpio: string): string | null {
    const m = limpio.match(/export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\s*[:=]/);
    if (!m || m.index === undefined) return null;
    const desde = m.index;
    const pOpen = limpio.indexOf("(", desde);
    if (pOpen === -1) return null;
    const abre = indiceLlaveCuerpo(limpio, finParams(limpio, pOpen));
    if (limpio[abre] !== "{") return null;
    let db = 0;
    for (let j = abre; j < limpio.length; j++) {
        if (limpio[j] === "{") db++;
        else if (limpio[j] === "}" && --db === 0) return limpio.slice(desde, j + 1);
    }
    return limpio.slice(desde);
}

/** Devuelve el patrón de mutación hallado en el fragmento (ya sin comentarios), o null. */
function detectar(fragmento: string): string | null {
    const s = FRONTIER_SIEMPRE.exec(fragmento);
    if (s) return s[0].trim();
    const l = FRONTIER_LECTURA.exec(fragmento);
    if (l && !OPT_OUT_LECTURA.test(fragmento)) return `${l[0].trim()} (sin registrarLectura:false)`;
    return null;
}

function lineaDePatron(contenidoCompleto: string, patronBase: string): number {
    const idx = contenidoCompleto.indexOf(patronBase);
    return idx === -1 ? 0 : contenidoCompleto.slice(0, idx).split("\n").length;
}

export function buscarInfractores(): InfractorGetMuta[] {
    const infractores: InfractorGetMuta[] = [];
    for (const abs of caminar(DIR_APP)) {
        const rel = path.relative(RAIZ, abs).split(path.sep).join("/");
        const esRoute = /\/route\.tsx?$/.test(rel);
        const esPagina = /\/(page|layout)\.tsx$/.test(rel);
        if (!esRoute && !esPagina) continue;
        if (ARCHIVOS_GET_MUTA.has(rel)) continue; // ya declarado en la lista compartida

        const contenido = fs.readFileSync(abs, "utf8");
        const limpio = sinComentarios(contenido);
        let fragmento: string;
        if (esRoute) {
            const cuerpo = cuerpoGet(limpio);
            if (!cuerpo) continue;
            fragmento = cuerpo;
        } else {
            // Página: solo Server Components (el render corre como GET). Las de cliente no.
            if (/["']use client["']/.test(contenido.slice(0, 300))) continue;
            fragmento = limpio;
        }
        const patron = detectar(fragmento);
        if (patron) {
            const base = patron.split(" ")[0];
            infractores.push({ archivo: rel, linea: lineaDePatron(contenido, base), patron });
        }
    }
    return infractores;
}

/** Entradas de la lista cuyo archivo ya no existe (rename/borrado) → la lista quedó vieja. */
export function entradasObsoletas(): string[] {
    return SUPERFICIE_GET_MUTA.filter((e) => !fs.existsSync(path.join(RAIZ, e.archivo))).map((e) => e.archivo);
}

/**
 * Control positivo (SPEC-619 · acople D-123, endurecido tras la revisión de Dev 1): el regex de
 * detección de CADA frontier debe SEGUIR PEGANDO en al menos una llamada viva `NOMBRE(` en `src/`
 * (no-test). Es la forma correcta del chequeo. La versión anterior exigía que el NOMBRE tuviera una
 * DEFINICIÓN — más débil: un shim `export const viejo = nuevo`, un homónimo, o una definición muerta la
 * satisfacen y dejan el scanner ciego con el chequeo en verde. Éste mide que la SONDA sigue funcionando:
 * que el MISMO shape de regex que usa `buscarInfractores` todavía encuentra lo que sí está. Un rename
 * total —o PARCIAL, dejando un shim y migrando los callers al nombre nuevo— deja el regex sin pegar en
 * ningún GET y también sin pegar acá → ROJO. `$executeRaw` no está en las listas (framework) → no se controla.
 *
 * «Un vacío no es evidencia hasta que un control positivo prueba que el comando encuentra lo presente.»
 * LÍMITE (declarado, no tapado): un HOMÓNIMO —otra función/método con el mismo nombre, llamado en otro
 * lado— deja el regex pegando (falso verde), y pegar ≠ estar cableado a la frontera correcta. El cierre
 * por construcción de la clase es el chequeo Sec-Fetch-Site; esto es el aviso temprano y el ratchet.
 */
export function frontierSinCallsite(): string[] {
    const nombres = [...NOMBRES_FRONTIER_SIEMPRE, ...NOMBRES_FRONTIER_LECTURA];
    const fuentes: string[] = [];
    for (const abs of caminar(DIR_SRC)) {
        if (/\.(test|spec)\.tsx?$/.test(abs)) continue; // el callsite vivo no puede ser solo un test
        fuentes.push(sinComentarios(fs.readFileSync(abs, "utf8")));
    }
    // El MISMO shape que el regex de detección, por-nombre: `\bNOMBRE\s*\(`. El `\b` pega también tras un
    // `.`, así cubre los frontier que son MÉTODOS (`registrarInicioSesion`/`registrarAuditoriaExport`).
    return nombres.filter((nombre) => {
        const call = new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`);
        return !fuentes.some((src) => call.test(src));
    });
}
