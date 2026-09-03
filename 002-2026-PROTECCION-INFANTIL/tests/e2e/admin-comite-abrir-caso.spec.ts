/**
 * C12 · El comité de validación abre casos, pero no todos.
 *
 * Origen operativo: I-278/I-279/I-275 (03-09-2026). En prod el rol
 * `COMITE_VALIDACION` no podía abrir NINGÚN caso — «No se pudo cargar el
 * reporte...». La causa REAL, verificada por el CEO en la BD de producción,
 * NO era el código: la fila `PermisoModulo{rol:"COMITE_VALIDACION",
 * modulo:"comite_bandeja", activo:false}` estaba en `activo=false` con el
 * padre `comite` en activo=true. Un guardia denegando por diseño.
 *
 * Este spec **sella el comportamiento del código** — los 4 subcasos que la
 * vida real del comité produce, más los DOS torcidos del árbol de módulos que
 * son la condición que rompió producción. Un spec sobre base de pruebas
 * podría pasar en verde con el bug vivo en prod; por eso el recorrido en prod
 * queda como pendiente aparte (Jelkin habilita la cuenta, alguien lo camina),
 * pero este candado ya no se rompe sin avisar.
 *
 * NOTA: el spec MUTA `PermisoModulo` durante los tests torcidos. En `beforeAll`
 * guardamos el estado inicial y en `afterAll` lo restauramos.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const ADMIN_EMAIL = "e2e-c12-admin@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";
const COMITE_PROPIO_EMAIL = "e2e-c12-comite-propio@proteccion.local";
const COMITE_AJENO_EMAIL = "e2e-c12-comite-ajeno@proteccion.local";
const COMITE_PASSWORD = "Comite123!Secure";

const CORRIDA = `e2e-c12-${randomUUID().slice(0, 8)}`;
const PREFIJO_TEXTO = `${CORRIDA}-reporte`;

const sembrados = {
    reportes: new Set<string>(),
    usuarios: new Set<string>(),
};
type EstadoPermisoOriginal = { rol: string; moduloId: string; existia: boolean; activo: boolean };
const permisosOriginales: EstadoPermisoOriginal[] = [];

async function asegurarUsuario(email: string, rol: RolUsuario, password: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(password),
            rol,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function asegurarModulo(clave: string) {
    const m = await prisma.moduloPermisible.findUnique({ where: { clave } });
    // No creamos módulos ausentes: el catálogo lo maneja el seed. Si falta, el
    // spec falla ruidosamente y el arreglo es correr `prisma db seed`.
    expect(m, `módulo '${clave}' debe existir en el catálogo (corre prisma db seed)`).not.toBeNull();
    return m!;
}

/**
 * Setea `PermisoModulo(rol, moduloClave)` a `activo`, recordando el valor
 * previo para restaurarlo en `afterAll`. Idempotente por corrida.
 */
async function setPermiso(rol: string, moduloClave: string, activo: boolean) {
    const modulo = await asegurarModulo(moduloClave);
    const previo = await prisma.permisoModulo.findUnique({
        where: { rol_moduloId: { rol, moduloId: modulo.id } },
    });
    if (!permisosOriginales.some((p) => p.rol === rol && p.moduloId === modulo.id)) {
        permisosOriginales.push({
            rol,
            moduloId: modulo.id,
            existia: previo !== null,
            activo: previo?.activo ?? false,
        });
    }
    await prisma.permisoModulo.upsert({
        where: { rol_moduloId: { rol, moduloId: modulo.id } },
        update: { activo },
        create: { rol, moduloId: modulo.id, activo },
    });
}

async function restaurarPermisos() {
    for (const p of permisosOriginales) {
        if (p.existia) {
            await prisma.permisoModulo.update({
                where: { rol_moduloId: { rol: p.rol, moduloId: p.moduloId } },
                data: { activo: p.activo },
            });
        } else {
            await prisma.permisoModulo
                .delete({ where: { rol_moduloId: { rol: p.rol, moduloId: p.moduloId } } })
                .catch(() => {});
        }
    }
    permisosOriginales.length = 0;
}

async function obtenerPlataformaId(): Promise<string> {
    const p = await prisma.plataforma.findFirst({ select: { id: true } });
    if (!p) throw new Error("No hay Plataforma sembrada (corre `prisma db seed`)");
    return p.id;
}

async function crearReporteConComite(comiteId: string, sufijo: string, plataformaId: string): Promise<string> {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `${CORRIDA}-id-${sufijo}`,
            plataformaId,
            texto: `${PREFIJO_TEXTO}-${sufijo}: reporte del spec c12`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-C12-${sufijo.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            estado: "REVISION_MANUAL",
            comiteId,
        },
    });
    sembrados.reportes.add(reporte.id);
    return reporte.id;
}

async function login(page: import("@playwright/test").Page, email: string, password: string, quien: string) {
    // Logout defensivo: si la jarra tiene sesión previa, se refresca al hacer POST.
    const res = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${quien}`).toBe(200);
}

async function limpiarSembrados() {
    const idsR = [...sembrados.reportes];
    const idsU = [...sembrados.usuarios];
    if (idsR.length > 0) await prisma.reporte.deleteMany({ where: { id: { in: idsR } } });
    if (idsU.length > 0) await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
    sembrados.reportes.clear();
    sembrados.usuarios.clear();
}

test.describe.serial("Comité de Validación abre casos (C12)", () => {
    let comitePropioId: string;
    let comiteAjenoId: string;
    let reportePropio: string;
    let reporteAjeno: string;

    test.beforeAll(async () => {
        await asegurarUsuario(ADMIN_EMAIL, "ADMIN" as RolUsuario, ADMIN_PASSWORD, "Admin E2E C12");
        comitePropioId = await asegurarUsuario(
            COMITE_PROPIO_EMAIL,
            "COMITE_VALIDACION" as RolUsuario,
            COMITE_PASSWORD,
            "Comité E2E C12 propio"
        );
        comiteAjenoId = await asegurarUsuario(
            COMITE_AJENO_EMAIL,
            "COMITE_VALIDACION" as RolUsuario,
            COMITE_PASSWORD,
            "Comité E2E C12 ajeno"
        );
        const plataformaId = await obtenerPlataformaId();
        reportePropio = await crearReporteConComite(comitePropioId, "propio", plataformaId);
        reporteAjeno = await crearReporteConComite(comiteAjenoId, "ajeno", plataformaId);

        // Estado base: comité + comite_bandeja activos para COMITE_VALIDACION
        // (así vive el rol en producción sana). Los torcidos los aplica su test.
        await setPermiso("COMITE_VALIDACION", "comite", true);
        await setPermiso("COMITE_VALIDACION", "comite_bandeja", true);
        // Adicional que suele estar en la config: bandeja_reportes NO va al comité
        // (I-274 los separó a propósito). Aseguramos que NO tiene ese permiso.
        await setPermiso("COMITE_VALIDACION", "bandeja_reportes", false);
    });

    test.afterAll(async () => {
        await restaurarPermisos();
        await limpiarSembrados();
    });

    test("A · comité abre su caso propio → 200", async ({ page }) => {
        await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
        const res = await page.request.get(`/api/admin/reportes-revision/${reportePropio}`);
        expect(res.status(), "GET propio").toBe(200);
        const body = (await res.json()) as { id?: string };
        expect(body.id).toBe(reportePropio);
    });

    test("B · comité NO abre caso ajeno → 403 con mensaje real (no I-279 genérico)", async ({ page }) => {
        await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
        const res = await page.request.get(`/api/admin/reportes-revision/${reporteAjeno}`);
        expect(res.status(), "GET ajeno").toBe(403);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message, "mensaje real del 403 ajeno").toBe("No tienes permiso para ver este caso");
    });

    test("C · comité NO puede clasificar/confirmar/reasignar → 403 «Sin acceso al módulo»", async ({ page }) => {
        await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
        // Los tres endpoints exigen `bandeja_reportes` (SPEC-374). Comité NO lo tiene
        // (permiso apagado en `beforeAll`). Espero 403 «Sin acceso al módulo» de assertModulo.
        const rutas = [
            `/api/admin/reportes-revision/${reportePropio}/clasificar`,
            `/api/admin/reportes-revision/${reportePropio}/confirmar`,
            `/api/admin/reportes-revision/${reportePropio}/reasignar`,
        ];
        for (const ruta of rutas) {
            const res = await page.request.post(ruta, { data: {} });
            expect(res.status(), `POST ${ruta}`).toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, `mensaje real de ${ruta}`).toBe("Sin acceso al módulo");
        }
    });

    test("D · hijo comite_bandeja apagado con padre comite activo → 403 (candado I-278)", async ({ page }) => {
        await setPermiso("COMITE_VALIDACION", "comite_bandeja", false);
        try {
            await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
            const res = await page.request.get(`/api/admin/reportes-revision/${reportePropio}`);
            expect(res.status(), "GET propio con comite_bandeja apagado").toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, "mensaje real cuando el módulo está apagado").toBe("Sin acceso al módulo");
        } finally {
            await setPermiso("COMITE_VALIDACION", "comite_bandeja", true);
        }
    });

    test("E · padre comite apagado con hijo comite_bandeja activo → 403 (agujero jerárquico)", async ({ page }) => {
        await setPermiso("COMITE_VALIDACION", "comite", false);
        try {
            await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
            const res = await page.request.get(`/api/admin/reportes-revision/${reportePropio}`);
            expect(res.status(), "GET propio con padre comite apagado").toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, "mensaje real cuando el padre está apagado").toBe("Sin acceso al módulo");
        } finally {
            await setPermiso("COMITE_VALIDACION", "comite", true);
        }
    });
});
