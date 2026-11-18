/**
 * SPEC-918 · CANDADO — el corrector in-place del correo de activación por enlace es correcto.
 *
 * Lecciones que amarra (db FALSA, sin base real): DRY-RUN no escribe; `--confirm` trae la fila
 * viva al copy canónico (botón); es IDEMPOTENTE (2ª corrida = 0 cambios); va FILA POR FILA
 * (una envenenada se reporta en `fallidas`, no explota); y una clave sin fila viva se reporta.
 *
 * Puro: no toca prisma real (se le inyecta un `db` falso). En el allowlist de unit.
 */
import type { PrismaClient } from "@prisma/client";
import { describe, it, expect } from "vitest";
import { COLEGIO_REGISTRO_ENLACE_COPIES } from "../prisma/colegio-registro-enlace-copy.seed-data";
import { corregirColegioRegistroEnlaceBoton } from "./corregir-colegio-registro-enlace-boton";

interface Fila {
    id: string;
    asunto: string;
    cuerpoMarkdown: string;
}

function fakeDb(filas: Record<string, Fila>, throwOn?: string): PrismaClient {
    return {
        notificacionPlantilla: {
            findUnique: async ({ where: { clave } }: { where: { clave: string } }) => filas[clave] ?? null,
            update: async ({ where: { clave }, data }: { where: { clave: string }; data: Partial<Fila> }) => {
                if (throwOn === clave) throw new Error("fila envenenada");
                filas[clave] = { ...filas[clave], ...data };
                return filas[clave];
            },
        },
    } as unknown as PrismaClient;
}

function filasViejas(): Record<string, Fila> {
    const r: Record<string, Fila> = {};
    for (const c of COLEGIO_REGISTRO_ENLACE_COPIES) {
        // Copy VIEJO: URL pelada en su línea (el defecto que cierra SPEC-918).
        r[c.clave] = { id: `id-${c.clave}`, asunto: "Cree su contraseña y empecemos", cuerpoMarkdown: "Hola,\n\nAbra este enlace y cree su contraseña:\n{{url}}\n\nvence." };
    }
    return r;
}
function filasCanonicas(): Record<string, Fila> {
    const r: Record<string, Fila> = {};
    for (const c of COLEGIO_REGISTRO_ENLACE_COPIES) r[c.clave] = { id: `id-${c.clave}`, asunto: c.asunto, cuerpoMarkdown: c.cuerpoMarkdown };
    return r;
}

describe("SPEC-918 · corrector in-place del correo de activación por enlace", () => {
    it("DRY-RUN: detecta las desactualizadas y NO escribe", async () => {
        const filas = filasViejas();
        const r = await corregirColegioRegistroEnlaceBoton(fakeDb(filas), { dryRun: true });
        expect(r.desactualizadas.length).toBe(COLEGIO_REGISTRO_ENLACE_COPIES.length);
        expect(r.corregidas).toBe(0);
        expect(r.escrito).toBe(false);
        expect(filas[COLEGIO_REGISTRO_ENLACE_COPIES[0].clave].cuerpoMarkdown).toContain("{{url}}\n\nvence"); // intacto
    });

    it("--confirm: trae la fila al copy canónico (botón)", async () => {
        const filas = filasViejas();
        const r = await corregirColegioRegistroEnlaceBoton(fakeDb(filas), { dryRun: false });
        expect(r.corregidas).toBe(COLEGIO_REGISTRO_ENLACE_COPIES.length);
        expect(r.fallidas).toEqual([]);
        for (const c of COLEGIO_REGISTRO_ENLACE_COPIES) {
            expect(filas[c.clave].asunto).toBe(c.asunto);
            expect(filas[c.clave].cuerpoMarkdown).toBe(c.cuerpoMarkdown);
            expect(filas[c.clave].cuerpoMarkdown).toContain("[Activar mi cuenta]({{url}})");
        }
    });

    it("IDEMPOTENTE: sobre filas ya canónicas, 0 cambios", async () => {
        const r = await corregirColegioRegistroEnlaceBoton(fakeDb(filasCanonicas()), { dryRun: false });
        expect(r.desactualizadas.length).toBe(0);
        expect(r.corregidas).toBe(0);
    });

    it("FILA POR FILA: una envenenada se reporta en fallidas, no explota", async () => {
        const filas = filasViejas();
        const victima = COLEGIO_REGISTRO_ENLACE_COPIES[0].clave;
        const r = await corregirColegioRegistroEnlaceBoton(fakeDb(filas, victima), { dryRun: false });
        expect(r.fallidas.map((f) => f.clave)).toEqual([victima]);
        expect(r.corregidas).toBe(COLEGIO_REGISTRO_ENLACE_COPIES.length - 1);
    });

    it("clave sin fila viva se reporta, no explota", async () => {
        const r = await corregirColegioRegistroEnlaceBoton(fakeDb({}), { dryRun: false });
        expect(r.encontradas).toBe(0);
        expect(r.clavesSinFila.length).toBe(COLEGIO_REGISTRO_ENLACE_COPIES.length);
    });
});
