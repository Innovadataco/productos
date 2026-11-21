/**
 * CANDADO 1 · SPEC-977 (I-459) — el docker.sock vive SOLO en pi-docker-guard.
 *
 * El defecto: pi-app (expuesto a internet) montaba `/var/run/docker.sock`; si se
 * compromete, tiene la API de Docker completa sobre TODO el VPS, ignorando la whitelist
 * de código. La corrección mueve el socket a un guard dedicado (pi-docker-guard) con
 * allowlist estricta; pi-app le habla por HTTP.
 *
 * Este candado lee `docker-compose.prod.yml` y afirma, por imposibilidad estructural:
 *  1. El ÚNICO servicio que monta `/var/run/docker.sock` es `pi-docker-guard`, y en `:ro`.
 *  2. `pi-docker-guard` NO publica puertos (`ports:`): solo la red interna de PI.
 *  3. `pi-app` NO monta el socket y NO tiene `group_add` (ya no toca el grupo docker).
 *
 * Mutación (en memoria, las dos direcciones): devolver el socket a pi-app → rojo;
 * publicar un puerto en el guard → rojo. Unit puro (lee texto, sin BD) → `test:unit`/`pi-gate`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const COMPOSE = resolve(AQUI, "../../docker-compose.prod.yml");

interface Servicio {
    clave: string;
    lineas: string[];
}

/** Parte el YAML por servicios (encabezados a 2 espacios bajo `services:`). */
export function parsearServicios(texto: string): Servicio[] {
    const servicios: Servicio[] = [];
    let enServices = false;
    let actual: Servicio | null = null;
    for (const linea of texto.split("\n")) {
        if (/^services:\s*$/.test(linea)) {
            enServices = true;
            continue;
        }
        if (!enServices) continue;
        if (/^\S/.test(linea)) {
            // clave de nivel superior (p. ej. `volumes:`): fin de services
            break;
        }
        const header = linea.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
        if (header) {
            if (actual) servicios.push(actual);
            actual = { clave: header[1]!, lineas: [] };
            continue;
        }
        if (actual) actual.lineas.push(linea);
    }
    if (actual) servicios.push(actual);
    return servicios;
}

export function containerName(s: Servicio): string | null {
    for (const l of s.lineas) {
        const m = l.match(/^\s*container_name:\s*(\S+)/);
        if (m) return m[1]!;
    }
    return null;
}

/** La línea de montaje (no un comentario) del docker.sock, si existe. */
export function lineaSocket(s: Servicio): string | null {
    for (const l of s.lineas) {
        if (/^\s*-\s*\/var\/run\/docker\.sock(?::|\s|$)/.test(l)) return l.trim();
    }
    return null;
}

export function tienePorts(s: Servicio): boolean {
    return s.lineas.some((l) => /^\s*ports:\s*$/.test(l));
}

export function tieneGroupAdd(s: Servicio): boolean {
    return s.lineas.some((l) => /^\s*group_add:\s*$/.test(l));
}

describe("SPEC-977 · candado 1 · el docker.sock vive solo en pi-docker-guard", () => {
    const texto = readFileSync(COMPOSE, "utf8");
    const servicios = parsearServicios(texto);
    const porContenedor = new Map(servicios.map((s) => [containerName(s), s]));

    it("el parser encontró los servicios del stack (no es un verde vacuo)", () => {
        expect(servicios.length).toBeGreaterThanOrEqual(10);
        expect(porContenedor.has("pi-app")).toBe(true);
        expect(porContenedor.has("pi-docker-guard")).toBe(true);
    });

    it("SOLO pi-docker-guard monta el docker.sock, y en :ro", () => {
        const conSocket = servicios.filter((s) => lineaSocket(s) !== null).map(containerName);
        expect(conSocket).toEqual(["pi-docker-guard"]);
        const guard = porContenedor.get("pi-docker-guard")!;
        expect(lineaSocket(guard)).toMatch(/\/var\/run\/docker\.sock:ro$/);
    });

    it("pi-docker-guard NO publica puertos (solo red interna)", () => {
        expect(tienePorts(porContenedor.get("pi-docker-guard")!)).toBe(false);
    });

    it("pi-app NO monta el socket y NO tiene group_add", () => {
        const app = porContenedor.get("pi-app")!;
        expect(lineaSocket(app)).toBeNull();
        expect(tieneGroupAdd(app)).toBe(false);
    });

    it("CONTROL POSITIVO por MUTACIÓN (en memoria, las dos direcciones)", () => {
        const conSocketEnApp = `services:
  app:
    container_name: pi-app
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
  guard:
    container_name: pi-docker-guard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
volumes:
  x:
`;
        const svc = parsearServicios(conSocketEnApp);
        const conSocket = svc.filter((s) => lineaSocket(s) !== null).map(containerName).sort();
        // el mutante (socket devuelto a pi-app) DEBE aparecer junto al guard
        expect(conSocket).toEqual(["pi-app", "pi-docker-guard"]);
        // un guard con `ports:` DEBE delatarse
        const guardConPorts = `services:
  guard:
    container_name: pi-docker-guard
    ports:
      - "2375:2375"
`;
        expect(tienePorts(parsearServicios(guardConPorts)[0]!)).toBe(true);
        // group_add en pi-app DEBE delatarse
        const appConGroup = `services:
  app:
    container_name: pi-app
    group_add:
      - "988"
`;
        expect(tieneGroupAdd(parsearServicios(appConGroup)[0]!)).toBe(true);
    });
});
