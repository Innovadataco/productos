/**
 * Tope general de las API por IP (requisito #10 del CEO de PI): ventana fija por red (IPv4 /32,
 * IPv6 /64, o «sin IP»). En memoria del proceso: la app es un solo contenedor. Es la segunda capa; la
 * del login (bloqueo por cuenta y 20 fallos por IP) vive en la base. Memoria acotada: con más de
 * `maxRedes` redes se descartan primero las vencidas y después las más viejas. Módulo puro: lo usa el proxy.
 */
export interface Decision {
  readonly permitido: boolean;
  /** Segundos hasta que la ventana de esa red se reinicia (para Retry-After). */
  readonly reintentarEnS: number;
}

export interface Limitador {
  registrar(red: string, ahoraMs: number): Decision;
  tamano(): number;
}

interface Ventana {
  readonly inicio: number;
  readonly cuenta: number;
}

const MAX_REDES_POR_DEFECTO = 10_000;

export function crearLimitador(opciones: { readonly maximo: number; readonly ventanaMs: number; readonly maxRedes?: number }): Limitador {
  const { maximo, ventanaMs } = opciones;
  const maxRedes = opciones.maxRedes ?? MAX_REDES_POR_DEFECTO;
  const ventanas = new Map<string, Ventana>();

  const podar = (ahoraMs: number) => {
    for (const [red, v] of ventanas) if (ahoraMs - v.inicio >= ventanaMs) ventanas.delete(red);
    for (const red of ventanas.keys()) {
      if (ventanas.size < maxRedes) break;
      ventanas.delete(red);
    }
  };

  return {
    registrar(red, ahoraMs) {
      const previa = ventanas.get(red);
      const vigente = previa && ahoraMs - previa.inicio < ventanaMs ? previa : undefined;
      if (!vigente && !ventanas.has(red) && ventanas.size >= maxRedes) podar(ahoraMs);
      const actual: Ventana = vigente ? { inicio: vigente.inicio, cuenta: vigente.cuenta + 1 } : { inicio: ahoraMs, cuenta: 1 };
      ventanas.delete(red);
      ventanas.set(red, actual);
      const reintentarEnS = Math.max(1, Math.ceil((actual.inicio + ventanaMs - ahoraMs) / 1000));
      return { permitido: actual.cuenta <= maximo, reintentarEnS };
    },
    tamano: () => ventanas.size,
  };
}
