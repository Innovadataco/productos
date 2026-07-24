/**
 * Reintento con límite (spec 013, FR-001).
 *
 * La extracción de texto de la subida ocurre **dentro de la petición** y no
 * reintentaba: si fallaba una vez, el documento quedaba `needs_review` y **nunca
 * se encolaba**, así que los reintentos que la cola sí tiene (3, con espera
 * creciente) no llegaban a aplicarse jamás. Un `Timeout` pasajero condenaba el
 * documento para siempre.
 *
 * Los valores por defecto son deliberadamente cortos: esto corre mientras un
 * usuario espera, no en un proceso de fondo.
 */

export interface OpcionesReintento {
  /** Número TOTAL de intentos, incluido el primero. */
  intentos?: number;
  /** Espera entre intentos, en milisegundos. */
  esperaMs?: number;
  /** Se invoca tras cada fallo; sirve para auditar (FR-005). */
  alFallar?: (intento: number, error: unknown) => void;
  /** Inyectable para que la suite no espere de verdad. */
  dormir?: (ms: number) => Promise<void>;
}

const dormirDeVerdad = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Ejecuta `tarea` hasta que salga bien o se agoten los intentos.
 *
 * Si se agotan, **relanza el último error**: quien llama debe poder distinguir
 * "no se pudo" de "salió vacío", que no es lo mismo.
 */
export async function conReintento<T>(
  tarea: () => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const intentos = Math.max(1, opciones.intentos ?? 2);
  const esperaMs = opciones.esperaMs ?? 400;
  const dormir = opciones.dormir ?? dormirDeVerdad;

  let ultimoError: unknown;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await tarea();
    } catch (err) {
      ultimoError = err;
      opciones.alFallar?.(intento, err);
      // No se espera después del último fallo: esa espera no sirve a nadie.
      if (intento < intentos) await dormir(esperaMs);
    }
  }
  throw ultimoError;
}
