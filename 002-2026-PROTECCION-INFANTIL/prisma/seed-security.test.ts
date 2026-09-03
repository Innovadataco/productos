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
    it("COMITE_VALIDACION recibe exactamente 4 grants (SPEC-266, I-128)", () => {
        const entrada = bloqueClavesPorRol().match(/COMITE_VALIDACION:\s*\[([^\]]*)\]/)?.[1] ?? "";
        const claves = entrada.match(/"[^"]+"/g) ?? [];
        // SPEC-128 (D-43): solo comite_bandeja base.
        // I-57 (SPEC-175): comite requiere su padre `comite` (jerarquía AND).
        // SPEC-235 (002-PI-135): comite_guias_accion para aprobar/rechazar guías.
        // SPEC-263 (002-PI-164): expediente_revelar_original standalone (sin padre desde SPEC-266).
        // SPEC-266 (002-PI-169): bandeja_reportes y denuncia_formal eran indebidos (I-128) — eliminados.
        expect(claves).toEqual(['"comite"', '"comite_bandeja"', '"comite_guias_accion"', '"expediente_revelar_original"']);
    });

    it("ADMIN deriva sus grants del catálogo completo (conserva comite y comite_auditoria)", () => {
        expect(bloqueClavesPorRol()).toMatch(/ADMIN:\s*modulosSeed\.map/);
    });
    // SPEC-381 (I-274): quien modera NO aprueba sus propias guías. `comite_guias_accion`
    // es exclusivo del rol COMITE_VALIDACION; sacar al ADMIN de esa clave evita el
    // descuadre que dejaba la pestaña Guías visible para él y respondía 403 al abrirla.
    it("ADMIN NO recibe `comite_guias_accion` (separación de poderes SPEC-381 · I-274)", () => {
        const bloque = bloqueClavesPorRol();
        // Con el filter, la línea del ADMIN nombra explícitamente la exclusión.
        expect(bloque).toMatch(/ADMIN:\s*modulosSeed\.map\(\(m\) => m\.clave\)\.filter\(\(c\) => c !== "comite_guias_accion"\)/);
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

/**
 * SPEC-186 (002-PI-081): seed MIXTO del vigilante (I-65).
 * Verifica estructuralmente que los parámetros viejos de SPEC-171 se crean sin
 * pisar valores existentes, y que los nuevos de SPEC-186 se aplican siempre.
 */
describe("seed de parámetros de monitoreo — idempotencia estructural", () => {
    const src = fs.readFileSync(SEED_PATH, "utf-8");

    it("los 13 parámetros viejos de SPEC-171 están en monitoreoViejos con update: {}", () => {
        const inicio = src.indexOf("const monitoreoViejos");
        const fin = src.indexOf("const monitoreoNuevos", inicio);
        const bloque = src.slice(inicio, fin);
        const viejos = [
            "monitoreo.enabled",
            "monitoreo.app.intervalo_seg",
            "monitoreo.worker.heartbeat_max_seg",
            "monitoreo.ollama.ping.intervalo_seg",
            "monitoreo.ollama.smoke.timeout_ms",
            "monitoreo.tailscale.url",
            "monitoreo.tailscale.intervalo_seg",
            "monitoreo.reprobe.segundos",
            "monitoreo.email.throttle_min",
            "monitoreo.email.destinatarios",
            "monitoreo.autorefresh_seg",
            "monitoreo.atascados.horas",
        ];
        for (const clave of viejos) {
            expect(bloque).toContain(clave);
        }
        // El upsert de los viejos no pisa valores existentes.
        expect(bloque).toMatch(/update:\s*\{\s*\}/);
    });

    it("los 2 parámetros nuevos/cambiados de SPEC-186 están en monitoreoNuevos con update que aplica valor", () => {
        const inicio = src.indexOf("const monitoreoNuevos");
        const fin = src.indexOf("console.log(\"Parámetros por defecto creados\")", inicio);
        const bloque = src.slice(inicio, fin);
        expect(bloque).toContain("monitoreo.ollama.smoke.intervalo_min");
        expect(bloque).toContain("monitoreo.ollama.smoke.piggyback_min");
        expect(bloque).toMatch(/update:\s*\{\s*valor:\s*p\.valor,\s*descripcion:\s*p\.descripcion\s*\}/);
    });
});
