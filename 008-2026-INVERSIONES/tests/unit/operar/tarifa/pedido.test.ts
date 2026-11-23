// El pedido de /edicion/tarifas (O5): claves exactas, números como en la ficha y exactos, listas cerradas, hasta 3 otros
// cargos, la vigencia a menos de un año y el motivo. Los errores llevan campo y código, nunca el valor. Datos inventados.
import { describe, expect, it } from "vitest";
import { leerPedidoTarifa } from "@/operar/tarifa/pedido";
import { cuerpoTarifa } from "./apoyo/tarifa.ficticio";

const HOY = new Date(Date.UTC(2027, 2, 17));
const errores = (cuerpo: unknown) => {
  const r = leerPedidoTarifa(cuerpo, HOY);
  return r.ok ? [] : r.errores;
};

describe("leerPedidoTarifa", () => {
  it("lee un pedido válido como texto decimal exacto", () => {
    const r = leerPedidoTarifa(cuerpoTarifa(), HOY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.versionBase).toBe(2);
    expect(r.valor).toEqual({
      comisionista: "TRII", lado: "VENTA", porcentaje: "0.2731", minimoPorOrden: "7.13", fijoPorOrden: "1.37", ivaPct: "17.31",
      otrosCargos: [{ nombre: "Cargo ficticio", tipo: "PCT", valor: "0.0137" }], vigenteDesde: new Date(Date.UTC(2027, 0, 11)), motivo: "Tarifa ficticia de prueba",
    });
  });

  it("acepta miles y cero, y recorta el nombre del cargo", () => {
    const r = leerPedidoTarifa(cuerpoTarifa({ minimoPorOrden: "4.613,2701", fijoPorOrden: "0", otrosCargos: [{ nombre: "  Cargo  ", tipo: "FIJO", valor: "37.911,47" }] }), HOY);
    expect(r.ok && r.valor.minimoPorOrden).toBe("4613.2701");
    expect(r.ok && r.valor.otrosCargos[0]).toEqual({ nombre: "Cargo", tipo: "FIJO", valor: "37911.47" });
  });

  it.each([
    [{ extra: 1 }, "cuerpo", "FORMATO_INVALIDO"],
  ])("un cuerpo con otras claves es FORMATO_INVALIDO", (cambio, campo, codigo) => {
    expect(errores({ ...cuerpoTarifa(), ...cambio })).toEqual([{ campo, codigo }]);
  });

  it.each([
    ["comisionista", "OTRA", "COMISIONISTA_INVALIDO"],
    ["lado", "COMPRAR", "LADO_INVALIDO"],
    ["porcentaje", "100,0001", "PORCENTAJE_INVALIDO"],
    ["porcentaje", "0,27311", "PORCENTAJE_INVALIDO"],
    ["porcentaje", "-1", "PORCENTAJE_INVALIDO"],
    ["porcentaje", 0.25, "PORCENTAJE_INVALIDO"],
    ["ivaPct", "1.5", "PORCENTAJE_INVALIDO"],
    // La columna es DECIMAL(5,2): con más de 2 decimales la base redondearía en silencio (revisión de seguridad).
    ["ivaPct", "17,315", "IVA_INVALIDO"],
    ["minimoPorOrden", "100.000.000", "MONTO_INVALIDO"],
    ["fijoPorOrden", "", "MONTO_INVALIDO"],
    ["fijoPorOrden", "1".repeat(40), "MONTO_INVALIDO"],
    ["vigenteDesde", "2027-02-30", "FECHA_INVALIDA"],
    ["vigenteDesde", "2028-03-18", "VIGENCIA_DEMASIADO_LEJANA"],
    ["motivo", "   ", "VACIO"],
    ["motivo", "x".repeat(2001), "DEMASIADO_LARGO"],
    ["otrosCargos", "no", "FORMATO_INVALIDO"],
    ["versionBase", -1, "FORMATO_INVALIDO"],
    ["versionBase", 1.5, "FORMATO_INVALIDO"],
  ])("%s = %j → %s", (campo, valor, codigo) => {
    expect(errores(cuerpoTarifa({ [campo]: valor }))).toEqual([{ campo, codigo }]);
  });

  it("la vigencia hasta un año adelante pasa", () => {
    expect(leerPedidoTarifa(cuerpoTarifa({ vigenteDesde: "2028-03-17" }), HOY).ok).toBe(true);
  });

  it("los cargos: hasta 3, cada uno con claves exactas, nombre de una línea, tipo de la lista y su valor", () => {
    const cargo = { nombre: "C", tipo: "FIJO", valor: "1" };
    expect(errores(cuerpoTarifa({ otrosCargos: [cargo, cargo, cargo, cargo] }))).toEqual([{ campo: "otrosCargos", codigo: "CARGOS_DEMASIADOS" }]);
    expect(leerPedidoTarifa(cuerpoTarifa({ otrosCargos: [cargo, cargo, cargo] }), HOY).ok).toBe(true);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, otra: 1 }] }))).toEqual([{ campo: "otrosCargos.0", codigo: "FORMATO_INVALIDO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [cargo, { ...cargo, nombre: "a\nb" }] }))).toEqual([{ campo: "otrosCargos.1.nombre", codigo: "NOMBRE_INVALIDO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, nombre: `a${String.fromCharCode(0x200f)}b` }] }))).toEqual([{ campo: "otrosCargos.0.nombre", codigo: "NOMBRE_INVALIDO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, nombre: "x".repeat(61) }] }))).toEqual([{ campo: "otrosCargos.0.nombre", codigo: "NOMBRE_INVALIDO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, nombre: " " }] }))).toEqual([{ campo: "otrosCargos.0.nombre", codigo: "VACIO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, tipo: "OTRO" }] }))).toEqual([{ campo: "otrosCargos.0.tipo", codigo: "TIPO_CARGO_INVALIDO" }]);
    expect(errores(cuerpoTarifa({ otrosCargos: [{ ...cargo, tipo: "PCT", valor: "101" }] }))).toEqual([{ campo: "otrosCargos.0.valor", codigo: "PORCENTAJE_INVALIDO" }]);
  });

  it("junta todos los errores y nunca trae el valor escrito", () => {
    const e = errores(cuerpoTarifa({ porcentaje: "4613,27", minimoPorOrden: "x", motivo: "" }));
    expect(e.map((x) => x.campo)).toEqual(["porcentaje", "minimoPorOrden", "motivo"]);
    expect(JSON.stringify(e)).not.toContain("4613");
  });
});
