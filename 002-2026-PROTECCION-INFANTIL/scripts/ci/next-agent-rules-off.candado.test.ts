/**
 * CANDADO · SPEC-975 — Next NO gestiona AGENTS.md de 002.
 *
 * El defecto: Next 16.4 trae `agentRules` activo por defecto. En el arranque de `next dev`,
 * `start-server.js` llama `syncAgentRulesForDev(dir, agentRules !== false)` — es decir, el generador
 * corre SALVO que `agentRules` sea EXPLÍCITAMENTE `false`. Cuando detecta un agente de IA, escribe o
 * actualiza `AGENTS.md` en la raíz del proyecto insertando un bloque gestionado por el framework
 * (verificado en node_modules/next/dist/server/lib/generate-agent-files.js). Para PI, `AGENTS.md` es
 * DOCTRINA del repo, no un archivo que el framework pueda reescribir.
 *
 * Este candado afirma las dos mitades del arreglo:
 *  1. `next.config.ts` exporta `agentRules === false` (apaga el generador en su origen).
 *  2. `AGENTS.md` de 002 NO contiene el bloque gestionado por Next (marcadores REALES importados del
 *     propio paquete `next`, no supuestos: si Next cambia el marcador en una subida de versión, el
 *     import trae el nuevo y el candado sigue siendo verdadero).
 *
 * Muere con el defecto: quitar `agentRules: false` (o ponerlo en `true`) → rojo; si un `next dev`
 * llegara a inyectar el bloque en AGENTS.md y se commiteara → rojo. Control positivo por MUTACIÓN en
 * memoria (un AGENTS.md con el marcador DEBE detectarse; uno limpio DEBE pasar).
 *
 * Unit puro (lee archivos de texto + importa el default de next.config; sin BD) — corre en el carril
 * `test:unit` (registrado en vitest.unit.includes.ts), que `pi-gate` exige: CORRE en CI y BLOQUEA.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import nextConfig from "../../next.config";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const AGENTS_MD = resolve(AQUI, "../../AGENTS.md"); // 002-…/AGENTS.md

// Marcadores REALES del bloque que Next inyecta, tomados del propio paquete (no inventados).
const requireDesdeAqui = createRequire(import.meta.url);
const generador = requireDesdeAqui("next/dist/server/lib/generate-agent-files") as {
    AGENT_RULES_START_MARKER: string;
    AGENT_RULES_END_MARKER: string;
    AGENT_FEEDBACK_START_MARKER: string;
    AGENT_FEEDBACK_END_MARKER: string;
};

// Marcadores legacy (los escribía la versión vieja del codemod); también se vigilan por si un
// AGENTS.md venido de otro proyecto los trajera. Fijos porque el paquete ya no los exporta.
const LEGACY_START = "<!-- NEXT-AGENTS-MD-START -->";
const LEGACY_END = "<!-- NEXT-AGENTS-MD-END -->";

/** Devuelve los marcadores de Next presentes en un AGENTS.md. Vacío = limpio. */
export function marcadoresNextEn(contenido: string): string[] {
    const candidatos = [
        generador.AGENT_RULES_START_MARKER,
        generador.AGENT_RULES_END_MARKER,
        generador.AGENT_FEEDBACK_START_MARKER,
        generador.AGENT_FEEDBACK_END_MARKER,
        LEGACY_START,
        LEGACY_END,
    ];
    return candidatos.filter((m) => contenido.includes(m));
}

describe("SPEC-975 · Next no gestiona AGENTS.md de 002", () => {
    it("next.config exporta agentRules === false (apaga el generador en su origen)", () => {
        expect(nextConfig.agentRules).toBe(false);
    });

    it("los marcadores reales existen en el paquete next (no los suponemos)", () => {
        expect(generador.AGENT_RULES_START_MARKER).toMatch(/BEGIN:nextjs-agent-rules/);
        expect(generador.AGENT_RULES_END_MARKER).toMatch(/END:nextjs-agent-rules/);
    });

    it("AGENTS.md de 002 NO contiene ningún bloque gestionado por Next", () => {
        const contenido = readFileSync(AGENTS_MD, "utf8");
        const presentes = marcadoresNextEn(contenido);
        expect(presentes, `marcadores de Next en AGENTS.md: ${presentes.join(" · ")}`).toEqual([]);
    });

    it("CONTROL POSITIVO por MUTACIÓN (en memoria): el detector caza el bloque y deja pasar lo limpio", () => {
        const conBloque = `# AGENTS\n\n${generador.AGENT_RULES_START_MARKER}\nruido\n${generador.AGENT_RULES_END_MARKER}\n`;
        expect(marcadoresNextEn(conBloque)).toContain(generador.AGENT_RULES_START_MARKER);
        const conLegacy = `# AGENTS\n${LEGACY_START}\nx\n${LEGACY_END}\n`;
        expect(marcadoresNextEn(conLegacy)).toContain(LEGACY_START);
        expect(marcadoresNextEn("# AGENTS.md — doctrina de PI, sin marcadores")).toEqual([]);
    });
});
