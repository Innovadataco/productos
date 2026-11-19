/**
 * SPEC-922 · CANDADO — el corrector in-place data-driven del registro de copys canónicos es correcto,
 * y el deploy lo usa SOLO como detector de deriva.
 *
 * Amarra (db FALSA, sin base real), sobre el registro REAL:
 *   - DRY-RUN no escribe y lista fila por fila QUÉ difiere (asunto/cuerpo), su versión y si la editaron
 *     en el panel (`actualizadaPor`) — el CEO decide antes de pisar una edición.
 *   - `--confirm` trae cada fila al canónico y escribe SOLO asunto + cuerpo: PRESERVA `activa`
 *     (una DEROGADA/inactiva sigue inactiva — VEREDICTO CEO), `variablesSchema`, `canal` y `version`.
 *   - IDEMPOTENTE; FILA POR FILA (lectura y escritura); clave sin fila se reporta.
 *   - `--aviso` (detector de deriva del deploy) NO escribe; `--confirm` + `--aviso` ABORTA; flag
 *     desconocido ABORTA.
 *   - `deploy-prod.sh` corre el detector en modo `--aviso`, blando (`|| echo`), DESPUÉS de
 *     «DEPLOY VERIFICADO», y NUNCA con `--confirm`.
 *
 * Puro: no toca prisma real (se le inyecta un `db` falso). En el allowlist de unit.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, it, expect } from "vitest";
import { CORREOS_CANONICOS } from "../prisma/correos-canonicos.seed-data";
import {
    corregirCorreosCanonicos,
    correrModo,
    detalleDeFila,
    lineaDeAviso,
    parsearArgsCorrector,
    type ResultadoCorrectorCopys,
} from "./corregir-correos-canonicos";

interface Fila {
    id: string;
    canal: string;
    asunto: string | null;
    cuerpoMarkdown: string;
    variablesSchema: unknown;
    activa: boolean;
    version: number;
    actualizadaPor: string | null;
}

function fakeDb(filas: Record<string, Fila>, opts: { revientaAlEscribir?: string; revientaAlLeer?: string } = {}) {
    let escrituras = 0;
    const db = {
        notificacionPlantilla: {
            findUnique: async ({ where: { clave } }: { where: { clave: string } }) => {
                if (opts.revientaAlLeer === clave) throw new Error("lectura envenenada");
                return filas[clave] ?? null;
            },
            update: async ({ where: { clave }, data }: { where: { clave: string }; data: Partial<Fila> }) => {
                if (opts.revientaAlEscribir === clave) throw new Error("fila envenenada");
                escrituras++;
                filas[clave] = { ...filas[clave]!, ...data };
                return filas[clave];
            },
        },
    } as unknown as PrismaClient;
    return { db, escrituras: () => escrituras };
}

/** Lo que NO es copy: el corrector no debe tocarlo (centinelas distintos a lo que sembraría el seed). */
const NO_COPY = { variablesSchema: { centinela: "schema-de-prod" }, activa: false, version: 7, actualizadaPor: null };

function filasViejas(): Record<string, Fila> {
    const r: Record<string, Fila> = {};
    for (const c of CORREOS_CANONICOS) {
        // Copy VIEJO: URL pelada / voz «tú» (el defecto que cierra SPEC-922).
        r[c.clave] = {
            id: `id-${c.clave}`,
            canal: c.canal,
            asunto: c.asunto ? `${c.asunto} (viejo)` : null,
            cuerpoMarkdown: "Hola {{nombreUsuario}},\n\nPuedes consultar tu expediente en {{urlDashboard}}.",
            ...NO_COPY,
        };
    }
    return r;
}

function filasCanonicas(): Record<string, Fila> {
    const r: Record<string, Fila> = {};
    for (const c of CORREOS_CANONICOS) {
        r[c.clave] = { id: `id-${c.clave}`, canal: c.canal, asunto: c.asunto ?? null, cuerpoMarkdown: c.cuerpoMarkdown, ...NO_COPY };
    }
    return r;
}

const CLAVES = CORREOS_CANONICOS.map((c) => c.clave);

describe("SPEC-922 · corrector in-place data-driven de copys canónicos", () => {
    it("DRY-RUN: detecta TODAS las desactualizadas del registro y NO escribe", async () => {
        const filas = filasViejas();
        const f = fakeDb(filas);
        const r = await corregirCorreosCanonicos(f.db, { dryRun: true });
        expect(r.desactualizadas.map((d) => d.clave)).toEqual(CLAVES);
        expect(r.corregidas).toBe(0);
        expect(r.escrito).toBe(false);
        expect(f.escrituras()).toBe(0);
        expect(filas[CLAVES[0]!]!.cuerpoMarkdown).toContain("Puedes consultar"); // intacto
    });

    it("DRY-RUN: dice QUÉ difiere y si la fila fue EDITADA EN PANEL", async () => {
        const filas = filasCanonicas();
        const editada = CLAVES[0]!;
        filas[editada] = { ...filas[editada]!, cuerpoMarkdown: "Cuerpo que editó el admin", version: 3, actualizadaPor: "admin-1" };
        const r = await corregirCorreosCanonicos(fakeDb(filas).db, { dryRun: true });
        expect(r.desactualizadas).toEqual([{ clave: editada, id: `id-${editada}`, campos: ["cuerpo"], version: 3, editadaEnPanel: true }]);
        expect(detalleDeFila(r.desactualizadas[0]!)).toContain("EDITADA EN PANEL");
        // Sin edición de panel (desfase del seed), no se rotula como edición.
        const viejas = await corregirCorreosCanonicos(fakeDb(filasViejas()).db, { dryRun: true });
        expect(viejas.desactualizadas.every((d) => !d.editadaEnPanel)).toBe(true);
        expect(viejas.desactualizadas[0]!.campos).toEqual(["asunto", "cuerpo"]);
    });

    it("--confirm: trae cada fila al copy canónico y PRESERVA activa/schema/canal/version", async () => {
        const filas = filasViejas();
        const r = await corregirCorreosCanonicos(fakeDb(filas).db, { dryRun: false });
        expect(r.corregidas).toBe(CORREOS_CANONICOS.length);
        expect(r.fallidas).toEqual([]);
        for (const c of CORREOS_CANONICOS) {
            const fila = filas[c.clave]!;
            expect(fila.asunto).toBe(c.asunto ?? null); // IN_APP queda sin asunto
            expect(fila.cuerpoMarkdown).toBe(c.cuerpoMarkdown);
            expect(fila.canal).toBe(c.canal);
            expect(fila.variablesSchema).toEqual(NO_COPY.variablesSchema);
            expect(fila.activa).toBe(false); // desactualizada E inactiva: se corrige el copy, sigue inactiva
            expect(fila.version).toBe(NO_COPY.version);
        }
    });

    it("control POSITIVO (VEREDICTO CEO): una fila canónica INACTIVA (derogada) sigue inactiva tras --confirm", async () => {
        const filas = filasCanonicas(); // activa=false en todas
        await corregirCorreosCanonicos(fakeDb(filas).db, { dryRun: false });
        for (const c of CLAVES) expect(filas[c]!.activa).toBe(false);
    });

    it("IDEMPOTENTE: sobre filas ya canónicas, 0 desactualizadas y 0 escrituras", async () => {
        const f = fakeDb(filasCanonicas());
        const r = await corregirCorreosCanonicos(f.db, { dryRun: false });
        expect(r.desactualizadas).toEqual([]);
        expect(r.corregidas).toBe(0);
        expect(f.escrituras()).toBe(0);
    });

    it("FILA POR FILA: una envenenada AL ESCRIBIR se reporta; las demás se corrigen", async () => {
        const victima = CLAVES[0]!;
        const r = await corregirCorreosCanonicos(fakeDb(filasViejas(), { revientaAlEscribir: victima }).db, { dryRun: false });
        expect(r.fallidas.map((x) => x.clave)).toEqual([victima]);
        expect(r.corregidas).toBe(CORREOS_CANONICOS.length - 1);
    });

    it("FILA POR FILA: una envenenada AL LEER se reporta; las demás se corrigen", async () => {
        const victima = CLAVES[CLAVES.length - 1]!;
        const r = await corregirCorreosCanonicos(fakeDb(filasViejas(), { revientaAlLeer: victima }).db, { dryRun: false });
        expect(r.fallidas.map((x) => x.clave)).toEqual([victima]);
        expect(r.corregidas).toBe(CORREOS_CANONICOS.length - 1);
    });

    it("clave sin fila viva se reporta, no explota", async () => {
        const r = await corregirCorreosCanonicos(fakeDb({}).db, { dryRun: false });
        expect(r.encontradas).toBe(0);
        expect(r.clavesSinFila).toEqual(CLAVES);
    });

    it("modos: SOLO --confirm escribe; --aviso y DRY-RUN son de solo lectura", async () => {
        for (const modo of ["aviso", "dry-run"] as const) {
            const f = fakeDb(filasViejas());
            const r = await correrModo(f.db, modo);
            expect(r.desactualizadas.length, modo).toBe(CORREOS_CANONICOS.length);
            expect(f.escrituras(), modo).toBe(0);
        }
        const f = fakeDb(filasViejas());
        await correrModo(f.db, "confirm");
        expect(f.escrituras()).toBe(CORREOS_CANONICOS.length);
    });

    it("flags: DRY-RUN por defecto; --confirm; --aviso; ABORTA ante desconocido o --confirm + --aviso", () => {
        const base = ["node", "corregir-correos-canonicos.ts"];
        expect(parsearArgsCorrector(base)).toEqual({ modo: "dry-run" });
        expect(parsearArgsCorrector([...base, "--confirm"])).toEqual({ modo: "confirm" });
        expect(parsearArgsCorrector([...base, "--aviso"])).toEqual({ modo: "aviso" });
        // El typo peligroso: `--confirmar` NO es `--confirm` — aborta antes de tocar nada.
        expect(() => parsearArgsCorrector([...base, "--confirmar"])).toThrow(/no reconocido/);
        expect(() => parsearArgsCorrector([...base, "--confirm", "--aviso"])).toThrow(/excluyentes/);
    });

    it("línea del aviso: N > 0 manda a correr el corrector; 0 lo dice; fallas se cuentan", () => {
        const r = (n: number, fallidas = 0): ResultadoCorrectorCopys => ({
            encontradas: 3,
            desactualizadas: Array.from({ length: n }, (_, i) => ({ clave: `k${i}`, id: `i${i}`, campos: ["cuerpo"], version: 1, editadaEnPanel: false })),
            clavesSinFila: [],
            corregidas: 0,
            fallidas: Array.from({ length: fallidas }, (_, i) => ({ clave: `f${i}`, error: "x" })),
            escrito: false,
        });
        expect(lineaDeAviso(r(2))).toContain("2 plantillas difieren del canónico → corré el corrector");
        expect(lineaDeAviso(r(1))).toContain("1 plantilla difiere del canónico → corré el corrector");
        expect(lineaDeAviso(r(0))).toContain("0 plantillas difieren del canónico");
        expect(lineaDeAviso(r(0, 1))).toContain("1 no se pudieron verificar");
    });
});

/** Todo lo que está MAL en cómo el deploy usa el corrector. `[]` = detector blando, solo aviso, post-verificación. */
export function problemasDelDeploy(sh: string): string[] {
    const lineas = sh.split("\n");
    const iVerificado = lineas.findIndex((l) => /^\s*echo\s+".*DEPLOY VERIFICADO/.test(l));
    const usos = lineas
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => !l.trim().startsWith("#") && /corregir-correos-canonicos\.ts/.test(l));
    if (usos.length === 0) return ["deploy-prod.sh no corre el detector de deriva"];
    const p: string[] = [];
    for (const { l, i } of usos) {
        if (/--confirm\b/.test(l)) p.push("el deploy APLICA el corrector (--confirm): debe ser un acto deliberado del CEO");
        if (!/--aviso\b/.test(l)) p.push("el deploy corre el corrector sin --aviso");
        if (!/\|\|\s*echo\b/.test(l)) p.push("el detector no es blando (falta `|| echo`): podría tumbar el deploy");
        if (iVerificado < 0 || i < iVerificado) p.push("el detector corre ANTES de «DEPLOY VERIFICADO»");
    }
    return p;
}

describe("SPEC-922 · deploy-prod.sh usa el corrector SOLO como detector de deriva", () => {
    const DEPLOY = fs.readFileSync(path.resolve(__dirname, "deploy-prod.sh"), "utf-8");
    const ok = 'echo "  DEPLOY VERIFICADO"\n$COMPOSE exec -T app node --import tsx scripts/corregir-correos-canonicos.ts --aviso || echo "⚠️"';

    it("control POSITIVO del detector: cada desvío se caza", () => {
        expect(problemasDelDeploy(ok)).toEqual([]);
        expect(problemasDelDeploy("echo hola")).toEqual(["deploy-prod.sh no corre el detector de deriva"]);
        expect(problemasDelDeploy(ok.replace("--aviso", "--confirm"))).toContain(
            "el deploy APLICA el corrector (--confirm): debe ser un acto deliberado del CEO"
        );
        expect(problemasDelDeploy(ok.replace(' || echo "⚠️"', ""))).toContain(
            "el detector no es blando (falta `|| echo`): podría tumbar el deploy"
        );
        const antes = ok.split("\n").reverse().join("\n");
        expect(problemasDelDeploy(antes)).toContain("el detector corre ANTES de «DEPLOY VERIFICADO»");
    });

    it("deploy-prod.sh: aviso blando, después de «DEPLOY VERIFICADO», nunca --confirm", () => {
        expect(problemasDelDeploy(DEPLOY)).toEqual([]);
    });
});
