// Configuración del segundo ciclo del servicio de precios (precios intradía): variables de entorno con valores por
// omisión. Lo inválido cae al valor por omisión y avisa SIN repetir lo que llegó; el interruptor, ante la duda, apaga.
import { describe, expect, it } from "vitest";
import { HOSTS_YAHOO_INTRADIA } from "@/precios/intradia/url";
import { CONFIG_INTRADIA_POR_OMISION, leerConfigIntradia } from "@/servicio-precios/intradia-configuracion";

describe("leerConfigIntradia", () => {
  it("sin variables: APAGADO, un ciclo por minuto, 09:30 a 16:25 COT, 60 días de retención y Yahoo por omisión", () => {
    const c = leerConfigIntradia({});
    expect(c).toEqual({ ...CONFIG_INTRADIA_POR_OMISION, avisos: [] });
    expect(c).toMatchObject({ encendido: false, cicloMs: 60_000, desdeMin: 9 * 60 + 30, hastaMin: 16 * 60 + 25, pausaMs: 500, retencionDias: 60 });
    expect(c.urlYahoo).toBe("https://query1.finance.yahoo.com");
  });

  it("apagado por omisión: sin la variable o vacía, el ciclo queda APAGADO y sin aviso", () => {
    expect(CONFIG_INTRADIA_POR_OMISION.encendido).toBe(false);
    for (const env of [{}, { INV_INTRADIA_ENCENDIDO: "" }, { INV_INTRADIA_ENCENDIDO: "  " }, { INV_INTRADIA_ENCENDIDO: undefined }]) {
      const c = leerConfigIntradia(env);
      expect(c.encendido, JSON.stringify(env)).toBe(false);
      expect(c.avisos, JSON.stringify(env)).toEqual([]);
    }
  });

  it.each([
    ["1", true],
    ["true", true],
    [" TRUE ", true],
    ["0", false],
    ["false", false],
    [" 0 ", false],
  ])("INV_INTRADIA_ENCENDIDO=%j → %s", (valor, esperado) => {
    expect(leerConfigIntradia({ INV_INTRADIA_ENCENDIDO: valor }).encendido).toBe(esperado);
  });

  it("un valor raro del interruptor APAGA (falla cerrada) y avisa sin repetir el valor", () => {
    const c = leerConfigIntradia({ INV_INTRADIA_ENCENDIDO: "tal vez-secreto" });
    expect(c.encendido).toBe(false);
    expect(c.avisos).toHaveLength(1);
    expect(c.avisos.join(" ")).not.toContain("secreto");
  });

  it("segundos entre ciclos: de 30 a 3600; fuera de rango o no entero, vuelve a 60 y avisa", () => {
    expect(leerConfigIntradia({ INV_INTRADIA_CICLO_SEG: "120" }).cicloMs).toBe(120_000);
    expect(leerConfigIntradia({ INV_INTRADIA_CICLO_SEG: "30" }).cicloMs).toBe(30_000);
    for (const malo of ["29", "3601", "1.5", "abc", "", "-60", "60s"]) {
      const c = leerConfigIntradia({ INV_INTRADIA_CICLO_SEG: malo });
      expect(c.cicloMs).toBe(60_000);
      expect(c.avisos).toHaveLength(malo === "" ? 0 : 1);
    }
  });

  it("la ventana, en HH:MM de Colombia: desde antes de hasta y hasta antes de las 17:30 (nunca cruza la corrida de las 18:00)", () => {
    expect(leerConfigIntradia({ INV_INTRADIA_DESDE_COT: "08:25", INV_INTRADIA_HASTA_COT: "15:25" })).toMatchObject({ desdeMin: 8 * 60 + 25, hastaMin: 15 * 60 + 25 });
    for (const [desde, hasta] of [["16:00", "09:30"], ["09:30", "09:30"], ["09:30", "17:31"], ["25:00", "16:00"], ["9:30", "16:00"], ["09:30", "16:60"]]) {
      const c = leerConfigIntradia({ INV_INTRADIA_DESDE_COT: desde, INV_INTRADIA_HASTA_COT: hasta });
      expect(c.desdeMin).toBe(CONFIG_INTRADIA_POR_OMISION.desdeMin);
      expect(c.hastaMin).toBe(CONFIG_INTRADIA_POR_OMISION.hastaMin);
      expect(c.avisos.length).toBeGreaterThan(0);
    }
    expect(leerConfigIntradia({ INV_INTRADIA_HASTA_COT: "17:30" }).hastaMin).toBe(17 * 60 + 30);
  });

  it("pausa entre pedidos de 0 a 5000 ms; retención de 60 a 365 días (la base no deja borrar lo más joven que 60)", () => {
    expect(leerConfigIntradia({ INV_INTRADIA_PAUSA_MS: "0" }).pausaMs).toBe(0);
    expect(leerConfigIntradia({ INV_INTRADIA_PAUSA_MS: "5000" }).pausaMs).toBe(5000);
    expect(leerConfigIntradia({ INV_INTRADIA_PAUSA_MS: "5001" }).pausaMs).toBe(500);
    expect(leerConfigIntradia({ INV_INTRADIA_RETENCION_DIAS: "90" }).retencionDias).toBe(90);
    expect(leerConfigIntradia({ INV_INTRADIA_RETENCION_DIAS: "59" }).retencionDias).toBe(60);
    expect(leerConfigIntradia({ INV_INTRADIA_RETENCION_DIAS: "366" }).retencionDias).toBe(60);
  });

  it("el host de Yahoo se elige con INV_INTRADIA_HOST_YAHOO entre dos fijos (query1 por omisión), sin URL libre", () => {
    expect(HOSTS_YAHOO_INTRADIA).toEqual({ query1: "query1.finance.yahoo.com", query2: "query2.finance.yahoo.com" });
    expect(Object.isFrozen(HOSTS_YAHOO_INTRADIA)).toBe(true);
    for (const env of [{}, { INV_INTRADIA_HOST_YAHOO: "" }, { INV_INTRADIA_HOST_YAHOO: "query1" }, { INV_INTRADIA_HOST_YAHOO: " query1 " }]) {
      const c = leerConfigIntradia(env);
      expect(c.urlYahoo, JSON.stringify(env)).toBe("https://query1.finance.yahoo.com");
      expect(c.avisos, JSON.stringify(env)).toEqual([]);
    }
    const c2 = leerConfigIntradia({ INV_INTRADIA_HOST_YAHOO: "query2" });
    expect(c2.urlYahoo).toBe("https://query2.finance.yahoo.com");
    expect(c2.avisos).toEqual([]);
  });

  it("cualquier otro valor del selector da INTRADIA_URL_INVALIDA, cae a query1 y avisa sin repetir el valor", () => {
    const ip = (...o: number[]): string => o.join(".");
    for (const malo of ["query3", "QUERY2", "https://query2.finance.yahoo.com", "query2.finance.yahoo.com", "https://yahoo.ficticio.invalid", "yahoo.ficticio.invalid", "query1;query2", "1", `https://${ip(11, 37, 91, 47)}`, "https://[::1]", "localhost"]) {
      const c = leerConfigIntradia({ INV_INTRADIA_HOST_YAHOO: malo });
      expect(c.urlYahoo, malo).toBe("https://query1.finance.yahoo.com");
      expect(c.avisos, malo).toHaveLength(1);
      expect(c.avisos.join(" "), malo).toContain("INTRADIA_URL_INVALIDA");
      expect(c.avisos.join(" "), malo).not.toContain("ficticio");
    }
  });

  it("la variable vieja INV_INTRADIA_URL_YAHOO ya no hace nada (la URL libre desapareció)", () => {
    const c = leerConfigIntradia({ INV_INTRADIA_URL_YAHOO: "https://yahoo.ficticio.invalid" });
    expect(c.urlYahoo).toBe("https://query1.finance.yahoo.com");
    expect(c.avisos).toEqual([]);
  });

  it("frecuencia: 60 s es la omisión; 29 y 3601 caen a 60 con aviso (el rango válido es de 30 a 3600)", () => {
    expect(CONFIG_INTRADIA_POR_OMISION.cicloMs).toBe(60_000);
    expect(leerConfigIntradia({}).cicloMs).toBe(60_000);
    for (const malo of ["29", "3601"]) {
      const c = leerConfigIntradia({ INV_INTRADIA_CICLO_SEG: malo });
      expect(c.cicloMs, malo).toBe(60_000);
      expect(c.avisos, malo).toHaveLength(1);
    }
    expect(leerConfigIntradia({ INV_INTRADIA_CICLO_SEG: "3600" }).cicloMs).toBe(3_600_000);
  });
});
