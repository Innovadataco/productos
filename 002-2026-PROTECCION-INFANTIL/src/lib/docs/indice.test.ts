/**
 * SPEC-017 — Guardas del índice de documentación: toda ruta declarada existe en
 * disco (el índice nunca apunta a contenido inexistente), los slugs son únicos
 * y la allowlist del lector solo admite documentos del índice.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { INDICE_DOCS, buscarDocumentoPermitido, capasVisibles, temasVisibles } from "./indice";
import { leerDocumento } from "./documentos";

describe("índice de documentación (SPEC-017)", () => {
    it("toda ruta del índice existe en el repo (nada de contenido inventado)", () => {
        const faltantes: string[] = [];
        for (const tema of INDICE_DOCS) {
            for (const doc of tema.documentos) {
                if (!fs.existsSync(path.join(process.cwd(), doc.ruta))) {
                    faltantes.push(`${tema.slug}: ${doc.ruta}`);
                }
            }
        }
        expect(faltantes, faltantes.join("; ")).toEqual([]);
    });

    it("los slugs de tema son únicos y las capas son 1/2/3", () => {
        const slugs = INDICE_DOCS.map((t) => t.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const tema of INDICE_DOCS) {
            expect([1, 2, 3]).toContain(tema.capa);
            expect(tema.documentos.length).toBeGreaterThan(0);
        }
    });

    it("la allowlist solo admite documentos del índice y rechaza traversal", () => {
        expect(buscarDocumentoPermitido("README.md")).not.toBeNull();
        expect(buscarDocumentoPermitido("../../etc/passwd")).toBeNull();
        expect(buscarDocumentoPermitido("src/lib/proxy.ts")).toBeNull();
        expect(buscarDocumentoPermitido(".env")).toBeNull();
    });

    it("capas por rol: anónimo=1, autenticado=1-2, ADMIN/SCHOOL_ADMIN=1-3", () => {
        expect(capasVisibles(null)).toEqual([1]);
        expect(capasVisibles("PARENT")).toEqual([1, 2]);
        expect(capasVisibles("OPERADOR")).toEqual([1, 2]);
        expect(capasVisibles("ADMIN")).toEqual([1, 2, 3]);
        expect(capasVisibles("SCHOOL_ADMIN")).toEqual([1, 2, 3]);
        expect(temasVisibles(null).every((t) => t.capa === 1)).toBe(true);
    });
});

describe("lector de documentos (SPEC-017)", () => {
    it("lee un documento del índice con su metadata de capa", async () => {
        const doc = await leerDocumento("README.md");
        expect(doc).not.toBeNull();
        expect(doc!.markdown.length).toBeGreaterThan(0);
        expect(doc!.capa).toBe(1);
    });

    it("rechaza rutas fuera del índice", async () => {
        expect(await leerDocumento("package.json")).toBeNull();
        expect(await leerDocumento("../AGENTS.md")).toBeNull();
    });
});
