import bcrypt from "bcryptjs";

/**
 * Verificación del admin de bootstrap. Las credenciales viven SOLO en el
 * .env (lo escribe Jelkin, permisos 600); el hash bcrypt se calcula una vez
 * en caliente y se cachea — jamás hay clave en claro en el código.
 * Fail-closed: si falta configuración, nadie entra.
 */
let hashCache: string | null = null;
// B3: costo de bcrypt parametrizable por env (nada quemado en código).
const RONDAS = Number(process.env.BI_BCRYPT_RONDAS ?? "10");

export function verificarAdmin(email: string, password: string): boolean {
    const emailEnv = process.env.BI_ADMIN_EMAIL;
    const passEnv = process.env.BI_ADMIN_PASSWORD;
    if (!emailEnv || !passEnv) return false;
    if (email.trim().toLowerCase() !== emailEnv.trim().toLowerCase()) return false;
    if (!hashCache) hashCache = bcrypt.hashSync(passEnv, RONDAS);
    return bcrypt.compareSync(password, hashCache);
}
