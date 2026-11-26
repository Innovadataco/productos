// La credencial del servicio de las alertas: la conexión corre como inv_alertas y nada más. El rol de prueba equivalente solo se admite
// con NODE_ENV=test y su variable; en producción (o sin NODE_ENV) esa variable no existe para el servicio. Con una base simulada.
import { describe, expect, it, vi } from "vitest";
import { revisarCredencial, rolesPermitidos } from "@/alertas/credencial";

const base = (usuario: string) => ({ $queryRaw: vi.fn(async () => [{ u: usuario }]) }) as never;

describe("rolesPermitidos", () => {
  it("solo inv_alertas, también con una variable de prueba si NODE_ENV no es test", () => {
    expect(rolesPermitidos({})).toEqual(["inv_alertas"]);
    expect(rolesPermitidos({ NODE_ENV: "production", INV_ALERTAS_ROL_PRUEBA: "inversiones" })).toEqual(["inv_alertas"]);
    expect(rolesPermitidos({ INV_ALERTAS_ROL_PRUEBA: "inversiones" })).toEqual(["inv_alertas"]);
  });

  it("con NODE_ENV=test admite el rol de prueba equivalente, si tiene la forma de un rol", () => {
    expect(rolesPermitidos({ NODE_ENV: "test", INV_ALERTAS_ROL_PRUEBA: "inversiones" })).toEqual(["inv_alertas", "inversiones"]);
    expect(rolesPermitidos({ NODE_ENV: "test", INV_ALERTAS_ROL_PRUEBA: "x; DROP" })).toEqual(["inv_alertas"]);
    expect(rolesPermitidos({ NODE_ENV: "test", INV_ALERTAS_ROL_PRUEBA: "" })).toEqual(["inv_alertas"]);
  });
});

describe("revisarCredencial", () => {
  it("con inv_alertas, bien; con otro rol (la clave de la app o del dueño), no", async () => {
    expect(await revisarCredencial(base("inv_alertas"), {})).toBe(true);
    for (const otro of ["inv_app", "inv_dueno", "inv_precios", "postgres"]) expect(await revisarCredencial(base(otro), {}), otro).toBe(false);
  });

  it("el rol de prueba solo vale en pruebas", async () => {
    expect(await revisarCredencial(base("inversiones"), { NODE_ENV: "test", INV_ALERTAS_ROL_PRUEBA: "inversiones" })).toBe(true);
    expect(await revisarCredencial(base("inversiones"), { NODE_ENV: "production", INV_ALERTAS_ROL_PRUEBA: "inversiones" })).toBe(false);
  });

  it("si la consulta no devuelve nada, no hay credencial", async () => {
    expect(await revisarCredencial({ $queryRaw: vi.fn(async () => []) } as never, {})).toBe(false);
  });
});
