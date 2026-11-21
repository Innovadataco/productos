// `importarPrecios`: el CSV de cierres ya validado entra por el MISMO camino que `precios:actualizar`
// (guardarCierresDeEspecies): mismas especies (acciones activas con lotes), versión con guarda, omisiones y
// re-verificación. Un nemotécnico sin esa especie no escribe nada y se informa por su línea; si la especie
// tiene registrado otro símbolo de Yahoo que `<NEMO>.CL` (el que usa el exportador), tampoco: SIMBOLO_DISTINTO.
// Base falsa (sin PostgreSQL). Especies FICT, precios y fechas inventados.
import { describe, expect, it } from "vitest";
import { leerCsvCierres, type ResultadoLectura } from "@/precios/csv-cierres";
import { guardarCierresDeEspecies } from "@/precios/guardar";
import { importarPrecios } from "@/precios/importar";
import { baseFalsa, filaFalsa, resumenFilas, type EspecieFalsa } from "./base-falsa";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Lunes 18:00 en Colombia: la barra de ese día ya es definitiva. */
const AHORA = new Date("2024-03-11T23:00:00Z");
const csv = (...filas: string[]) => leerCsvCierres(new TextEncoder().encode(`nemotecnico,fecha,cierre,volumen\n${filas.join("\n")}\n`));
const valido = (r: ResultadoLectura) => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
};
const ESPECIES: readonly EspecieFalsa[] = [{ id: "id-a", nemotecnico: "FICTA" }, { id: "id-b", nemotecnico: "FICTB" }];

describe("importarPrecios · por el camino único", () => {
  it("guarda como guardarCierresDeEspecies con los mismos cierres, el rango del CSV y fuente yahoo", async () => {
    const lectura = valido(csv("FICTA,2024-03-08,1000.5,10", "FICTB,2024-03-11,20,0", "FICTA,2024-03-11,1001,", "FICTB,2024-03-09,21,5"));
    const previas = [filaFalsa("v1", "id-b", "2024-03-11", "19")];
    const porCsv = baseFalsa({ especies: ESPECIES, previas });
    const directo = baseFalsa({ especies: ESPECIES, previas });
    const r = await importarPrecios(porCsv.db, lectura, { ahora: AHORA });
    const esperado = await guardarCierresDeEspecies(directo.db, lectura.especies.map((e, i) => ({ instrumentoId: ESPECIES[i]!.id, traer: async () => ({ ok: true as const, cierres: e.cierres }) })), {
      desde: utc("2024-03-08"), hasta: utc("2024-03-11"), ahora: AHORA,
    });
    expect(r).toEqual({ filas: 4, especiesCsv: 2, sinEspecie: [], guardado: esperado });
    expect(resumenFilas(porCsv.filas)).toEqual(resumenFilas(directo.filas));
    expect(r.guardado).toMatchObject({ especies: 2, cierresNuevos: 2, cierresRetirados: 1, omitidasNoHabil: 1, omitidasSinNegociacion: 1, fallidas: [] });
    expect(new Set(porCsv.filas.map((f) => f.fuente))).toEqual(new Set(["yahoo"]));
    expect(porCsv.llamadas.conteos).toEqual([{ estado: "VERIFICADO", reemplazadoEn: null, fecha: { gte: utc("2024-03-08"), lte: utc("2024-03-11") } }]);
  });

  it("la barra de hoy antes de la hora definitiva se omite por HORARIO (decide `ahora`, como en Yahoo directo)", async () => {
    const b = baseFalsa({ especies: ESPECIES });
    const r = await importarPrecios(b.db, valido(csv("FICTA,2024-03-11,10,1")), { ahora: new Date("2024-03-11T19:00:00Z") });
    expect(r.guardado).toMatchObject({ cierresNuevos: 0, omitidasPorHorario: 1 });
    expect(b.filas).toEqual([]);
  });
});

describe("importarPrecios · especies que no se guardan", () => {
  it("sin acción activa con lotes y ese nemotécnico (no existe, es fondo, inactiva o sin lotes): se informa su primera línea", async () => {
    const especies: EspecieFalsa[] = [
      { id: "id-a", nemotecnico: "FICTA" }, { id: "id-f", nemotecnico: "FICTF", tipo: "FIC" },
      { id: "id-i", nemotecnico: "FICTI", activo: false }, { id: "id-s", nemotecnico: "FICTS", conLotes: false },
    ];
    const b = baseFalsa({ especies });
    const r = await importarPrecios(b.db, valido(csv("FICTZ,2024-03-08,10,1", "FICTA,2024-03-08,10,1", "FICTF,2024-03-08,10,1", "FICTI,2024-03-08,10,1", "FICTS,2024-03-08,10,1", "FICTZ,2024-03-07,10,1")), { ahora: AHORA });
    expect(r.sinEspecie).toEqual([{ linea: 2, codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 4, codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 5, codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 6, codigo: "ESPECIE_NO_REGISTRADA" }]);
    expect(r.guardado).toMatchObject({ especies: 1, cierresNuevos: 1, fallidas: [] });
    expect(b.filas.map((f) => f.instrumentoId)).toEqual(["id-a"]);
  });

  it("con otro símbolo de Yahoo registrado que <NEMO>.CL: SIMBOLO_DISTINTO y nada escrito de ella", async () => {
    const b = baseFalsa({ especies: [{ id: "id-a", nemotecnico: "FICTA", simbolo: "OTRAFICT.CL" }, { id: "id-b", nemotecnico: "FICTB", simbolo: "FICTB.CL" }] });
    const r = await importarPrecios(b.db, valido(csv("FICTA,2024-03-08,10,1", "FICTB,2024-03-08,10,1")), { ahora: AHORA });
    expect(r.guardado.fallidas).toEqual([{ instrumentoId: "id-a", codigo: "SIMBOLO_DISTINTO", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(b.filas.map((f) => f.instrumentoId)).toEqual(["id-b"]);
  });

  it("un error de la base al buscar el símbolo queda en la especie: GUARDADO_ERROR con su nombre", async () => {
    const b = baseFalsa({ especies: ESPECIES, errorSimbolo: Object.assign(new Error("valor 443322"), { name: "PrismaClientUnknownRequestError" }) });
    const r = await importarPrecios(b.db, valido(csv("FICTA,2024-03-08,10,1")), { ahora: AHORA });
    expect(r.guardado.fallidas).toEqual([{ instrumentoId: "id-a", codigo: "GUARDADO_ERROR", detalle: "PrismaClientUnknownRequestError", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(JSON.stringify(r)).not.toContain("443322");
  });
});
