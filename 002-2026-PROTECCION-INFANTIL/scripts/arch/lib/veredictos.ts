/**
 * SPEC-126 (D2/D5 + condición ZEUS 1): veredictos de acceso ejecutando el código REAL
 * de `src/lib/proxy.ts` (nunca reimplementado). La SESIÓN CANÓNICA del barrido rol × ruta
 * es un usuario activo con `debeCambiarPassword=false` y vigencia vigente: el proxy solo
 * lee `sub` y `rol` del JWT, así que el único eje que varía es el rol. El rol ANONIMO
 * (sin sesión) se evalúa aparte y sus divergencias se documentan como nota, nunca como rojo.
 *
 * Los JWT de prueba se firman con el patrón de `src/lib/e2e/helpers.ts` (jose + cookie
 * `token`), sin tocar la BD.
 */
import * as fs from "node:fs";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { proxy, esDestinoPermitidoPorRol } from "../../../src/lib/proxy";
import { RUTA_PROXY } from "./paths";

export const ROLES_AUTENTICADOS = ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "SCHOOL_ADMIN", "PARENT"] as const;
export type RolAutenticado = (typeof ROLES_AUTENTICADOS)[number];
export type RolBarrido = RolAutenticado | "ANONIMO";
export const ROLES_BARRIDO: RolBarrido[] = [...ROLES_AUTENTICADOS, "ANONIMO"];

/**
 * Clave de firma DUMMY para las aserciones (no es un secreto real: solo firma tokens
 * efímeros en memoria cuando el entorno no trae JWT_SECRET, p.ej. en CI). Si el entorno
 * ya define JWT_SECRET, se usa ese (el proxy lo lee en cada llamada).
 */
const JWT_SECRET_PRUEBA = "arch-check-jwt-secret-de-prueba-32chars";

function secretoEfectivo(): string {
    const delEntorno = process.env.JWT_SECRET;
    if (delEntorno && delEntorno.length >= 32) return delEntorno;
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    return JWT_SECRET_PRUEBA;
}

const tokens = new Map<string, Promise<string>>();

/** JWT de la sesión canónica para un rol (mismo payload que `crearTokenUsuario`: sub + rol). */
function tokenCanonico(rol: RolAutenticado): Promise<string> {
    let token = tokens.get(rol);
    if (!token) {
        token = new SignJWT({ sub: "arch-check-sesion-canonica", rol })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(secretoEfectivo()));
        tokens.set(rol, token);
    }
    return token;
}

export type Veredicto =
    | { tipo: "permitir" }
    | { tipo: "redirigir"; destino: string }
    | { tipo: "error"; status: number };

/** Ejecuta `proxy()` (la puerta real) con la sesión canónica del rol sobre una ruta. */
export async function veredictoProxy(rol: RolBarrido, ruta: string): Promise<Veredicto> {
    const headers = new Headers();
    if (rol !== "ANONIMO") headers.set("cookie", `token=${await tokenCanonico(rol)}`);
    const request = new NextRequest(`http://localhost:5005${ruta}`, { headers });
    const res = await proxy(request);
    if (res.headers.get("x-middleware-next") === "1") return { tipo: "permitir" };
    const location = res.headers.get("location");
    if (location) return { tipo: "redirigir", destino: new URL(location).pathname };
    return { tipo: "error", status: res.status };
}

/** Alineación D5: permitir ≡ true; cualquier 401/403/redirect ≡ false. */
export function veredictoPermite(veredicto: Veredicto): boolean {
    return veredicto.tipo === "permitir";
}

export function textoVeredicto(veredicto: Veredicto): string {
    if (veredicto.tipo === "permitir") return "permitir";
    if (veredicto.tipo === "redirigir") return `redirigir→${veredicto.destino}`;
    return `HTTP ${veredicto.status}`;
}

/** El predicado del menú (`esDestinoPermitidoPorRol`), ejecutado, nunca reimplementado. */
export function predicadoPermite(rol: RolBarrido, ruta: string): boolean {
    return esDestinoPermitidoPorRol(rol === "ANONIMO" ? null : rol, ruta);
}

/**
 * Rutas declaradas en las listas del propio `proxy.ts` (PUBLIC_ROUTES, USER_FINAL_ROUTES,
 * COLEGIO_ROUTES, SESION_ROUTES, PUBLICAS_LECTURA_SCHOOL_ADMIN, APIS_LECTURA_SCHOOL_ADMIN,
 * ADMIN_ONLY_ROUTES, REPORTAR_ROUTE y destinos de redirect). Se extraen del texto fuente
 * (las listas no se exportan y proxy.ts NO se toca): todo literal que pinta una ruta.
 */
export function rutasDeclaradasEnProxy(): string[] {
    const texto = fs.readFileSync(RUTA_PROXY, "utf-8");
    const rutas = new Set<string>();
    for (const m of texto.matchAll(/"(\/[a-zA-Z0-9\-/]*)"/g)) {
        rutas.add(m[1]);
    }
    return [...rutas].sort();
}
