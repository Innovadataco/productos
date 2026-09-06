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

/** ¿`.dockerignore` excluye este root del contexto de build? (patrones simples: nombre exacto, `*.md`, `!neg`). */
function excluidoPorDockerignore(root: string): boolean {
    const lineas = DOCKERIGNORE.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    const esMd = root.endsWith(".md");
    let excluido = false;
    for (const l of lineas) {
        if (l === root || (esMd && l === "*.md")) excluido = true;
        else if (l === "!" + root) excluido = false;
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

    it(".dockerignore no excluye los roots de los docs (si no, la COPY del runner rompe el build)", () => {
        const roots = [...new Set(RUTAS_ALLOWLIST.map((r) => r.split("/")[0]))];
        const excluidos = roots.filter(excluidoPorDockerignore);
        expect(
            excluidos,
            `Roots que .dockerignore saca del contexto (rompen la COPY --from=builder): ${excluidos.join("; ")}`
        ).toEqual([]);
    });
});
