// El camino ÚNICO de escritura de los cierres (src/precios/guardar.ts): lo usan `precios:actualizar` (desde Yahoo)
// y `precios:importar` (desde el CSV de cierres). Paridad: el mismo JSON de Yahoo, por `actualizarPrecios` o
// entregado ya leído a `guardarCierresDeEspecies`, deja el mismo resultado y las mismas filas, con las reglas
// de #1002 (versión con guarda), #1005 (omisiones y retiro del vigente) y #1007 (re-verificación).
// Base falsa (sin PostgreSQL) y Yahoo falso (sin red). Especies, precios, volúmenes y fechas inventados.
import { describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import { guardarCierresDeEspecies } from "@/precios/guardar";
import { parsearYahoo, type Buscar } from "@/precios/yahoo";
import { baseFalsa, filaFalsa, resumenFilas, type OpcionesBaseFalsa } from "./base-falsa";

const ESPECIE = "esp-ficticia-guardar";
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Barra diaria de Yahoo: 09:30 en Colombia (14:30 UTC) del día dado. */
const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;

interface Barra { readonly dia: string; readonly close: number; readonly volume: number | null }
const chart = (barras: readonly Barra[]) => ({
  chart: { result: [{ meta: { currency: "COP" }, timestamp: barras.map((b) => ts(b.dia)), indicators: { quote: [{ close: barras.map((b) => b.close), volume: barras.map((b) => b.volume) }] } }] },
});
const yahoo = (barras: readonly Barra[]): Buscar => async () => new Response(JSON.stringify(chart(barras)));

// Rango ficticio: el calendario falso solo cubre 2024 (el 2023 queda sin calendario).
const DESDE = utc("2023-03-15");
const HASTA = utc("2024-03-15");
/** Viernes 14:00 en Colombia: la barra de ese día aún no es definitiva. */
const AHORA = new Date("2024-03-15T19:00:00Z");

/** Una barra por cada regla: guardada, verificada, fin de semana, sin negociación (retira), sin calendario y aún no definitiva. */
const BARRAS: readonly Barra[] = [
  { dia: "2023-03-15", close: 900, volume: 10 }, // miércoles de un año sin calendario → SIN_CALENDARIO
  { dia: "2024-03-09", close: 995, volume: 0 }, // sábado → NO_HABIL
  { dia: "2024-03-11", close: 1000.5, volume: 120 }, // lunes → nuevo
  { dia: "2024-03-12", close: 1010, volume: 80 }, // martes, certificación a 1012 → VERIFICADO (re-verifica el vigente)
  { dia: "2024-03-13", close: 1020, volume: 0 }, // miércoles sin negociación → retira el vigente
  { dia: "2024-03-14", close: 1030, volume: null }, // jueves sin volumen → se guarda
  { dia: "2024-03-15", close: 1040, volume: 50 }, // hoy antes de la hora → HORARIO
];

const escenario = (): OpcionesBaseFalsa => ({
  previas: [filaFalsa("v1", ESPECIE, "2024-03-12", "1010"), filaFalsa("v2", ESPECIE, "2024-03-13", "1015")],
  especies: [{ id: ESPECIE, nemotecnico: "FICTG" }],
  referencias: [{ instrumentoId: ESPECIE, fechaCorte: utc("2024-03-12"), precioValoracion: "1012" }],
});

describe("guardarCierresDeEspecies · paridad con actualizarPrecios", () => {
  it("el mismo JSON de Yahoo deja el mismo resultado y las mismas filas por los dos caminos", async () => {
    const porYahoo = baseFalsa(escenario());
    const porLista = baseFalsa(escenario());
    const rYahoo = await actualizarPrecios(porYahoo.db, { desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: yahoo(BARRAS), instrumentoIds: [ESPECIE] });
    const rLista = await guardarCierresDeEspecies(porLista.db, [{ instrumentoId: ESPECIE, traer: async () => parsearYahoo(chart(BARRAS)) }], { desde: DESDE, hasta: HASTA, ahora: AHORA });
    expect(rLista).toEqual(rYahoo);
    expect(resumenFilas(porLista.filas)).toEqual(resumenFilas(porYahoo.filas));
    // Lo que deja cada regla, para que la paridad no sea «los dos no hicieron nada».
    expect(rLista).toMatchObject({
      especies: 1, cierresNuevos: 2, cierresRevisados: 0, cierresReverificados: 1, cierresRetirados: 1, verificados: 1,
      omitidasPorHorario: 1, omitidasNoHabil: 1, omitidasSinNegociacion: 1, omitidasSinCalendario: 1, fallidas: [],
    });
    expect(porLista.filas.filter((f) => f.reemplazadoEn === null).map((f) => [f.fecha.toISOString().slice(0, 10), f.precio.toString(), f.estado])).toEqual([
      ["2024-03-11", "1000.5", "NO_VERIFICADO"], ["2024-03-12", "1010", "VERIFICADO"], ["2024-03-14", "1030", "NO_VERIFICADO"],
    ]);
  });

  it("cuenta los verificados del rango [desde, hasta] (vigentes, de todas las especies)", async () => {
    const b = baseFalsa(escenario());
    await guardarCierresDeEspecies(b.db, [], { desde: DESDE, hasta: HASTA, ahora: AHORA });
    expect(b.llamadas.conteos).toEqual([{ estado: "VERIFICADO", reemplazadoEn: null, fecha: { gte: DESDE, lte: HASTA } }]);
  });

  it("lee el calendario de la BVC una sola vez para todas las especies", async () => {
    const b = baseFalsa({ especies: [{ id: "a", nemotecnico: "FICTA" }, { id: "b", nemotecnico: "FICTB" }] });
    const una = { ok: true as const, cierres: [{ fecha: utc("2024-03-11"), precio: "10", volumen: 5 }] };
    const r = await guardarCierresDeEspecies(b.db, [{ instrumentoId: "a", traer: async () => una }, { instrumentoId: "b", traer: async () => una }], { desde: DESDE, hasta: HASTA, ahora: AHORA });
    expect(b.llamadas.calendario).toBe(1);
    expect(r).toMatchObject({ especies: 2, cierresNuevos: 2, fallidas: [] });
  });
});

describe("guardarCierresDeEspecies · una especie que no se puede traer no escribe nada y no detiene las demás", () => {
  const una = { ok: true as const, cierres: [{ fecha: utc("2024-03-11"), precio: "10", volumen: 5 }] };

  it("si la fuente lanza: GUARDADO_ERROR con nombre y código del error (nunca el mensaje), barras 0/0", async () => {
    const b = baseFalsa();
    const error = Object.assign(new Error("valor 765432 en la consulta"), { name: "PrismaClientKnownRequestError", code: "P1001" });
    const r = await guardarCierresDeEspecies(b.db, [
      { instrumentoId: "falla", traer: async () => { throw error; } },
      { instrumentoId: "bien", traer: async () => una },
    ], { desde: DESDE, hasta: HASTA, ahora: AHORA });
    expect(r.fallidas).toEqual([{ instrumentoId: "falla", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P1001", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(r.cierresNuevos).toBe(1);
    expect(JSON.stringify(r)).not.toContain("765432");
  });

  it("si la fuente responde con un código: ese código, sin detalle, barras 0/0", async () => {
    const b = baseFalsa();
    const r = await guardarCierresDeEspecies(b.db, [{ instrumentoId: "sin-datos", traer: async () => ({ ok: false, codigo: "YAHOO_SIN_DATOS" }) }], { desde: DESDE, hasta: HASTA, ahora: AHORA });
    expect(r.fallidas).toEqual([{ instrumentoId: "sin-datos", codigo: "YAHOO_SIN_DATOS", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(b.filas).toEqual([]);
  });
});

describe("actualizarPrecios · un error de la base al buscar el símbolo queda en la especie (no aborta la corrida)", () => {
  it("GUARDADO_ERROR con el nombre del error y nada escrito", async () => {
    const b = baseFalsa({ especies: [{ id: ESPECIE, nemotecnico: "FICTG" }], errorSimbolo: Object.assign(new Error("valor 876543"), { name: "PrismaClientUnknownRequestError" }) });
    const r = await actualizarPrecios(b.db, { desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: yahoo(BARRAS), instrumentoIds: [ESPECIE] });
    expect(r.fallidas).toEqual([{ instrumentoId: ESPECIE, codigo: "GUARDADO_ERROR", detalle: "PrismaClientUnknownRequestError", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(b.filas).toEqual([]);
  });
});
