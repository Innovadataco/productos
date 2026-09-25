/**
 * SPEC-725 (I-430) · CANDADO — la BD no puede tener una `clave` de `ModuloPermisible` que el
 * catálogo del código (`CATALOGO_MODULOS`) NO conozca; si la tiene, el barrido la SEÑALA y
 * `scripts/barrer-claves-modulo-desconocidas.ts` FALLA (exit 1). Y el corrector
 * `scripts/retirar-modulos-permiso-huerfanos.ts` retira esa fila SOLO si el código ya no la
 * declara, sin tocar ninguna otra.
 *
 * Divergencia hoy invisible: `seed-modulos-grants.ts` deriva de `CATALOGO_MODULOS` y NUNCA borra
 * tras un retiro. Dos claves quedaron huérfanas en BDs de larga vida: `profesional_verificacion`
 * (SPEC-706) y `profesional_citaciones` (SPEC-732 / #684) — filas vivas gateando NADA.
 *
 * Control positivo por REMOCIÓN del discriminador: se inserta un `ModuloPermisible` con clave que
 * el código NO declara y el barrido DEBE devolverla; si alguien debilita el checker a "siempre
 * vacío", este caso se pone ROJO. El caso limpio (solo el catálogo sembrado) DEBE dar vacío, para
 * que el candado no sea falso-rojo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { CATALOGO_MODULOS } from "@/lib/permisos-catalogo";
import { clavesModuloDesconocidas } from "../../scripts/barrer-claves-modulo-desconocidas";
import { retirarModuloDivergente, CLAVES_A_RETIRAR } from "../../scripts/retirar-modulos-permiso-huerfanos";

const clavesCatalogo = () => CATALOGO_MODULOS.map((m) => m.clave);
const CLAVES = [...CLAVES_A_RETIRAR];

async function sembrarModuloHuerfano(clave: string, roles: RolUsuario[] = []) {
    const modulo = await prisma.moduloPermisible.create({
        data: { clave, nombre: `Huérfano ${clave}`, categoria: "profesional", orden: 9000 },
    });
    if (roles.length > 0) {
        await prisma.permisoModulo.createMany({
            data: roles.map((rol) => ({ rol, moduloId: modulo.id, activo: true })),
        });
    }
    return modulo;
}

async function contarModulo(clave: string) {
    const fila = await prisma.moduloPermisible.findUnique({
        where: { clave },
        select: { id: true, _count: { select: { permisos: true } } },
    });
    return { existe: !!fila, grants: fila?._count.permisos ?? 0 };
}

describe("SPEC-725 · barrido: la BD no puede tener claves de módulo que el código no conoce", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("BD sembrada SOLO del catálogo ⇒ sin divergencia (vacío) — no es falso-rojo", async () => {
        expect(await clavesModuloDesconocidas(prisma)).toEqual([]);
    });

    it("CONTROL POSITIVO: una clave que el código no declara ⇒ el barrido la señala", async () => {
        const fantasma = "modulo_que_el_codigo_no_conoce_spec725";
        expect(clavesCatalogo()).not.toContain(fantasma);
        await sembrarModuloHuerfano(fantasma);
        expect(await clavesModuloDesconocidas(prisma)).toContain(fantasma);
    });

    it("los casos REALES (todas las claves retiradas) son señalados si viven en BD", async () => {
        for (const clave of CLAVES) expect(clavesCatalogo()).not.toContain(clave);
        for (const clave of CLAVES) await sembrarModuloHuerfano(clave, [RolUsuario.ADMIN, RolUsuario.PROFESIONAL]);
        const desconocidas = await clavesModuloDesconocidas(prisma);
        for (const clave of CLAVES) expect(desconocidas).toContain(clave);
    });
});

describe("SPEC-725 · corrector: retira las claves huérfanas (fila + grants), acotado", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it.each(CLAVES)("DRY-RUN no escribe nada para '%s': la fila y sus grants siguen ahí", async (clave) => {
        await sembrarModuloHuerfano(clave, [RolUsuario.ADMIN, RolUsuario.PROFESIONAL]);
        const res = await retirarModuloDivergente(prisma, clave, { confirm: false });
        expect(res).toMatchObject({ encontrado: true, permisosEliminados: 2 });
        expect(await contarModulo(clave)).toEqual({ existe: true, grants: 2 });
    });

    it.each(CLAVES)("--confirm retira '%s' (fila + grants) y el barrido deja de verla", async (clave) => {
        await sembrarModuloHuerfano(clave, [RolUsuario.ADMIN, RolUsuario.PROFESIONAL]);
        const res = await retirarModuloDivergente(prisma, clave, { confirm: true });
        expect(res).toMatchObject({ encontrado: true, permisosEliminados: 2 });
        expect(await contarModulo(clave)).toEqual({ existe: false, grants: 0 });
        expect(await clavesModuloDesconocidas(prisma)).not.toContain(clave);
    });

    it("TODAS a la vez: sembradas todas → tras retirar cada una, el barrido queda VERDE", async () => {
        for (const clave of CLAVES) await sembrarModuloHuerfano(clave, [RolUsuario.ADMIN, RolUsuario.PROFESIONAL]);
        for (const clave of CLAVES) await retirarModuloDivergente(prisma, clave, { confirm: true });
        expect(await clavesModuloDesconocidas(prisma)).toEqual([]);
    });

    it.each(CLAVES)("IDEMPOTENTE: sin la fila, --confirm no hace nada para '%s' y no lanza", async (clave) => {
        const res = await retirarModuloDivergente(prisma, clave, { confirm: true });
        expect(res).toEqual({ encontrado: false, permisosEliminados: 0, rolesAfectados: [] });
    });

    it("INTERLOCK: se niega a borrar una clave que el código TODAVÍA declara", async () => {
        const claveViva = "profesional_ficha";
        expect(clavesCatalogo()).toContain(claveViva); // precondición del control
        const antes = await contarModulo(claveViva); // sembrada por resetDatabase
        expect(antes.existe).toBe(true);
        await expect(retirarModuloDivergente(prisma, claveViva, { confirm: true })).rejects.toThrow(
            /CATALOGO_MODULOS|conoce/i,
        );
        expect(await contarModulo(claveViva)).toEqual(antes); // fila viva intacta
    });

    it("GUARDA DE TOPOLOGÍA: aborta si la fila huérfana tuviera submódulos", async () => {
        const clave = CLAVES[0]!;
        const padre = await sembrarModuloHuerfano(clave, [RolUsuario.ADMIN]);
        await prisma.moduloPermisible.create({
            data: { clave: "hijo_inesperado_spec725", nombre: "hijo", categoria: "profesional", orden: 9001, padreId: padre.id },
        });
        await expect(retirarModuloDivergente(prisma, clave, { confirm: true })).rejects.toThrow(/subm[oó]dulo/i);
        expect((await contarModulo(clave)).existe).toBe(true); // no borró nada
    });
});
