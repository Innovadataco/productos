/**
 * SPEC-612 — lectura de credenciales de las cuentas de Calidad, PURA (sin Prisma).
 *
 * Vive aparte del sembrado para que su candado sea de verdad UNITARIO: importar este módulo NO
 * instancia Prisma, así que la guarda «falta una variable → aborta» se prueba en la suite unit (sin
 * base) — el contrato de esa suite es correr sin BD. El sembrado (que sí toca la base) vive en
 * `scripts/seed-e2e-cuentas-calidad.ts` y se prueba en integración.
 *
 * `import type` de `@prisma/client`: solo el tipo `RolUsuario`, borrado en runtime — no arrastra el cliente.
 */
import type { RolUsuario } from "@prisma/client";

/** Cuenta intocable: orden permanente de Jelkin. Ni se siembra ni se puede usar como destino. */
export const EMAIL_INTOCABLE = "soporte@innovadataco.com";

export interface DefinicionCuenta {
    clave: "PADRE" | "PADRE2" | "PROFESIONAL";
    rol: RolUsuario;
    nombre: string;
    esProfesional: boolean;
}

/** Las tres cuentas. El correo y la clave NO viven acá: se leen del entorno por `clave`. */
export const DEFINICIONES: DefinicionCuenta[] = [
    { clave: "PADRE", rol: "PARENT", nombre: "Padre Calidad (E2E)", esProfesional: false },
    { clave: "PADRE2", rol: "PARENT", nombre: "Padre 2 Calidad (E2E)", esProfesional: false },
    { clave: "PROFESIONAL", rol: "PROFESIONAL", nombre: "Profesional Calidad (E2E)", esProfesional: true },
];

export interface CredencialCuenta extends DefinicionCuenta {
    email: string;
    secreto: string;
}

/**
 * Lee correo+clave de cada cuenta del ENTORNO y aborta si falta alguna — sin tocar nada (es pura).
 * «Falta una variable → no se escribe nada» es estructural: esta función no tiene forma de escribir.
 * Los nombres de variable se arman desde `clave` (no hay literal de credencial en el código, SPEC-107).
 */
export function leerCredencialesE2E(env: Record<string, string | undefined> = process.env): CredencialCuenta[] {
    const faltantes: string[] = [];
    for (const def of DEFINICIONES) {
        if (!env[`E2E_${def.clave}_EMAIL`]?.trim()) faltantes.push(`E2E_${def.clave}_EMAIL`);
        if (!env[`E2E_${def.clave}_PASSWORD`]?.trim()) faltantes.push(`E2E_${def.clave}_PASSWORD`);
    }
    if (faltantes.length > 0) {
        throw new Error(
            `[seed-e2e-calidad] Faltan variables de entorno (${faltantes.join(", ")}). Aborto sin escribir nada.`
        );
    }
    return DEFINICIONES.map((def) => {
        const email = env[`E2E_${def.clave}_EMAIL`]!.trim().toLowerCase();
        const secreto = env[`E2E_${def.clave}_PASSWORD`]!.trim();
        if (email === EMAIL_INTOCABLE) {
            throw new Error(`[seed-e2e-calidad] E2E_${def.clave}_EMAIL no puede ser la cuenta intocable ${EMAIL_INTOCABLE}.`);
        }
        return { ...def, email, secreto };
    });
}
