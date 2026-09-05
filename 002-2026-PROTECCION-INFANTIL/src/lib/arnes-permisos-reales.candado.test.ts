/**
 * SPEC-443 (I-309): el arnés de pruebas siembra EXACTAMENTE el mismo mapa de permisos
 * que producción. Antes (`otorgarTodosLosPermisos`) encendía 43 módulos × 8 roles, lo
 * que hacía pasar en verde tests de acceso que en prod daban 403 (I-278) y candados de
 * bloqueo que nunca morían — un candado de palabras a escala de suite entera.
 *
 * Candado de CONDUCTA: tras `resetDatabase()` (que llama `sembrarPermisosDeProduccion`),
 * compara las FILAS reales de `permisoModulo` activas en BD contra el mapa declarado en
 * `CLAVES_POR_ROL` (la fuente única de `seed-modulos-grants.ts`) y falla si se separan
 * en cualquier dirección. Un candado que solo mirara nombres de función no serviría.
 *
 * Contraprueba (mutación): agregar un permiso de más en el arnés (o en el seed) → el
 * conjunto en BD supera al declarado → rojo con el permiso de sobra.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { CLAVES_POR_ROL } from "../../prisma/seed-modulos-grants";

function esperadoDelSeed(): Set<string> {
    const set = new Set<string>();
    for (const [rol, claves] of Object.entries(CLAVES_POR_ROL)) {
        for (const clave of claves) set.add(`${rol}::${clave}`);
    }
    return set;
}

describe("SPEC-443 · el arnés siembra el mapa REAL de permisos (no todos)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("los grants activos en BD == CLAVES_POR_ROL del seed de producción", async () => {
        const filas = await prisma.permisoModulo.findMany({
            where: { activo: true },
            select: { rol: true, modulo: { select: { clave: true } } },
        });
        const enBd = new Set(filas.map((f) => `${f.rol}::${f.modulo.clave}`));
        const esperado = esperadoDelSeed();

        const deMas = [...enBd].filter((x) => !esperado.has(x)).sort();
        const deMenos = [...esperado].filter((x) => !enBd.has(x)).sort();

        expect(deMas, `el arnés otorga permisos que el seed NO declara:\n${deMas.join("\n")}`).toEqual([]);
        expect(deMenos, `el seed declara permisos que el arnés NO sembró:\n${deMenos.join("\n")}`).toEqual([]);
    });

    it("NO enciende todo: PARENT no tiene ningún módulo (no está en CLAVES_POR_ROL)", async () => {
        const activos = await prisma.permisoModulo.count({ where: { activo: true, rol: "PARENT" } });
        expect(activos, "PARENT no debe tener módulos activos: prod no le da ninguno").toBe(0);
    });
});
