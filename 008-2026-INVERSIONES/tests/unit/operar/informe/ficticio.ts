// Ayudas de las pruebas del informe para operar (frente operar-informe): entradas inventadas, especies FICTICIA-*,
// fechas de 2027 (el calendario de la BVC las cubre). No es una prueba.
import type { Prisma } from "@prisma/client";
import type { Proximo } from "@/datos-oficiales/decretos/proximos";
import type { CierreLeido, ReglaLeida } from "@/plan/lectura";
import type { CalendarioBvc } from "@/precios/negociacion";
import type { EntradasInforme, PlanVigente } from "@/operar/informe/tipos";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";
import { D, dia, especie } from "../../tablero/ficticio";

export { D, dia, especie };

/** Miércoles 17-mar-2027 y su rueda anterior, el martes 16. */
export const HOY = dia("2027-03-17");
export const REFERENCIA = dia("2027-03-16");

/** Calendario de 2026 y 2027 sin festivos, salvo los que se pasen. */
export const calendario = (noHabiles: readonly string[] = []): CalendarioBvc => ({ noHabiles: new Set(noHabiles), aniosCubiertos: new Set([2026, 2027]) });

export const cierre = (precio: Prisma.Decimal.Value, fecha: Date = REFERENCIA, verificado = false) => ({ precio: D(precio), fecha, verificado });

export const cierreLeido = (precio: Prisma.Decimal.Value, fecha: Date = REFERENCIA): CierreLeido => ({ precio: D(precio), fecha, estado: "NO_VERIFICADO" });

export const regla = (o: Partial<ReglaLeida> & { readonly id: string }): ReglaLeida => ({
  instrumentoId: null, nemotecnico: null, conLotes: true, condicion: "NINGUNA", nivel: null, accion: "NO_ACTUAR", cantidad: null,
  plazoHasta: null, detalle: "Regla ficticia", decisiones: 0, ...o,
});

/** Una regla de una especie FICTICIA-<nemo>, con el id de la especie igual al nemotécnico. */
export const reglaDe = (nemo: string, o: Partial<ReglaLeida> & { readonly id: string }): ReglaLeida =>
  regla({ instrumentoId: nemo, nemotecnico: nemo, ...o });

export const proximo = (o: Partial<Proximo> & { readonly id: string; readonly fechaEx: Date }): Proximo => ({
  instrumentoId: "FICTICIA-D", nemotecnico: "FICTICIA-D", tipo: "ORDINARIO", cuota: 1, valorPorAccion: D("37.91"),
  fechaAnuncio: dia("2027-02-03"), fechaPago: o.fechaEx, referenciaOficial: "sfc:FICTICIO-4613", version: 1, tenencia: 0n, brutoEstimado: D(0), ...o,
});

export const plan = (reglas: readonly ReglaLeida[], numero = 7): PlanVigente => ({ numero, vigenteDesde: dia("2027-01-04"), reglas });

interface OpcionesEntradas {
  readonly especies?: readonly EntradaEspecie[];
  readonly incompletas?: readonly string[];
  readonly calendario?: CalendarioBvc;
  readonly plan?: PlanVigente | null;
  readonly cierres?: ReadonlyMap<string, CierreLeido>;
  readonly proximos?: readonly Proximo[];
}

/** Por defecto: dos especies vivas con cierre en la referencia, sin plan ni próximos. */
export function entradas(o: OpcionesEntradas = {}): EntradasInforme {
  const especies = o.especies ?? [
    especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("158917.31"), cierre: cierre("4597.31") }),
    especie({ nemotecnico: "FICTICIA-B", cantidad: 113n, costoVivo: D("131711.39"), cierre: cierre("1237") }),
  ];
  return {
    tablero: calcularTablero(especies),
    incompletas: o.incompletas ?? [],
    calendario: o.calendario ?? calendario(),
    plan: o.plan === undefined ? null : o.plan,
    cierresDeReglas: o.cierres ?? new Map(),
    proximos: o.proximos ?? [],
  };
}

/**
 * Un informe con todos los casos de la pantalla: una regla tocada con el plazo vencido (FICTICIA-A), una que se cumple
 * (FICTICIA-B, tocada y sin plazo), una cercana
 * (FICTICIA-B), una con el cierre atrasado (FICTICIA-C), una en el nivel, posturas, una por orden y una escrita; una
 * especie sin cierre, una atrasada y una incompleta; un ex-dividendo y un plazo en la ventana.
 */
export function entradasCompletas(): EntradasInforme {
  return entradas({
    especies: [
      especie({ nemotecnico: "FICTICIA-A", cantidad: 37n, costoVivo: D("158917.31"), cierre: cierre("4597.31") }),
      especie({ nemotecnico: "FICTICIA-B", cantidad: 113n, costoVivo: D("131711.39"), cierre: cierre("1237") }),
      especie({ nemotecnico: "FICTICIA-C", cantidad: 19n, costoVivo: D("17431.07"), cierre: cierre("899.11", dia("2027-03-12")) }),
      especie({ nemotecnico: "FICTICIA-E", cantidad: 7n, costoVivo: D("3191.37") }),
    ],
    incompletas: ["FICTICIA-I"],
    plan: plan([
      reglaDe("FICTICIA-A", { id: "r-a", condicion: "CIERRE_BAJO", nivel: D("4613.17"), accion: "VENDER", cantidad: 37n, plazoHasta: dia("2027-03-01") }),
      reglaDe("FICTICIA-B", { id: "r-b", condicion: "CIERRE_SOBRE", nivel: D("1259.17"), accion: "VENDER", cantidad: 13n, plazoHasta: dia("2027-04-02") }),
      reglaDe("FICTICIA-C", { id: "r-c", condicion: "CIERRE_BAJO", nivel: D("917.43"), accion: "COMPRAR", cantidad: 1n }),
      reglaDe("FICTICIA-A", { id: "r-n", condicion: "CIERRE_SOBRE", nivel: D("4597.31"), accion: "COMPRAR" }),
      reglaDe("FICTICIA-B", { id: "r-t", condicion: "CIERRE_BAJO", nivel: D("1301.17"), accion: "VENDER", cantidad: 7n }),
      reglaDe("FICTICIA-B", { id: "r-p", condicion: "NINGUNA", accion: "NO_ACTUAR", cantidad: 43n, plazoHasta: dia("2027-05-14") }),
      regla({ id: "r-m", condicion: "MONTO_ORDEN_BAJO", nivel: D("1237911.47") }),
      regla({ id: "r-l", condicion: "LIBRE", detalle: "Orden límite siempre (ficticia)" }),
    ]),
    cierres: new Map([["FICTICIA-A", cierreLeido("4597.31")], ["FICTICIA-B", cierreLeido("1237")], ["FICTICIA-C", cierreLeido("899.11", dia("2027-03-12"))]]),
    proximos: [proximo({ id: "x-d", fechaEx: dia("2027-03-24"), fechaPago: dia("2027-03-31"), cuota: 2, tenencia: 0n })],
  });
}

/**
 * Los casos raros, para el candado de lenguaje: una regla de cierre de portafolio, una sin nivel y una sin cierre;
 * tenencias positiva, de una acción y negativa; un ex-dividendo de una especie sin nemotécnico, y un plazo de portafolio.
 */
export function entradasRaras(): EntradasInforme {
  return entradas({
    plan: plan([
      regla({ id: "q-1", condicion: "CIERRE_SOBRE", nivel: D("4751.39"), accion: "VENDER", cantidad: 1n, plazoHasta: dia("2027-03-30") }),
      reglaDe("FICTICIA-A", { id: "q-2", condicion: "CIERRE_BAJO", nivel: null, accion: "COMPRAR" }),
      reglaDe("FICTICIA-Z", { id: "q-3", condicion: "CIERRE_BAJO", nivel: D("917.43"), accion: "NO_ACTUAR", cantidad: 4613n }),
    ]),
    proximos: [
      proximo({ id: "x-1", fechaEx: dia("2027-03-18"), tenencia: 37n, tipo: "EXTRAORDINARIO" }),
      proximo({ id: "x-2", fechaEx: dia("2027-03-19"), tenencia: 1n }),
      proximo({ id: "x-3", fechaEx: dia("2027-03-22"), tenencia: -13n, nemotecnico: null }),
    ],
  });
}

/** Congela en profundidad (objetos, arreglos y mapas por dentro): el armador no debe tocar nada. */
export function congelar<T>(valor: T): T {
  if (valor === null || typeof valor !== "object" || Object.isFrozen(valor)) return valor;
  if (valor instanceof Map) for (const v of valor.values()) congelar(v);
  for (const v of Object.values(valor)) congelar(v);
  return Object.freeze(valor);
}
