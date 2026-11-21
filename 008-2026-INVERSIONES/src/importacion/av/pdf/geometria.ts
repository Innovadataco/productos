/** Matrices de PDF (§8.3.3): [a b c d e f], con la convención de vector fila. */
export type Matriz = readonly [number, number, number, number, number, number];

export const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

/** m1 × m2. */
export function por(m1: Matriz, m2: Matriz): Matriz {
  const [a, b, c, d, e, f] = m1;
  const [A, B, C, D, E, F] = m2;
  return [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
}

export const traslacion = (tx: number, ty: number): Matriz => [1, 0, 0, 1, tx, ty];

/** El punto (x, y) llevado por la matriz. */
export function aplicar(m: Matriz, x: number, y: number): readonly [number, number] {
  return [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];
}

export interface Caja {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export function cajaDe(puntos: readonly (readonly [number, number])[]): Caja {
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export const ampliar = (c: Caja, margen: number): Caja => ({ x0: c.x0 - margen, y0: c.y0 - margen, x1: c.x1 + margen, y1: c.y1 + margen });

/** Estrictamente adentro (un borde que solo roza el punto no lo tapa). */
export const contiene = (c: Caja, x: number, y: number, holgura = 0.01): boolean =>
  x > c.x0 + holgura && x < c.x1 - holgura && y > c.y0 + holgura && y < c.y1 - holgura;
