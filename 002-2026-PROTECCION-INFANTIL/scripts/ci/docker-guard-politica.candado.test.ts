/**
 * CANDADO 2 · SPEC-977 (I-459) — la POLÍTICA del guard (nginx) solo deja pasar lo justo.
 *
 * Lee `docker/pi-docker-guard.conf` y, a partir de las reglas ESCRITAS AHÍ (no de una
 * copia a mano), afirma:
 *  · hay un `location /` que devuelve 403 (denegado por defecto);
 *  · el allow de acciones acepta EXACTAMENTE los 12 contenedores del adapter
 *    (CONTENEDORES_PERMITIDOS) con start|stop|restart, solo POST y sin query string;
 *  · el allow de `containers/json` es solo GET y FUERZA la query (all=true + filtro pi-).
 *
 * Luego construye el veredicto del guard A PARTIR de los regex extraídos del .conf y corre
 * la tabla de mutación del radicado: si alguien afloja el .conf (añade pi-db, abre /exec,
 * quita el bloqueo de método/query), el regex o la verificación extraídos cambian y estos
 * casos se vuelven rojos. Unit puro (lee texto, sin BD) → `test:unit`/`pi-gate`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CONTENEDORES_PERMITIDOS } from "../../src/lib/servicios/docker-adapter";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const CONF = resolve(AQUI, "../../docker/pi-docker-guard.conf");

/** Los regex `location ~ <patrón> {` escritos en el .conf. */
export function locationsRegex(conf: string): string[] {
    return [...conf.matchAll(/location\s+~\s+(\S+)\s*\{/g)].map((m) => m[1]!);
}

/** Nombres de contenedor del allow de acciones (grupo entre `containers/(` y `)/(start`). */
export function contenedoresDelAllow(patronAccion: string): string[] {
    const m = patronAccion.match(/containers\/\(([^)]*)\)\/\(start\|stop\|restart\)/);
    if (!m) return [];
    return m[1]!.split("|");
}

type Verdicto = "pass" | 403;

/** Reconstruye el veredicto del guard usando los regex EXTRAÍDOS del .conf. */
export function construirGuard(conf: string): (method: string, path: string, query: string) => Verdicto {
    const locs = locationsRegex(conf);
    const patronAccion = locs.find((r) => r.includes("(start|stop|restart)"));
    const patronJson = locs.find((r) => r.includes("containers/json$"));
    if (!patronAccion || !patronJson) throw new Error("el .conf no define los dos allow esperados");
    const reAccion = new RegExp(patronAccion);
    const reJson = new RegExp(patronJson);
    return (method, path, query) => {
        if (reAccion.test(path)) {
            if (method !== "POST") return 403; // limit_except POST
            if (query !== "") return 403; // if ($query_string != "") → 403
            return "pass";
        }
        if (reJson.test(path)) {
            if (method !== "GET") return 403; // limit_except GET
            return "pass"; // el guard fuerza la query (all=true + filtro pi-)
        }
        return 403; // location / → 403 (denegado por defecto)
    };
}

describe("SPEC-977 · candado 2 · política del guard del docker.sock", () => {
    const conf = readFileSync(CONF, "utf8");
    const locs = locationsRegex(conf);
    const patronAccion = locs.find((r) => r.includes("(start|stop|restart)"))!;

    it("denegado por defecto: hay un `location /` que devuelve 403", () => {
        expect(/location\s+\/\s*\{\s*return\s+403;/.test(conf)).toBe(true);
    });

    it("el allow de acciones acepta EXACTAMENTE los 12 contenedores del adapter (defensa en dos capas)", () => {
        const delGuard = contenedoresDelAllow(patronAccion).slice().sort();
        const delAdapter = [...CONTENEDORES_PERMITIDOS].sort();
        expect(delGuard).toEqual(delAdapter);
        expect(delGuard).toHaveLength(12);
    });

    it("el allow de acciones exige POST y prohíbe query string; el de json exige GET y fuerza el filtro pi-", () => {
        expect(/limit_except\s+POST\s*\{\s*deny\s+all;/.test(conf)).toBe(true);
        expect(/if\s*\(\$query_string\s*!=\s*""\)\s*\{\s*return\s+403;/.test(conf)).toBe(true);
        expect(/limit_except\s+GET\s*\{\s*deny\s+all;/.test(conf)).toBe(true);
        expect(/set\s+\$args\s+'all=true&filters=[^']*pi-[^']*';/.test(conf)).toBe(true);
    });

    it("TABLA DE MUTACIÓN del radicado (veredicto reconstruido del .conf)", () => {
        const guard = construirGuard(conf);
        // Prohibidos → 403
        expect(guard("POST", "/containers/pi-db/restart", "")).toBe(403); // pi-db NO está
        expect(guard("POST", "/containers/pi-worker/exec", "")).toBe(403); // exec no es start/stop/restart
        expect(guard("POST", "/containers/create", "")).toBe(403); // crear
        expect(guard("GET", "/images/json", "")).toBe(403); // imágenes
        expect(guard("POST", "/containers/pi-worker/restart", "x=1")).toBe(403); // con query
        expect(guard("GET", "/containers/pi-worker/restart", "")).toBe(403); // método incorrecto
        expect(guard("POST", "/containers/pi-worker-evil/restart", "")).toBe(403); // nombre fuera de lista
        // Permitidos → pasa
        expect(guard("POST", "/containers/pi-worker/restart", "")).toBe("pass");
        expect(guard("POST", "/v1.43/containers/pi-citas/stop", "")).toBe("pass"); // prefijo de versión
        expect(guard("GET", "/containers/json", "")).toBe("pass");
    });
});
