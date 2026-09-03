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
 * Este spec **sella el comportamiento del código** — los 5 subcasos que la
 * vida real del comité produce, más los DOS torcidos del árbol de módulos que
 * son la condición que rompió producción. Un spec sobre base de pruebas
 * podría pasar en verde con el bug vivo en prod; por eso el recorrido en prod
 * queda como pendiente aparte (Jelkin habilita la cuenta, alguien lo camina),
 * pero este candado ya no se rompe sin avisar.
 *
 * AISLAMIENTO (aprendizaje del CEO 03-09 10:05 tras I-282):
 *   - `PermisoModulo` es estado GLOBAL COMPARTIDO. Mutar filas del rol real
 *     `COMITE_VALIDACION` compite con cualquier shard hermano que lea ese rol
 *     al mismo tiempo (lock en Postgres, o veredicto ambiguo si toca la
 *     ventana entre `set` y `restore`). Un `beforeAll/afterAll` con snapshot
 *     NO protege contra shards hermanos — solo contra los propios tests.
 *   - Por eso los subcasos que MUTAN (C, D, E) corren sobre un **rol de
 *     prueba dedicado** creado con un UUID único por corrida. Ningún otro
 *     spec puede leer ese rol → cero colisiones.
 *   - Los subcasos A y B necesitan `COMITE_VALIDACION` real porque la lógica
 *     del endpoint (`route.ts:55`) distingue ese rol por nombre; se resuelven
 *     ASERTANDO el estado inicial sin mutarlo.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-c12-${randomUUID().slice(0, 8)}`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const ADMIN_PASSWORD = "Admin123!Secure";
const COMITE_PROPIO_EMAIL = `${CORRIDA}-comite-propio@proteccion.local`;
const COMITE_AJENO_EMAIL = `${CORRIDA}-comite-ajeno@proteccion.local`;
const ROL_TEST_USER_EMAIL = `${CORRIDA}-rol-test@proteccion.local`;
const COMITE_PASSWORD = "Comite123!Secure";

/**
 * Rol EFÍMERO exclusivo de esta corrida — se usa solo para los subcasos que
 * mutan `PermisoModulo` (C, D, E). El UUID en el nombre garantiza que ningún
 * shard hermano lo esté leyendo.
 */
const ROL_TEST = `E2E_C12_ROL_${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

const PREFIJO_TEXTO = `${CORRIDA}-reporte`;

const sembrados = {
    reportes: new Set<string>(),
    usuarios: new Set<string>(),
    permisosRolTest: new Set<string>(), // ids de PermisoModulo del rol efímero
};

async function asegurarUsuario(email: string, rol: string, password: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: rol as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(password),
            // Cast necesario para el usuario del rol efímero (no está en el enum
            // `RolUsuario` en tiempo de compilación pero PostgreSQL lo acepta
            // como string en la columna; `rolesConocidos()` lo absorbe).
            rol: rol as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function moduloIdPorClave(clave: string): Promise<string> {
    const m = await prisma.moduloPermisible.findUnique({ where: { clave } });
    expect(m, `módulo '${clave}' debe existir en el catálogo (corre prisma db seed)`).not.toBeNull();
    return m!.id;
}

/** Setea (upsert) el permiso del ROL EFÍMERO — nunca del rol real. */
async function setPermisoRolTest(moduloClave: string, activo: boolean) {
    const moduloId = await moduloIdPorClave(moduloClave);
    const p = await prisma.permisoModulo.upsert({
        where: { rol_moduloId: { rol: ROL_TEST, moduloId } },
        update: { activo },
        create: { rol: ROL_TEST, moduloId, activo },
    });
    sembrados.permisosRolTest.add(p.id);
}

async function asertarPermisoRolReal(moduloClave: string, activoEsperado: boolean) {
    const moduloId = await moduloIdPorClave(moduloClave);
    const fila = await prisma.permisoModulo.findUnique({
        where: { rol_moduloId: { rol: "COMITE_VALIDACION", moduloId } },
    });
    const activoReal = fila?.activo ?? false;
    expect(
        activoReal,
        `PermisoModulo{rol:COMITE_VALIDACION, modulo:${moduloClave}} debe estar activo=${activoEsperado} (estado inicial esperado; corre prisma db seed si no)`
    ).toBe(activoEsperado);
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
    const res = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${quien}`).toBe(200);
}

async function limpiarSembrados() {
    const idsR = [...sembrados.reportes];
    const idsU = [...sembrados.usuarios];
    const idsP = [...sembrados.permisosRolTest];
    if (idsP.length > 0) await prisma.permisoModulo.deleteMany({ where: { id: { in: idsP } } });
    // El rol efímero puede tener filas huérfanas de un upsert previo; barrido total.
    await prisma.permisoModulo.deleteMany({ where: { rol: ROL_TEST } });
    if (idsR.length > 0) await prisma.reporte.deleteMany({ where: { id: { in: idsR } } });
    if (idsU.length > 0) await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
    sembrados.reportes.clear();
    sembrados.usuarios.clear();
    sembrados.permisosRolTest.clear();
}

test.describe.serial("Comité de Validación abre casos (C12 · SPEC-393)", () => {
    let comitePropioId: string;
    let comiteAjenoId: string;
    let usuarioRolTestId: string;
    let reportePropio: string;
    let reporteAjeno: string;
    let reporteRolTest: string;

    test.beforeAll(async () => {
        // Precondiciones NO mutantes: el seed del entorno debe tener el rol real
        // COMITE_VALIDACION con `comite` y `comite_bandeja` activos y
        // `bandeja_reportes` NO activo. Los subcasos A/B/C dependen de esto.
        await asertarPermisoRolReal("comite", true);
        await asertarPermisoRolReal("comite_bandeja", true);
        await asertarPermisoRolReal("bandeja_reportes", false);

        await asegurarUsuario(ADMIN_EMAIL, "ADMIN", ADMIN_PASSWORD, "Admin E2E C12");
        comitePropioId = await asegurarUsuario(
            COMITE_PROPIO_EMAIL,
            "COMITE_VALIDACION",
            COMITE_PASSWORD,
            "Comité E2E C12 propio"
        );
        comiteAjenoId = await asegurarUsuario(
            COMITE_AJENO_EMAIL,
            "COMITE_VALIDACION",
            COMITE_PASSWORD,
            "Comité E2E C12 ajeno"
        );
        usuarioRolTestId = await asegurarUsuario(
            ROL_TEST_USER_EMAIL,
            ROL_TEST,
            COMITE_PASSWORD,
            "Usuario rol efímero C12"
        );

        // Rol efímero: sembramos sus permisos base (D/E los mutarán y restaurarán).
        await setPermisoRolTest("comite", true);
        await setPermisoRolTest("comite_bandeja", true);

        const plataformaId = await obtenerPlataformaId();
        reportePropio = await crearReporteConComite(comitePropioId, "propio", plataformaId);
        reporteAjeno = await crearReporteConComite(comiteAjenoId, "ajeno", plataformaId);
        // El rol efímero también necesita "su" reporte para C/D/E; le pasamos su
        // propio id como comiteId aunque el rol no es COMITE_VALIDACION (el
        // endpoint solo mira comiteId cuando el rol es COMITE_VALIDACION exacto).
        reporteRolTest = await crearReporteConComite(usuarioRolTestId, "roltest", plataformaId);
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("A · comité real abre su caso propio → 200", async ({ page }) => {
        await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
        const res = await page.request.get(`/api/admin/reportes-revision/${reportePropio}`);
        expect(res.status(), "GET propio").toBe(200);
        const body = (await res.json()) as { id?: string };
        expect(body.id).toBe(reportePropio);
    });

    test("B · comité real NO abre caso ajeno → 403 con mensaje real (no I-279 genérico)", async ({ page }) => {
        await login(page, COMITE_PROPIO_EMAIL, COMITE_PASSWORD, "comité propio");
        const res = await page.request.get(`/api/admin/reportes-revision/${reporteAjeno}`);
        expect(res.status(), "GET ajeno").toBe(403);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message, "mensaje real del 403 ajeno").toBe("No tienes permiso para ver este caso");
    });

    test("C · sin `bandeja_reportes` → 403 «Sin acceso al módulo» en clasificar/confirmar/reasignar", async ({
        page,
    }) => {
        // Rol efímero: nunca sembramos `bandeja_reportes` para él, así que la
        // primera línea del handler (`assertModulo(user, "bandeja_reportes")`)
        // deniega. Es el mismo candado que dispara para COMITE_VALIDACION en
        // producción (donde `bandeja_reportes` está en activo=false), sin
        // mutar el rol real.
        await login(page, ROL_TEST_USER_EMAIL, COMITE_PASSWORD, "usuario rol efímero");
        const rutas = [
            `/api/admin/reportes-revision/${reporteRolTest}/clasificar`,
            `/api/admin/reportes-revision/${reporteRolTest}/confirmar`,
            `/api/admin/reportes-revision/${reporteRolTest}/reasignar`,
        ];
        for (const ruta of rutas) {
            const res = await page.request.post(ruta, { data: {} });
            expect(res.status(), `POST ${ruta}`).toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, `mensaje real de ${ruta}`).toBe("Sin acceso al módulo");
        }
    });

    test("D · hijo `comite_bandeja` apagado con padre `comite` activo → 403 (candado I-278)", async ({ page }) => {
        await setPermisoRolTest("comite_bandeja", false);
        try {
            await login(page, ROL_TEST_USER_EMAIL, COMITE_PASSWORD, "usuario rol efímero");
            const res = await page.request.get(`/api/admin/reportes-revision/${reporteRolTest}`);
            expect(res.status(), "GET con comite_bandeja apagado").toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, "mensaje real cuando el módulo está apagado").toBe("Sin acceso al módulo");
        } finally {
            await setPermisoRolTest("comite_bandeja", true);
        }
    });

    test("E · padre `comite` apagado con hijo `comite_bandeja` activo → 403 (agujero jerárquico)", async ({
        page,
    }) => {
        await setPermisoRolTest("comite", false);
        try {
            await login(page, ROL_TEST_USER_EMAIL, COMITE_PASSWORD, "usuario rol efímero");
            const res = await page.request.get(`/api/admin/reportes-revision/${reporteRolTest}`);
            expect(res.status(), "GET con padre comite apagado").toBe(403);
            const body = (await res.json()) as { error?: { message?: string } };
            expect(body.error?.message, "mensaje real cuando el padre está apagado").toBe("Sin acceso al módulo");
        } finally {
            await setPermisoRolTest("comite", true);
        }
    });
});
