// La vista que viaja al navegador (frente proyecciones-pantalla; plan, corrección 8): solo lo que la pantalla pinta.
// Los puntos y los indicadores, los cinco controles (sin trayectorias ni semilla), los textos de los supuestos y los
// avisos con su texto; NO los valores ni los pesos por posición. Cifras en pesos enteros. Inventado.
import { describe, expect, it } from "vitest";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { resultadoFicticio } from "./ficticio";

describe("aVistaProyeccion", () => {
  const r = resultadoFicticio();
  const v = aVistaProyeccion(r);

  it("lleva la fecha, el valor de hoy, la versión del método y los cinco controles", () => {
    expect(v.hoy).toBe("2027-03-17");
    expect(v.valorHoy).toBe(46137);
    expect(v.versionMetodo).toBe("bootstrap-circular-v1");
    expect(v.controles).toEqual({ horizonteMeses: 12, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 });
  });

  it("un punto por mes, con las cinco bandas y lo aportado en pesos enteros", () => {
    expect(v.puntos).toHaveLength(13);
    expect(v.puntos[0]).toEqual({ mes: 0, p5: 46137, p25: 46137, p50: 46137, p75: 46137, p95: 46137, aportado: 46137 });
    const p = r.puntos[12]!;
    expect(v.puntos[12]).toEqual({ mes: 12, p5: Math.round(p.p5), p25: Math.round(p.p25), p50: Math.round(p.p50), p75: Math.round(p.p75), p95: Math.round(p.p95), aportado: Math.round(p.aportado) });
  });

  it("los indicadores salen del último mes y del resumen del motor", () => {
    const fin = r.puntos.at(-1)!;
    expect(v.final).toEqual({ p5: Math.round(fin.p5), p50: Math.round(fin.p50), p95: Math.round(fin.p95), aportado: Math.round(fin.aportado) });
    expect(v.probabilidadBajoAportado).toBe(0.1373);
    expect(v.caidaMaximaMediana).toBe(0.0917);
  });

  it("los supuestos en texto llano y los avisos con su código y su texto", () => {
    expect(v.textos).toEqual(r.supuestos.textos);
    expect(v.avisos).toEqual([{ codigo: "HISTORIA_CORTA", texto: r.supuestos.avisos[0]!.texto }]);
  });

  it("no viajan los valores ni los pesos por posición, ni las trayectorias ni la semilla", () => {
    const json = JSON.stringify(v);
    expect(json).not.toContain("31337");
    expect(json).not.toContain("0.6791");
    expect(json).not.toContain("instrumentoId");
    expect(json).not.toContain("trayectorias");
    expect(json).not.toContain("semilla");
    expect(json).not.toContain("46133");
  });
});
