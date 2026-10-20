/**
 * SPEC-884 (I-364) · CANDADO de la compuerta contra ciudades duplicadas.
 *
 * Muere con el defecto: sin el índice UNIQUE PARCIAL
 * `(paisId, departamentoId, nombreNormalizado) WHERE esActivo` (NULLS NOT
 * DISTINCT), insertar una variante tilde/espacio de una ciudad ACTIVA en el
 * mismo (país, depto) tiene éxito → vuelve el duplicado de I-364. Con el índice,
 * el segundo insert es rechazado.
 *
 * Control positivo (el índice NO sobre-rechaza): misma norma en DISTINTO depto o
 * DISTINTO país pasa; una colisionante INACTIVA pasa (la compuerta es WHERE
 * esActivo). Y NULLS NOT DISTINCT cierra el hueco de los null-depto DENTRO del
 * país sin tocar los de países distintos.
 *
 * Más: la lógica PURA del corrector (re-normalizar + dedup país-aware) y del
 * detector (preflight) — testeada sin BD, control positivo por cada rama.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { normalizarNombreGeografico } from "../normalizar";
import {
    calcularRenormalizaciones,
    calcularDesactivacionesPorPais,
    type FilaCiudadConPais,
} from "../../../scripts/geo/normalizar-y-dedup-ciudades";
import { analizarCiudades, type FilaDeteccion } from "../../../scripts/geo/detectar-ciudades-duplicadas";
import { verificarIndices, REQUIRED } from "../../../scripts/verify-hnsw-indexes";

const NOMBRE_INDICE = "Ciudad_paisId_departamentoId_nombreNormalizado_activas_key";
const COD_P1 = "ZZ884A";
const COD_P2 = "ZZ884B";

let paisId1 = "";
let paisId2 = "";
let deptoA = "";
let deptoB = "";

async function limpiarCiudades(): Promise<void> {
    await prisma.ciudad.deleteMany({ where: { paisId: { in: [paisId1, paisId2].filter(Boolean) } } });
}

function esViolacionUnique(error: unknown): boolean {
    // Prisma mapea el 23505 de Postgres a P2002 incluso para un índice que no vive en el schema.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return true;
    const msg = error instanceof Error ? error.message : String(error);
    return /unique constraint|23505|activas_key/i.test(msg);
}

async function crearCiudadActiva(opts: {
    nombre: string;
    paisId: string;
    departamentoId?: string | null;
    esActivo?: boolean;
}): Promise<void> {
    await prisma.ciudad.create({
        data: {
            nombre: opts.nombre,
            nombreNormalizado: normalizarNombreGeografico(opts.nombre),
            paisId: opts.paisId,
            departamentoId: opts.departamentoId ?? null,
            esActivo: opts.esActivo ?? true,
        },
    });
}

describe("SPEC-884 · compuerta de ciudades duplicadas (índice UNIQUE parcial)", () => {
    beforeAll(async () => {
        const p1 = await prisma.pais.upsert({ where: { codigo: COD_P1 }, update: {}, create: { codigo: COD_P1, nombre: "ZZ Testlandia A" } });
        const p2 = await prisma.pais.upsert({ where: { codigo: COD_P2 }, update: {}, create: { codigo: COD_P2, nombre: "ZZ Testlandia B" } });
        paisId1 = p1.id;
        paisId2 = p2.id;
        const dA = await prisma.departamento.upsert({ where: { nombre_paisId: { nombre: "ZZ Depto A", paisId: paisId1 } }, update: {}, create: { nombre: "ZZ Depto A", paisId: paisId1 } });
        const dB = await prisma.departamento.upsert({ where: { nombre_paisId: { nombre: "ZZ Depto B", paisId: paisId1 } }, update: {}, create: { nombre: "ZZ Depto B", paisId: paisId1 } });
        deptoA = dA.id;
        deptoB = dB.id;
    });

    beforeEach(async () => {
        await limpiarCiudades();
    });

    afterAll(async () => {
        await limpiarCiudades();
        await prisma.departamento.deleteMany({ where: { paisId: { in: [paisId1, paisId2].filter(Boolean) } } });
        await prisma.pais.deleteMany({ where: { codigo: { in: [COD_P1, COD_P2] } } });
    });

    it("RECHAZA una variante tilde activa en el MISMO (país, depto) — muere sin el índice", async () => {
        await crearCiudadActiva({ nombre: "Medellín", paisId: paisId1, departamentoId: deptoA });
        // «Medellin» (sin tilde): nombre crudo DISTINTO (pasa @@unique[nombre,paisId]),
        // pero norm = "medellin" idéntica → debe chocar contra el índice parcial.
        let capturado: unknown = null;
        try {
            await crearCiudadActiva({ nombre: "Medellin", paisId: paisId1, departamentoId: deptoA });
        } catch (error) {
            capturado = error;
        }
        expect(capturado, "el segundo insert debió ser rechazado por el índice UNIQUE parcial").not.toBeNull();
        expect(esViolacionUnique(capturado)).toBe(true);
    });

    it("PERMITE la misma norma en DISTINTO depto del mismo país (los 253 municipios legítimos)", async () => {
        await crearCiudadActiva({ nombre: "Medellín", paisId: paisId1, departamentoId: deptoA });
        await expect(crearCiudadActiva({ nombre: "Medellin", paisId: paisId1, departamentoId: deptoB })).resolves.toBeUndefined();
    });

    it("PERMITE la misma norma null-depto en PAÍSES distintos (Santiago CL/PA/DO)", async () => {
        await crearCiudadActiva({ nombre: "Santiago", paisId: paisId1, departamentoId: null });
        await expect(crearCiudadActiva({ nombre: "Sántiago", paisId: paisId2, departamentoId: null })).resolves.toBeUndefined();
    });

    it("RECHAZA dos null-depto con misma norma en el MISMO país (NULLS NOT DISTINCT)", async () => {
        await crearCiudadActiva({ nombre: "Santiago", paisId: paisId1, departamentoId: null });
        let capturado: unknown = null;
        try {
            await crearCiudadActiva({ nombre: "Sántiago", paisId: paisId1, departamentoId: null });
        } catch (error) {
            capturado = error;
        }
        expect(capturado, "dos null-depto misma norma mismo país debieron chocar (NULLS NOT DISTINCT)").not.toBeNull();
        expect(esViolacionUnique(capturado)).toBe(true);
    });

    it("PERMITE una colisionante INACTIVA (la compuerta es WHERE esActivo)", async () => {
        await crearCiudadActiva({ nombre: "Medellín", paisId: paisId1, departamentoId: deptoA, esActivo: true });
        await expect(
            crearCiudadActiva({ nombre: "Medellin", paisId: paisId1, departamentoId: deptoA, esActivo: false }),
        ).resolves.toBeUndefined();
    });

    it("el guardián (verify-hnsw-indexes) declara y reconoce el índice con su predicado", async () => {
        expect(REQUIRED.map((r) => r.name)).toContain(NOMBRE_INDICE);
        const res = await verificarIndices();
        expect(res.missing, `faltante: ${res.missing.join(", ")}`).not.toContain(NOMBRE_INDICE);
        // El chequeo de `predicado` (NULLS NOT DISTINCT + esActivo) no debe marcar el índice como mal tipo.
        expect(res.wrongType.find((w) => w.name === NOMBRE_INDICE)).toBeUndefined();
    });
});

// ── Lógica PURA del corrector y el detector (sin BD) ───────────────────────────
describe("SPEC-884 · corrector (puro)", () => {
    it("calcularRenormalizaciones marca stale y vacío, no las que ya coinciden", () => {
        const r = calcularRenormalizaciones([
            { id: "ok", nombre: "Medellín", nombreNormalizado: "medellin" }, // ya coincide
            { id: "stale", nombre: "Medellín", nombreNormalizado: "medellín" }, // con tilde (stale)
            { id: "vacio", nombre: "Cali", nombreNormalizado: "" }, // vacío
        ]);
        expect(r.map((x) => x.id).sort()).toEqual(["stale", "vacio"]);
        expect(r.find((x) => x.id === "vacio")!.a).toBe("cali");
    });

    it("calcularDesactivacionesPorPais es PAÍS-AWARE: no fusiona null-depto entre países, sí dentro", () => {
        const base = { poblacion: null as number | null, creadoEn: new Date("2026-01-01T00:00:00Z") };
        const filas: FilaCiudadConPais[] = [
            // Mismo país, mismo (null) depto, misma norm → dup (desactiva una)
            { id: "cl-stgo-1", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null, paisId: "CL", poblacion: 100, creadoEn: base.creadoEn },
            { id: "cl-stgo-2", nombre: "Sántiago", nombreNormalizado: "santiago", departamentoId: null, paisId: "CL", poblacion: 50, creadoEn: base.creadoEn },
            // Otro país, misma norm, null depto → NO se fusiona (país distinto)
            { id: "do-stgo", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null, paisId: "DO", poblacion: 10, creadoEn: base.creadoEn },
        ];
        const d = calcularDesactivacionesPorPais(filas);
        expect(d.map((x) => x.id)).toEqual(["cl-stgo-2"]); // solo la de menor población de CL
    });

    it("calcularDesactivacionesPorPais conserva municipios de deptos distintos (mismo país)", () => {
        const filas: FilaCiudadConPais[] = [
            { id: "a", nombre: "La Unión", nombreNormalizado: "la union", departamentoId: "dptoA", paisId: "CO", poblacion: 1, creadoEn: new Date("2026-01-01") },
            { id: "b", nombre: "La Unión", nombreNormalizado: "la union", departamentoId: "dptoB", paisId: "CO", poblacion: 1, creadoEn: new Date("2026-01-01") },
        ];
        expect(calcularDesactivacionesPorPais(filas)).toEqual([]);
    });
});

describe("SPEC-884 · detector (puro)", () => {
    const fila = (p: Partial<FilaDeteccion> & { id: string }): FilaDeteccion => ({
        nombre: p.id,
        nombreNormalizado: p.id,
        paisId: "CO",
        departamentoId: "dptoA",
        ...p,
    });

    it("cuenta dups por (país,depto,norm-canónica), stale y vacíos; limpio cuando no hay", () => {
        const limpio = analizarCiudades([
            fila({ id: "x", nombre: "Bogotá", nombreNormalizado: "bogota" }),
            fila({ id: "y", nombre: "Medellín", nombreNormalizado: "medellin" }),
        ]);
        expect(limpio.limpio).toBe(true);
        expect(limpio.gruposDup).toHaveLength(0);
    });

    it("detecta el dup por norma canónica aunque el stored difiera, y lo marca stale", () => {
        const r = analizarCiudades([
            fila({ id: "1", nombre: "Medellín", nombreNormalizado: "medellin" }),
            fila({ id: "2", nombre: "Medellin", nombreNormalizado: "medellin" }),
        ]);
        expect(r.gruposDup).toHaveLength(1);
        expect(r.gruposDup[0].ids.sort()).toEqual(["1", "2"]);
        expect(r.limpio).toBe(false);
    });

    it("separa el dup null-depto en nullDeptoDup (el caso que el preflight debe mirar)", () => {
        const r = analizarCiudades([
            fila({ id: "1", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null }),
            fila({ id: "2", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null }),
        ]);
        expect(r.nullDeptoDup).toHaveLength(1);
    });

    it("NO fusiona el mismo nombre de PAÍSES distintos (null depto)", () => {
        const r = analizarCiudades([
            fila({ id: "cl", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null, paisId: "CL" }),
            fila({ id: "do", nombre: "Santiago", nombreNormalizado: "santiago", departamentoId: null, paisId: "DO" }),
        ]);
        expect(r.gruposDup).toHaveLength(0);
        expect(r.limpio).toBe(true);
    });
});
