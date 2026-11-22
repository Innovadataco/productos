// Registro de los resúmenes con IA (src/ia/registro/registro.ts) contra la base de PRUEBAS: registrar, no repetir un
// PUBLICADO, leer el último publicado de vuelta como paquete construido (cerrando en fallo si lo guardado no cuadra) y
// sumar los tokens de una puerta en un rango semiabierto [desde, hasta) para el tope de la nube. Datos inventados: días
// de 2027 y especies FICTICIA-*.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { esPaqueteConstruido, construirPaquete } from "@/ia/paquete";
import { sha256Hex } from "@/ia/hash";
import type { ExitoGeneracion, Puerta } from "@/ia/generador";
import type { PaqueteHechos } from "@/ia/contrato";
import { ErrorRegistro, filaDeResumen, type EntradaResumen } from "@/ia/registro/fila";
import { gastoDelMes, registrarResumen, ultimoPublicado, yaPublicado } from "@/ia/registro/registro";
import { ENTRADAS_FICTICIAS } from "../../unit/ia/apoyo/hechos.ficticio";

const db = new PrismaClient();
const marca = Date.now().toString(36).toUpperCase();

/** Un paquete propio de esta corrida (otro hash): el mismo armado de las pruebas de src/ia, con un aviso propio y otro hoy. */
function paqueteDe(tipo: "DIARIO" | "REGLAS", hoy: string, aviso: string): PaqueteHechos {
  return construirPaquete({ ...ENTRADAS_FICTICIAS[tipo](), hoy, avisos: [`${aviso}_${marca}`] } as never);
}
const PROMPT = { version: "resumen-reglas-v1", hash: sha256Hex(`prompt ficticio del registro ${marca}`) };
const exito = (puerta: Puerta, tokensEntrada: number | null, tokensSalida: number | null): ExitoGeneracion => ({
  ok: true, puerta, salidaCruda: '{"frases":[{"texto":"{H01}","hechos":["H01"]}]}', modelo: "ornith:9b", modeloDigest: "sha256:ficticio7193",
  latenciaMs: 4127, tokensEntrada, tokensSalida,
});
const comun = (paquete: PaqueteHechos) => ({ paquete, prompt: PROMPT, opciones: { temperature: 0, seed: 42 }, validadorVersion: "validador-v1" });
const publicado = (paquete: PaqueteHechos, extra: Partial<ExitoGeneracion> = {}): EntradaResumen => ({ ...comun(paquete), estado: "PUBLICADO", exito: { ...exito("local", 1237, 211), ...extra }, texto: `Resumen ficticio ${marca}.` });
const contar = () => db.resumenIa.count();

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registrarResumen", () => {
  it("registra un PUBLICADO con la hora de la base y devuelve su id", async () => {
    const paquete = paqueteDe("DIARIO", "2027-04-07", "REGISTRO_UNO");
    const antes = new Date();
    const r = await registrarResumen(db, publicado(paquete));
    const fila = await db.resumenIa.findUniqueOrThrow({ where: { id: r.id } });
    expect(fila).toMatchObject({ estado: "PUBLICADO", tipo: "DIARIO", hechosHash: paquete.hash, puerta: "local", tokensEntrada: 1237, tokensSalida: 211 });
    expect(fila.generadoEn.toISOString()).toBe(r.generadoEn.toISOString());
    expect(r.generadoEn.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 5_000);
  });

  it("un segundo PUBLICADO con la misma clave da YA_PUBLICADO y no escribe; los RECHAZADO y FALLIDO se repiten", async () => {
    const paquete = paqueteDe("DIARIO", "2027-04-08", "REGISTRO_DOS");
    await registrarResumen(db, publicado(paquete));
    const n = await contar();
    await expect(registrarResumen(db, publicado(paquete))).rejects.toThrow(expect.objectContaining({ codigo: "YA_PUBLICADO" }));
    expect(await contar()).toBe(n);
    const rechazado: EntradaResumen = { ...comun(paquete), estado: "RECHAZADO", exito: exito("local", 1237, 211), motivos: ["PREDICCION"] };
    const fallido: EntradaResumen = { ...comun(paquete), estado: "FALLIDO", puerta: "local", motivo: "TIEMPO_AGOTADO", detalles: ["LIMITE_DEL_ORQUESTADOR"] };
    for (const e of [rechazado, rechazado, fallido, fallido]) await registrarResumen(db, e);
    expect(await contar()).toBe(n + 4);
  });

  it("una entrada inválida no llega a la base (ErrorRegistro antes de escribir)", async () => {
    const n = await contar();
    await expect(registrarResumen(db, { ...publicado(paqueteDe("DIARIO", "2027-04-09", "REGISTRO_TRES")), texto: "" } as EntradaResumen)).rejects.toBeInstanceOf(ErrorRegistro);
    expect(await contar()).toBe(n);
  });
});

describe("yaPublicado", () => {
  it("solo un PUBLICADO con la misma clave cuenta (un RECHAZADO o otro digest no)", async () => {
    const paquete = paqueteDe("REGLAS", "2027-04-12", "YA_PUBLICADO");
    const clave = { tipo: "REGLAS", fechaNegocio: "2027-04-12", hechosHash: paquete.hash, promptHash: PROMPT.hash, modeloDigest: "sha256:ficticio7193" } as const;
    expect(await yaPublicado(db, clave)).toBe(false);
    await registrarResumen(db, { ...comun(paquete), estado: "RECHAZADO", exito: exito("local", 17, 3), motivos: ["TRATO"] });
    expect(await yaPublicado(db, clave)).toBe(false);
    await registrarResumen(db, publicado(paquete));
    expect(await yaPublicado(db, clave)).toBe(true);
    expect(await yaPublicado(db, { ...clave, modeloDigest: "sha256:otro" })).toBe(false);
    await expect(yaPublicado(db, { ...clave, hechosHash: "x" })).rejects.toThrow(expect.objectContaining({ codigo: "CLAVE_INVALIDA" }));
  });
});

describe("ultimoPublicado", () => {
  it("el PUBLICADO más reciente del tipo y del día exacto, con su paquete de vuelta como paquete construido", async () => {
    const dia = "2027-05-11";
    const viejo = paqueteDe("DIARIO", dia, "ULTIMO_VIEJO");
    const nuevo = paqueteDe("DIARIO", dia, "ULTIMO_NUEVO");
    expect(await ultimoPublicado(db, "DIARIO", dia)).toBeNull();
    await db.resumenIa.create({ data: { ...filaDeResumen(publicado(viejo)), generadoEn: new Date("2027-05-11T22:01:13.000Z") } });
    await db.resumenIa.create({ data: { ...filaDeResumen(publicado(nuevo)), generadoEn: new Date("2027-05-11T23:17:41.000Z") } });
    // Un RECHAZADO más nuevo, otro tipo y otro día no cuentan.
    await db.resumenIa.create({ data: { ...filaDeResumen({ ...comun(nuevo), estado: "RECHAZADO", exito: exito("nube", 5, 7), motivos: ["IDIOMA"] }), generadoEn: new Date("2027-05-11T23:59:01.000Z") } });
    await registrarResumen(db, publicado(paqueteDe("REGLAS", dia, "ULTIMO_OTRO_TIPO")));
    await registrarResumen(db, publicado(paqueteDe("DIARIO", "2027-05-12", "ULTIMO_OTRO_DIA")));
    const ultimo = await ultimoPublicado(db, "DIARIO", dia);
    expect(ultimo).toMatchObject({ tipo: "DIARIO", fechaNegocio: dia, puerta: "local", texto: `Resumen ficticio ${marca}.`, hechosHash: nuevo.hash, promptHash: PROMPT.hash, modeloDigest: "sha256:ficticio7193" });
    expect(ultimo!.generadoEn.toISOString()).toBe("2027-05-11T23:17:41.000Z");
    expect(esPaqueteConstruido(ultimo!.paquete)).toBe(true);
    expect(ultimo!.paquete).toEqual(nuevo);
  });

  it("si lo guardado no se reconstruye igual (alguien tocó los hechos), cierra en fallo con GUARDADO_INVALIDO", async () => {
    const dia = "2027-05-18";
    const paquete = paqueteDe("DIARIO", dia, "ULTIMO_ALTERADO");
    const fila = filaDeResumen(publicado(paquete));
    const alterado = JSON.parse(JSON.stringify(fila.hechos)) as { hechos: { presentacion: string }[] };
    alterado.hechos[0]!.presentacion = `${alterado.hechos[0]!.presentacion}1`;
    await db.resumenIa.create({ data: { ...fila, hechos: alterado as never } });
    await expect(ultimoPublicado(db, "DIARIO", dia)).rejects.toThrow(expect.objectContaining({ codigo: "GUARDADO_INVALIDO" }));
  });

  it("un tipo o un día inválidos dan CLAVE_INVALIDA", async () => {
    await expect(ultimoPublicado(db, "SEMANAL" as never, "2027-05-11")).rejects.toThrow(expect.objectContaining({ codigo: "CLAVE_INVALIDA" }));
    await expect(ultimoPublicado(db, "DIARIO", "2027-02-30")).rejects.toThrow(expect.objectContaining({ codigo: "CLAVE_INVALIDA" }));
  });
});

describe("gastoDelMes", () => {
  it("suma los tokens de una puerta en [desde, hasta): el borde de abajo entra, el de arriba no; los nulos cuentan 0", async () => {
    const desde = new Date("2027-06-01T05:00:00.000Z");
    const hasta = new Date("2027-07-01T05:00:00.000Z");
    const antes = await gastoDelMes(db, "nube", desde, hasta);
    const filas: [Puerta, number | null, number | null, string][] = [
      ["nube", 1237, 461, "2027-06-01T04:59:59.999Z"], // antes del rango
      ["nube", 3719, 211, "2027-06-01T05:00:00.000Z"], // borde de abajo: entra
      ["nube", 613, 97, "2027-06-30T23:13:00.000Z"], // dentro
      ["nube", null, null, "2027-06-17T15:41:00.000Z"], // sin conteo del proveedor: 0
      ["nube", 2917, 389, "2027-07-01T05:00:00.000Z"], // borde de arriba: no entra
      ["local", 4613, 733, "2027-06-11T23:00:00.000Z"], // otra puerta
    ];
    for (const [i, [puerta, entrada, salida, en]] of filas.entries()) {
      const paquete = paqueteDe("DIARIO", "2027-04-21", `GASTO_${"ABCDEF"[i]}`);
      await db.resumenIa.create({ data: { ...filaDeResumen({ ...comun(paquete), estado: "RECHAZADO", exito: exito(puerta, entrada, salida), motivos: ["LONGITUD"] }), generadoEn: new Date(en) } });
    }
    const despues = await gastoDelMes(db, "nube", desde, hasta);
    expect(despues.tokensEntrada - antes.tokensEntrada).toBe(3719 + 613);
    expect(despues.tokensSalida - antes.tokensSalida).toBe(211 + 97);
    expect(despues.corridas - antes.corridas).toBe(3);
  });

  it.each<[string, unknown, Date, Date]>([
    ["una puerta fuera de la lista", "ollama", new Date("2027-06-01T05:00:00Z"), new Date("2027-07-01T05:00:00Z")],
    ["un rango vacío", "nube", new Date("2027-07-01T05:00:00Z"), new Date("2027-07-01T05:00:00Z")],
    ["un rango al revés", "nube", new Date("2027-07-01T05:00:00Z"), new Date("2027-06-01T05:00:00Z")],
    ["una fecha inválida", "nube", new Date("no es fecha"), new Date("2027-06-01T05:00:00Z")],
  ])("rechaza %s con RANGO_INVALIDO o PUERTA_INVALIDA, sin consultar", async (_n, puerta, desde, hasta) => {
    await expect(gastoDelMes(db, puerta as Puerta, desde, hasta)).rejects.toBeInstanceOf(ErrorRegistro);
  });
});
