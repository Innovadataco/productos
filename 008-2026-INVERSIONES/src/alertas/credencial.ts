/**
 * La credencial del servicio de las alertas: la conexión corre como `inv_alertas` (el rol con los permisos mínimos) y nada más.
 * Si el servicio arrancara con la clave de la app o del dueño, todo funcionaría igual pero con permisos de sobra: se detiene (salida 1,
 * como `revisarCredencial` del servicio de precios). Para las pruebas, `NODE_ENV=test` y `INV_ALERTAS_ROL_PRUEBA` admiten un rol
 * equivalente; en producción NODE_ENV no es «test» y esa variable no se mira. La configuración entra por parámetro.
 */
import type { PrismaClient } from "@prisma/client";

export const ROL_ALERTAS = "inv_alertas";
const FORMA_DE_ROL = /^[a-z_][a-z0-9_]{0,62}$/;

type Entorno = Readonly<Record<string, string | undefined>>;

export function rolesPermitidos(env: Entorno): string[] {
  const prueba = env["INV_ALERTAS_ROL_PRUEBA"];
  return env["NODE_ENV"] === "test" && prueba !== undefined && FORMA_DE_ROL.test(prueba) ? [ROL_ALERTAS, prueba] : [ROL_ALERTAS];
}

/** true si el usuario de la conexión es uno de los permitidos. */
export async function revisarCredencial(db: Pick<PrismaClient, "$queryRaw">, env: Entorno): Promise<boolean> {
  const filas = await db.$queryRaw<Array<{ u: string }>>`SELECT current_user::text AS u`;
  const actual = filas[0]?.u;
  return actual !== undefined && rolesPermitidos(env).includes(actual);
}
