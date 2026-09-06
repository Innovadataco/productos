/**
 * SPEC-567 (I-351) — Conducta fail-loud de los lectores de documentos.
 *
 * Una clave DESCONOCIDA (fuera del allowlist) → `null` → 404 (correcto: no existe tal doc).
 * Una clave del ALLOWLIST cuyo archivo NO está en runtime → NO es 404: es una imagen mal armada
 * (el doc no se embarcó en el Dockerfile). El lector LANZA (→ 500 + log de servidor) para que el
 * hueco de despliegue sea RUIDOSO, no un 404 silencioso. Se mockea `fs.readFile` para simular el
 * archivo ausente sin depender del filesystem.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({
    default: { readFile: (...a: unknown[]) => mockReadFile(...a) },
    readFile: (...a: unknown[]) => mockReadFile(...a),
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { leerDocumento } from "./documentos";
import { leerDocumentoConfianza } from "@/lib/colegio/confianza-documentos";

const ausente = () => Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });

describe("SPEC-567 · lectores de documentos fail-loud ante archivo ausente (I-351)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("leerDocumento: ruta del allowlist con archivo ausente → LANZA (→ 500), no null (→ 404)", async () => {
        mockReadFile.mockRejectedValue(ausente());
        await expect(leerDocumento("README.md")).rejects.toThrow(/no disponible en runtime/);
    });

    it("leerDocumento: ruta desconocida → null (404) sin tocar el filesystem", async () => {
        expect(await leerDocumento("package.json")).toBeNull();
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("leerDocumentoConfianza: clave del allowlist con archivo ausente → LANZA (→ 500)", async () => {
        mockReadFile.mockRejectedValue(ausente());
        await expect(leerDocumentoConfianza("transparencia")).rejects.toThrow(/no disponible en runtime/);
    });

    it("leerDocumentoConfianza: clave desconocida → null (404) sin tocar el filesystem", async () => {
        expect(await leerDocumentoConfianza("clave-inexistente")).toBeNull();
        expect(mockReadFile).not.toHaveBeenCalled();
    });
});
