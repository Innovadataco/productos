// Los supuestos en texto llano y el aviso fijo: ventana, días por especie, método y reglas aplicadas. Candado: ningún
// texto recomienda comprar, vender ni mantener. El resultado es JSON puro. Puro.
import { describe, expect, it } from "vitest";
import { calcularProyeccion } from "@/proyecciones/calcular";
import { BLOQUE, MINIMO_DIAS } from "@/proyecciones/metodo";
import { textoAviso } from "@/proyecciones/supuestos";
import { AVISO, CODIGOS_AVISO, type EntradasProyeccion, type ParametrosProyeccion, type ResultadoProyeccion } from "@/proyecciones/tipos";
import { accion, dia, diasHabiles, entradas, fondo, iso, serieGeometrica, valoresDiarios } from "./ficticio";

const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 6, aportePeriodico: 371.53, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 12.7, trayectorias: 211, semilla: 4613, ...cambios,
});

const dias = diasHabiles("2019-01-02", 300);

/** Una entrada que dispara TODOS los avisos. */
function entradaConTodo(): EntradasProyeccion {
  const evento = dias[200]!;
  const caida = serieGeometrica(dias, 1237.4, 1.0003).map((c, j) => ({ ...c, precio: c.precio * (j >= 200 ? 0.3 : 1) * (j >= 100 ? 0.4 : 1) }));
  const conTodo = accion("o", 311, caida, {
    movimientos: [{ fecha: dia("2019-01-08"), cantidad: 311n }, { fecha: dia("2019-07-05"), cantidad: 5n }, { fecha: dia("2019-09-09"), cantidad: 7n }],
    dividendos: [
      { fechaPago: dia("2019-01-04"), montoNeto: 41.37, decretadoId: null },
      // Antes de la ex de su decreto (d3): DIVIDENDO_DECRETO_EN_DUDA.
      { fechaPago: dia("2019-05-13"), montoNeto: 37.91, decretadoId: null },
      // Junta dos decretos con ex distintas (d4 y d5) y la tenencia cambió entre ellas: DIVIDENDO_EX_DISTINTAS.
      { fechaPago: dia("2019-07-18"), montoNeto: 47.93, decretadoId: null },
      { fechaPago: dia("2019-09-11"), montoNeto: 43.11, decretadoId: null },
    ],
    decretos: [
      { id: "d1", fechaEx: dia("2019-10-02"), fechaPago: dia("2019-10-09"), valorPorAccion: 3.47, recibido: false },
      { id: "d2", fechaEx: dia("2027-04-07"), fechaPago: dia("2027-04-14"), valorPorAccion: 3.13, recibido: false },
      { id: "d3", fechaEx: dia("2019-05-14"), fechaPago: dia("2019-05-15"), valorPorAccion: 1.13, recibido: false },
      { id: "d4", fechaEx: dia("2019-07-03"), fechaPago: dia("2019-07-17"), valorPorAccion: 2.71, recibido: false },
      { id: "d5", fechaEx: dia("2019-07-10"), fechaPago: dia("2019-07-17"), valorPorAccion: 0.97, recibido: false },
    ],
  });
  const otra = accion("p", 13, serieGeometrica(dias, 905.6, 1.0001));
  return entradas(
    [
      conTodo, otra, accion("q", 5, serieGeometrica(dias, 77.31, 1.0002)), accion("u", 5, [{ dia: dias[3]!, precio: 811.3 }]), accion("v", 5, []), fondo("g", 31.7, []),
      accion("s", 3, serieGeometrica(diasHabiles("2018-01-02", 260), 413.9, 1.0001)), // 260 en total, 0 en la ventana
    ],
    {
      escisiones: [
        { origenId: "o", destinoId: "d", fecha: evento, razon: null },
        { origenId: "p", destinoId: "d", fecha: dias[150]!, razon: 0.5 },
        { origenId: "q", destinoId: "e", fecha: dias[170]!, razon: 0.2 },
        { origenId: "e", destinoId: "z", fecha: dias[170]!, razon: 0.2 },
      ],
      cierresDestino: { d: serieGeometrica(dias.slice(160), 41.9, 1), e: serieGeometrica(dias, 11.3, 1), z: serieGeometrica(dias, 3.1, 1) },
      noHabiles: [dia("2020-06-17")],
      incompletas: ["ZQX"],
    },
  );
}

const IMPERATIVOS = /\b(compr|vend|manten|conviene|deber[ií]a|aprovech|recomendamos|le sugerimos)/i;
const textos = (r: ResultadoProyeccion) => [r.aviso, ...r.supuestos.textos, ...r.supuestos.avisos.map((a) => a.texto)];

describe("supuestos", () => {
  it("la entrada de prueba dispara todos los avisos", () => {
    const r = calcularProyeccion(entradaConTodo(), P());
    const vistos = new Set(r.supuestos.avisos.map((a) => a.codigo));
    expect(CODIGOS_AVISO.filter((c) => !vistos.has(c) && c !== "SIN_POSICIONES_PROYECTADAS" && c !== "SIN_POSICIONES_VALORADAS")).toEqual([]);
    // Los de la regla de la fecha ex (los pide aparte: la lista de arriba solo ve los códigos que existen).
    expect([...vistos]).toEqual(expect.arrayContaining(["DIVIDENDO_DECRETO_EN_DUDA", "DIVIDENDO_EX_DISTINTAS", "DIVIDENDO_SIN_TENENCIA", "DIVIDENDO_TENENCIA_CAMBIA"]));
  });

  it("los textos de los dividendos dicen qué tenencia se buscó: la de antes de la ex con decreto, la del pago sin él", () => {
    const texto = (codigo: (typeof CODIGOS_AVISO)[number]) => textoAviso({ codigo, instrumentoId: "x", nombre: "XQZ", dia: "2019-03-05", dato: null });
    expect(texto("DIVIDENDO_TENENCIA_CAMBIA")).toContain("sin decreto");
    expect(texto("DIVIDENDO_SIN_TENENCIA")).toContain("fecha ex");
    expect(texto("DIVIDENDO_DECRETO_EN_DUDA")).toContain("fecha ex");
    expect(texto("DIVIDENDO_DECRETO_EN_DUDA")).toContain("dos fechas de pago");
    expect(texto("DIVIDENDO_EX_DISTINTAS")).toContain("fechas ex distintas");
  });

  it("cada código de aviso tiene su texto", () => {
    for (const codigo of CODIGOS_AVISO) {
      expect(textoAviso({ codigo, instrumentoId: "x", nombre: "XQZ", dia: "2019-03-05", dato: 2019 }).length).toBeGreaterThan(10);
    }
  });

  it("dicen la ventana, los días por especie, el método, el bloque, el mínimo y la semilla", () => {
    const r = calcularProyeccion(entradaConTodo(), P());
    const todo = r.supuestos.textos.join("\n");
    expect(todo).toContain(`${iso(dias[0]!)} al ${iso(dias.at(-1)!)}`);
    expect(todo).toContain(`bloques de ${BLOQUE} ruedas`);
    expect(todo).toContain(`${MINIMO_DIAS} días`);
    expect(todo).toContain("semilla 4613");
    expect(todo).toContain("P: 300 días con cierre en la ventana");
    expect(todo).toContain("U: 1 día con cierre");
    expect(todo).toContain("S: 0 días con cierre en la ventana (260 en total)");
    expect(r.supuestos.avisos.find((x) => x.codigo === "HISTORIA_CORTA_EN_VENTANA")!.texto).toContain("solo 0 días con cierre en la ventana común");
    expect(todo).toMatch(/caída inicial de 12,7 %/i);
    expect(todo).toMatch(/no incluye el efectivo/);
    expect(r.supuestos).toMatchObject({ bloque: BLOQUE, minimoDias: MINIMO_DIAS, decretosFuturos: 1 });
  });

  it("candado: ningún texto recomienda comprar, vender ni mantener (también sin aportes y reinvirtiendo)", () => {
    for (const p of [P(), P({ aportePeriodico: 0, reinvertirDividendos: true, caidaInicialPct: 0 })]) {
      for (const t of textos(calcularProyeccion(entradaConTodo(), p))) expect(t).not.toMatch(IMPERATIVOS);
    }
    for (const t of textos(calcularProyeccion(entradas([accion("v", 5, [])]), P()))) expect(t).not.toMatch(IMPERATIVOS);
    expect(AVISO).not.toMatch(IMPERATIVOS);
  });

  it("el resultado es JSON puro: sin Date, BigInt, Map ni números no finitos", () => {
    const r = calcularProyeccion(entradaConTodo(), P());
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    const numeros: number[] = [];
    const recorrer = (x: unknown): void => {
      if (typeof x === "number") numeros.push(x);
      else if (Array.isArray(x)) x.forEach(recorrer);
      else if (x && typeof x === "object") {
        expect(Object.getPrototypeOf(x)).toBe(Object.prototype);
        Object.values(x).forEach(recorrer);
      } else expect(["string", "boolean"].includes(typeof x) || x === null).toBe(true);
    };
    recorrer(r);
    expect(numeros.every(Number.isFinite)).toBe(true);
  });

  it("con un fondo y sin acciones también lo dice", () => {
    const r = calcularProyeccion(entradas([fondo("f", 1499.927, valoresDiarios("2019-01-01", 400, 12_731.4419, 1.0002))]), P());
    expect(r.supuestos.textos.join("\n")).toContain("Fondo f: 2");
  });
});
