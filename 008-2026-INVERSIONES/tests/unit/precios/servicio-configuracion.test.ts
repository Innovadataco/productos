// Configuración del servicio inv-008-precios: la credencial (solo la del rol inv_precios en la base inv-008-db, D-018)
// y los argumentos de --ahora. Sin el secreto el servicio NO se cae: queda en espera (SIN_SECRETO). Una credencial
// ajena tampoco lo tumba: queda en espera (SECRETO_INVALIDO). Ningún mensaje repite lo que llegó. Datos inventados.
import { describe, expect, it } from "vitest";
import { HOST_BASE, USUARIO_PRECIOS, leerArgumentosAhora, revisarCredencial } from "../../../src/servicio-precios/configuracion";

const CLAVE = "clave-ficticia-4613";
const url = (usuario: string, host = "inv-008-db", protocolo = "postgresql") => `${protocolo}://${usuario}:${CLAVE}@${host}:5432/inversiones?connection_limit=2`;

describe("revisarCredencial", () => {
  it("el rol y la base esperados son inv_precios en inv-008-db", () => {
    expect(USUARIO_PRECIOS).toBe("inv_precios");
    expect(HOST_BASE).toBe("inv-008-db");
  });

  it("acepta la URL de inv_precios en inv-008-db (postgresql:// y postgres://)", () => {
    expect(revisarCredencial(url("inv_precios"))).toEqual({ ok: true });
    expect(revisarCredencial(url("inv_precios", "inv-008-db", "postgres"))).toEqual({ ok: true });
  });

  // Revisión de la base (M1 y M2): el pool del servicio cabe en el CONNECTION LIMIT 4 de inv_precios, y ningún
  // parámetro de la URL cambia el destino (libpq y Prisma aceptan host, hostaddr… en la consulta).
  for (const buena of [
    "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=1",
    "postgresql://inv_precios:clave-ficticia-4613@inv-008-db/inversiones?connection_limit=2",
    "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones_ficticia_test?schema=public&connection_limit=2&connect_timeout=7&pool_timeout=13",
  ]) {
    it(`acepta ${buena.replace("clave-ficticia-4613", "<clave>")}`, () => {
      expect(revisarCredencial(buena)).toEqual({ ok: true });
    });
  }

  for (const [caso, mala] of [
    ["sin connection_limit (Prisma abriría núcleos×2+1 conexiones)", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones"],
    ["connection_limit 3 (con el bucle y un --ahora pasaría del límite 4)", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=3"],
    ["connection_limit 0", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=0"],
    ["connection_limit que no es un entero", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2x"],
    ["connection_limit repetido", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2&connection_limit=1"],
    ["host en la consulta", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2&host=ejemplo.invalid"],
    ["hostaddr en la consulta", `postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2&hostaddr=${[172, 17, 0, 1].join(".")}`],
    ["otro parámetro fuera de la lista", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2&sslmode=disable"],
    ["host múltiple", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db,ejemplo.invalid:5432/inversiones?connection_limit=2"],
    ["otro puerto", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5433/inversiones?connection_limit=2"],
    ["sin base", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/?connection_limit=2"],
    ["una base con ruta", "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones/otra?connection_limit=2"],
  ] as const) {
    it(`${caso}: SECRETO_INVALIDO, sin repetir la URL`, () => {
      const r = revisarCredencial(mala);
      expect(r).toMatchObject({ ok: false, estado: "SECRETO_INVALIDO" });
      if (!r.ok) for (const dato of ["clave-ficticia-4613", "ejemplo.invalid", "sslmode", "5433"]) expect(r.motivo).not.toContain(dato);
    });
  }

  for (const vacia of [undefined, "", "   ", "\n"]) {
    it(`sin secreto (${JSON.stringify(vacia)}): SIN_SECRETO, en espera`, () => {
      const r = revisarCredencial(vacia);
      expect(r).toMatchObject({ ok: false, estado: "SIN_SECRETO" });
      if (!r.ok) expect(r.motivo).toContain("INV_PRECIOS_DATABASE_URL");
    });
  }

  // [caso, URL] → SECRETO_INVALIDO, sin repetir la URL, la clave ni el usuario que llegó.
  for (const [caso, mala] of [
    ["el rol del dueño", url("inv_dueno")],
    ["el rol de la app", url("inv_app")],
    ["el superusuario", url("postgres")],
    ["el rol escrito con escape", url("inv%5Fprecios")],
    ["otro host (la IP del host vista desde el contenedor)", url("inv_precios", [172, 17, 0, 1].join("."))],
    ["otro host con nombre", url("inv_precios", "inv-008-db.ejemplo.invalid")],
    ["otro protocolo", url("inv_precios", "inv-008-db", "mysql")],
    ["sin clave", "postgresql://inv_precios@inv-008-db:5432/inversiones"],
    ["texto que no es URL", `inv_precios ${CLAVE}`],
  ] as const) {
    it(`${caso}: SECRETO_INVALIDO y el mensaje no repite la URL`, () => {
      const r = revisarCredencial(mala);
      expect(r).toMatchObject({ ok: false, estado: "SECRETO_INVALIDO" });
      if (r.ok) return;
      for (const dato of [CLAVE, "inv_dueno", "inv_app", "postgresql://", "mysql", "ejemplo.invalid", "inv%5F"]) expect(r.motivo).not.toContain(dato);
    });
  }
});

describe("leerArgumentosAhora (lo que va después de --ahora)", () => {
  const HOY = new Date("2027-03-17T15:41:00.000Z");

  it("sin argumentos: la corrida de siempre (los 10 días de cada CLI)", () => {
    expect(leerArgumentosAhora([], HOY)).toEqual({ ok: true, desde: null });
  });

  it("--desde AAAA-MM-DD: la carga histórica desde ese día (también hoy mismo)", () => {
    expect(leerArgumentosAhora(["--desde", "2019-08-23"], HOY)).toEqual({ ok: true, desde: "2019-08-23" });
    expect(leerArgumentosAhora(["--desde", "2027-03-17"], HOY)).toEqual({ ok: true, desde: "2027-03-17" });
  });

  for (const [caso, args] of [
    ["--desde sin fecha", ["--desde"]],
    ["fecha imposible", ["--desde", "2019-02-30"]],
    ["otro formato", ["--desde", "23/08/2019"]],
    ["fecha futura (en Colombia)", ["--desde", "2027-03-18"]],
    ["--desde repetido", ["--desde", "2019-08-23", "--desde", "2019-08-26"]],
    ["otra opción", ["--hasta", "2019-08-23"]],
    ["un posicional", ["posicional-ficticio"]],
    ["--desde=fecha", ["--desde=2019-08-23"]],
  ] as const) {
    it(`${caso}: rechazo con un mensaje que no repite lo que llegó`, () => {
      const r = leerArgumentosAhora(args, HOY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.mensaje).toContain("--ahora [--desde AAAA-MM-DD]");
      for (const dato of args.filter((a) => !a.startsWith("--"))) expect(r.mensaje).not.toContain(dato);
    });
  }

  it("el día de hoy es el de Colombia: a las 21:00 COT del 17 (02:00 UTC del 18), el 18 todavía es futuro", () => {
    const noche = new Date("2027-03-18T02:00:00.000Z");
    expect(leerArgumentosAhora(["--desde", "2027-03-18"], noche).ok).toBe(false);
    expect(leerArgumentosAhora(["--desde", "2027-03-17"], noche).ok).toBe(true);
  });
});
