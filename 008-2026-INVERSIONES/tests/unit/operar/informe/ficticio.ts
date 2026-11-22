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

/** Congela en profundidad (objetos, arreglos y mapas por dentro): el armador no debe tocar nada. */
export function congelar<T>(valor: T): T {
  if (valor === null || typeof valor !== "object" || Object.isFrozen(valor)) return valor;
  if (valor instanceof Map) for (const v of valor.values()) congelar(v);
  for (const v of Object.values(valor)) congelar(v);
  return Object.freeze(valor);
}
