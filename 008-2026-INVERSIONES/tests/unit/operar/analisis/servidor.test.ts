// El análisis del antes y el después en el servidor, con la base simulada: el tablero y la historia de un portafolio
// inventado, los motores tal cual, los escenarios dentro del turno de proyecciones (y sin ellos si el turno está
// ocupado) y la vista de la pantalla. Datos inventados (FICTICIA-*, fechas anteriores a 2022).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import { aVistaAnalisis } from "@/operar/analisis/vista";
import { cerrada, D, diasHabiles, portafolio, retornosRepetidos, serieDeRetornos, type EspecieFicticia } from "../../analisis/fixtures/portafolio.ficticio";

const DIAS = diasHabiles("2019-01-02", 300);
const especie = (id: string, cantidad: number, inicial: number, escala: number): EspecieFicticia => ({
  id, cantidad, cierres: serieDeRetornos(DIAS, inicial, retornosRepetidos(DIAS.length - 1, escala)),
});
const ENTRADAS = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2.3), especie("FICTICIA-C", 23, 905.61, 1.7)]);

const obtenerResumen = vi.hoisted(() => vi.fn());
const leerEntradas = vi.hoisted(() => vi.fn());
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));
vi.mock("@/proyecciones/leer", () => ({ leerEntradas }));

const { analizarSimulacion } = await import("@/operar/pantalla/analisis");
const DB = {} as never;
const CIERRE_B = ENTRADAS.tablero.filas.find((f) => f.instrumentoId === "FICTICIA-B")!.cierre!.precio;
const COMISION = D("137.91");
/** Compra de 102 de FICTICIA-B a su cierre: de la caja salen el valor de la orden y la comisión. */
const CAJA = { antes: D("793713.41"), despues: D("793713.41").sub(CIERRE_B.mul(102)).sub(COMISION) };
const PEDIDO = { hoy: ENTRADAS.hoy, usuarioId: "usuario-ficticio", instrumentoId: "FICTICIA-B", cantidadDespues: 113n, reglas: [], caja: CAJA };

beforeEach(() => {
  reiniciarTurnoParaPruebas();
  obtenerResumen.mockResolvedValue({ tablero: ENTRADAS.tablero });
  leerEntradas.mockResolvedValue(ENTRADAS.historia);
});

describe("analizarSimulacion", () => {
  it("compara con los motores y calcula los escenarios a 3, 6 y 12 meses", async () => {
    const a = await analizarSimulacion(DB, PEDIDO);
    expect(a.comparacion.pesoOperada.despues!).toBeGreaterThan(a.comparacion.pesoOperada.antes!);
    expect(a.escenarios?.antes.puntos.map((p) => p.mes)).toEqual([3, 6, 12]);
    // El defecto: el después sumaba la compra sin restar la caja que sale. Con la caja, el valor de partida solo baja la comisión.
    const { antes, despues } = a.escenarios!;
    expect(antes.partida.caja).toBeCloseTo(793713.41, 6);
    expect(despues.partida.caja).toBeCloseTo(CAJA.despues.toNumber(), 6);
    expect(despues.partida.acciones - antes.partida.acciones).toBeCloseTo(CIERRE_B.mul(102).toNumber(), 4);
    expect(antes.partida.total - despues.partida.total).toBeCloseTo(137.91, 4);
    expect(a.nombres.get("FICTICIA-B")).toBe("FICTB");
    const vista = aVistaAnalisis({ ...a, operadaId: "FICTICIA-B", lado: "COMPRAR", plan: null, caja: "AV" });
    expect(vista.filas.map((f) => f.titulo)).toEqual(["Peso de FICTB", "Primera especie", "Tres primeras especies", "HHI", "Volatilidad anual del portafolio", "Contribución de FICTB al riesgo"]);
    expect(vista.escenarios).toHaveLength(4);
    expect(vista.partida.map((f) => f.titulo)).toEqual(["Acciones", "Caja (parte fija, sin rendimiento)", "Valor de partida"]);
    expect(vista.frases.length).toBeGreaterThanOrEqual(3);
  });

  it("con el turno de proyecciones ocupado por el mismo usuario, sale sin escenarios", async () => {
    const { conTurno } = await import("@/app/proyecciones/turno");
    let soltar: () => void = () => undefined;
    const ocupado = conTurno("usuario-ficticio", Date.now(), () => new Promise<void>((r) => { soltar = r; }));
    const a = await analizarSimulacion(DB, PEDIDO);
    soltar();
    await ocupado;
    expect(a.escenarios).toBeNull();
    expect(aVistaAnalisis({ ...a, operadaId: "FICTICIA-B", lado: "VENDER", plan: null, caja: "AV" }).escenarios).toEqual([]);
  });

  it("una especie que la historia no trae (cerrada en el tablero) entra al después como parte fija, a su cierre", async () => {
    const conCerrada = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2.3)], { cerradas: [cerrada("FICTICIA-D", { precio: D("317.43"), fecha: DIAS.at(-1)! })] });
    obtenerResumen.mockResolvedValue({ tablero: conCerrada.tablero });
    leerEntradas.mockResolvedValue(conCerrada.historia);
    const caja = { antes: D("4613.27"), despues: D("4613.27").sub(D("317.43").mul(7)) };
    const a = await analizarSimulacion(DB, { ...PEDIDO, instrumentoId: "FICTICIA-D", cantidadDespues: 7n, caja });
    const { antes, despues } = a.escenarios!;
    expect(despues.partida.acciones - antes.partida.acciones).toBeCloseTo(7 * 317.43, 6);
    expect(despues.partida.total).toBeCloseTo(antes.partida.total, 6);
  });
});
