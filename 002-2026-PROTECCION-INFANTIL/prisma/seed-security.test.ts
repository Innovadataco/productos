/**
 * Guarda de regresión anti-literal del seed (spec 105-US3, I-31).
 * Falla si una contraseña literal vuelve a entrar al seed, si el bloque del admin
 * recupera un `update:` (anti-pisado) o si el create pierde `debeCambiarPassword: true`.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CATALOGO_MODULOS } from "../src/lib/permisos-catalogo";

const SEED_PATH = path.join(process.cwd(), "prisma", "seed.ts");

function bloqueAdmin(): string {
    const src = fs.readFileSync(SEED_PATH, "utf-8");
    const inicio = src.indexOf("const adminEmail");
    const fin = src.indexOf("Admin inicial creado");
    if (inicio === -1 || fin === -1) {
        throw new Error("No se encontró el bloque del admin en prisma/seed.ts (cambió la estructura; revisar este test)");
    }
    return src.slice(inicio, fin);
}

describe("seed del admin — guarda anti-literal (I-31)", () => {
    it("la contraseña del admin solo viene de process.env (sin literal en el repo)", () => {
        const bloque = bloqueAdmin();
        // Asignación de string literal (>=6 chars) a identificadores *password* fuera de process.env
        const literal = bloque.match(/password\w*\s*=\s*["'`]([^"'`]{6,})["'`]/i);
        const valor = literal?.[1] ?? "";
        expect(valor.startsWith("process.env") || valor === "" ? true : !literal, 
            "Contraseña literal detectada en el bloque del admin del seed").toBe(true);
    });

    it("el bloque del admin NO tiene update: (el seed nunca pisa credenciales)", () => {
        expect(bloqueAdmin()).not.toMatch(/update\s*:/);
    });

    it("el create del admin exige debeCambiarPassword: true", () => {
        expect(bloqueAdmin()).toMatch(/debeCambiarPassword:\s*true/);
    });

    it("sin SEED_ADMIN_PASSWORD el seed omite el admin (rama de omisión presente)", () => {
        expect(bloqueAdmin()).toMatch(/Admin omitido/);
    });
});

/**
 * Guarda de regresión del default de grants del comité (SPEC-128, D-43).
 * Falla si COMITE_VALIDACION vuelve a recibir módulos cuyas rutas la puerta le niega
 * (comite → /dashboard/admin/comite/gestion y comite_auditoria → .../auditoria son
 * ADMIN_ONLY en proxy.ts). El comité solo recibe su bandeja por defecto.
 * 002-PI-048: el bloque vive en la fuente única `prisma/seed-modulos-grants.ts`
 * (la comparten el seed y scripts/sync-modulos-grants.ts).
 */
const SEED_MODULOS_PATH = path.join(process.cwd(), "prisma", "seed-modulos-grants.ts");

function bloqueClavesPorRol(): string {
    const src = fs.readFileSync(SEED_MODULOS_PATH, "utf-8");
    const inicio = src.indexOf("const clavesPorRol");
    const fin = src.indexOf("};", inicio);
    if (inicio === -1 || fin === -1) {
        throw new Error("No se encontró clavesPorRol en prisma/seed-modulos-grants.ts (cambió la estructura; revisar este test)");
    }
    return src.slice(inicio, fin);
}

describe("grants por defecto del comité — reconciliación D-43 (SPEC-128)", () => {
    it("COMITE_VALIDACION recibe su bandeja + denuncia formal (002-PI-056, decisión ZEUS)", () => {
        const entrada = bloqueClavesPorRol().match(/COMITE_VALIDACION:\s*\[([^\]]*)\]/)?.[1] ?? "";
        const claves = entrada.match(/"[^"]+"/g) ?? [];
        // SPEC-128 (D-43): solo comite_bandeja. 002-PI-056 (F2, decisión ZEUS): el comité
        // genera denuncias formales → denuncia_formal, que es hijo de bandeja_reportes
        // (jerarquía AND) y exige el padre. No reabre D-43: esas rutas no son ADMIN_ONLY.
        // I-57 (SPEC-175): comite_bandeja también exige SU padre `comite` (jerarquía AND);
        // sin él la bandeja del comité quedaba inoperante en prod. `comite` solo mapea a
        // rutas ADMIN_ONLY (la puerta las niega) y los endpoints que lo exigen verifican
        // verifyAuth("ADMIN") antes — concederlo no abre nada al comité.
        expect(claves).toEqual(['"comite"', '"comite_bandeja"', '"bandeja_reportes"', '"denuncia_formal"']);
    });

    it("ADMIN deriva sus grants del catálogo completo (conserva comite y comite_auditoria)", () => {
        expect(bloqueClavesPorRol()).toMatch(/ADMIN:\s*modulosSeed\.map/);
    });
});

describe("grants por rol — jerarquía AND completa (I-57, SPEC-175)", () => {
    it("todo rol que recibe un módulo hijo recibe también su padre", () => {
        const bloque = bloqueClavesPorRol();
        const padreDe = new Map(CATALOGO_MODULOS.filter((m) => m.padre).map((m) => [m.clave, m.padre!]));
        const violaciones: string[] = [];
        // Entradas literales rol: ["a", "b"] — ADMIN es dinámico (todo el catálogo) y no aplica.
        for (const m of bloque.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
            const [_, rol, listaRaw] = m;
            const claves = new Set(listaRaw.match(/"[^"]+"/g)?.map((c) => c.replaceAll('"', "")) ?? []);
            for (const clave of claves) {
                const padre = padreDe.get(clave);
                if (padre && !claves.has(padre)) {
                    violaciones.push(`${rol}: recibe "${clave}" pero no su padre "${padre}"`);
                }
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });
});
