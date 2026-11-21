// Rutas públicas del login (D-014): solo /ingresar, /definir-clave, el POST de ingreso, el POST del
// enlace y GET /api/salud, más las del segundo paso (TOTP), que no exigen sesión porque exigen la
// pre-sesión en el servidor. Todo lo demás exige sesión (también lo que agreguen otros frentes).
import { describe, expect, it } from "vitest";
import { esPublica } from "@/auth/rutas";

describe("esPublica", () => {
  it.each([
    ["GET", "/ingresar"],
    ["HEAD", "/ingresar"],
    ["GET", "/definir-clave"],
    ["POST", "/api/sesion/ingresar"],
    ["POST", "/api/sesion/definir-clave"],
    ["GET", "/api/salud"],
    ["HEAD", "/api/salud"],
    ["GET", "/totp"],
    ["GET", "/totp/enrolar"],
    ["POST", "/api/sesion/totp"],
    ["POST", "/api/sesion/totp/enrolar"],
  ])("%s %s es pública", (metodo, ruta) => {
    expect(esPublica(metodo, ruta)).toBe(true);
  });

  it.each([
    ["GET", "/"],
    ["GET", "/tablero"],
    ["POST", "/ingresar"],
    ["GET", "/api/sesion/ingresar"],
    ["POST", "/api/sesion/salir"],
    ["POST", "/api/salud"],
    ["GET", "/ingresar/otra"],
    ["GET", "/ingresar/"],
    ["GET", "/api/salud/detalle"],
    ["GET", "/Ingresar"],
    ["GET", "/api/plan"],
    ["GET", "/totp/codigos"],
    ["POST", "/api/sesion/totp/codigos"],
    ["POST", "/totp"],
    ["GET", "/api/sesion/totp"],
    ["GET", "/totp/"],
    ["GET", "/totp/enrolar/otra"],
  ])("%s %s exige sesión", (metodo, ruta) => {
    expect(esPublica(metodo, ruta)).toBe(false);
  });
});

describe("esDelSegundoPaso", () => {
  it("son exactamente las rutas que exigen la pre-sesión en el servidor", async () => {
    const { RUTAS_SEGUNDO_PASO } = await import("@/auth/rutas");
    expect([...RUTAS_SEGUNDO_PASO].sort()).toEqual(["/api/sesion/totp", "/api/sesion/totp/enrolar", "/totp", "/totp/enrolar"]);
  });
});
