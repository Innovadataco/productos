// Textos y formatos de la sección de dividendos decretados (frente datos-oficiales-decretos-pantalla, C6b). Puros:
// - los pesos salen del TEXTO decimal, exactos (al menos 2 decimales, nunca redondeados ni truncados) y con el signo
//   delante del «$»; las acciones, con miles y su signo;
// - cada estado y cada motivo de C5b tiene su texto (Record exhaustivo: un estado o un motivo nuevo no compila sin el
//   suyo); ninguno llama «retención» a la diferencia ni recomienda nada;
// - la nota de la ventana sale de las constantes de ventana.ts.
import { describe, expect, it } from "vitest";
import { ESTADOS_CRUCE, MOTIVOS_REVISAR } from "@/datos-oficiales/decretos/cruce";
import { VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "@/datos-oficiales/decretos/ventana";
import {
  EXPLICACION_ESTADO, NOTA_BRUTO, NOTA_DIFERENCIA, TEXTO_ESTADO_CRUCE, TEXTO_MOTIVO, TEXTO_TIPO, acciones, notaVentana, pesos, sinTenencia, tipoYCuota,
} from "@/app/datos-oficiales/formato-decretos";

describe("pesos", () => {
  it.each([
    ["5308.871247", "$ 5.308,871247"],
    ["4613.27", "$ 4.613,27"],
    ["1200", "$ 1.200,00"],
    ["41.37", "$ 41,37"],
    ["13.7", "$ 13,70"],
    ["0", "$ 0,00"],
    ["0.000001", "$ 0,000001"],
    ["-137.1", "−$ 137,10"],
    ["-0.37", "−$ 0,37"],
    ["123456789012345678.123456", "$ 123.456.789.012.345.678,123456"],
  ])("%s → %s (exacto, sin redondeo)", (valor, esperado) => {
    expect(pesos(valor)).toBe(esperado);
  });

  it("sin dato o con un texto que no es decimal: «—»", () => {
    expect(pesos(null)).toBe("—");
    for (const malo of ["", "abc", "1e5", "1,5", " 1", "NaN"]) expect(pesos(malo), malo).toBe("—");
  });
});

describe("acciones", () => {
  it.each([
    ["1237", "1.237 acciones"], ["97", "97 acciones"], ["0", "0 acciones"], ["1", "1 acción"], ["-1", "−1 acción"], ["-10", "−10 acciones"],
    ["1152921504606846976", "1.152.921.504.606.846.976 acciones"],
  ])("%s → %s", (t, esperado) => {
    expect(acciones(t)).toBe(esperado);
  });

  it("un texto que no es entero: «—»", () => {
    for (const malo of ["", "1.5", "abc"]) expect(acciones(malo), malo).toBe("—");
  });
});

describe("textos de tipo, estado y motivo", () => {
  it("tipo y cuota", () => {
    expect(tipoYCuota("ORDINARIO", 2)).toBe("Ordinario · cuota 2");
    expect(tipoYCuota("EXTRAORDINARIO", 1)).toBe("Extraordinario · cuota 1");
    expect(Object.keys(TEXTO_TIPO).sort()).toEqual(["EXTRAORDINARIO", "FRACCION_ESCISION", "ORDINARIO"]);
  });

  it("cada estado de C5b tiene su texto y, menos REVISAR (que dice sus motivos), su explicación", () => {
    expect(Object.keys(TEXTO_ESTADO_CRUCE).sort()).toEqual([...ESTADOS_CRUCE].sort());
    expect(TEXTO_ESTADO_CRUCE).toEqual({ RECIBIDO: "Recibido", PENDIENTE: "Pendiente", NO_RECIBIDO: "No recibido", SIN_DECRETO: "Sin decreto", REVISAR: "Revisar" });
    expect(Object.keys(EXPLICACION_ESTADO).sort()).toEqual(ESTADOS_CRUCE.filter((e) => e !== "REVISAR").sort());
    for (const t of Object.values(EXPLICACION_ESTADO)) expect(t.length).toBeGreaterThan(10);
  });

  it("cada motivo de REVISAR tiene un texto propio; el de la disputa la nombra", () => {
    expect(Object.keys(TEXTO_MOTIVO).sort()).toEqual([...MOTIVOS_REVISAR].sort());
    expect(new Set(Object.values(TEXTO_MOTIVO)).size).toBe(MOTIVOS_REVISAR.length);
    expect(TEXTO_MOTIVO.PAGO_EN_DISPUTA).toMatch(/^Pago en disputa/);
  });
});

describe("notas", () => {
  it("la ventana de pago sale de ventana.ts", () => {
    expect(notaVentana()).toBe(
      `Un pago de Trii cuenta para un decreto si llega entre ${VENTANA_PAGO_ANTES_DIAS} días antes y ${VENTANA_PAGO_DESPUES_DIAS} días después de su fecha de pago.`,
    );
  });

  it("el bruto es una estimación y la diferencia se llama «diferencia bruto − neto»", () => {
    expect(NOTA_BRUTO).toContain("estimación");
    expect(NOTA_DIFERENCIA).toMatch(/^Diferencia bruto − neto:/);
  });

  it("los decretos que no esperaban pago, en singular y en plural", () => {
    expect(sinTenencia(1)).toBe("1 decreto con fecha ex pasada no esperaba pago: no había acciones de la especie antes de la ex.");
    expect(sinTenencia(3)).toBe("3 decretos con fecha ex pasada no esperaban pago: no había acciones de la especie antes de la ex.");
  });

  it("ningún texto llama «retención» a nada", () => {
    const todos = [...Object.values(TEXTO_ESTADO_CRUCE), ...Object.values(EXPLICACION_ESTADO), ...Object.values(TEXTO_MOTIVO), NOTA_BRUTO, NOTA_DIFERENCIA, notaVentana()];
    for (const t of todos) expect(t, t).not.toMatch(/retenci[oó]n/i);
  });
});
