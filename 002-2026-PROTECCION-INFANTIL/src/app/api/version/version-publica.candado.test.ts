/**
 * SPEC-548 (I-337) · CANDADO: /api/version es PÚBLICA.
 *
 * El motor de detección de despliegue vive en el layout raíz (todas las
 * pantallas, con o sin sesión). Si /api/version deja de estar en
 * GUARDIAS_ACCESO.publicas, el middleware responde 401 en las páginas públicas
 * y el aviso «hay versión nueva» nunca aparece ahí — una degradación silenciosa.
 * Este candado muere si alguien la saca de la lista blanca.
 *
 * Integración por el glob src/** (no toca vitest.unit.includes.ts).
 */
import { describe, it, expect } from "vitest";
import { esRutaPublica } from "@/lib/routing/guardias";

describe("SPEC-548 · /api/version es pública", () => {
    it("esRutaPublica('/api/version') === true", () => {
        expect(esRutaPublica("/api/version")).toBe(true);
    });

    it("no abre de más: /api/versionado (hermana) NO queda pública por prefijo", () => {
        expect(esRutaPublica("/api/versionado")).toBe(false);
    });
});
