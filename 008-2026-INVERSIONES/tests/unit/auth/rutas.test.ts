// Rutas públicas del login (D-014): solo /ingresar, /definir-clave, el POST de ingreso, el POST del
// enlace y GET /api/salud. Todo lo demás exige sesión (también lo que agreguen otros frentes).
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
  ])("%s %s exige sesión", (metodo, ruta) => {
    expect(esPublica(metodo, ruta)).toBe(false);
  });
});
