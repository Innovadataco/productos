// Lectores del borde del área de edición (fase B, PR-B): convierten el JSON del formulario en los datos del dominio con
// la MISMA lectura de la ficha (leerMontoEs y leerEnteroEs de src/plan/importar/valores-es.ts; fechas ISO de Trii), con
// claves exactas y topes de tamaño. La semántica (nivel según la condición, plazo, textos vacíos, cantidad > 0…) no se
// mira aquí: la validan las funciones del dominio (src/plan/validar.ts), las mismas del importador. Errores: solo
// campo y código, nunca el valor. Datos inventados.
import { describe, expect, it } from "vitest";
import { MAX_CANTIDAD, MAX_REGLAS } from "@/plan/edicion/comun";
import { leerPedidoDecision } from "@/plan/edicion/leer-decision";
import { leerPedidoEnlace } from "@/plan/edicion/leer-enlace";
import { leerPedidoVersion } from "@/plan/edicion/leer-version";
import { MAX_TEXTO } from "@/plan/validar";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const REGLA = {
  instrumentoId: "inst-ficticio-a",
  condicion: "CIERRE_SOBRE",
  nivel: "1.237,5",
  accion: "VENDER",
  cantidad: "4.613",
  plazoHasta: "2027-03-17",
  detalle: "Vender si cierra sobre el nivel (ficticia)",
};
const VERSION = { vigenteDesde: "2027-02-11", motivo: "Ajuste ficticio del plan", versionBase: 3, reglas: [REGLA] };

const errores = (r: { ok: boolean; errores?: readonly unknown[] }) => (r.ok ? [] : r.errores);

describe("leerPedidoVersion", () => {
  it("convierte el formulario con la lectura de la ficha: nivel y cantidad es-CO, fechas ISO, vacíos a nulo", () => {
    const r = leerPedidoVersion({
      ...VERSION,
      reglas: [REGLA, { ...REGLA, instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: "$7,3 M", accion: "NO_ACTUAR", cantidad: "", plazoHasta: "" }],
    });
    expect(r).toEqual({
      ok: true,
      valor: {
        vigenteDesde: dia("2027-02-11"),
        motivo: "Ajuste ficticio del plan",
        versionBase: 3,
        reglas: [
          { instrumentoId: "inst-ficticio-a", condicion: "CIERRE_SOBRE", nivel: "1237.5", accion: "VENDER", cantidad: 4613n, plazoHasta: dia("2027-03-17"), detalle: "Vender si cierra sobre el nivel (ficticia)" },
          { instrumentoId: null, condicion: "MONTO_ORDEN_BAJO", nivel: "7300000", accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle: "Vender si cierra sobre el nivel (ficticia)" },
        ],
      },
    });
  });

  it("un nivel vacío es nulo (lo exige o lo prohíbe la condición, en el dominio)", () => {
    const r = leerPedidoVersion({ ...VERSION, reglas: [{ ...REGLA, condicion: "LIBRE", nivel: "  " }] });
    expect(r.ok && r.valor.reglas[0]!.nivel).toBeNull();
  });

  it("nunca adivina un número: «1.5», «1,5» de cantidad o letras dan su código, con el campo y sin el valor", () => {
    const r = leerPedidoVersion({ ...VERSION, reglas: [{ ...REGLA, nivel: "1.5", cantidad: "1,5" }, { ...REGLA, nivel: "doce" }] });
    expect(errores(r)).toEqual([
      { campo: "reglas[0].nivel", codigo: "NIVEL_NO_RECONOCIDO" },
      { campo: "reglas[0].cantidad", codigo: "CANTIDAD_NO_RECONOCIDA" },
      { campo: "reglas[1].nivel", codigo: "NIVEL_NO_RECONOCIDO" },
    ]);
    expect(JSON.stringify(r)).not.toContain("doce");
  });

  it("una cantidad que no cabe en la columna (BIGINT) se rechaza en el borde, no con un 500 de la base", () => {
    const tope = leerPedidoVersion({ ...VERSION, reglas: [{ ...REGLA, cantidad: MAX_CANTIDAD.toString() }] });
    expect(tope.ok && tope.valor.reglas[0]!.cantidad).toBe(MAX_CANTIDAD);
    const r = leerPedidoVersion({ ...VERSION, reglas: [{ ...REGLA, cantidad: (MAX_CANTIDAD + 1n).toString() }] });
    expect(errores(r)).toEqual([{ campo: "reglas[0].cantidad", codigo: "CANTIDAD_INVALIDA" }]);
  });

  it("fechas: solo AAAA-MM-DD y que existan", () => {
    const r = leerPedidoVersion({ ...VERSION, vigenteDesde: "11/02/2027", reglas: [{ ...REGLA, plazoHasta: "2027-02-30" }] });
    expect(errores(r)).toEqual([
      { campo: "vigenteDesde", codigo: "FECHA_INVALIDA" },
      { campo: "reglas[0].plazoHasta", codigo: "FECHA_INVALIDA" },
    ]);
  });

  it("claves exactas: una de más (p. ej. el autor) o una de menos rechazan el pedido entero", () => {
    expect(leerPedidoVersion({ ...VERSION, autorId: "otro" }).ok).toBe(false);
    expect(errores(leerPedidoVersion({ ...VERSION, autorId: "otro" }))).toEqual([{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]);
    const { motivo: _m, ...sinMotivo } = VERSION;
    expect(errores(leerPedidoVersion(sinMotivo))).toEqual([{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]);
    expect(errores(leerPedidoVersion({ ...VERSION, reglas: [{ ...REGLA, planVersionId: "x" }] }))).toEqual([{ campo: "reglas[0]", codigo: "FORMATO_INVALIDO" }]);
    for (const valor of [null, [], "texto", 7]) expect(leerPedidoVersion(valor).ok).toBe(false);
  });

  it("tipos: textos donde van textos, la versión base como entero no negativo, el id con la forma de la base", () => {
    const r = leerPedidoVersion({ ...VERSION, versionBase: "3", motivo: 7, reglas: [{ ...REGLA, instrumentoId: "Robert'); DROP", detalle: ["x"], condicion: 1 }] });
    expect(errores(r)).toEqual([
      { campo: "motivo", codigo: "FORMATO_INVALIDO" },
      { campo: "versionBase", codigo: "FORMATO_INVALIDO" },
      { campo: "reglas[0].instrumentoId", codigo: "ID_INVALIDO" },
      { campo: "reglas[0].condicion", codigo: "FORMATO_INVALIDO" },
      { campo: "reglas[0].detalle", codigo: "FORMATO_INVALIDO" },
    ]);
    for (const versionBase of [-1, 1.5, Number.NaN]) expect(errores(leerPedidoVersion({ ...VERSION, versionBase }))).toEqual([{ campo: "versionBase", codigo: "FORMATO_INVALIDO" }]);
    expect(leerPedidoVersion({ ...VERSION, versionBase: 0 }).ok).toBe(true);
  });

  it("topes: textos de más de MAX_TEXTO y más de MAX_REGLAS reglas (el cuerpo no se procesa entero)", () => {
    const largo = "x".repeat(MAX_TEXTO + 1);
    expect(errores(leerPedidoVersion({ ...VERSION, motivo: largo, reglas: [{ ...REGLA, detalle: largo }] }))).toEqual([
      { campo: "motivo", codigo: "DEMASIADO_LARGO" },
      { campo: "reglas[0].detalle", codigo: "DEMASIADO_LARGO" },
    ]);
    expect(leerPedidoVersion({ ...VERSION, motivo: "x".repeat(MAX_TEXTO) }).ok).toBe(true);
    expect(errores(leerPedidoVersion({ ...VERSION, reglas: Array.from({ length: MAX_REGLAS + 1 }, () => REGLA) }))).toEqual([{ campo: "reglas", codigo: "REGLAS_DEMASIADAS" }]);
    expect(leerPedidoVersion({ ...VERSION, reglas: Array.from({ length: MAX_REGLAS }, () => REGLA) }).ok).toBe(true);
    expect(errores(leerPedidoVersion({ ...VERSION, reglas: "todas" }))).toEqual([{ campo: "reglas", codigo: "FORMATO_INVALIDO" }]);
  });

  it("una versión sin reglas pasa el borde: SIN_REGLAS lo dice el dominio, como al importar", () => {
    expect(leerPedidoVersion({ ...VERSION, reglas: [] })).toMatchObject({ ok: true, valor: { reglas: [] } });
  });

  it("los textos no se recortan aquí (lo hace el dominio al guardar, igual que con la ficha)", () => {
    const r = leerPedidoVersion({ ...VERSION, motivo: "  Ajuste ficticio  " });
    expect(r.ok && r.valor.motivo).toBe("  Ajuste ficticio  ");
  });
});

const DECISION = {
  fechaDecision: "2027-02-12",
  instrumentoId: "inst-ficticio-a",
  accion: "NO_ACTUAR",
  cantidad: "37",
  reglaId: "regla-ficticia-1",
  excepcion: false,
  motivo: "Mantener hasta el dividendo (ficticio)",
  ordenId: null,
  corrige: null,
};

describe("leerPedidoDecision", () => {
  it("convierte el formulario: fecha ISO, cantidad es-CO, ids con la forma de la base", () => {
    expect(leerPedidoDecision({ ...DECISION, cantidad: "1.237", ordenId: "orden-ficticia-9" })).toEqual({
      ok: true,
      valor: { ...DECISION, fechaDecision: dia("2027-02-12"), cantidad: 1237n, ordenId: "orden-ficticia-9" },
    });
    const sinRegla = leerPedidoDecision({ ...DECISION, reglaId: null, cantidad: "", corrige: "decision-ficticia-2" });
    expect(sinRegla).toMatchObject({ ok: true, valor: { reglaId: null, cantidad: null, corrige: "decision-ficticia-2" } });
  });

  it("una orden y una corrección a la vez no: la corrección mueve las órdenes de la anterior", () => {
    expect(errores(leerPedidoDecision({ ...DECISION, ordenId: "orden-ficticia-9", corrige: "decision-ficticia-2" }))).toEqual([{ campo: "ordenId", codigo: "ORDEN_CON_CORRECCION" }]);
  });

  it("tipos y formas: la excepción es booleana, los ids con su forma, sin claves de más (el autor sale de la sesión)", () => {
    expect(errores(leerPedidoDecision({ ...DECISION, excepcion: "true", reglaId: "../x", ordenId: 3, fechaDecision: "ayer" }))).toEqual([
      { campo: "fechaDecision", codigo: "FECHA_INVALIDA" },
      { campo: "reglaId", codigo: "ID_INVALIDO" },
      { campo: "excepcion", codigo: "FORMATO_INVALIDO" },
      { campo: "ordenId", codigo: "ID_INVALIDO" },
    ]);
    expect(errores(leerPedidoDecision({ ...DECISION, decididaPorId: "otro" }))).toEqual([{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]);
    expect(errores(leerPedidoDecision({ ...DECISION, instrumentoId: "" }))).toEqual([{ campo: "instrumentoId", codigo: "ID_INVALIDO" }]);
    expect(errores(leerPedidoDecision({ ...DECISION, motivo: "x".repeat(MAX_TEXTO + 1) }))).toEqual([{ campo: "motivo", codigo: "DEMASIADO_LARGO" }]);
    expect(errores(leerPedidoDecision({ ...DECISION, cantidad: "-4" }))).toEqual([{ campo: "cantidad", codigo: "CANTIDAD_NO_RECONOCIDA" }]);
    expect(errores(leerPedidoDecision({ ...DECISION, accion: null }))).toEqual([{ campo: "accion", codigo: "FORMATO_INVALIDO" }]);
  });
});

describe("leerPedidoEnlace", () => {
  it("solo la decisión y la orden, con la forma de los ids de la base", () => {
    expect(leerPedidoEnlace({ decisionId: "decision-ficticia-2", ordenId: "orden-ficticia-9" })).toEqual({ ok: true, valor: { decisionId: "decision-ficticia-2", ordenId: "orden-ficticia-9" } });
    expect(errores(leerPedidoEnlace({ decisionId: "decision-ficticia-2", ordenId: "orden-ficticia-9", motivo: "cambiar" }))).toEqual([{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]);
    expect(errores(leerPedidoEnlace({ decisionId: "D'1", ordenId: null }))).toEqual([
      { campo: "decisionId", codigo: "ID_INVALIDO" },
      { campo: "ordenId", codigo: "ID_INVALIDO" },
    ]);
  });
});
