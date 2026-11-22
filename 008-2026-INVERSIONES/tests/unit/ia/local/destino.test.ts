/**
 * El destino de la puerta local: solo `http://<IPv4 del rango CGNAT de la tailnet>:<puerto>`, puro y cerrado en fallo.
 * Las IP se arman al correr (ninguna IPv4 escrita) y ninguna es de los documentos de PI.
 */
import { describe, expect, it } from "vitest";
import { RUTAS_LOCALES, leerDestinoLocal, urlLocal, type DestinoLocal, type RutaLocal } from "@/ia/local/destino";
import { ErrorLocal, type CodigoErrorLocal } from "@/ia/local/errores";
import { IP_FICTICIA, ORIGEN_FICTICIO, PUERTO_FICTICIO, ip } from "./apoyo/red.ficticio";

function codigoDe(accion: () => unknown): CodigoErrorLocal {
  try {
    accion();
  } catch (e) {
    if (e instanceof ErrorLocal) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

function mensajeDe(accion: () => unknown): string {
  try {
    accion();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("no lanzó");
}

describe("leerDestinoLocal · acepta solo http, una IPv4 del rango de la tailnet y un puerto", () => {
  it.each([
    [ip(100, 64, 0, 1), 1],
    [ip(100, 127, 255, 254), 65535],
    [IP_FICTICIA, PUERTO_FICTICIO],
    [ip(100, 64, 255, 255), 52817],
    [ip(100, 127, 0, 0), 3917],
    [ip(100, 99, 7, 23), 9],
  ])("http://%s:%i", (direccion, puerto) => {
    const destino = leerDestinoLocal(`http://${direccion}:${puerto}`);
    expect(destino.origen).toBe(`http://${direccion}:${puerto}`);
    expect(Object.keys(destino)).toEqual(["origen"]);
    expect(Object.isFrozen(destino)).toBe(true);
  });
});

describe("leerDestinoLocal · rechaza, sin repetir el valor", () => {
  const p = PUERTO_FICTICIO;
  const casos: ReadonlyArray<readonly [string, unknown, CodigoErrorLocal]> = [
    ["sin valor", undefined, "DESTINO_AUSENTE"],
    ["vacío", "", "DESTINO_AUSENTE"],
    ["null", null, "DESTINO_INVALIDO"],
    ["un número", 47213, "DESTINO_INVALIDO"],
    ["espacio al inicio", ` ${ORIGEN_FICTICIO}`, "DESTINO_INVALIDO"],
    ["espacio al final", `${ORIGEN_FICTICIO} `, "DESTINO_INVALIDO"],
    ["salto de línea", `${ORIGEN_FICTICIO}\n`, "DESTINO_INVALIDO"],
    ["https", `https://${IP_FICTICIA}:${p}`, "DESTINO_INVALIDO"],
    ["esquema en mayúsculas", `HTTP://${IP_FICTICIA}:${p}`, "DESTINO_INVALIDO"],
    ["sin esquema", `${IP_FICTICIA}:${p}`, "DESTINO_INVALIDO"],
    ["un nombre DNS", `http://ollama.ficticio.test:${p}`, "DESTINO_INVALIDO"],
    ["un nombre de la tailnet", `http://mac-ficticio.tail-ficticia.ts.net:${p}`, "DESTINO_INVALIDO"],
    ["localhost", `http://localhost:${p}`, "DESTINO_INVALIDO"],
    ["IPv6 de bucle", `http://[::1]:${p}`, "DESTINO_INVALIDO"],
    ["IPv6 local", `http://[fd00:4613::27]:${p}`, "DESTINO_INVALIDO"],
    ["IPv4 dentro de IPv6", `http://[::ffff:${IP_FICTICIA}]:${p}`, "DESTINO_INVALIDO"],
    ["sin puerto", `http://${IP_FICTICIA}`, "DESTINO_INVALIDO"],
    ["puerto vacío", `http://${IP_FICTICIA}:`, "DESTINO_INVALIDO"],
    ["puerto cero", `http://${IP_FICTICIA}:0`, "DESTINO_INVALIDO"],
    ["puerto fuera de rango", `http://${IP_FICTICIA}:65536`, "DESTINO_INVALIDO"],
    ["puerto de más cifras", `http://${IP_FICTICIA}:472139`, "DESTINO_INVALIDO"],
    ["puerto con cero a la izquierda", `http://${IP_FICTICIA}:0${p}`, "DESTINO_INVALIDO"],
    ["puerto con signo", `http://${IP_FICTICIA}:+${p}`, "DESTINO_INVALIDO"],
    ["barra final", `${ORIGEN_FICTICIO}/`, "DESTINO_INVALIDO"],
    ["una ruta", `${ORIGEN_FICTICIO}/api/tags`, "DESTINO_INVALIDO"],
    ["una consulta", `${ORIGEN_FICTICIO}?modelo=ficticio`, "DESTINO_INVALIDO"],
    ["un fragmento", `${ORIGEN_FICTICIO}#ficticio`, "DESTINO_INVALIDO"],
    ["usuario y clave", `http://ficticio:clave@${IP_FICTICIA}:${p}`, "DESTINO_INVALIDO"],
    ["octeto con cero a la izquierda", `http://${ip(100, 73, 41, 157).replace(".41.", ".041.")}:${p}`, "DESTINO_INVALIDO"],
    ["primer octeto con cero a la izquierda", `http://0${IP_FICTICIA}:${p}`, "DESTINO_INVALIDO"],
    ["octetos en hexadecimal", `http://0x64.0x49.41.157:${p}`, "DESTINO_INVALIDO"],
    ["forma corta", `http://${ip(100, 73, 157)}:${p}`, "DESTINO_INVALIDO"],
    ["un entero", `http://1682516381:${p}`, "DESTINO_INVALIDO"],
    ["punto final", `http://${IP_FICTICIA}.:${p}`, "DESTINO_INVALIDO"],
    ["octeto mayor que 255", `http://${ip(100, 73, 256, 157)}:${p}`, "DESTINO_INVALIDO"],
    ["dígitos de ancho completo", `http://１００.７３.４１.１５７:${p}`, "DESTINO_INVALIDO"],
    ["privada de clase A", `http://${ip(10, 41, 7, 23)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["privada de clase B", `http://${ip(172, 19, 41, 157)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["privada de clase C", `http://${ip(192, 168, 41, 157)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["de bucle", `http://${ip(127, 0, 0, 1)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["de enlace local", `http://${ip(169, 254, 41, 157)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["todas las interfaces", `http://${ip(0, 0, 0, 0)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["de difusión general", `http://${ip(255, 255, 255, 255)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["una pública", `http://${ip(8, 41, 7, 23)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["justo antes del rango", `http://${ip(100, 63, 255, 254)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["justo después del rango", `http://${ip(100, 128, 0, 1)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["la dirección de red del rango", `http://${ip(100, 64, 0, 0)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
    ["la de difusión del rango", `http://${ip(100, 127, 255, 255)}:${p}`, "DESTINO_FUERA_DE_RANGO"],
  ];

  it.each(casos)("%s", (_nombre, valor, codigo) => {
    expect(codigoDe(() => leerDestinoLocal(valor as string))).toBe(codigo);
    const mensaje = mensajeDe(() => leerDestinoLocal(valor as string));
    expect(mensaje).toContain(codigo);
    if (typeof valor === "string" && valor !== "") {
      expect(mensaje).not.toContain(valor.trim());
      expect(mensaje).not.toMatch(/[0-9]/);
    }
  });
});

describe("urlLocal · solo las dos rutas", () => {
  const destino = leerDestinoLocal(ORIGEN_FICTICIO);

  it("las rutas permitidas son exactamente generate y tags, en una lista congelada", () => {
    expect([...RUTAS_LOCALES]).toEqual(["/api/generate", "/api/tags"]);
    expect(Object.isFrozen(RUTAS_LOCALES)).toBe(true);
  });

  it.each(RUTAS_LOCALES)("%s queda pegada al origen", (ruta) => {
    expect(urlLocal(destino, ruta)).toBe(`${ORIGEN_FICTICIO}${ruta}`);
  });

  it.each(["/api/pull", "/api/push", "/api/delete", "/api/create", "/api/copy", "/api/ps", "/api/chat", "/api/embed", "/api/show",
    "/api/tags/../pull", "/api/generate?stream=true", "/api/tags/", "api/tags", "/API/TAGS", "", "/api/generate#x"])("rechaza «%s»", (ruta) => {
    expect(codigoDe(() => urlLocal(destino, ruta as RutaLocal))).toBe("RUTA_NO_PERMITIDA");
  });

  it("una ruta fuera de la lista no compila", () => {
    // @ts-expect-error: la ruta no es de RUTAS_LOCALES.
    expect(() => urlLocal(destino, "/api/pull")).toThrow(ErrorLocal);
  });

  it("un destino armado a mano se vuelve a revisar: no se cuela un nombre ni otro rango", () => {
    const aMano = Object.freeze({ origen: `http://localhost:${PUERTO_FICTICIO}` }) as unknown as DestinoLocal;
    expect(codigoDe(() => urlLocal(aMano, "/api/tags"))).toBe("DESTINO_INVALIDO");
    const privado = Object.freeze({ origen: `http://${ip(192, 168, 7, 23)}:${PUERTO_FICTICIO}` }) as unknown as DestinoLocal;
    expect(codigoDe(() => urlLocal(privado, "/api/generate"))).toBe("DESTINO_FUERA_DE_RANGO");
  });
});
