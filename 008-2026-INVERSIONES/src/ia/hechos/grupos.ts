/**
 * Grupos de hechos (E1b): cada armador arma sus hechos en grupos que entran o salen enteros (el portafolio, una
 * especie con sus reglas, una regla de portafolio). Aquí se ordenan por prioridad (los empates, en el orden de llegada),
 * se recortan al tope del contrato (99 hechos: el grupo que no cabe se salta y se cuenta), se numeran de H01 en adelante
 * y se resuelve cada `sujeto`, que en el borrador es una referencia local del grupo («especie», «regla-2»), al id de un
 * hecho anterior del MISMO grupo. La presentación sale de `presentar` con la unidad del catálogo.
 * Lo obligatorio arrastra al nombre de su especie, a través del ancla de la regla (que no se vuelve obligatoria): el
 * texto que cite el hecho obligatorio tiene que poder decir de qué especie habla.
 */
import { CLAVE_NOMBRE_ESPECIE, entradaDeCatalogo, type ClaveDe, type ClaveHecho } from "../catalogo";
import { MAX_HECHOS, type Calidad, type Cercania, type DiaIso, type Direccion, type EntradaHecho, type Frescura, type IdHecho, type TipoResumen } from "../contrato";
import { idDeHecho } from "../paquete";
import { presentar } from "../presentar";
import { ErrorArmado } from "./errores";

/** Un hecho sin id ni presentación: el `sujeto` es la `ref` de otro borrador anterior del mismo grupo. */
export interface BorradorHecho<C extends ClaveHecho = ClaveHecho> {
  readonly ref?: string;
  readonly clave: C;
  readonly sujeto?: string;
  readonly valor: string;
  readonly fuente: string;
  readonly fecha: DiaIso;
  readonly calidad: Calidad;
  readonly direccion: Direccion;
  readonly cercania: Cercania;
  readonly frescura: Frescura;
  readonly obligatorio: boolean;
}

export interface Grupo<C extends ClaveHecho = ClaveHecho> {
  /** Menor, primero: decide qué entra si no cabe todo. */
  readonly prioridad: number;
  readonly hechos: readonly BorradorHecho<C>[];
}

export interface Numerados<C extends ClaveHecho = ClaveHecho> {
  readonly hechos: readonly EntradaHecho<C>[];
  /** Cuántos grupos no cupieron. */
  readonly recortados: number;
}

/** Los índices (en el grupo) de cada `ref`, y el índice del sujeto de cada borrador; REFERENCIA_INVALIDA si no resuelve. */
function sujetosDe(hechos: readonly BorradorHecho[]): readonly (number | null)[] {
  const vistos = new Map<string, number>();
  return hechos.map((hecho, i) => {
    const sujeto = hecho.sujeto === undefined ? null : vistos.get(hecho.sujeto);
    if (sujeto === undefined) throw new ErrorArmado("REFERENCIA_INVALIDA");
    if (hecho.ref !== undefined) {
      if (vistos.has(hecho.ref)) throw new ErrorArmado("REFERENCIA_INVALIDA");
      vistos.set(hecho.ref, i);
    }
    return sujeto;
  });
}

/** Los índices de los nombres de especie que quedan obligatorios porque un hecho obligatorio los alcanza por su cadena. */
function nombresObligatorios(hechos: readonly BorradorHecho[], sujetos: readonly (number | null)[]): ReadonlySet<number> {
  const marcados = new Set<number>();
  hechos.forEach((hecho, i) => {
    if (!hecho.obligatorio) return;
    for (let actual = sujetos[i] ?? null; actual !== null; actual = sujetos[actual] ?? null) {
      if (hechos[actual]?.clave === CLAVE_NOMBRE_ESPECIE) marcados.add(actual);
    }
  });
  return marcados;
}

function presentacionDe(tipo: TipoResumen, hecho: BorradorHecho): string {
  const entrada = entradaDeCatalogo(tipo, hecho.clave);
  if (entrada === null) throw new ErrorArmado("CLAVE_FUERA_DE_CATALOGO");
  try {
    return presentar(hecho.valor, entrada.unidad);
  } catch {
    throw new ErrorArmado("VALOR_INVALIDO");
  }
}

/** Los hechos del grupo, numerados desde `primero` (posición 1 = H01). */
function numerarGrupo<C extends ClaveHecho>(tipo: TipoResumen, grupo: Grupo<C>, primero: number): readonly EntradaHecho<C>[] {
  const sujetos = sujetosDe(grupo.hechos);
  const obligatorios = nombresObligatorios(grupo.hechos, sujetos);
  const id = (i: number): IdHecho => idDeHecho(primero + i);
  return grupo.hechos.map((hecho, i): EntradaHecho<C> => {
    const sujeto = sujetos[i] ?? null;
    return {
      id: id(i),
      clave: hecho.clave,
      ...(sujeto === null ? {} : { sujeto: id(sujeto) }),
      valor: hecho.valor,
      presentacion: presentacionDe(tipo, hecho),
      fuente: hecho.fuente,
      fecha: hecho.fecha,
      calidad: hecho.calidad,
      direccion: hecho.direccion,
      cercania: hecho.cercania,
      frescura: hecho.frescura,
      obligatorio: hecho.obligatorio || obligatorios.has(i),
    };
  });
}

/** Los grupos que caben en el tope, por prioridad (estable), y cuántos se saltaron. */
function elegir<C extends ClaveHecho>(grupos: readonly Grupo<C>[], tope: number): { readonly elegidos: readonly Grupo<C>[]; readonly recortados: number } {
  const ordenados = grupos.filter((g) => g.hechos.length > 0).sort((a, b) => a.prioridad - b.prioridad);
  const { elegidos } = ordenados.reduce<{ readonly elegidos: readonly Grupo<C>[]; readonly total: number }>(
    (acc, grupo) => (acc.total + grupo.hechos.length <= tope ? { elegidos: [...acc.elegidos, grupo], total: acc.total + grupo.hechos.length } : acc),
    { elegidos: [], total: 0 },
  );
  return { elegidos, recortados: ordenados.length - elegidos.length };
}

/** Los hechos listos para `construirPaquete` (sin etiqueta ni unidad: las pone el catálogo). */
export function numerarGrupos<T extends TipoResumen>(tipo: T, grupos: readonly Grupo<ClaveDe<T>>[], tope: number = MAX_HECHOS): Numerados<ClaveDe<T>> {
  const { elegidos, recortados } = elegir(grupos, tope);
  const { hechos } = elegidos.reduce<{ readonly hechos: readonly EntradaHecho<ClaveDe<T>>[] }>(
    (acc, grupo) => ({ hechos: [...acc.hechos, ...numerarGrupo(tipo, grupo, acc.hechos.length + 1)] }),
    { hechos: [] },
  );
  return { hechos, recortados };
}
