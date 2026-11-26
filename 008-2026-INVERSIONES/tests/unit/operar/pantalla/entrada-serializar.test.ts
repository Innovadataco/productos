// El borde del simulador de /operar: el pedido (cinco claves exactas, números como en la ficha, topes de largo antes de
// convertir) y la respuesta como texto (pesos exactos, pesos porcentuales a 2 decimales, la fuente de la comisión y de
// la caja). Datos inventados (FICTICIA-*, 2027).
import { describe, expect, it } from "vitest";
import { aRespuestaSimulacion, CAJA_ESCRITA, CAJA_SIN_CERTIFICACION, especiesSimulables, textoCajaCertificada, textoPeso } from "@/app/operar/serializar-simulacion";
import { leerPedidoSimulacion } from "@/operar/pantalla/entrada";
import { simularOperacion } from "@/operar/simulador/simular";
import { A, B, C, CONTEXTO, D, ESTADO, SIN_HISTORIA, idDe, operacion, regla } from "../simulador/apoyo/estado.ficticio";
import { tarifa } from "../tarifa/apoyo/tarifa.ficticio";

const cuerpo = (cambios: Record<string, unknown> = {}) => ({ instrumentoId: idDe(A), lado: "COMPRAR", cantidad: "3", precioLimite: "4.613,27", comisionista: "TRII", saldoComisionista: "", precioActual: "", ...cambios });

describe("leerPedidoSimulacion", () => {
  it("convierte cantidad y precio sin punto flotante", () => {
    const r = leerPedidoSimulacion(cuerpo({ cantidad: "1.237" }));
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    expect(r.valor.operacion.cantidad).toBe(1237n);
    expect(r.valor.operacion.precioLimite.toFixed()).toBe("4613.27");
    expect(r.valor.comisionista).toBe("TRII");
  });

  it("el saldo disponible en el comisionista es opcional: vacío es null; escrito, se convierte como en la ficha", () => {
    const vacio = leerPedidoSimulacion(cuerpo());
    expect(vacio?.ok && vacio.valor.saldo).toBeNull();
    const escrito = leerPedidoSimulacion(cuerpo({ saldoComisionista: "37.911,47" }));
    expect(escrito?.ok && escrito.valor.saldo?.toFixed()).toBe("37911.47");
    const malo = leerPedidoSimulacion(cuerpo({ saldoComisionista: "abc" }));
    expect(malo).toEqual({ ok: false, campos: ["saldoComisionista"] });
    expect(leerPedidoSimulacion(cuerpo({ saldoComisionista: "-4.613" }))).toEqual({ ok: false, campos: ["saldoComisionista"] });
  });

  it("con el saldo escrito, la caja se rotula «escrito por usted»", () => {
    const r = aRespuestaSimulacion(simularOperacion(ESTADO, operacion(A, "COMPRAR", 3n, "4613.27"), CONTEXTO), idDe(A), ESTADO.posiciones, "ESCRITA");
    expect(r.ok && r.vista.cajaFuente).toBe(CAJA_ESCRITA);
    expect(CAJA_ESCRITA).toBe("Caja de la simulación: el saldo que usted escribió, no la de Acciones & Valores (no se guarda).");
  });

  it("un cuerpo sin las claves exactas es null (400 sin campos)", () => {
    expect(leerPedidoSimulacion({ ...cuerpo(), hoy: "2027-03-17" })).toBeNull();
    expect(leerPedidoSimulacion([cuerpo()])).toBeNull();
    expect(leerPedidoSimulacion(null)).toBeNull();
  });

  it.each([
    ["instrumentoId", "ID CON ESPACIOS"],
    ["lado", "COMPRA"],
    ["cantidad", "1,5"],
    ["cantidad", 3],
    ["cantidad", "9".repeat(33)],
    ["precioLimite", "-4"],
    ["precioLimite", "1".repeat(33)],
    ["comisionista", "trii"],
  ])("%s = %j no se lee", (campo, valor) => {
    expect(leerPedidoSimulacion(cuerpo({ [campo]: valor }))).toEqual({ ok: false, campos: [campo] });
  });
});

describe("aRespuestaSimulacion", () => {
  it("la vista con la tarifa: valor, comisión de la tarifa, caja certificada, pesos y la especie operada", () => {
    const op = operacion(A, "COMPRAR", 3n, "4613.27");
    const r = aRespuestaSimulacion(simularOperacion(ESTADO, op, { ...CONTEXTO, tarifas: { COMPRA: tarifa() } }), op.instrumentoId, ESTADO.posiciones, new Date(Date.UTC(2027, 2, 12)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.vista.valorOrden).toBe("$ 13.840");
    expect(r.vista.comision).toEqual({ fuente: "TARIFA", valor: "$ 50", texto: "calculada con su tarifa de Trii para compra · versión 3" });
    expect(r.vista.cajaAntes).toBe("$ 37.911");
    expect(r.vista.cajaDespues).toBe("$ 24.022");
    expect(r.vista.cajaFuente).toBe(textoCajaCertificada("2027-03-12"));
    expect(r.vista.especies.find((e) => e.operada)?.nemotecnico).toBe(A);
    expect(r.vista.especies.find((e) => e.nemotecnico === A)).toMatchObject({ cantidadAntes: "1.237", cantidadDespues: "1.240" });
    expect(r.vista.notas).toHaveLength(1);
  });

  it("sin historia ni tarifa: sin valor de comisión y con la nota de la caja; sin certificación, lo dice", () => {
    const op = operacion(B, "VENDER", 7n, "11.71");
    const r = aRespuestaSimulacion(simularOperacion(ESTADO, op, SIN_HISTORIA), op.instrumentoId, ESTADO.posiciones, null);
    expect(r.ok && r.vista.comision).toMatchObject({ fuente: "SIN_HISTORIA", valor: null });
    expect(r.ok && r.vista.cajaFuente).toBe(CAJA_SIN_CERTIFICACION);
    expect(r.ok && r.vista.notas).toHaveLength(2);
  });

  it("con historia, la fuente es HISTORIA; las reglas afectadas salen con su texto", () => {
    const estado = { ...ESTADO, reglas: [regla({ id: "r1", instrumentoId: idDe(A), condicion: "CIERRE_SOBRE", nivel: D("4600.13"), accion: "VENDER", cantidad: 41n })] };
    const op = operacion(A, "COMPRAR", 3n, "4613.27");
    const r = aRespuestaSimulacion(simularOperacion(estado, op, CONTEXTO), op.instrumentoId, estado.posiciones, null);
    expect(r.ok && r.vista.comision.fuente).toBe("HISTORIA");
    expect(r.ok && r.vista.reglas[0]?.texto).toBe(`Su regla de ${A} dice: vender 41 si el cierre queda por encima de $ 4.600,13.`);
  });

  it("los errores del dueño vuelven como texto", () => {
    const op = operacion(B, "VENDER", 4613n, "11.71");
    const r = aRespuestaSimulacion(simularOperacion(ESTADO, op, CONTEXTO), op.instrumentoId, ESTADO.posiciones, null);
    expect(r).toEqual({ ok: false, errores: ["La venta es de 4.613 acciones y usted tiene 379."] });
  });

  it("textoPeso: 2 decimales mitad hacia arriba, sin cierre o sin peso", () => {
    expect(textoPeso({ cantidad: 1n, valoracion: { estado: "VALORADA", valor: D("1"), pesoPct: D("12.345") } })).toBe("12,35 %");
    expect(textoPeso({ cantidad: 1n, valoracion: { estado: "VALORADA", valor: D("0"), pesoPct: null } })).toBe("—");
    expect(textoPeso({ cantidad: 1n, valoracion: { estado: "SIN_CIERRE" } })).toBe("sin cierre");
  });

  it("especiesSimulables: id, nemotécnico y la cantidad con miles", () => {
    expect(especiesSimulables(ESTADO.posiciones)).toEqual([
      { id: idDe(A), nemotecnico: A, cantidad: "1.237" },
      { id: idDe(B), nemotecnico: B, cantidad: "379" },
      { id: idDe(C), nemotecnico: C, cantidad: "0" },
    ]);
  });
});
