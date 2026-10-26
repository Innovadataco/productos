/**
 * SPEC-909 · CANDADO — el corrector in-place de invitaciones es correcto.
 *
 * Lecciones que amarra (db FALSA, sin base real): DRY-RUN no escribe; `--confirm` trae las
 * filas vivas al copy canónico; es IDEMPOTENTE (2ª corrida = 0 cambios); y va FILA POR FILA
 * — una fila envenenada NO aborta a las sanas (lote atómico) y la corrida reporta la fallida.
 *
 * Puro: no toca prisma real (se le inyecta un `db` falso). En el allowlist.
 */
import type { PrismaClient } from "@prisma/client";
import { describe, it, expect } from "vitest";
import { INVITACIONES_USTED } from "../prisma/invitaciones-copy.seed-data";
import { corregirInvitacionesUsted } from "./corregir-invitaciones-usted";

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
    for (const c of INVITACIONES_USTED) {
        r[c.clave] = { id: `id-${c.clave}`, asunto: "Activa tu cuenta", cuerpoMarkdown: "Has sido registrado... haz clic en el link" };
    }
    return r;
}
function filasCanonicas(): Record<string, Fila> {
    const r: Record<string, Fila> = {};
    for (const c of INVITACIONES_USTED) r[c.clave] = { id: `id-${c.clave}`, asunto: c.asunto, cuerpoMarkdown: c.cuerpoMarkdown };
    return r;
}

describe("SPEC-909 · corrector in-place de invitaciones", () => {
    it("DRY-RUN: detecta las desactualizadas y NO escribe", async () => {
        const filas = filasViejas();
        const r = await corregirInvitacionesUsted(fakeDb(filas), { dryRun: true });
        expect(r.desactualizadas.length).toBe(INVITACIONES_USTED.length);
        expect(r.corregidas).toBe(0);
        expect(r.escrito).toBe(false);
        expect(filas[INVITACIONES_USTED[0].clave].asunto).toBe("Activa tu cuenta"); // intacto
    });

    it("--confirm: trae las filas al copy canónico", async () => {
        const filas = filasViejas();
        const r = await corregirInvitacionesUsted(fakeDb(filas), { dryRun: false });
        expect(r.corregidas).toBe(INVITACIONES_USTED.length);
        expect(r.fallidas).toEqual([]);
        for (const c of INVITACIONES_USTED) {
            expect(filas[c.clave].asunto).toBe(c.asunto);
            expect(filas[c.clave].cuerpoMarkdown).toBe(c.cuerpoMarkdown);
        }
    });

    it("IDEMPOTENTE: sobre filas ya canónicas, 0 cambios", async () => {
        const r = await corregirInvitacionesUsted(fakeDb(filasCanonicas()), { dryRun: false });
        expect(r.desactualizadas.length).toBe(0);
        expect(r.corregidas).toBe(0);
    });

    it("FILA POR FILA: una envenenada no tumba a la sana", async () => {
        const filas = filasViejas();
        const victima = INVITACIONES_USTED[0].clave;
        const r = await corregirInvitacionesUsted(fakeDb(filas, victima), { dryRun: false });
        expect(r.fallidas.map((f) => f.clave)).toEqual([victima]);
        expect(r.corregidas).toBe(INVITACIONES_USTED.length - 1); // la otra SÍ se corrigió
    });

    it("clave sin fila viva se reporta, no explota", async () => {
        const r = await corregirInvitacionesUsted(fakeDb({}), { dryRun: false });
        expect(r.encontradas).toBe(0);
        expect(r.clavesSinFila.length).toBe(INVITACIONES_USTED.length);
    });
});
