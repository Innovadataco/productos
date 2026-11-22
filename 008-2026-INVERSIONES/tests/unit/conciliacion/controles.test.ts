/**
 * Reglas de la conciliación por fecha de corte (GATE 1 aprobada), cálculo puro:
 * - CANTIDAD por especie: lo liquidado al corte contra la certificación, diferencia 0; si cuadra con lo operado
 *   (T+2 por liquidar), PENDIENTE_LIQUIDACION «t_mas_2»;
 * - VALOR por especie y total: cantidad del sistema × cierre del día exacto del corte, ±0,5 % del certificado;
 * - FONDO: unidades del sistema × valor de unidad del corte, ±0,5 %; sin unidades, «fondo_sin_unidades»;
 * - EFECTIVO: ±1 COP absoluto (libro de caja); si no, el porqué y la cifra sin explicar.
 * Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { calcularConciliacion, TOLERANCIA_EFECTIVO_COP, TOLERANCIA_VALOR, VERSION_CALCULO, type EntradasConciliacion } from "@/conciliacion/controles";

const especie = (id: string, c: Partial<EntradasConciliacion["especies"][number]> = {}): EntradasConciliacion["especies"][number] => ({
  instrumentoId: id, certificada: { cantidad: 100n, precioValoracion: "10", valorMercado: "1000" }, liquidada: 100n, operada: 100n, pendientes: 0, cierre: "10", cierreAnterior: null, escisionSinLote: false, ...c,
});

const base = (cambios: Partial<EntradasConciliacion> = {}): EntradasConciliacion => ({
  especies: [especie("A"), especie("B", { certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, cierre: "50" })],
  fondos: [{ instrumentoId: "F", saldoCertificado: "5000", unidades: "100", valorUnidad: "50" }],
  efectivo: { certificado: "300", liquidado: "300", operado: "300", hayFondo: true, aporteFondoRegistrado: true },
  diaAnterior: null,
  ...cambios,
});

const de = (r: ReturnType<typeof calcularConciliacion>, tipo: string, id: string | null = null) => r.controles.filter((c) => c.tipo === tipo && c.instrumentoId === id);
const uno = (r: ReturnType<typeof calcularConciliacion>, tipo: string, id: string | null = null) => {
  const lista = de(r, tipo, id);
  expect(lista).toHaveLength(1);
  return lista[0]!;
};

describe("calcularConciliacion: todo cuadra", () => {
  it("cantidad, valor por especie y total, fondo y efectivo cuadran → CUADRA, con versión y tolerancias", () => {
    const r = calcularConciliacion(base());
    expect(r.resultado).toBe("CUADRA");
    expect(r.controles.every((c) => c.resultado === "CUADRA" && c.codigoMotivo === null)).toBe(true);
    expect(uno(r, "CANTIDAD", "A")).toMatchObject({ esperado: "100", real: "100", diferencia: "0", tolerancia: "0" });
    expect(uno(r, "VALOR", "A")).toMatchObject({ esperado: "1000", real: "1000", diferencia: "0", tolerancia: TOLERANCIA_VALOR });
    expect(uno(r, "VALOR")).toMatchObject({ esperado: "2000", real: "2000", detalle: { alcance: "total_acciones" } });
    expect(uno(r, "FONDO", "F")).toMatchObject({ esperado: "5000", real: "5000" });
    expect(uno(r, "EFECTIVO")).toMatchObject({ esperado: "300", real: "300", tolerancia: TOLERANCIA_EFECTIVO_COP });
    // v2 (frente certificacion-corte-real): fecha_corte_dudosa también por el día hábil anterior, con fechaSugerida.
    expect([VERSION_CALCULO, TOLERANCIA_VALOR, TOLERANCIA_EFECTIVO_COP]).toEqual(["conciliacion-v2", "0.005", "1"]);
  });
});

describe("CANTIDAD por especie", () => {
  it("diferencia 0 exigida: una acción de más no cuadra", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { liquidada: 99n, operada: 99n })] }));
    expect(uno(r, "CANTIDAD", "A")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "diferencia_cantidad", esperado: "99", real: "100", diferencia: "1" });
    expect(r.resultado).toBe("NO_CUADRA");
  });

  it("si la certificación cuadra con lo operado (no con lo liquidado): cantidad y valor PENDIENTE_LIQUIDACION t_mas_2 y el global PARCIAL (code-reviewer ALTO)", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { liquidada: 80n, operada: 100n, pendientes: 1 }), especie("B", { certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, cierre: "50" })] }));
    expect(uno(r, "CANTIDAD", "A")).toMatchObject({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", detalle: { pendientes: 1, operada: "100" } });
    expect(uno(r, "VALOR", "A")).toMatchObject({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", esperado: "1000", real: "1000" });
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2", esperado: "2000" });
    expect(r.resultado).toBe("PARCIAL");
  });

  it("con T+2 en la cantidad pero el precio fuera del 0,5 %: el valor dice precio_distinto (se valora con lo operado)", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { liquidada: 80n, operada: 100n, pendientes: 1, cierre: "12" })] }));
    expect(uno(r, "VALOR", "A")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "precio_distinto", esperado: "1200" });
  });

  it("solo con T+2 pendiente (y el resto cuadra) el global es PARCIAL", () => {
    const r = calcularConciliacion(base({ efectivo: { certificado: "300", liquidado: "200", operado: "300", hayFondo: true, aporteFondoRegistrado: true } }));
    expect(uno(r, "EFECTIVO")).toMatchObject({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2" });
    expect(r.resultado).toBe("PARCIAL");
  });

  it("una especie del sistema que no está en la certificación: no_certificada", () => {
    const r = calcularConciliacion(base({ especies: [especie("A"), especie("Z", { certificada: null, liquidada: 5n, operada: 5n })] }));
    expect(uno(r, "CANTIDAD", "Z")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "no_certificada", esperado: "5", real: "0", diferencia: "-5" });
    expect(de(r, "VALOR", "Z")).toHaveLength(0);
  });

  it("una especie certificada sin operaciones en el sistema; o destino de una escisión sin su lote", () => {
    const sinNada = calcularConciliacion(base({ especies: [especie("A", { liquidada: 0n, operada: 0n })] }));
    expect(uno(sinNada, "CANTIDAD", "A").codigoMotivo).toBe("sin_operaciones_en_sistema");
    const escision = calcularConciliacion(base({ especies: [especie("A", { liquidada: 0n, operada: 0n, escisionSinLote: true })] }));
    expect(uno(escision, "CANTIDAD", "A").codigoMotivo).toBe("escision_sin_lote");
  });
});

describe("VALOR por especie y total (±0,5 % del certificado)", () => {
  it("en el borde del 0,5 % cuadra; un centavo más allá no", () => {
    const borde = calcularConciliacion(base({ especies: [especie("A", { cierre: "10.05" })] }));
    expect(uno(borde, "VALOR", "A")).toMatchObject({ resultado: "CUADRA", esperado: "1005", diferencia: "-5" });
    const fuera = calcularConciliacion(base({ especies: [especie("A", { cierre: "10.0501" })] }));
    expect(uno(fuera, "VALOR", "A")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "precio_distinto", detalle: { cierre: "10.0501", precioValoracion: "10" } });
  });

  it("sin cierre del día exacto del corte: sin_precio_al_corte (nunca el día anterior), también en el total", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { cierre: null }), especie("B")] }));
    expect(uno(r, "VALOR", "A")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", esperado: null, diferencia: null });
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "sin_precio_al_corte", esperado: null });
  });

  it("si todas las especies (2 o más) difieren en precio, el total dice fecha_corte_dudosa", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { cierre: "11" }), especie("B", { cierre: "12" })] }));
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "fecha_corte_dudosa" });
  });

  it("la regla de siempre (todas difieren del corte) sin cierres del día anterior: fecha_corte_dudosa sin fecha sugerida", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { cierre: "11" }), especie("B", { cierre: "12" })], diaAnterior: "2027-08-31" }));
    expect(uno(r, "VALOR")).toMatchObject({ codigoMotivo: "fecha_corte_dudosa", detalle: { alcance: "total_acciones" } });
    expect(uno(r, "VALOR").detalle).not.toHaveProperty("fechaSugerida");
  });

  // El caso del defecto, con cifras inventadas: 9 especies valoradas EXACTO al cierre del día hábil anterior; 2 tienen
  // el mismo cierre los dos días (por eso «todas difieren» no se cumplía y el total decía por_especies).
  it("todas cuadran con el día hábil anterior y alguna también con el corte: fecha_corte_dudosa con la fecha sugerida", () => {
    const valoraciones = ["2371", "63.17", "418.9", "1237", "46.13", "7913.6", "381.47", "29.11", "5023.7"];
    const especies = valoraciones.map((pv, i) => {
      const cierre = i < 2 ? pv : (Number(pv) * 1.0347).toFixed(2);
      return especie(`E${i}`, { certificada: { cantidad: 37n, precioValoracion: pv, valorMercado: (Number(pv) * 37).toFixed(4) }, liquidada: 37n, operada: 37n, cierre, cierreAnterior: pv });
    });
    const r = calcularConciliacion(base({ especies, diaAnterior: "2027-09-01" }));
    expect(de(r, "VALOR").length).toBe(1);
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "fecha_corte_dudosa", detalle: { alcance: "total_acciones", fechaSugerida: "2027-09-01" } });
    expect(r.controles.filter((c) => c.codigoMotivo === "precio_distinto")).toHaveLength(7);
  });

  it("la regla de siempre y la nueva a la vez: fecha_corte_dudosa con la fecha sugerida", () => {
    const especies = [especie("A", { cierre: "10.41", cierreAnterior: "10" }), especie("B", { certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, cierre: "52.37", cierreAnterior: "50.13" })];
    const r = calcularConciliacion(base({ especies, diaAnterior: "2027-09-01" }));
    expect(uno(r, "VALOR")).toMatchObject({ codigoMotivo: "fecha_corte_dudosa", detalle: { alcance: "total_acciones", fechaSugerida: "2027-09-01" } });
  });

  it("si el total cuadra, los cierres del día anterior no cambian nada", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { cierreAnterior: "9.37" }), especie("B", { certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, cierre: "50", cierreAnterior: "50" })], diaAnterior: "2027-09-01" }));
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "CUADRA", codigoMotivo: null, detalle: { alcance: "total_acciones" } });
  });

  it("sin el día anterior (año sin calendario) la regla nueva no concluye: por_especies", () => {
    const especies = [especie("A", { cierre: "10.41", cierreAnterior: "10" }), especie("B", { certificada: { cantidad: 20n, precioValoracion: "50", valorMercado: "1000" }, liquidada: 20n, operada: 20n, cierre: "50", cierreAnterior: "50" })];
    expect(uno(calcularConciliacion(base({ especies, diaAnterior: null })), "VALOR")).toMatchObject({ codigoMotivo: "por_especies" });
    expect(uno(calcularConciliacion(base({ especies, diaAnterior: "2027-09-01" })), "VALOR")).toMatchObject({ codigoMotivo: "fecha_corte_dudosa", detalle: { fechaSugerida: "2027-09-01" } });
  });

  it("si una especie no cuadra y las demás sí, el total puede cuadrar o decir por_especies", () => {
    const r = calcularConciliacion(base({ especies: [especie("A", { cierre: "11" }), especie("B")] }));
    expect(uno(r, "VALOR")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "por_especies" });
  });

  it("un valor certificado en 0 solo cuadra con 0", () => {
    const cero = { cantidad: 100n, precioValoracion: "0", valorMercado: "0" };
    expect(uno(calcularConciliacion(base({ especies: [especie("A", { certificada: cero, cierre: "0.001" })] })), "VALOR", "A").resultado).toBe("NO_CUADRA");
  });
});

describe("FONDO", () => {
  it("sin unidades en el sistema: NO_CUADRA fondo_sin_unidades (se muestra «no se pudo verificar»)", () => {
    const r = calcularConciliacion(base({ fondos: [{ instrumentoId: "F", saldoCertificado: "5000", unidades: null, valorUnidad: "50" }] }));
    expect(uno(r, "FONDO", "F")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "fondo_sin_unidades", esperado: null, real: "5000" });
  });

  it("sin valor de unidad del día del corte: sin_valor_unidad_al_corte; fuera del 0,5 %: diferencia_fondo", () => {
    expect(uno(calcularConciliacion(base({ fondos: [{ instrumentoId: "F", saldoCertificado: "5000", unidades: "100", valorUnidad: null }] })), "FONDO", "F").codigoMotivo).toBe("sin_valor_unidad_al_corte");
    expect(uno(calcularConciliacion(base({ fondos: [{ instrumentoId: "F", saldoCertificado: "5000", unidades: "100", valorUnidad: "51" }] })), "FONDO", "F").codigoMotivo).toBe("diferencia_fondo");
  });
});

describe("EFECTIVO (±1 COP)", () => {
  const efectivo = (certificado: string, liquidado: string, operado = liquidado, hayFondo = true, aporteFondoRegistrado = true) =>
    uno(calcularConciliacion(base({ efectivo: { certificado, liquidado, operado, hayFondo, aporteFondoRegistrado } })), "EFECTIVO");

  it("un peso de redondeo cuadra; uno y un centavo no", () => {
    expect(efectivo("300", "299").resultado).toBe("CUADRA");
    expect(efectivo("300", "298.99")).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "partida_sin_fuente", detalle: { sinExplicar: "1.01" } });
  });

  it("con fondo y sin el aporte registrado en caja: aporte_fic_sin_registrar, con la cifra sin explicar", () => {
    expect(efectivo("300", "5300", "5300", true, false)).toMatchObject({ resultado: "NO_CUADRA", codigoMotivo: "aporte_fic_sin_registrar", diferencia: "-5000", detalle: { sinExplicar: "-5000" } });
  });
});
