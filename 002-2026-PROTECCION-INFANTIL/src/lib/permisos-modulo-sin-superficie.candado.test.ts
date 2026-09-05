/**
 * SPEC-496 · Candado ANTIRREGRESIÓN DE LA CLASE, no del caso.
 *
 * Origen (barrido de brechas de permisos, 05-09): existían módulos concedidos a
 * un rol en `CLAVES_POR_ROL` que **ningún endpoint ni página exigía** — los 6
 * `profesional_*`. El área del profesional se gateaba por ROL, así que el módulo
 * solo pintaba el menú: revocarlo en el panel de permisos escondía el ítem pero
 * NO cortaba el acceso. Un control de administración que miente
 * ([[ceo-degradacion-silenciosa]]).
 *
 * SPEC-496 cableó `profesional_*` en sus endpoints y páginas. Este candado
 * impide que la CLASE vuelva: falla si CUALQUIER módulo concedido a un rol no es
 * exigido por al menos un guard real (o es el padre de uno, porque la jerarquía
 * AND lo vuelve necesario aunque no tenga guard propio).
 *
 * Vigilancia por CONDUCTA (no por texto): escanea la FUENTE en busca de llamadas
 * reales a `assertModulo` / `assertAnyModulo` / `verificarAccesoPagina` /
 * `puedeAccederAModulo`. Quitar el guard de un módulo lo deja «solo-NAV» otra vez
 * y este test se pone rojo con el nombre exacto del módulo huérfano.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CLAVES_POR_ROL } from "../../prisma/seed-modulos-grants";
import { CATALOGO_MODULOS } from "./permisos-catalogo";

// Vitest corre desde la raíz del proyecto; `src/` cuelga de ahí. (No se usa
// import.meta.url: bajo jsdom no siempre es un file:// URL.)
const SRC = path.resolve(process.cwd(), "src");

/** Recorre src/ y devuelve el texto de cada .ts/.tsx que NO sea test. */
function fuentesDeSrc(): string[] {
    const out: string[] = [];
    for (const entrada of fs.readdirSync(SRC, { withFileTypes: true, recursive: true })) {
        if (!entrada.isFile()) continue;
        const nombre = entrada.name;
        if (!/\.tsx?$/.test(nombre)) continue;
        if (/\.test\.tsx?$/.test(nombre)) continue; // los tests no son superficie de producción
        const dir = (entrada as unknown as { parentPath?: string; path?: string }).parentPath
            ?? (entrada as unknown as { path?: string }).path
            ?? SRC;
        out.push(fs.readFileSync(path.join(dir, nombre), "utf-8"));
    }
    return out;
}

// Greedy hasta `;`: captura toda la llamada aunque tenga paréntesis anidados,
// p. ej. `assertModulo(await verifyAuth(RolUsuario.ADMIN), "sesiones_admin")`.
// Un `\)` no-greedy se cerraría en el paréntesis interno y perdería el módulo.
const GUARDS = /(assertModulo|assertAnyModulo|verificarAccesoPagina|puedeAccederAModulo)\s*\(([^;]*)/g;

describe("SPEC-496 · ningún módulo concedido queda SOLO-NAV (exigido por cero superficies)", () => {
    const claves = new Set(CATALOGO_MODULOS.map((m) => m.clave));
    const padre = new Map(CATALOGO_MODULOS.filter((m) => m.padre).map((m) => [m.clave, m.padre!]));

    // Módulos exigidos por un guard REAL en la fuente (clave literal dentro de la llamada).
    const exigidosDirecto = new Set<string>();
    for (const texto of fuentesDeSrc()) {
        for (const m of texto.matchAll(GUARDS)) {
            for (const lit of m[2].matchAll(/["'`]([a-z_]+)["'`]/g)) {
                if (claves.has(lit[1])) exigidosDirecto.add(lit[1]);
            }
        }
    }
    // La jerarquía AND vuelve necesario al PADRE de un módulo exigido, aunque el
    // padre no tenga guard propio (p. ej. `colegios`, `comite`, `centro_control_ia`).
    const exigidosEfectivo = new Set(exigidosDirecto);
    for (const c of exigidosDirecto) {
        const p = padre.get(c);
        if (p) exigidosEfectivo.add(p);
    }

    it("todo módulo en CLAVES_POR_ROL tiene al menos un guard real (o es padre de uno)", () => {
        const concedidos = new Set<string>();
        for (const lista of Object.values(CLAVES_POR_ROL)) for (const c of lista) concedidos.add(c);

        const soloNav = [...concedidos].filter((c) => !exigidosEfectivo.has(c)).sort();
        expect(
            soloNav,
            "Módulos concedidos a un rol pero exigidos por CERO endpoints/páginas " +
                `(solo-NAV → revocarlos no corta acceso, degradación silenciosa):\n${soloNav.join("\n")}`
        ).toEqual([]);
    });

    it("el escaneo encontró guards reales (la fuente se leyó de verdad)", () => {
        // Sanidad del propio candado: si el walk no leyó nada, `exigidosDirecto`
        // quedaría vacío y el test de arriba pasaría en falso.
        expect(exigidosDirecto.size).toBeGreaterThan(30);
        expect(exigidosDirecto.has("profesional_inicio")).toBe(true); // el fix de este PR
    });
});
