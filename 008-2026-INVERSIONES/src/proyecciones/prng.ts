/**
 * Generador pseudoaleatorio reproducible del motor: xoshiro128** 1.1 sembrado con SplitMix64 (D. Blackman y
 * S. Vigna, dominio público, prng.di.unimi.it). Sin dependencias. La misma semilla da exactamente la misma
 * secuencia en cualquier máquina (solo enteros de 32 bits y `Math.imul`). Puro.
 * Siembra: dos salidas de SplitMix64 desde la semilla, partidas en palabra baja y alta (como recomienda Vigna).
 * Las pruebas lo comparan con el C de referencia.
 */
const MASCARA_64 = (1n << 64n) - 1n;
const DOS_A_LA_32 = 4_294_967_296;
const MAX_SEMILLA = 4_294_967_295;

export interface Prng {
  /** Entero de 32 bits sin signo. */
  siguiente(): number;
  /** Real en [0, 1). */
  uniforme(): number;
  /** Entero en [0, n), con n entero en [1, 2^32]. El sesgo de `floor(u·n)` es < n / 2^32 (despreciable aquí). */
  enteroMenorQue(n: number): number;
}

/** Un paso de SplitMix64: el estado siguiente y su salida. */
export function splitmix64(estado: bigint): { readonly estado: bigint; readonly salida: bigint } {
  const x = (estado + 0x9e3779b97f4a7c15n) & MASCARA_64;
  let z = x;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASCARA_64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASCARA_64;
  return { estado: x, salida: z ^ (z >> 31n) };
}

const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));
const baja = (x: bigint): number => Number(x & 0xffffffffn) | 0;
const alta = (x: bigint): number => Number(x >> 32n) | 0;

export function crearPrng(semilla: number): Prng {
  if (!Number.isInteger(semilla) || semilla < 0 || semilla > MAX_SEMILLA) throw new RangeError("La semilla debe ser un entero de 0 a 2^32 − 1.");
  const a = splitmix64(BigInt(semilla));
  const b = splitmix64(a.estado);
  let s0 = baja(a.salida);
  let s1 = alta(a.salida);
  let s2 = baja(b.salida);
  let s3 = alta(b.salida);
  const siguiente = (): number => {
    const resultado = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return resultado;
  };
  const uniforme = (): number => siguiente() / DOS_A_LA_32;
  const enteroMenorQue = (n: number): number => {
    if (!Number.isInteger(n) || n < 1 || n > DOS_A_LA_32) throw new RangeError("n debe ser un entero de 1 a 2^32.");
    return Math.floor(uniforme() * n);
  };
  return { siguiente, uniforme, enteroMenorQue };
}
