/**
 * Posiciones del grafo de relaciones de Base Oficial
 * (spec 009, T-b del radicado 001-IDC-014).
 *
 * El turno anterior declaró este caso como no tocable: el componente sembraba
 * las posiciones con `setState` dentro de un `useEffect` (§6.2) y parecía un
 * `useMemo`, pero el usuario **arrastra** esos nodos, así que convertirlo a la
 * ligera habría roto el arrastre.
 *
 * La salida es separar las dos cosas que estaban mezcladas en un solo estado:
 *
 * - la **disposición inicial**, que es una función pura de los documentos;
 * - las **posiciones movidas por el usuario**, que son lo único que es estado.
 *
 * Separadas, ninguna necesita un efecto y ambas se pueden probar sin lienzo.
 */

export interface Punto {
  x: number;
  y: number;
}

/** Reparte los identificadores en círculo, en orden estable. */
export function posicionesEnCirculo(
  ids: string[],
  centro: Punto = { x: 400, y: 250 },
  radio = 180,
): Record<string, Punto> {
  const posiciones: Record<string, Punto> = {};
  for (const [i, id] of ids.entries()) {
    const angulo = (i / Math.max(1, ids.length)) * Math.PI * 2;
    posiciones[id] = {
      x: centro.x + Math.cos(angulo) * radio,
      y: centro.y + Math.sin(angulo) * radio,
    };
  }
  return posiciones;
}

/**
 * Superpone lo que el usuario movió sobre la disposición inicial.
 *
 * Consecuencia deliberada: al añadirse un documento nuevo, los nodos que el
 * usuario ya había colocado **se quedan donde los dejó**. Antes se perdían
 * todos, porque el efecto reescribía el estado entero cada vez que cambiaba el
 * número de documentos. Perder el trabajo del usuario al llegar un dato nuevo
 * era un defecto, no una función.
 *
 * Un nodo movido cuyo documento ya no está se descarta: no se arrastran
 * posiciones fantasma.
 */
export function combinarPosiciones(
  iniciales: Record<string, Punto>,
  movidas: Record<string, Punto>,
): Record<string, Punto> {
  const combinadas: Record<string, Punto> = { ...iniciales };
  for (const [id, punto] of Object.entries(movidas)) {
    if (id in iniciales) combinadas[id] = punto;
  }
  return combinadas;
}
