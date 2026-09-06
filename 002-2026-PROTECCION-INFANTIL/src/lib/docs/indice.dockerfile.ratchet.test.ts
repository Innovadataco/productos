/**
 * SPEC-567 (I-351) — Ratchet estático: los documentos servidos DEBEN viajar en la imagen.
 *
 * `indice.test.ts` verifica que cada ruta del índice existe EN EL REPO — pero eso nunca falló:
 * el runner de producción nunca copiaba `docs/`/`specs/`, así que en la imagen los archivos NO
 * estaban y toda ruta daba 404, con el test en verde perpetuo sobre el repo. Este ratchet cierra
 * ese hueco: lee el `Dockerfile`, extrae las `COPY` de la etapa `runner`, y exige que CADA ruta de
 * los dos allowlists (índice de docs + documentos de confianza) quede embarcada. Muere si alguien
 * agrega una ruta a un índice sin embarcarla. Sin allowlist de excepciones.
 *
 * Segundo guard: `.dockerignore` no debe excluir los roots de esos docs — si los excluye, el builder
 * no los tiene y la `COPY --from=builder` rompe el build (ruidoso, pero tarde). Lo atrapamos en CI.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { INDICE_DOCS } from "./indice";
import { DOCUMENTOS_CONFIANZA } from "@/lib/colegio/confianza-documentos";

const REPO_ROOT = process.cwd();
const DOCKERFILE = fs.readFileSync(path.join(REPO_ROOT, "Dockerfile"), "utf8");
const DOCKERIGNORE = fs.readFileSync(path.join(REPO_ROOT, ".dockerignore"), "utf8");

/** Todas las rutas que un lector sirve en runtime (deduplicadas). */
const RUTAS_ALLOWLIST = [
    ...new Set([
        ...INDICE_DOCS.flatMap((t) => t.documentos.map((d) => d.ruta)),
        ...DOCUMENTOS_CONFIANZA.map((d) => d.ruta),
    ]),
];

/** Texto de la etapa `runner` (última): desde su `FROM ... AS runner` hasta el fin del archivo. */
function etapaRunner(): string {
    const idx = DOCKERFILE.search(/^FROM\s+\S+\s+AS\s+runner\s*$/m);
    if (idx < 0) throw new Error("[ratchet] No se encontró la etapa `AS runner` en el Dockerfile");
    return DOCKERFILE.slice(idx);
}

/**
 * Roots (repo-relativos) que la etapa runner COPIA a `/app`. Cada `COPY [--flags] <src...> <dest>`
 * horneada preserva la ruta (docs→./docs, specs→./specs, X.md→./); tomamos los fuentes `/app/<root>`.
 */
function rootsCopiados(): Set<string> {
    const roots = new Set<string>();
    for (const linea of etapaRunner().split("\n")) {
        if (!/^\s*COPY\s/.test(linea)) continue;
        const tokens = linea
            .trim()
            .replace(/^COPY\s+/, "")
            .split(/\s+/)
            .filter((t) => !t.startsWith("--")); // descarta flags (--from, --chown)
        if (tokens.length < 2) continue;
        for (const src of tokens.slice(0, -1)) {
            // todos menos el destino
            const m = src.match(/^\/app\/(.+)$/);
            if (m) roots.add(m[1].replace(/\/+$/, ""));
        }
    }
    return roots;
}

/** ¿La `ruta` (repo-relativa) queda embarcada por algún root copiado (archivo exacto o carpeta padre)? */
function estaEmbarcada(ruta: string, roots: Set<string>): boolean {
    for (const r of roots) {
        if (ruta === r || ruta.startsWith(r + "/")) return true;
    }
    return false;
}

const GLOB = /[*?[\]]/;

/**
 * ¿`.dockerignore` NO garantiza que este root entre al contexto de build? true si lo EXCLUYE, o si
 * aparece un patrón cuya FORMA el parser no reconoce y que PODRÍA afectar al root.
 *
 * SPEC-567 (endurecimiento, refutador de Datos — mismo invariante que SPEC-572): un patrón desconocido
 * DESCONOCIDO CIERRA, no abre. Antes se asumía benigno todo lo que no fuera nombre-exacto/`*.md`/`!neg`,
 * así que un `docs/**` o un `**` futuro habría sacado los docs de la imagen sin que este guard lo viera.
 *
 * Formas reconocidas: literal exacto (sin glob), `*.md`, `!negación`. Un glob se DESCARTA solo si su
 * prefijo literal es un path claramente ajeno al root (p.ej. `.env.*` o `scripts/simulacion/*` no tocan
 * `docs`/`specs`/*.md de raíz); cualquier glob que empiece con `**`, sin prefijo, o cuyo prefijo pueda
 * tocar el root, CIERRA.
 */
function noSeGarantizaInclusion(root: string): boolean {
    const lineas = DOCKERIGNORE.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    const esMd = root.endsWith(".md");
    let excluido = false;
    for (const l of lineas) {
        if (l.startsWith("!")) {
            if (l.slice(1) === root) excluido = false; // re-inclusión explícita de este root
            continue;
        }
        if (!GLOB.test(l)) {
            // Literal exacto: excluye si matchea el root o es su ancestro; si no, es ajeno → irrelevante.
            if (l === root || root.startsWith(l + "/")) excluido = true;
            continue;
        }
        if (l === "*.md") {
            if (esMd) excluido = true; // `*.md` matchea solo .md de raíz (no cruza "/")
            continue;
        }
        // Glob no trivial: ¿su prefijo literal PODRÍA tocar este root? Si es global (`**`), sin prefijo,
        // o el prefijo se solapa con el root → no podemos PROBAR que el doc viaja → CERRAR (fail-closed).
        const prefijoLiteral = l.split(GLOB)[0];
        const podriaTocar =
            l.startsWith("**") || prefijoLiteral === "" || root.startsWith(prefijoLiteral) || l.startsWith(root);
        if (podriaTocar) excluido = true;
    }
    return excluido;
}

describe("SPEC-567 · ratchet docs-en-imagen (I-351)", () => {
    it("cada ruta de los allowlists (índice + confianza) viaja en la etapa runner del Dockerfile", () => {
        const roots = rootsCopiados();
        const faltantes = RUTAS_ALLOWLIST.filter((r) => !estaEmbarcada(r, roots));
        expect(
            faltantes,
            `Rutas del allowlist sin COPY en la etapa runner (agregá la COPY al Dockerfile): ${faltantes.join("; ")}`
        ).toEqual([]);
    });

    it(".dockerignore GARANTIZA que los roots de los docs entran al contexto (patrón desconocido = fail-closed)", () => {
        const roots = [...new Set(RUTAS_ALLOWLIST.map((r) => r.split("/")[0]))];
        const enRiesgo = roots.filter(noSeGarantizaInclusion);
        expect(
            enRiesgo,
            "Roots sin inclusión garantizada — .dockerignore los excluye, o trae un patrón que el guard " +
                `no reconoce y podría afectarlos (extendé el parser o simplificá el patrón): ${enRiesgo.join("; ")}`
        ).toEqual([]);
    });
});
