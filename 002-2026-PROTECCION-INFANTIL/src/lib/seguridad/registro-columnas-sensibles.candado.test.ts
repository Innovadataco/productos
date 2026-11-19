/**
 * CANDADO · SPEC-765 · el registro es un ESPEJO VERIFICADO (relación (b)), no una 6.ª lista.
 *
 * Cruza cada fuente declarativa contra `REGISTRO_COLUMNAS_SENSIBLES` y FALLA si discrepan. Sin
 * este candado desde el commit 1, el registro sería un documento que describe cómo deberían ser
 * las cosas sin nada que lo confronte con cómo son — deuda con formato de entregable.
 *
 * 🚨 FAIL-LOUD del acoplamiento cross-producto: el cruce con el whitelist LEE el SQL de 006. Si
 * ese archivo no existe, no parsea, o el parseo devuelve CERO tablas → el candado FALLA, NUNCA
 * pasa en verde con cero. Es el patrón de la sonda que falla hacia cero y parece sana. Control
 * positivo abajo: apuntar a un path inexistente / a un archivo sin tablas → cae.
 *
 * LÍMITE (escrito en el registro): el cruce del whitelist es ASIMÉTRICO — caza la dirección
 * peligrosa (marcado sensible-para-replica-bi pero SIGUE viajando), no la inversa (algo en el
 * whitelist que debimos clasificar y no clasificamos = desconocido desconocido).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { REGISTRO_COLUMNAS_SENSIBLES } from "./registro-columnas-sensibles";
import { CAMPOS_INTERNOS_PROFESIONAL } from "@/lib/profesional/dto";
import { CAMPOS_INTERNOS_CITA } from "@/lib/profesional/cita/dto";

// Ruta cross-producto DECLARADA. Si 006 la reorganiza, este candado se entera ROMPIÉNDOSE.
const WHITELIST_006 = resolve(
    process.cwd(),
    "../006-2026-BI-INTELIGENCIA-NEGOCIO/scripts/replica-setup/02-pi-db-publicacion.sql",
);

/** `ARRAY['Tabla', 'col1,col2,...']` → Map<Tabla, Set<columnas PUBLICADAS>>.
 *
 * SPEC-892: el whitelist REAL es el allow-list `canon` (las columnas que SÍ viajan a BI). El mismo
 * SQL trae después `columnas_vetadas` (lista de VETO: PII que NUNCA se publica) con el MISMO patrón
 * `ARRAY['t','col']`. Parsear ambas y sobrescribir (`mapa.set`) hacía que, para una tabla presente en
 * las dos (ClasificacionIA, AuditLog…), el whitelist quedara con las columnas VETADAS (último match) —
 * un FALSO POSITIVO: `ClasificacionIA.piiDetectada` está vetada (segura) pero aparecía «publicada». Se
 * acota el parseo al bloque `canon` (entre `canon text[][] :=` y `columnas_vetadas text[][] :=`) y se
 * UNEN columnas por si una tabla se repite. */
function parsearWhitelist(sql: string): Map<string, Set<string>> {
    const iCanon = sql.indexOf("canon text[][]");
    const iVetadas = sql.indexOf("columnas_vetadas text[][]");
    const bloque = iCanon >= 0 && iVetadas > iCanon ? sql.slice(iCanon, iVetadas) : sql;
    const mapa = new Map<string, Set<string>>();
    const re = /ARRAY\['([^']+)',\s*'([^']*)'\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bloque)) !== null) {
        const cols = m[2]
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
        const set = mapa.get(m[1]) ?? new Set<string>();
        for (const c of cols) set.add(c);
        mapa.set(m[1], set);
    }
    return mapa;
}

/** Lee + parsea el whitelist de 006. FALLA RUIDOSO si no existe, no parsea, o da CERO tablas. */
function leerWhitelist(path: string = WHITELIST_006): Map<string, Set<string>> {
    if (!existsSync(path)) {
        throw new Error(
            `[765] whitelist de 006 NO ENCONTRADO en ${path} — el candado FALLA (nunca pasa con cero). Si 006 movió/renombró el archivo, actualizá la ruta.`,
        );
    }
    const mapa = parsearWhitelist(readFileSync(path, "utf8"));
    if (mapa.size === 0) {
        throw new Error("[765] el parseo del whitelist de 006 devolvió CERO tablas — ¿cambió el formato ARRAY['t','cols']? El candado FALLA.");
    }
    return mapa;
}

/** Cruce de fuente 1: columnas sensible-para-replica-bi que SIGUEN en el whitelist (la dirección peligrosa). */
function infractoresReplicaBi(whitelist: Map<string, Set<string>>): string[] {
    const infractores: string[] = [];
    for (const e of REGISTRO_COLUMNAS_SENSIBLES) {
        if (!e.sensiblePara.includes("replica-bi")) continue;
        const permitidas = whitelist.get(e.tabla);
        if (permitidas && permitidas.has(e.columna)) infractores.push(`${e.tabla}.${e.columna} SIGUE en el whitelist (viaja a BI)`);
    }
    return infractores;
}

describe("SPEC-765 · registro de columnas sensibles = espejo verificado de las 5 fuentes", () => {
    it("cada entrada está documentada (tabla/columna/sensiblePara≥1/razon/fuente) y el registro no está vacío", () => {
        expect(REGISTRO_COLUMNAS_SENSIBLES.length).toBeGreaterThan(0);
        for (const e of REGISTRO_COLUMNAS_SENSIBLES) {
            expect(e.tabla.trim() && e.columna.trim() && e.razon.trim() && e.fuente.trim(), `entrada incompleta: ${JSON.stringify(e)}`).toBeTruthy();
            expect(e.sensiblePara.length, `${e.tabla}.${e.columna} sin superficie`).toBeGreaterThan(0);
        }
    });

    it("cruce fuente 3 · CAMPOS_INTERNOS_PROFESIONAL ≡ registro[directorio-publico, PerfilProfesional] (bidireccional)", () => {
        const enRegistro = new Set(
            REGISTRO_COLUMNAS_SENSIBLES.filter((e) => e.tabla === "PerfilProfesional" && e.sensiblePara.includes("directorio-publico")).map((e) => e.columna),
        );
        const enFuente = new Set<string>(CAMPOS_INTERNOS_PROFESIONAL);
        expect([...enFuente].filter((c) => !enRegistro.has(c)), "en la FUENTE pero falta en el registro").toEqual([]);
        expect([...enRegistro].filter((c) => !enFuente.has(c)), "en el REGISTRO pero ya no en la fuente").toEqual([]);
    });

    it("cruce fuente 4 · CAMPOS_INTERNOS_CITA ≡ registro[cliente-cita, SolicitudCita] (bidireccional)", () => {
        const enRegistro = new Set(
            REGISTRO_COLUMNAS_SENSIBLES.filter((e) => e.tabla === "SolicitudCita" && e.sensiblePara.includes("cliente-cita")).map((e) => e.columna),
        );
        const enFuente = new Set<string>(CAMPOS_INTERNOS_CITA);
        expect([...enFuente].filter((c) => !enRegistro.has(c)), "en la FUENTE pero falta en el registro").toEqual([]);
        expect([...enRegistro].filter((c) => !enFuente.has(c)), "en el REGISTRO pero ya no en la fuente").toEqual([]);
    });

    it("cruce fuente 1 (subset) · toda columna sensible-para-replica-bi está EXCLUIDA del whitelist de 006", () => {
        expect(infractoresReplicaBi(leerWhitelist()), "sensible-para-replica-bi pero aún en el whitelist = la dirección peligrosa").toEqual([]);
    });

    // ── SPEC-929 · AuditLog.ipAddress/userAgent ──
    // Control positivo con la publicación REAL de 006: se le mete ip/userAgent al canon de AuditLog (lo
    // que haría una edición de 006) y el cruce TIENE que cazarlo. Muere con el defecto: si alguien quita
    // las dos entradas del registro, el cruce deja de verlas y este test cae.
    it("SPEC-929 · control positivo · meter AuditLog.ipAddress/userAgent en la lista PUBLICADA de 006 → el cruce lo caza (ROJO)", () => {
        const sql = readFileSync(WHITELIST_006, "utf8");
        const real = parsearWhitelist(sql);
        // Estado real (verificado por el CEO contra el catálogo de prod): AuditLog SÍ se publica, por lista de
        // columnas, y ip/userAgent quedan afuera — la exclusión es por COLUMNA, no por tabla ausente.
        expect(real.get("AuditLog")?.size ?? 0, "AuditLog debería estar publicada con lista de columnas").toBeGreaterThan(0);
        expect(real.get("AuditLog")?.has("ipAddress")).toBe(false);
        expect(real.get("AuditLog")?.has("userAgent")).toBe(false);

        // Mutación: SOLO dentro del bloque canon (la lista que viaja), no en columnas_vetadas.
        const iCanon = sql.indexOf("canon text[][]");
        const iVetadas = sql.indexOf("columnas_vetadas text[][]");
        const bloque = sql.slice(iCanon, iVetadas);
        const mutado = bloque.replace(/ARRAY\['AuditLog',\s*'([^']*)'\]/, (_m, cols: string) => `ARRAY['AuditLog', '${cols},ipAddress,userAgent']`);
        const inyectado = parsearWhitelist(sql.slice(0, iCanon) + mutado + sql.slice(iVetadas));

        // La mutación tiene que haber pegado (si no, el «rojo» de abajo sería vacío).
        expect(inyectado.get("AuditLog")?.has("ipAddress"), "la inyección no pegó en el canon de AuditLog").toBe(true);
        expect(inyectado.get("AuditLog")?.has("userAgent"), "la inyección no pegó en el canon de AuditLog").toBe(true);

        const infractores = infractoresReplicaBi(inyectado);
        expect(infractores.some((i) => i.startsWith("AuditLog.ipAddress ")), "publicar AuditLog.ipAddress debe dar ROJO").toBe(true);
        expect(infractores.some((i) => i.startsWith("AuditLog.userAgent ")), "publicar AuditLog.userAgent debe dar ROJO").toBe(true);
    });

    it("SPEC-929 · toda columna sensible-para-replica-bi EXISTE en su modelo del schema (el veto no apunta a una columna fantasma)", () => {
        const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
        const faltantes: string[] = [];
        for (const e of REGISTRO_COLUMNAS_SENSIBLES) {
            if (!e.sensiblePara.includes("replica-bi")) continue;
            const modelo = new RegExp(`^model ${e.tabla} \\{([\\s\\S]*?)^\\}`, "m").exec(schema)?.[1];
            if (!modelo) {
                faltantes.push(`${e.tabla} (modelo no encontrado en schema.prisma)`);
                continue;
            }
            if (!new RegExp(`^\\s+${e.columna}\\s`, "m").test(modelo)) faltantes.push(`${e.tabla}.${e.columna}`);
        }
        expect(faltantes, "una columna vetada que ya no existe (renombrada/borrada) deja el veto apuntando a nada").toEqual([]);
    });

    it("control positivo FAIL-LOUD · path inexistente → FALLA (no pasa en verde con cero)", () => {
        expect(() => leerWhitelist(resolve(process.cwd(), "../006-INEXISTENTE/no-existe.sql"))).toThrow(/NO ENCONTRADO|FALLA/);
    });

    it("control positivo FAIL-LOUD · archivo real pero SIN tablas (parseo cero) → FALLA", () => {
        // el propio .ts del registro existe pero no tiene ARRAY['t','cols'] → 0 tablas → debe caer.
        expect(() => leerWhitelist(resolve(process.cwd(), "src/lib/seguridad/registro-columnas-sensibles.ts"))).toThrow(/CERO/);
    });
});
