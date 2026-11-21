/** mulberry32: PRNG pequeño y determinista para los fuzz de los lectores acotados (las corridas se repiten igual). */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [0, n). */
export const entero = (r: () => number, n: number): number => Math.floor(r() * n);

/** `largo` bytes pseudoaleatorios con semilla (incompresibles para deflate). */
export function bytesAzar(semilla: number, largo: number): Uint8Array {
  const r = azar(semilla);
  const salida = new Uint8Array(largo);
  for (let k = 0; k < largo; k += 1) salida[k] = entero(r, 256);
  return salida;
}
