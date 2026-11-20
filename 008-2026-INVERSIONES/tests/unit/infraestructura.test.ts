// Candado de infraestructura (D-008): un solo servicio de base en el 5438 y la app en el 5008.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(`../../${ruta}`, import.meta.url)), "utf8");

describe("docker-compose.yml de 008", () => {
  const compose = parse(leer("docker-compose.yml")) as {
    services: Record<string, { image: string; ports?: string[] }>;
  };

  it("tiene un solo servicio: la base de 008", () => {
    expect(Object.keys(compose.services)).toEqual(["db"]);
  });

  it("la base es PostgreSQL 16 y publica solo el puerto 5438", () => {
    const db = compose.services.db!;
    expect(db.image).toMatch(/^postgres:16(\.|-|$)/);
    expect(db.ports).toEqual(["5438:5432"]);
  });
});

describe("package.json de 008", () => {
  const pkg = JSON.parse(leer("package.json")) as { scripts: Record<string, string> };

  it("la app corre en el puerto 5008 en desarrollo y en producción", () => {
    expect(pkg.scripts.dev).toMatch(/-p 5008\b/);
    expect(pkg.scripts.start).toMatch(/-p 5008\b/);
  });
});

describe(".env.example", () => {
  it("apunta al puerto 5438 y la base de pruebas termina en _test", () => {
    const env = leer(".env.example");
    expect(env).toMatch(/^DATABASE_URL=".*@localhost:5438\/inversiones\?/m);
    expect(env).toMatch(/^DATABASE_URL_TEST=".*@localhost:5438\/inversiones_test\?/m);
  });
});
