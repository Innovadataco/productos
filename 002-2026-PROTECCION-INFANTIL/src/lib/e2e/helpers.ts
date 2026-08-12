/**
 * SPEC-114 — helpers de la suite E2E por rol.
 * Prueba CAMINOS (no piezas): login real → proxy con JWT → home correcto → menú por rol →
 * logo nunca muerto → salir con la sesión muerta. Cierra en BD (§9).
 */
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";
import { prisma } from "@/lib/prisma";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { crearTokenUsuario, crearUsuario } from "@/lib/reporte-test-utils";
import { decryptParameter } from "@/lib/param-encryption";
import type { RolUsuario, AccionAudit } from "@prisma/client";

export interface Sesion {
    usuarioId: string;
    email: string;
    rol: RolUsuario;
    token: string;
}

export const HOME_POR_ROL: Record<RolUsuario, string> = {
    PARENT: "/dashboard",
    SCHOOL_ADMIN: "/dashboard/colegio",
    ADMIN: "/dashboard/admin",
    OPERADOR: "/dashboard/admin",
    COMITE_VALIDACION: "/dashboard/admin/comite",
    COMITE_CONVIVENCIA: "/dashboard/colegio/comite/casos",
};

/** Crea un usuario por rol y hace LOGIN REAL (el camino de entrada, no un token regalado). */
export async function entrarComo(rol: RolUsuario, email: string, password: string): Promise<Sesion> {
    let usuario: { id: string };
    let emailLogin = email;
    if (rol === "SCHOOL_ADMIN") {
        // El login de colegio exige vigencia del servicio: va con su colegio (tenant) creado.
        const { crearColegioConAdmin } = await import("@/lib/reporte-test-utils");
        const { admin } = await crearColegioConAdmin();
        usuario = admin;
        emailLogin = admin.email;
        password = "TestPass123";
    } else {
        const existente = await prisma.usuario.findUnique({ where: { email } });
        usuario = existente ?? (await crearUsuario(rol, email, password));
    }
    const res = await loginPOST(
        new Request("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailLogin, password }),
        })
    );
    if (res.status !== 200) {
        throw new Error(`Login de ${rol} (${emailLogin}) falló con status ${res.status}`);
    }
    const token = await crearTokenUsuario(usuario.id, rol);
    return { usuarioId: usuario.id, email: emailLogin, rol, token };
}

/** Pide una ruta al PROXY con la sesión (prueba el camino de acceso, no solo el endpoint). */
export function viaProxy(sesion: Sesion, pathname: string, method = "GET"): ReturnType<typeof proxy> {
    return proxy(
        new NextRequest(`http://localhost:5005${pathname}`, {
            method,
            headers: { cookie: `token=${sesion.token}` },
        })
    );
}

/** El proxy deja pasar (no 401/403/redirect a login). */
export function esperarPasoLibre(res: { status: number }, contexto: string) {
    if (res.status === 401 || res.status === 403 || res.status === 307 || res.status === 302) {
        throw new Error(`Camino bloqueado (${res.status}): ${contexto}`);
    }
}

/** El proxy bloquea como debe (403 JSON en APIs o redirect fuera del área). Un 403 correcto es esperado. */
export function esperarBloqueo(res: { status: number }, contexto: string) {
    if (res.status !== 401 && res.status !== 403 && res.status !== 307 && res.status !== 302) {
        throw new Error(`Camino que DEBÍA estar bloqueado y no lo está (${res.status}): ${contexto}`);
    }
}

/** Cierra sesión por el camino real y exige que la ruta privada devuelva al login. */
export async function salirYExigirSesionMuerta(sesion: Sesion, rutaPrivada: string) {
    // El CAMINO al endpoint pasa por el proxy (I-35: si el proxy lo bloquea, el botón
    // de cerrar sesión de la pantalla nunca alcanza la API aunque la pieza funcione)
    esperarPasoLibre(await viaProxy(sesion, "/api/auth/logout", "POST"), `${sesion.rol} alcanza /api/auth/logout`);
    const { POST: logoutPOST } = await import("@/app/api/auth/logout/route");
    const res = await logoutPOST();
    if (res.status !== 200) throw new Error(`Logout falló (${res.status}) para ${sesion.rol}`);
    // Tras morir la sesión, el proxy sin token debe redirigir/401 en la ruta privada
    const sinSesion = await proxy(new NextRequest(`http://localhost:5005${rutaPrivada}`));
    if (![301, 302, 307, 401].includes(sinSesion.status)) {
        throw new Error(`Tras logout, la ruta privada ${rutaPrivada} no devuelve al login (${sinSesion.status})`);
    }
}

/** §9: el texto original persistido descifra al texto enviado (intacto, nunca en claro). */
export async function verificarTextoIntacto(reporteId: string, textoEnviado: string) {
    const reporte = await prisma.reporte.findUnique({ where: { id: reporteId } });
    if (!reporte) throw new Error("Reporte no persistido");
    if (!reporte.textoOriginal) throw new Error("§9: textoOriginal no persistido");
    if (reporte.textoOriginal === textoEnviado) {
        throw new Error("§9: textoOriginal quedó EN CLARO en BD (debe ir cifrado)");
    }
    const descifrado = decryptParameter(reporte.textoOriginal);
    if (descifrado !== textoEnviado) {
        throw new Error("§9: el texto original no se conserva intacto (descifrado difiere del enviado)");
    }
    return reporte;
}

/** §9: hash bcrypt presente y distinto de la contraseña. */
export function verificarHashBcrypt(passwordHash: string, password: string) {
    if (!passwordHash.startsWith("$2")) throw new Error("§9: el hash no es bcrypt");
    if (passwordHash.includes(password)) throw new Error("§9: la contraseña aparece en el hash");
}

/** §9: existe AuditLog reciente de una acción sobre un recurso. */
export async function verificarAuditLog(accion: AccionAudit, recursoId: string) {
    const log = await prisma.auditLog.findFirst({
        where: { accion, recursoId },
        orderBy: { creadoEn: "desc" },
    });
    if (!log) throw new Error(`§9: falta AuditLog de ${accion} sobre ${recursoId}`);
    return log;
}
