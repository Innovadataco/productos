/**
 * CANDADO · SPEC-766 · Plan.creadoEn está DECLARADA (legacy) pero CANDADA contra uso.
 *
 * La reconciliación (b) declara `Plan.creadoEn` en el esquema en vez de dropearla —la publicación
 * `bi_replica` (control de minimización Ley 1581, lo aplica Jelkin) depende de ella—. La
 * justificación ENTERA de conservarla es «creadoEn y createdAt son idénticas» (medido: 11 filas,
 * 0 difieren). El día que alguien ESCRIBA `creadoEn` y no `createdAt`, dejan de serlo y esa
 * justificación expira sin que nadie lo note. Este candado lo impide de forma ESTRUCTURAL —no un
 * comentario «legacy, no usar», que conserva conducta pero no la impide (lección de esta noche)—:
 * ningún query de Prisma sobre `Plan` puede mencionar `creadoEn` (data/select/where/orderBy).
 *
 * ALCANCE MEDIDO (candado de AUSENCIA: su alcance se DECLARA, no se asume que cubre todo — un
 * cero sin alcance escrito se lee como si cubriera todo, y así se leyó el barrido de código que
 * anoche no vio la publicación):
 *   CUBRE: queries FLUENT de Prisma sobre Plan (`X.plan.<metodo>({...})`) con `creadoEn` LITERAL
 *     en el bloque del argumento (data/select/where/orderBy). Es el riesgo real de ESCRITURA.
 *   NO CUBRE (puntos ciegos declarados; medidos HOY = 0, así que el verde es significativo AHORA):
 *     · SQL crudo `$queryRaw`/`$executeRaw` con la columna a mano — medido: ningún raw toca la
 *       tabla Plan (0 ocurrencias).
 *     · Selección dinámica `select: { [clave]: true }` (el nombre no aparece literal) — medido: 0
 *       en queries de Plan.
 *     · Spread de un objeto de select/data armado en otro lado (`{ ...campos }`) — medido: 0.
 *     · Acceso por propiedad a un Plan ya cargado (`planVar.creadoEn`) — el lado inofensivo (leer
 *       creadoEn, idéntica a createdAt, no diverge); el peligroso es escribir, y queda cerrado.
 *   Si mañana entra un raw / select dinámico / spread sobre Plan, este candado NO lo ve: ampliarlo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const RAICES = ["src", "scripts"];
// Este mismo archivo planta un ejemplo a propósito (el control positivo); no se escanea a sí mismo.
const AUTO_EXCLUIR = "plan-creadoen-no-uso.candado.test.ts";
const METODOS =
    "create|createMany|update|updateMany|upsert|findFirst|findFirstOrThrow|findMany|findUnique|findUniqueOrThrow|count|aggregate|groupBy|delete|deleteMany";
const RE_PLAN = new RegExp(`\\.plan\\.(?:${METODOS})\\s*\\(`, "g");

function archivosTs(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) archivosTs(p, acc);
        else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) acc.push(p);
    }
    return acc;
}

/** Desde el índice del `(` de apertura, devuelve el argumento hasta el `)` balanceado. */
function argBalanceado(texto: string, idxParen: number): string {
    let prof = 0;
    for (let i = idxParen; i < texto.length; i++) {
        if (texto[i] === "(") prof++;
        else if (texto[i] === ")") {
            prof--;
            if (prof === 0) return texto.slice(idxParen, i + 1);
        }
    }
    return texto.slice(idxParen);
}

describe("SPEC-766 · Plan.creadoEn candada contra uso (declarada legacy, idéntica a createdAt)", () => {
    it("ningún query de Prisma sobre Plan menciona creadoEn — createdAt es la fuente", () => {
        const infractores: string[] = [];
        for (const raiz of RAICES) {
            for (const archivo of archivosTs(raiz)) {
                if (archivo.endsWith(AUTO_EXCLUIR)) continue;
                const texto = readFileSync(archivo, "utf8");
                let m: RegExpExecArray | null;
                RE_PLAN.lastIndex = 0;
                while ((m = RE_PLAN.exec(texto)) !== null) {
                    const arg = argBalanceado(texto, m.index + m[0].length - 1);
                    if (/\bcreadoEn\b/.test(arg)) infractores.push(`${archivo} → ${m[0].trim()}…creadoEn`);
                }
            }
        }
        expect(
            infractores,
            "Plan.creadoEn está CANDADA (legacy, idéntica a createdAt): usá createdAt. Si de verdad se necesita creadoEn en un Plan, la decisión de SPEC-766 expiró — escalá al CEO, no toques el candado.",
        ).toEqual([]);
    });

    // Control positivo: el detector SÍ encuentra un uso plantado (no da vacío por bug del escaneo).
    it("control positivo: detecta un creadoEn plantado en un query de Plan", () => {
        const texto = "await prisma.plan.update({ where: { id }, data: { creadoEn: new Date() } });";
        const m = RE_PLAN.exec(texto);
        RE_PLAN.lastIndex = 0;
        expect(m, "el regex debe pegar en .plan.update(").not.toBeNull();
        const arg = argBalanceado(texto, m!.index + m![0].length - 1);
        expect(/\bcreadoEn\b/.test(arg), "debe ver el creadoEn plantado en el bloque del query").toBe(true);
    });
});
