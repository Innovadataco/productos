/**
 * E-8 (D3): test del adaptador de salud de infraestructura.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { verificarConexionDb } from "./health";

describe("adaptador health (D3)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("verificarConexionDb devuelve true con la BD disponible", async () => {
        expect(await verificarConexionDb()).toBe(true);
    });
});
