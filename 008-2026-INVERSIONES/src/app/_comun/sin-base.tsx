/**
 * «No se pudo leer la base» para las páginas que leen la base de 008 (tablero y conciliación).
 * Solo los fallos de Prisma se muestran así; un error de cálculo se propaga (lo atiende src/app/error.tsx).
 * Se registra solo el código: el mensaje de Prisma puede traer la URL de la base.
 */
import { Prisma } from "@prisma/client";

export const esErrorDeBase = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientInitializationError ||
  e instanceof Prisma.PrismaClientKnownRequestError ||
  e instanceof Prisma.PrismaClientUnknownRequestError;

export function registrarFalloDeBase(origen: string, error: unknown): void {
  const codigo = (error as { errorCode?: unknown }).errorCode ?? (error as { code?: unknown }).code ?? (error as Error).name;
  console.error(`[${origen}] no se pudo leer la base (código: ${String(codigo)})`);
}

export function SinBase() {
  return (
    <main className="wrap" style={{ paddingBlock: "48px" }}>
      <h1>No se pudo leer la base de 008</h1>
      <p>Revise que la base esté arriba (<code>npm run db:up</code>) y que las migraciones estén aplicadas (<code>npx prisma migrate deploy</code>).</p>
    </main>
  );
}
