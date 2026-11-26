// El pedido de /edicion/alertas: lo que manda el formulario, leído con EXACTAMENTE sus claves y convertido a los umbrales que se
// guardan. Los rangos son los de src/alertas/umbrales.ts (una sola fuente). Los errores llevan campo y código, nunca el valor.
import { describe, expect, it } from "vitest";
import { leerPedidoUmbrales, MAX_CUERPO_UMBRALES } from "@/app/edicion/alertas/pedido-umbrales";
import { RANGOS_UMBRALES, UMBRALES_OMISION } from "@/alertas/umbrales";

const CUERPO = {
  versionBase: 2, alertaCercaPct: "3,5", alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: "4", alertaMovimientoActiva: false,
  alertaCaidaPct: "2,25", alertaCaidaActiva: true, alertaDatoViejoMin: 45, alertaDatoViejoActiva: true, alertaExDiasHabiles: 5, alertaExActiva: true,
  motivo: "Umbrales ficticios de la prueba",
};
const errores = (cuerpo: unknown) => {
  const r = leerPedidoUmbrales(cuerpo);
  return r.ok ? [] : r.errores;
};

describe("leerPedidoUmbrales", () => {
  it("lee un pedido válido: porcentajes en es-CO, enteros y booleanos, con la versión de partida y el motivo", () => {
    const r = leerPedidoUmbrales(CUERPO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.versionBase).toBe(2);
    expect(r.motivo).toBe("Umbrales ficticios de la prueba");
    expect(r.umbrales).toEqual({
      alertaCercaPct: 3.5, alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: 4, alertaMovimientoActiva: false,
      alertaCaidaPct: 2.25, alertaCaidaActiva: true, alertaDatoViejoMin: 45, alertaDatoViejoActiva: true, alertaExDiasHabiles: 5, alertaExActiva: true,
    });
  });

  it("acepta los bordes de cada rango (los del código) y números JSON además de texto", () => {
    for (const [campo, { min, max }] of Object.entries(RANGOS_UMBRALES)) {
      expect(errores({ ...CUERPO, [campo]: min }), `${campo} mínimo`).toEqual([]);
      expect(errores({ ...CUERPO, [campo]: max }), `${campo} máximo`).toEqual([]);
    }
  });

  it("la omisión del código es un pedido válido (el formulario parte de ella)", () => {
    expect(errores({ ...CUERPO, ...UMBRALES_OMISION })).toEqual([]);
  });

  it("recorta el motivo y exige que no esté vacío ni pase de 2000", () => {
    const r = leerPedidoUmbrales({ ...CUERPO, motivo: "  porque sí  " });
    expect(r.ok && r.motivo).toBe("porque sí");
    expect(errores({ ...CUERPO, motivo: "   " })).toEqual([{ campo: "motivo", codigo: "VACIO" }]);
    expect(errores({ ...CUERPO, motivo: "x".repeat(2001) })).toEqual([{ campo: "motivo", codigo: "DEMASIADO_LARGO" }]);
  });

  it.each([
    ["alertaCercaPct", "0,49"], ["alertaCercaPct", "10,01"], ["alertaMovimientoPct", "20,01"], ["alertaCaidaPct", "0,4"],
    ["alertaDatoViejoMin", 9], ["alertaDatoViejoMin", 241], ["alertaExDiasHabiles", 0], ["alertaExDiasHabiles", 11],
  ])("%s = %j está fuera de rango", (campo, valor) => {
    expect(errores({ ...CUERPO, [campo]: valor })).toEqual([{ campo, codigo: "FUERA_DE_RANGO" }]);
  });

  it.each([
    ["alertaCercaPct", "3,555", "DECIMALES_DE_MAS"],
    ["alertaDatoViejoMin", 45.5, "DEBE_SER_ENTERO"],
    ["alertaExDiasHabiles", "3,5", "DEBE_SER_ENTERO"],
    ["alertaCercaPct", "tres", "FORMATO_INVALIDO"],
    ["alertaCercaPct", "", "FORMATO_INVALIDO"],
    ["alertaCaidaPct", null, "FORMATO_INVALIDO"],
    ["alertaMovimientoPct", Number.NaN, "FORMATO_INVALIDO"],
    ["alertaCercaPct", "1".repeat(40), "FORMATO_INVALIDO"],
    ["alertaCercaActiva", "true", "FORMATO_INVALIDO"],
    ["alertaExActiva", 1, "FORMATO_INVALIDO"],
    ["versionBase", -1, "FORMATO_INVALIDO"],
    ["versionBase", 1.5, "FORMATO_INVALIDO"],
    ["versionBase", "2", "FORMATO_INVALIDO"],
    ["motivo", 4613, "FORMATO_INVALIDO"],
  ])("%s = %j → %s", (campo, valor, codigo) => {
    expect(errores({ ...CUERPO, [campo]: valor })).toEqual([{ campo, codigo }]);
  });

  it("acumula los errores de varios campos y nunca repite el valor", () => {
    const e = errores({ ...CUERPO, alertaCercaPct: "99", alertaDatoViejoMin: 1, motivo: "" });
    expect(e.map((x) => x.campo).sort()).toEqual(["alertaCercaPct", "alertaDatoViejoMin", "motivo"]);
    expect(JSON.stringify(e)).not.toMatch(/99/);
  });

  it.each([
    ["con una clave de más", { ...CUERPO, autorId: "otro" }],
    ["sin una clave", (({ motivo: _m, ...resto }) => resto)(CUERPO)],
    ["un arreglo", []],
    ["nulo", null],
    ["un texto", "x"],
  ])("un cuerpo %s es FORMATO_INVALIDO en «cuerpo»", (_n, cuerpo) => {
    expect(errores(cuerpo)).toEqual([{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]);
  });

  it("el tope del cuerpo cabe el motivo más largo y lo demás", () => {
    expect(MAX_CUERPO_UMBRALES).toBeGreaterThanOrEqual(2000 * 4 + 512);
    expect(MAX_CUERPO_UMBRALES).toBeLessThan(1_000_000);
  });
});
