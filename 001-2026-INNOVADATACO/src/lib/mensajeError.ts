/**
 * Mensaje legible de un valor capturado, para componentes de cliente
 * (spec 009, FR-002).
 *
 * `catch (err: any)` estaba en 18 sitios solo para poder escribir `err.message`.
 * La constitución (§2.1) exige `unknown` + estrechamiento, y esto es el
 * estrechamiento, en un único lugar.
 *
 * No confundir con `detalleDeError` de `apiError.ts`: aquel es de servidor y su
 * resultado va **al log**, nunca al cliente (§0.3). Éste es de cliente y su
 * entrada es el `new Error("texto legible")` que la propia pantalla lanzó tras
 * leer el `{ error }` de la API, así que mostrarlo es correcto: no filtra nada
 * del servidor que el servidor no haya decidido contar.
 *
 * `apiError.ts` no sirve aquí porque importa `next/server`: usarlo en un
 * componente `"use client"` arrastraría código de servidor al bundle.
 */
export function mensajeDeError(err: unknown, porDefecto = "Error desconocido"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return porDefecto;
}
