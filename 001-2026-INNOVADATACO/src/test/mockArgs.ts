import { expect } from "vitest";

/**
 * Extrae los argumentos de la primera invocación de un mock, fallando con un
 * mensaje claro si nunca se llamó.
 *
 * Motivo: `mock.calls[0][0]` no compila bajo `strict` porque `calls[0]` puede ser
 * `undefined`. Acceder directamente dejaba el `type check` de `npm run build` en
 * rojo aunque la suite pasara (defecto arrastrado de la spec 002).
 *
 * Uso:
 *   const args = primerArgumento(vi.mocked(prisma.auditLog.findMany));
 *   expect(args.take).toBe(50);
 */
export function primerArgumento<A extends unknown[]>(mock: {
  mock: { calls: A[] };
}): NonNullable<A[0]> {
  const llamada = mock.mock.calls[0];
  expect(llamada, "se esperaba que el mock hubiera sido invocado").toBeDefined();

  // Muchos métodos de Prisma declaran su argumento como opcional (`findMany(args?)`),
  // así que el elemento también puede ser `undefined` a ojos del compilador.
  const argumento = (llamada as A)[0];
  expect(argumento, "se esperaba que el mock hubiera recibido argumentos").toBeDefined();

  return argumento as NonNullable<A[0]>;
}
