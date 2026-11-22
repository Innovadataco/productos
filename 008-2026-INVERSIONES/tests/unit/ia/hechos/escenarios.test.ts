/**
 * Armador ESCENARIOS: de un ResultadoProyeccion con los parámetros fijos (horizonte de doce meses), P5, P50 y P95 a tres,
 * seis y doce meses, lo aportado, la probabilidad de quedar bajo lo aportado, la caída máxima, la volatilidad, el
 * rendimiento histórico, la ventana y los días de historia de las especies fijas por historia corta. El AVISO lo pone el
 * código del render (E2): no es un hecho. Puro: `hoy` entra como parámetro.
 */
import { describe, expect, it } from "vitest";
import { armarEscenarios, HORIZONTES_ESCENARIOS, type EntradaArmadoEscenarios } from "@/ia/hechos";
import { ErrorArmado } from "@/ia/hechos/errores";
import { presentar } from "@/ia/presentar";
import { vistaCiega } from "@/ia/vista-ciega";
import { GAMMA, HOY, entradaEscenariosFicticia, resultadoProyeccion } from "./apoyo.ficticio";

type Resultado = ReturnType<typeof resultadoProyeccion>;
const con = (cambio: (r: Resultado) => Resultado, hoy = HOY) =>
  armarEscenarios({ hoy, resultado: cambio(resultadoProyeccion()) as unknown as EntradaArmadoEscenarios["resultado"] });

describe("armarEscenarios · el paquete de la proyección", () => {
  it("los horizontes son tres, seis y doce meses (plan de la fase E)", () => {
    expect(HORIZONTES_ESCENARIOS).toEqual({ CORTO: 3, MEDIO: 6, LARGO: 12 });
    expect(Object.isFrozen(HORIZONTES_ESCENARIOS)).toBe(true);
  });

  it("arma los hechos en orden, con su calidad, su dirección frente al valor de partida y lo obligatorio", () => {
    const paquete = armarEscenarios(entradaEscenariosFicticia());
    expect(paquete.tipo).toBe("ESCENARIOS");
    expect(paquete.versionesCalculo).toEqual({ hechos: "armadores-v1", proyecciones: "bootstrap-circular-v2" });
    expect(paquete.avisos).toEqual(["HISTORIA_CORTA", "ANIO_SIN_CALENDARIO"]);
    expect(paquete.hechos.map((h) => [h.clave, h.valor, h.calidad, h.direccion, h.obligatorio])).toEqual([
      ["VALOR_INICIAL", "37911.47", "CALCULADO", "NO_APLICA", false],
      ["HORIZONTE_CORTO", "3", "CALCULADO", "NO_APLICA", true],
      ["HORIZONTE_MEDIO", "6", "CALCULADO", "NO_APLICA", true],
      ["HORIZONTE_LARGO", "12", "CALCULADO", "NO_APLICA", true],
      ["ESCENARIO_BAJO_CORTO", "33917.29", "ESTIMADO", "BAJA", false],
      ["ESCENARIO_CENTRAL_CORTO", "38411.74", "ESTIMADO", "SUBE", true],
      ["ESCENARIO_ALTO_CORTO", "43177.02", "ESTIMADO", "SUBE", false],
      ["APORTADO_CORTO", "37911.47", "CALCULADO", "NO_APLICA", false],
      ["ESCENARIO_BAJO_MEDIO", "31719.13", "ESTIMADO", "BAJA", false],
      ["ESCENARIO_CENTRAL_MEDIO", "38917.37", "ESTIMADO", "SUBE", true],
      ["ESCENARIO_ALTO_MEDIO", "46931.77", "ESTIMADO", "SUBE", false],
      ["APORTADO_MEDIO", "37911.47", "CALCULADO", "NO_APLICA", false],
      ["ESCENARIO_BAJO_LARGO", "28713.42", "ESTIMADO", "BAJA", false],
      ["ESCENARIO_CENTRAL_LARGO", "39731.19", "ESTIMADO", "SUBE", true],
      ["ESCENARIO_ALTO_LARGO", "53119.37", "ESTIMADO", "SUBE", false],
      ["APORTADO_LARGO", "37911.47", "CALCULADO", "NO_APLICA", false],
      ["PROBABILIDAD_BAJO_APORTADO", "17.346", "ESTIMADO", "NO_APLICA", true],
      ["CAIDA_MAXIMA_MEDIANA", "9.213", "ESTIMADO", "NO_APLICA", false],
      ["VOLATILIDAD_ANUAL", "23.17", "CALCULADO", "NO_APLICA", false],
      ["RENDIMIENTO_ANUAL_HISTORICO", "7.13", "CALCULADO", "SUBE", false],
      ["FRACCION_PROYECTADA", "87.31", "CALCULADO", "NO_APLICA", false],
      ["VENTANA_DESDE", "2019-06-14", "CALCULADO", "NO_APLICA", false],
      ["VENTANA_HASTA", "2027-03-16", "CALCULADO", "NO_APLICA", false],
      ["ESPECIE_NOMBRE", GAMMA, "VERIFICADO", "NO_APLICA", false],
      ["DIAS_HISTORIA_ESPECIE", "41", "CALCULADO", "NO_APLICA", false],
    ]);
    for (const h of paquete.hechos) {
      expect([h.fecha, h.frescura], h.id).toEqual([HOY, "HOY"]);
      expect(h.presentacion, h.id).toBe(presentar(h.valor, h.unidad));
    }
    expect(paquete.hechos.at(-1)?.sujeto).toBe(paquete.hechos.at(-2)?.id);
  });

  it("la vista ciega pasa la guarda y la misma entrada da el mismo hash", () => {
    const paquete = armarEscenarios(entradaEscenariosFicticia());
    expect(() => vistaCiega(paquete)).not.toThrow();
    expect(armarEscenarios(entradaEscenariosFicticia()).hash).toBe(paquete.hash);
  });

  it("sin ventana, sin rendimiento ni volatilidad (sin historia común), esos hechos no van", () => {
    const paquete = con((r) => ({ ...r, supuestos: { ...r.supuestos, ventana: null, rendimientoAnualVentana: null, volatilidadAnualVentana: null } } as unknown as Resultado));
    const claves = paquete.hechos.map((h) => h.clave);
    for (const clave of ["VENTANA_DESDE", "VENTANA_HASTA", "VOLATILIDAD_ANUAL", "RENDIMIENTO_ANUAL_HISTORICO"]) expect(claves).not.toContain(clave);
  });

  it("una caída se guarda como su magnitud, sin importar el signo con que llegue", () => {
    expect(con((r) => ({ ...r, caidaMaximaMediana: -0.09213 })).hechos.find((h) => h.clave === "CAIDA_MAXIMA_MEDIANA")?.valor).toBe("9.213");
  });

  it.each<readonly [string, (r: Resultado) => Resultado, string]>([
    ["otro horizonte", (r) => ({ ...r, parametros: { ...r.parametros, horizonteMeses: 24 } }), "HORIZONTES_INVALIDOS"],
    ["sin el punto de seis meses", (r) => ({ ...r, puntos: r.puntos.filter((p) => p.mes !== 6) }), "HORIZONTES_INVALIDOS"],
    ["un percentil que no es un número finito", (r) => ({ ...r, puntos: r.puntos.map((p) => (p.mes === 3 ? { ...p, p50: Number.NaN } : p)) }), "NUMERO_INVALIDO"],
    ["una ventana con un día que no existe", (r) => ({ ...r, supuestos: { ...r.supuestos, ventana: { ...r.supuestos.ventana, desde: "2019-02-30" } } }), "FECHA_INVALIDA"],
  ])("cierra en fallo con %s", (_caso, cambio, codigo) => {
    try {
      con(cambio);
      throw new Error("no lanzó");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorArmado);
      expect((e as ErrorArmado).codigo).toBe(codigo);
    }
  });

  it("cierra en fallo si la proyección es de otro día", () => {
    expect(() => con((r) => r, "2027-03-18")).toThrow(ErrorArmado);
    try {
      con((r) => r, "2027-03-18");
    } catch (e) {
      expect((e as ErrorArmado).codigo).toBe("HOY_DISTINTO");
    }
  });
});
