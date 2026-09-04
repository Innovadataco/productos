import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { rolesConocidos, obtenerRolesProtegidos } from "@/lib/permisos-modulos";
import { PermisoModuloRepository } from "@/lib/dal/repositories/permiso-modulo";
import { CLAVES_POR_ROL } from "../../../../../prisma/seed-modulos-grants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * SPEC-435 (Jelkin vivo 04-09) · Roles con lista de módulos CERRADA por fuente.
 * La refutación adversarial cazó que el PATCH sin whitelist permitía al ADMIN
 * contaminar VERIFICADOR con módulos ajenos (`operadores`, `padres`, …) desde
 * la UI `PermisosRolPanel`, aunque `CLAVES_POR_ROL.VERIFICADOR = [...un módulo]`.
 * El candado `verificador-modulos.candado.test.ts` protegía la fuente pero era
 * cosmético en runtime.
 *
 * Estos roles son «un rol, una persona, un trabajo» (lección I-278 / I-299):
 *   · VERIFICADOR — SOLO `admin_verificacion_profesionales`.
 *   · COMITE_CONVIVENCIA — SOLO su bandeja de casos.
 * El PATCH rechaza cualquier cambio (activar OTRO módulo o desactivar el único)
 * para uno de estos roles; el fix quirúrgico se hace por PR de arquitectura, no
 * por click de admin.
 */
const ROLES_CERRADOS: readonly string[] = ["VERIFICADOR", "COMITE_CONVIVENCIA"];

const patchSchema = z.object({
    cambios: z
        .array(
            z.object({
                rol: z.string().min(1).max(50),
                moduloId: z.string().min(1),
                activo: z.boolean(),
            })
        )
        .min(1)
        .max(100),
});

/**
 * GET /api/admin/permisos-modulos
 * Matriz completa: roles conocidos × árbol de módulos × permisos actuales.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "configuracion_permisos");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // E-8: las consultas viven en el repo; la ruta no toca prisma.
        const repo = new PermisoModuloRepository();
        const [roles, modulos, permisos, rolesProtegidos] = await Promise.all([
            rolesConocidos(),
            repo.listarArbolModulos(),
            repo.listarTodos(),
            obtenerRolesProtegidos(),
        ]);

        return NextResponse.json({
            roles,
            rolesProtegidos,
            modulos,
            permisos,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/permisos-modulos
 * Aplica cambios de permisos por rol con validación anti-lockout y auditoría.
 * El rol se valida contra los roles conocidos (un typo devuelve 400, no crea fila fantasma).
 */
export async function PATCH(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "configuracion_permisos");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = patchSchema.safeParse(await request.json());
        if (!body.success) {
            throw new AppError("Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const { cambios } = body.data;

        // Validar roles contra los conocidos (enum RolUsuario ∪ roles ya usados)
        const conocidos = await rolesConocidos();
        const desconocidos = [...new Set(cambios.map((c) => c.rol))].filter((r) => !conocidos.includes(r));
        if (desconocidos.length > 0) {
            throw new AppError(
                `Roles desconocidos: ${desconocidos.join(", ")}. Roles válidos: ${conocidos.join(", ")}`,
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        // Validar módulos
        // E-8: las consultas y la aplicación transaccional viven en el repo.
        const repo = new PermisoModuloRepository();
        const moduloIds = [...new Set(cambios.map((c) => c.moduloId))];
        const modulos = await repo.listarModulosPorIds(moduloIds);
        if (modulos.length !== moduloIds.length) {
            throw new AppError("Uno o más módulos no existen", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        // SPEC-435 · anti-crecimiento para roles cerrados (VERIFICADOR, COMITE_CONVIVENCIA):
        // «no hereda módulos de admin». Bloqueamos cualquier cambio a un rol cerrado —
        // ni activar módulo fuera de la lista, ni tocar el que sí tiene. El fix legítimo
        // pasa por PR de arquitectura editando `CLAVES_POR_ROL` (fuente única).
        const clavePorModuloId = new Map(modulos.map((m) => [m.id, m.clave]));
        const violacionesCerradas: string[] = [];
        for (const cambio of cambios) {
            if (!ROLES_CERRADOS.includes(cambio.rol)) continue;
            const permitidas = CLAVES_POR_ROL[cambio.rol] ?? [];
            const clave = clavePorModuloId.get(cambio.moduloId) ?? "?";
            const enLista = permitidas.includes(clave);
            if (cambio.activo && !enLista) {
                violacionesCerradas.push(`${cambio.rol}: no puede activar "${clave}" (fuera de la lista cerrada)`);
            } else if (!cambio.activo && enLista) {
                violacionesCerradas.push(`${cambio.rol}: no puede desactivar "${clave}" (dejaría al rol sin acceso a su único módulo)`);
            }
        }
        if (violacionesCerradas.length > 0) {
            throw new AppError(
                `Roles cerrados por diseño (SPEC-435): ${violacionesCerradas.join("; ")}. Editá CLAVES_POR_ROL en un PR y volvé a intentar.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }

        // Anti-lockout: simular el estado final y exigir que cada módulo crítico
        // conserve al menos un rol protegido activo.
        const rolesProtegidos = await obtenerRolesProtegidos();
        const criticos = await repo.listarCriticos();
        const permisosActuales = await repo.listarPermisosPorRolesYModulos(rolesProtegidos, criticos.map((m) => m.id));
        const estadoFinal = new Map(permisosActuales.map((p) => [`${p.rol}:${p.moduloId}`, p.activo]));
        for (const cambio of cambios) {
            estadoFinal.set(`${cambio.rol}:${cambio.moduloId}`, cambio.activo);
        }
        for (const critico of criticos) {
            const algunoActivo = rolesProtegidos.some((rol) => estadoFinal.get(`${rol}:${critico.id}`) === true);
            if (!algunoActivo) {
                throw new AppError(
                    `No se puede dejar a la plataforma sin acceso al módulo crítico "${critico.nombre}" (roles protegidos: ${rolesProtegidos.join(", ")})`,
                    ERROR_CODES.CONFLICT,
                    409
                );
            }
        }

        // Snapshot para auditoría
        const anteriores = await repo.snapshotDe(cambios);

        await repo.aplicarCambios(cambios, admin.id);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PERMISOS_MODULO_ACTUALIZADOS",
            tipoRecurso: "PermisoModulo",
            usuarioId: admin.id,
            valorAnterior: JSON.stringify(anteriores),
            valorNuevo: JSON.stringify(cambios),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ actualizados: cambios.length });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
