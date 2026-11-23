// La credencial y el token del servicio inv-008-ia: solo el rol inv_ia en inv-008-db; sin la variable queda EN ESPERA
// (no se cae). Ningún motivo repite la URL, la clave ni el token.
import { describe, expect, it } from "vitest";
import { leerTokenServicio, revisarCredencialIa } from "@/servicio-ia/configuracion";

const CLAVE = "clave-ficticia-4613";
const url = (usuario = "inv_ia", host = "inv-008-db", cola = "?connection_limit=2") => `postgresql://${usuario}:${CLAVE}@${host}:5432/inversiones${cola}`;

describe("revisarCredencialIa", () => {
  it("la de inv_ia en inv-008-db, con connection_limit 1 o 2", () => {
    expect(revisarCredencialIa(url())).toEqual({ ok: true });
    expect(revisarCredencialIa(url("inv_ia", "inv-008-db", "?connection_limit=1&schema=public"))).toEqual({ ok: true });
  });

  it("sin la variable: SIN_SECRETO (en espera)", () => {
    for (const v of [undefined, "", "  "]) expect(revisarCredencialIa(v)).toMatchObject({ ok: false, estado: "SIN_SECRETO" });
  });

  it.each([
    ["otro rol", url("inv_app")],
    ["otro host", url("inv_ia", "otro-host")],
    ["sin límite de conexiones", url("inv_ia", "inv-008-db", "")],
    ["demasiadas conexiones", url("inv_ia", "inv-008-db", "?connection_limit=3")],
    ["un parámetro que cambia el destino", url("inv_ia", "inv-008-db", "?connection_limit=2&host=otro")],
    ["sin clave", "postgresql://inv_ia@inv-008-db:5432/inversiones?connection_limit=2"],
    ["otro puerto", `postgresql://inv_ia:${CLAVE}@inv-008-db:6543/inversiones?connection_limit=2`],
    ["no es una URL", "esto no es una url"],
    ["otro protocolo", url().replace("postgresql:", "mysql:")],
  ])("%s: SECRETO_INVALIDO, sin repetir la clave", (_nombre, valor) => {
    const r = revisarCredencialIa(valor);
    expect(r).toMatchObject({ ok: false, estado: "SECRETO_INVALIDO" });
    expect(JSON.stringify(r)).not.toContain(CLAVE);
  });
});

describe("leerTokenServicio", () => {
  const TOKEN = "t0ken-FICTICIO_".repeat(3);

  it("un token de 43 a 128 caracteres de base64url", () => {
    expect(leerTokenServicio(TOKEN)).toEqual({ ok: true, token: TOKEN });
  });

  it.each([undefined, ""])("sin token (%s): SIN_TOKEN, los pedidos a demanda quedan apagados", (v) => {
    expect(leerTokenServicio(v)).toMatchObject({ ok: false, estado: "SIN_TOKEN" });
  });

  it.each(["corto", "con espacio ".repeat(5), "x".repeat(129)])("un token débil o raro: TOKEN_INVALIDO, sin repetirlo", (v) => {
    const r = leerTokenServicio(v);
    expect(r).toMatchObject({ ok: false, estado: "TOKEN_INVALIDO" });
    expect(JSON.stringify(r)).not.toContain(v);
  });
});
