// Candado de la base del E2E de la pantalla (INV-SPEC-15). La siembra BORRA y recrea esa base con un
// superusuario: solo puede tocar una base local de 008 cuyo nombre termine en `_e2e_test`.
import { describe, expect, it } from "vitest";
import { URL_E2E_POR_DEFECTO, baseDePruebas } from "../../e2e/base";

const url = (host: string, puerto: string, nombre: string) => `postgresql://inversiones:clave@${host}:${puerto}/${nombre}?schema=public`;

describe("baseDePruebas", () => {
  it("acepta la base e2e local de 008 y arma la URL de mantenimiento sobre `postgres`", () => {
    const b = baseDePruebas(URL_E2E_POR_DEFECTO);
    expect(b.nombre).toBe("inversiones_e2e_test");
    expect(new URL(b.urlMantenimiento).pathname).toBe("/postgres");
    expect(new URL(b.urlMantenimiento).host).toBe(new URL(b.url).host);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("acepta el host local %s", (host) => {
    expect(baseDePruebas(url(host, "5438", "inversiones_e2e_test")).nombre).toBe("inversiones_e2e_test");
  });

  it.each([
    ["la base de trabajo", url("localhost", "5438", "inversiones")],
    ["la base de mantenimiento", url("localhost", "5438", "postgres")],
    ["la base de integración", url("localhost", "5438", "inversiones_test")],
    ["la base de integración de la pantalla", url("localhost", "5438", "inversiones_pantalla_test")],
    ["un host remoto", url("db.ejemplo.invalid", "5438", "inversiones_e2e_test")],
    ["una IP de la red local", url("192.168.0.10", "5438", "inversiones_e2e_test")],
    ["otro puerto (otra base de la máquina)", url("localhost", "5433", "inversiones_e2e_test")],
    ["un nombre con comillas", url("localhost", "5438", "x%22%3B%20DROP%20DATABASE%20inversiones%3B%20--_e2e_test")],
    ["un nombre con punto y coma", url("localhost", "5438", "a%3Bb_e2e_test")],
    ["un nombre con punto", url("localhost", "5438", "a.b_e2e_test")],
    ["un nombre en mayúsculas", url("localhost", "5438", "INVERSIONES_E2E_TEST")],
    ["otro protocolo", "mysql://inversiones:clave@localhost:5438/inversiones_e2e_test"],
    ["una URL vacía", ""],
    ["una URL inválida", "no es una url"],
    // La query la obedece Prisma: podría llevar la conexión a otro host, a un socket o a otra base.
    ["un host en la query", `${url("127.0.0.1", "5438", "x_e2e_test")}&host=evil.com&port=5432`],
    ["un socket en la query", `${url("127.0.0.1", "5438", "x_e2e_test")}&host=/tmp`],
    ["otra base en la query", `${url("127.0.0.1", "5438", "x_e2e_test")}&dbname=inversiones`],
    ["un parámetro que no es schema", `${url("127.0.0.1", "5438", "x_e2e_test")}&sslmode=disable`],
    ["otro esquema", url("127.0.0.1", "5438", "x_e2e_test").replace("schema=public", "schema=otro")],
    ["un hash", `${url("127.0.0.1", "5438", "x_e2e_test")}#host=evil.com`],
    ["una URL sin usuario", "postgresql://localhost:5438/x_e2e_test?schema=public"],
  ])("rechaza %s", (_caso, valor) => {
    expect(() => baseDePruebas(valor)).toThrow(/base del E2E/);
  });

  it("reconstruye las dos URL desde cero: solo usuario, clave, host, 5438, nombre y schema=public", () => {
    const b = baseDePruebas("postgresql://inversiones:cl%40ve@localhost:5438/x_e2e_test");
    expect(b.url).toBe("postgresql://inversiones:cl%40ve@localhost:5438/x_e2e_test?schema=public");
    expect(b.urlMantenimiento).toBe("postgresql://inversiones:cl%40ve@localhost:5438/postgres?schema=public");
  });

  it("el error nunca muestra la URL (puede traer la clave)", () => {
    expect(() => baseDePruebas(url("db.ejemplo.invalid", "5438", "inversiones_e2e_test"))).not.toThrow(/clave/);
  });
});
