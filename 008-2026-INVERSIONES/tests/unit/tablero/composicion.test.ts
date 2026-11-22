// Composición del portafolio (frente graficas-tablero): tajadas por valor, en Decimal en el servidor. Con más de 8
// especies, las 7 de mayor valor y «Otras» con la suma de las demás (nunca un noveno color). Datos inventados.
import { describe, expect, it } from "vitest";
import { calcularTablero } from "@/tablero/calculo";
import { componer, MAX_TAJADAS } from "@/tablero/composicion";
import { D, dia, especie } from "./ficticio";

const viva = (nemo: string, cantidad: bigint, precio: string | null) =>
  especie({ nemotecnico: nemo, cantidad, costoVivo: D(1237), cierre: precio === null ? null : { precio: D(precio), fecha: dia("2027-03-05"), verificado: false } });

describe("componer", () => {
  it("hasta 8 especies: una tajada por especie, de mayor a menor valor, con su peso; sin precio no entra", () => {
    const t = calcularTablero([viva("FICTA", 13n, "317.41"), viva("FICTB", 7n, "1211.09"), viva("FICTC", 3n, null)]);
    const r = componer(t.filas);
    expect(r.map((x) => [x.nemo, x.valor.toString(), x.pesoPct.toFixed(4), x.miembros])).toEqual([
      ["FICTB", "8477.63", D("8477.63").div("12603.96").mul(100).toFixed(4), []],
      ["FICTA", "4126.33", D("4126.33").div("12603.96").mul(100).toFixed(4), []],
    ]);
  });

  it("con 9 especies: 7 propias y «Otras» con la suma de las otras dos y sus nemotécnicos", () => {
    const nueve = Array.from({ length: 9 }, (_, k) => viva(`FICT${k + 1}`, BigInt(k + 1), `${41 + k * 13}.37`));
    const t = calcularTablero(nueve);
    const r = componer(t.filas);
    expect(r).toHaveLength(MAX_TAJADAS);
    expect(MAX_TAJADAS).toBe(8);
    const otras = r[7]!;
    const resto = t.filas.slice(7);
    expect([otras.id, otras.nemo]).toEqual(["otras", "Otras"]);
    expect(otras.miembros).toEqual(resto.map((f) => f.nemotecnico));
    expect(otras.valor.toString()).toBe(resto.reduce((s, f) => s.add(f.valor!), D(0)).toString());
    expect(otras.pesoPct.toFixed(6)).toBe(resto.reduce((s, f) => s.add(f.pesoPct!), D(0)).toFixed(6));
    expect(r.slice(0, 7).map((x) => x.nemo)).toEqual(t.filas.slice(0, 7).map((f) => f.nemotecnico));
  });

  it("con exactamente 8 no pliega nada; sin especies con valor, no hay tajadas", () => {
    const ocho = Array.from({ length: 8 }, (_, k) => viva(`FICT${k + 1}`, BigInt(k + 2), "173.29"));
    expect(componer(calcularTablero(ocho).filas).map((x) => x.id)).not.toContain("otras");
    expect(componer(calcularTablero([viva("FICTA", 3n, null)]).filas)).toEqual([]);
  });
});
