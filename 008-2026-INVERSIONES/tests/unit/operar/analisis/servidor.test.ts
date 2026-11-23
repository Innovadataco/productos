// El análisis del antes y el después en el servidor, con la base simulada: el tablero y la historia de un portafolio
// inventado, los motores tal cual, los escenarios dentro del turno de proyecciones (y sin ellos si el turno está
// ocupado) y la vista de la pantalla. Datos inventados (FICTICIA-*, fechas anteriores a 2022).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import { aVistaAnalisis } from "@/operar/analisis/vista";
import { diasHabiles, portafolio, retornosRepetidos, serieDeRetornos, type EspecieFicticia } from "../../analisis/fixtures/portafolio.ficticio";

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
const PEDIDO = { hoy: ENTRADAS.hoy, usuarioId: "usuario-ficticio", instrumentoId: "FICTICIA-B", cantidadDespues: 113n, reglas: [] };

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
    expect(a.escenarios!.despues.puntos[2]!.p50).toBeGreaterThan(a.escenarios!.antes.puntos[2]!.p50);
    expect(a.nombres.get("FICTICIA-B")).toBe("FICTB");
    const vista = aVistaAnalisis({ ...a, operadaId: "FICTICIA-B", lado: "COMPRAR", plan: null });
    expect(vista.filas.map((f) => f.titulo)).toEqual(["Peso de FICTB", "Primera especie", "Tres primeras especies", "HHI", "Volatilidad anual del portafolio", "Contribución de FICTB al riesgo"]);
    expect(vista.escenarios).toHaveLength(4);
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
    expect(aVistaAnalisis({ ...a, operadaId: "FICTICIA-B", lado: "VENDER", plan: null }).escenarios).toEqual([]);
  });
});
