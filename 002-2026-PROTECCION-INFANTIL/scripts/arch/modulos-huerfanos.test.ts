/**
 * SPEC-654 · Candado: ningún módulo de `src/` sin importador de producción fuera de la línea base.
 *
 * Unit (scan estático del grafo de imports, sin base) Y cableado en arch:check (bloque i). Ratchet:
 * la línea base vive en `modulos-huerfanos-allowlist.json` y SOLO BAJA. Se ejercita en las DOS
 * direcciones (control positivo): un módulo vivo NO se marca, y uno que se borra del grafo SÍ.
 */
import { describe, it, expect } from "vitest";
import { modulosHuerfanos, huerfanosNuevos, entradasObsoletas, huerfanosDe } from "./modulos-huerfanos";

describe("SPEC-654 · módulos huérfanos (ratchet de módulos sin importador)", () => {
    it("ratchet: ningún huérfano NUEVO fuera de la allowlist", () => {
        expect(
            huerfanosNuevos(),
            "Un módulo de src/ sin importador de producción NO está en modulos-huerfanos-allowlist.json. " +
                "Borralo si está muerto (y sacá su entrada si la tuviera), o —si es intencional— declaralo ahí con motivo y quién.",
        ).toEqual([]);
    });

    it("ratchet: la allowlist no tiene entradas obsoletas (ya cableadas o borradas)", () => {
        expect(
            entradasObsoletas(),
            "Una entrada de modulos-huerfanos-allowlist.json ya NO es huérfana (se cableó o se borró). Sacala: el ratchet solo baja.",
        ).toEqual([]);
    });

    // Control positivo sobre el árbol REAL: «un vacío no es evidencia hasta probar que el detector
    // encuentra lo presente». El caso que lo motivó (componente que solo importa su propio test).
    it("control positivo: detecta el huérfano conocido ExpedienteVivo.tsx", () => {
        expect(modulosHuerfanos()).toContain("src/components/modules/padre/ExpedienteVivo.tsx");
    });

    // Control negativo sobre el árbol REAL: un módulo muy importado NO se marca (no es falso positivo).
    it("un módulo vivo y muy importado NO se marca (src/lib/prisma.ts)", () => {
        expect(modulosHuerfanos()).not.toContain("src/lib/prisma.ts");
    });

    // Las DOS direcciones sobre el núcleo PURO (sin FS): con importador no es huérfano; al quitar la
    // arista (borrarlo del grafo), sí. Prueba que el detector REACCIONA al grafo, no que «no falló».
    it("las dos direcciones: un módulo se marca al borrarlo del grafo y NO antes", () => {
        const candidatos = ["src/lib/ejemplo.ts"];
        const conImportador = new Map<string, number>([["src/lib/ejemplo.ts", 1]]);
        const sinImportador = new Map<string, number>();
        expect(huerfanosDe(candidatos, conImportador), "con importador de producción NO debe marcarse").toEqual([]);
        expect(huerfanosDe(candidatos, sinImportador), "sin importador (borrado del grafo) SÍ debe marcarse").toEqual([
            "src/lib/ejemplo.ts",
        ]);
    });
});
