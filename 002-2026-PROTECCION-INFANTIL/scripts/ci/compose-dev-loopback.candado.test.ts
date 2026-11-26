/**
 * CANDADO · SPEC-982 (I-466) — la base (y toda la app) de DESARROLLO solo se publica en loopback.
 *
 * EL DEFECTO. `docker-compose.yml` (dev) publicaba la db como `"5433:5432"`, sin IP. En el Mac,
 * Colima/Lima reenvía un puerto sin IP a TODAS las interfaces (`*:5433`), así que la base de dev
 * —y la app en `5005`— quedaban visibles para la LAN y la tailnet (verificado con lsof). El
 * arreglo publica cada puerto de dev como `127.0.0.1:host:container`: el acceso local (navegador,
 * e2e, psql) sigue igual; la exposición a la red desaparece.
 *
 * QUÉ AFIRMA, por imposibilidad estructural (lee el YAML del compose de DEV, sin BD):
 *   1. El parser encontró el stack (db + app) — no es un verde vacuo.
 *   2. TODO puerto publicado del compose de dev empieza por `127.0.0.1:` (ninguno `*:`).
 *   3. Los dos puertos conocidos (db 5433, app 5005) existen y están atados a loopback.
 *
 * MUERE CON EL DEFECTO (control positivo por mutación, en memoria, las dos direcciones): un
 * `- "5433:5432"` sin IP se detecta como NO-loopback; uno con `127.0.0.1:` pasa. Quitar la IP de
 * cualquier puerto en `docker-compose.yml` pone este candado ROJO.
 *
 * ALCANCE: SOLO el compose de DEV. `docker-compose.prod.yml` es de otro candado (SPEC-977) y de
 * otro criterio (su app ya escucha en `127.0.0.1:5005` y la db no publica puerto).
 *
 * Unit puro → registrado en vitest.unit.includes.ts → corre en `test:unit`/`pi-gate` (BLOQUEA).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const COMPOSE_DEV = resolve(AQUI, "../../docker-compose.yml");

interface Servicio {
    clave: string;
    lineas: string[];
}

/**
 * Parte el YAML del compose por servicios (encabezados a 2 espacios bajo `services:`). Parser
 * propio y autocontenido: NO se importa de otro `.test.ts` (eso re-registraría sus `describe`).
 */
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
        if (/^\S/.test(linea)) break; // clave de nivel superior (p. ej. `volumes:`) → fin de services
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

/**
 * Puertos PUBLICADOS de un servicio (líneas `- "host:container"` o `- "ip:host:container"`).
 * El valor es solo dígitos, puntos y dos-puntos: así NO confunde un volumen (`- /ruta:/ruta`,
 * con barras) ni una línea de healthcheck con una publicación de puerto.
 */
export function puertosPublicados(s: Servicio): string[] {
    return s.lineas
        .map((l) => l.match(/^\s*-\s*"?([0-9.]+:[0-9:]+)"?\s*$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => m[1]!);
}

/** Un puerto está atado a loopback si empieza EXACTAMENTE por `127.0.0.1:`. */
export function esLoopback(puerto: string): boolean {
    return puerto.startsWith("127.0.0.1:");
}

describe("SPEC-982 · el compose de DEV publica sus puertos solo en loopback", () => {
    const servicios = parsearServicios(readFileSync(COMPOSE_DEV, "utf8"));
    const porClave = new Map(servicios.map((s) => [s.clave, s]));
    const todos = servicios.flatMap(puertosPublicados);

    it("el parser encontró el stack de dev (db + app) — no es un verde vacuo", () => {
        expect(servicios.length).toBeGreaterThanOrEqual(2);
        expect(porClave.has("db")).toBe(true);
        expect(porClave.has("app")).toBe(true);
        expect(todos.length, "no se detectó ningún puerto publicado — el matcher quedó vacío").toBeGreaterThanOrEqual(2);
    });

    it("TODO puerto publicado del compose de dev está atado a 127.0.0.1", () => {
        const expuestos = todos.filter((p) => !esLoopback(p));
        expect(expuestos, `puertos de dev publicados en todas las interfaces: ${expuestos.join(" · ")}`).toEqual([]);
    });

    it("los puertos conocidos (db 5433, app 5005) existen y están en loopback", () => {
        expect(puertosPublicados(porClave.get("db")!)).toEqual(["127.0.0.1:5433:5432"]);
        expect(puertosPublicados(porClave.get("app")!)).toEqual(["127.0.0.1:5005:3000"]);
    });

    it("CONTROL POSITIVO por MUTACIÓN (en memoria, las dos direcciones)", () => {
        const sinIp = parsearServicios("services:\n  db:\n    ports:\n      - \"5433:5432\"\nvolumes:\n  x:\n");
        expect(puertosPublicados(sinIp[0]!)).toEqual(["5433:5432"]);
        expect(esLoopback("5433:5432"), "un puerto sin IP DEBE delatarse").toBe(false);
        expect(esLoopback("127.0.0.1:5433:5432"), "un puerto con 127.0.0.1 DEBE pasar").toBe(true);
        // un volumen (con barras) NUNCA se confunde con un puerto publicado
        const conVolumen = parsearServicios("services:\n  db:\n    volumes:\n      - postgres_data:/var/lib/postgresql/data\nvolumes:\n  x:\n");
        expect(puertosPublicados(conVolumen[0]!)).toEqual([]);
    });
});
