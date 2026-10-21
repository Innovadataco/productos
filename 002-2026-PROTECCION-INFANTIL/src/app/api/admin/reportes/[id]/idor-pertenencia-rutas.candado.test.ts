/**
 * CANDADO ESTRUCTURAL (ratchet) · SPEC-891 (IDOR · pertenencia por reporte).
 *
 * Toda `route.ts` bajo `admin/reportes/[id]/` que sea ALCANZABLE por OPERADOR o COMITE —gatea un módulo que
 * esos roles tienen en `CLAVES_POR_ROL` (fuente única)— DEBE chequear pertenencia por reporte, por alguno de:
 *   (a) gate admin-only  → requireAdmin( … )  o  !esAdminRol(user.rol)
 *   (b) puedeGestionarReporte(user, reporte)   (ADMIN + OPERADOR dueño)
 *   (c) 3-vías           → findPermisosRevision(…) + chequeo comiteId   (+ operador/admin)
 *   (d) inline operadorId → operadorId ===/!== user.id
 * Si no, una ruta nueva nace vulnerable (un OPERADOR/COMITE de otro tenant opera reportes ajenos) y este
 * ratchet la caza. Al importar `CLAVES_POR_ROL`, el día que un módulo (p. ej. denuncia_formal) se conceda a
 * OPERADOR/COMITE, las rutas que lo gatean SIN pertenencia se vuelven rojas automáticamente.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CLAVES_POR_ROL } from "../../../../../../prisma/seed-modulos-grants";

const DIR = path.join(process.cwd(), "src/app/api/admin/reportes/[id]");

function rutas(): Array<{ nombre: string; src: string }> {
    return fs
        .readdirSync(DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => ({ nombre: d.name, file: path.join(DIR, d.name, "route.ts") }))
        .filter((r) => fs.existsSync(r.file))
        .map((r) => ({ nombre: r.nombre, src: fs.readFileSync(r.file, "utf8") }));
}

/** Módulos que la ruta exige (assertModulo / assertAnyModulo). */
function modulosAsertados(src: string): string[] {
    const mods: string[] = [];
    for (const m of src.matchAll(/assertModulo\(\s*user\s*,\s*"([^"]+)"/g)) mods.push(m[1]);
    for (const m of src.matchAll(/assertAnyModulo\(\s*user\s*,\s*\[([^\]]+)\]/g)) {
        for (const q of m[1].matchAll(/"([^"]+)"/g)) mods.push(q[1]);
    }
    return mods;
}

/** ¿La ruta chequea pertenencia por reporte por alguno de los 4 mecanismos aceptados? */
function tienePertenencia(src: string): boolean {
    return (
        /\brequireAdmin\s*\(/.test(src) || // (a)
        /!\s*esAdminRol\s*\(\s*user\.rol\s*\)/.test(src) || // (a)
        /\bpuedeGestionarReporte\s*\(/.test(src) || // (b)
        (/\bfindPermisosRevision\s*\(/.test(src) && /comiteId/.test(src)) || // (c)
        /operadorId\s*(===|!==)\s*user\.id/.test(src) // (d)
    );
}

const MODULOS_OP_COMITE = new Set<string>([
    ...(CLAVES_POR_ROL["OPERADOR"] ?? []),
    ...(CLAVES_POR_ROL["COMITE_VALIDACION"] ?? []),
]);

function alcanzablePorOpComite(src: string): boolean {
    return modulosAsertados(src).some((m) => MODULOS_OP_COMITE.has(m));
}

describe("SPEC-891 · ratchet IDOR: rutas de reporte alcanzables por OPERADOR/COMITE exigen pertenencia", () => {
    const todas = rutas();

    it("sanidad del parseo: ≥13 rutas, incluye expediente y revelar-original", () => {
        const nombres = todas.map((r) => r.nombre);
        expect(nombres.length).toBeGreaterThanOrEqual(13);
        expect(nombres).toContain("expediente");
        expect(nombres).toContain("revelar-original");
    });

    it("toda ruta gated por módulo de OPERADOR/COMITE chequea pertenencia (a/b/c/d)", () => {
        const viol: string[] = [];
        for (const { nombre, src } of todas) {
            if (alcanzablePorOpComite(src) && !tienePertenencia(src)) {
                viol.push(`${nombre}: módulo [${modulosAsertados(src).join(",")}] alcanzable por op/comité SIN pertenencia`);
            }
        }
        expect(viol, `rutas con IDOR potencial: ${viol.join(" · ")}`).toEqual([]);
    });

    it("control positivo: el detector marca una ruta vulnerable y respeta una segura", () => {
        const vulnerable = "await assertModulo(user, \"bandeja_reportes\"); const datos = await cargar(id);";
        const segura = "await assertModulo(user, \"bandeja_reportes\"); if (!puedeGestionarReporte(user, permisos)) return r403;";
        expect(alcanzablePorOpComite(vulnerable) && !tienePertenencia(vulnerable), "vulnerable detectada").toBe(true);
        expect(alcanzablePorOpComite(segura) && !tienePertenencia(segura), "segura NO marcada").toBe(false);
    });
});
