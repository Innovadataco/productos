import { db } from "@/lib/db";
import { evaluarSalud } from "@/lib/salud";

export const dynamic = "force-dynamic";

/** GET /api/salud · verifica la app y la conexión a la base. Sirve para verificar despliegues. */
export async function GET(): Promise<Response> {
  const version = process.env.APP_VERSION ?? "local";
  const salud = await evaluarSalud(async () => {
    await db.$queryRaw`SELECT 1`;
  }, version);
  // Pública (D-014): solo estado y versión, y sin caché.
  return Response.json(salud, { status: salud.estado === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
