/**
 * El simulador «¿y si…?» (O2): el dueño escribe la operación que piensa hacer (especie, compra o venta, cantidad y
 * precio límite) y 008 muestra sus efectos con sus propios datos: los pesos antes y después, la caja, el valor de la
 * orden, la comisión (con la tarifa vigente que cargó el dueño, O5, o estimada con su historia) y las reglas de su
 * plan que la orden toca. Determinista, sin IA, sin base, sin red y sin reloj. Muestra efectos; la decisión es del dueño.
 */
import type { LadoOrden } from "@prisma/client";
import { estimarComision, tasaComisionHistorica } from "./comision";
import { calcularEfectos } from "./efectos";
import { reglasAfectadas } from "./reglas";
import { comisionConTarifa } from "./tarifa";
import type { ComisionEstimada, ContextoSimulacion, EstadoSimulado, LadoSimulado, OperacionSimulada, ResultadoSimulacion } from "./tipos";
import { revisarOperacion, validarContexto, validarEstado } from "./validar";

const LADO_DE_LA_ORDEN = { COMPRAR: "COMPRA", VENDER: "VENTA" } as const satisfies Record<LadoSimulado, LadoOrden>;

/**
 * Los errores de la operación vuelven como datos (`ok: false`), todos juntos. Lanza RangeError si el estado o el
 * contexto están mal formados: es un error de quien llama, no del dueño.
 */
export function simularOperacion(estado: EstadoSimulado, operacion: OperacionSimulada, contexto: ContextoSimulacion): ResultadoSimulacion {
  validarEstado(estado);
  validarContexto(contexto);
  const revision = revisarOperacion(operacion, estado.posiciones);
  if (!revision.ok) return revision;
  const { valorOrden } = revision;
  const lado = LADO_DE_LA_ORDEN[operacion.lado];
  const tarifa = contexto.tarifas?.[lado];
  const comision: ComisionEstimada =
    tarifa === undefined ? estimarComision(valorOrden, tasaComisionHistorica(contexto.ordenes, lado)) : { estado: "TARIFA", lado, valor: comisionConTarifa(valorOrden, tarifa), tarifa };
  const efectos = calcularEfectos(estado, operacion, valorOrden, comision);
  return {
    ok: true,
    simulacion: { ...efectos, cajaAntes: estado.caja, valorOrden, comision, reglasAfectadas: reglasAfectadas(estado.reglas, operacion, valorOrden, contexto.hoy) },
  };
}
