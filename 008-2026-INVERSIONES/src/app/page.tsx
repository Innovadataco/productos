import { Prisma } from "@prisma/client";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { aVista } from "./tablero/serializar";
import { Tablero } from "./tablero/Tablero";

// Lee la base en cada visita: los datos son locales y cambian con cada carga.
export const dynamic = "force-dynamic";

/** Solo los fallos de la base se muestran como «no se pudo leer»; un error de cálculo se propaga. */
const esErrorDeBase = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientInitializationError ||
  e instanceof Prisma.PrismaClientKnownRequestError ||
  e instanceof Prisma.PrismaClientUnknownRequestError;

function SinBase() {
  return (
    <main className="wrap" style={{ paddingBlock: "48px" }}>
      <h1>No se pudo leer la base de 008</h1>
      <p>Revise que la base esté arriba (<code>npm run db:up</code>) y que las migraciones estén aplicadas (<code>npx prisma migrate deploy</code>).</p>
    </main>
  );
}

export default async function Inicio() {
  let resumen: Resumen;
  try {
    // Revalida la sesión contra la base (D-014). Sin sesión, `redirect` lanza y el catch la deja pasar.
    await exigirSesion();
    resumen = await obtenerResumen(db);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    const codigo = (error as { errorCode?: unknown; code?: unknown }).errorCode ?? (error as { code?: unknown }).code ?? (error as Error).name;
    console.error(`[tablero] no se pudo leer la base (código: ${String(codigo)})`);
    return <SinBase />;
  }
  return <Tablero vista={aVista(resumen)} />;
}
