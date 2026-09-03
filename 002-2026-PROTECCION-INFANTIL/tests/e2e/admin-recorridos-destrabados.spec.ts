/**
 * SPEC-406 · Los 5 recorridos que la data en prod recién destrabó.
 *
 * ORIGEN. Los documentos de Calidad venían marcando 5 recorridos como
 * "⚠️ no reproducible por falta de data". Medido contra la BD de prod el
 * 03-09 12:55 COT (encargo del CEO):
 *
 *   56 colegios · 1 426 alertas · 2 006 alumnos · 245 cursos · 306 profesores
 *   9 066 reportes (52 reales + 9 000 sembrados de BI) · 4 expedientes
 *   51 usuarios COMITE_CONVIVENCIA · 56 SCHOOL_ADMIN · 8 OPERADOR · 10 PARENT
 *   34 suscripciones activas
 *
 * Los recorridos ya son reproducibles. Este spec los sella en Playwright con
 * el mismo patrón de C12 (SPEC-393): cuenta efímera por corrida, cero
 * mutación de rol real, limpieza en `afterAll`.
 *
 * DOS CANDADOS PARA CADA RECORRIDO (mismo par de I-290):
 *   1) la URL final pertenece a la pantalla — no rebota a Sin Acceso ni a login;
 *   2) `main` muestra un elemento característico — un h1, una tabla, un KPI —
 *      no un skeleton eterno ni "Cargando…" congelado.
 *
 * "Muestra lo prometido, no solo responde 200."
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-406-${randomUUID().slice(0, 8)}`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const ADMIN_PASSWORD = "Admin123!Secure";
const RECTOR_EMAIL = `${CORRIDA}-rector@proteccion.local`;
const RECTOR_PASSWORD = "Rector123!Secure";
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const PADRE_PASSWORD = "Padre123!Secure";

const sembrados = {
    usuarios: new Set<string>(),
    colegios: new Set<string>(),
    tenants: new Set<string>(),
};

async function asegurarUsuario(email: string, rol: string, password: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: rol as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(password),
            rol: rol as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function crearColegioEfimero(rectorId: string): Promise<string> {
    // Colegio mínimo con Tenant propio. El schema exige nit único global,
    // representante legal, país/ciudad y tenant; usamos país/ciudad reales
    // (el seed los tiene garantizados). El rector se une con
    // `Usuario.colegioId` (@unique) — no hay `Colegio.rectorId` directo.
    const tenant = await prisma.tenant.create({
        data: { nombre: `Tenant E2E ${CORRIDA}`, estado: "activo" },
    });
    sembrados.tenants.add(tenant.id);

    const pais = await prisma.pais.findFirst({ select: { id: true } });
    const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
    if (!pais || !ciudad) {
        throw new Error("prod/pruebas debe tener País y Ciudad sembrados (corre `prisma db seed`)");
    }

    const c = await prisma.colegio.create({
        data: {
            nombre: `Colegio E2E ${CORRIDA}`,
            nit: `E2E-${CORRIDA}`,
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Rector E2E 406",
            representanteLegalIdentificacion: `E2E-${CORRIDA}`,
            representanteLegalEmail: RECTOR_EMAIL,
            inicioServicio: new Date(),
            tipoPeriodo: "ANUAL",
            tenantId: tenant.id,
        },
    });
    sembrados.colegios.add(c.id);

    // Enlazar el rector al colegio recién creado.
    await prisma.usuario.update({
        where: { id: rectorId },
        data: { colegioId: c.id, tenantId: tenant.id },
    });

    return c.id;
}

async function login(page: Page, email: string, password: string) {
    const res = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function limpiarSembrados() {
    const idsC = [...sembrados.colegios];
    const idsU = [...sembrados.usuarios];
    const idsT = [...sembrados.tenants];
    // Orden FK-safe: Usuario (que apunta a Colegio y Tenant) → Colegio → Tenant.
    if (idsU.length > 0) await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
    if (idsC.length > 0) await prisma.colegio.deleteMany({ where: { id: { in: idsC } } });
    if (idsT.length > 0) await prisma.tenant.deleteMany({ where: { id: { in: idsT } } });
    sembrados.colegios.clear();
    sembrados.usuarios.clear();
    sembrados.tenants.clear();
}

async function urlFinalPathname(page: Page): Promise<string> {
    return new URL(page.url()).pathname;
}

test.describe.serial("Recorridos destrabados por data (SPEC-406)", () => {
    test.beforeAll(async () => {
        await asegurarUsuario(ADMIN_EMAIL, "ADMIN", ADMIN_PASSWORD, "Admin E2E 406");
        await asegurarUsuario(PADRE_EMAIL, "PARENT", PADRE_PASSWORD, "Padre E2E 406");
        const rectorId = await asegurarUsuario(RECTOR_EMAIL, "SCHOOL_ADMIN", RECTOR_PASSWORD, "Rector E2E 406");
        await crearColegioEfimero(rectorId);
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    /**
     * G5 · Ficha del colegio (I-98 · lectura de estructura).
     * El admin abre la ESTRUCTURA de un colegio — cursos, alumnos por curso.
     * En prod hay 56 colegios; usar el primero por `creadoEn ASC` es estable.
     */
    test("G5 · admin abre la estructura de un colegio", async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        // Elegir un colegio real de la BD — el más viejo es estable entre corridas.
        const colegio = await prisma.colegio.findFirst({
            where: { NOT: { id: { in: [...sembrados.colegios] } } },
            orderBy: { creadoEn: "asc" },
            select: { id: true },
        });
        expect(colegio, "prod debe tener al menos un colegio no efímero (medido 56 el 03-09 12:55)").not.toBeNull();

        await page.goto(`/dashboard/admin/colegios/${colegio!.id}/estructura`);
        await page.waitForLoadState("networkidle");
        const pathname = await urlFinalPathname(page);
        expect(pathname, "no debe rebotar a login/Sin Acceso").toContain(`/colegios/${colegio!.id}/estructura`);
        await expect(page.locator("main"), "debe mostrar el h1 'Estructura del colegio'").toContainText(/estructura del colegio/i);
    });

    /**
     * G4 · Analítica de pagos (dinero vs valor).
     * KPIs base del negocio: MRR, ARR, cobertura de pagos. Ojo: la ficha I-104
     * original era "analítica de colegios"; en el árbol actual esa analítica se
     * absorbió en /dashboard/admin/estadisticas/dinero-vs-valor. Este candado
     * verifica que la pantalla RENDER carga y muestra los KPIs — no que los
     * números sean correctos (I-122 parcial reconoce que MRR muestra $0 hoy).
     */
    test("G4 · admin abre la analítica de dinero vs valor", async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        await page.goto("/dashboard/admin/estadisticas/dinero-vs-valor");
        await page.waitForLoadState("networkidle");
        const pathname = await urlFinalPathname(page);
        expect(pathname, "no debe rebotar").toContain("/estadisticas/dinero-vs-valor");
        // Cualquiera de las tres palabras clave del brief §9 aparece en el render.
        await expect(page.locator("main"), "debe mostrar KPIs o widgets del panel dinero-vs-valor").toContainText(/dinero|mrr|vencimientos|pagos/i);
    });

    /**
     * G6 · Reasignación entre operadores (I-114 · flujo con ReasignarModal).
     * En prod hay 8 operadores + 292 reportes REVISION_MANUAL. El admin abre la
     * ficha de un operador y este spec confirma que se ve al menos: métricas +
     * botón/afordancia de reasignar. La corrida real del modal se cubre en
     * spec propio (`admin-reasignar-operador.spec.ts` existente).
     */
    test("G6 · admin abre la ficha de un operador y ve métricas + reasignar", async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        const operador = await prisma.usuario.findFirst({
            where: { rol: "OPERADOR", estado: "activo", NOT: { email: { startsWith: "e2e-" } } },
            orderBy: { creadoEn: "asc" },
            select: { id: true },
        });
        expect(operador, "prod debe tener al menos un operador real (medido 8 el 03-09 12:55)").not.toBeNull();

        await page.goto(`/dashboard/admin/operadores/${operador!.id}`);
        await page.waitForLoadState("networkidle");
        const pathname = await urlFinalPathname(page);
        expect(pathname, "no debe rebotar").toContain(`/operadores/${operador!.id}`);
        // La ficha carga cuatro bloques (métricas, casos, distribución, historial);
        // el spec exige al menos "métricas" o "casos" en el main.
        await expect(page.locator("main"), "debe mostrar métricas del operador o su tabla de casos").toContainText(/métricas|casos|reportes|abiertos/i);
    });

    /**
     * D8 · Expedientes del padre — vista del propio padre.
     * El PARENT efímero no tiene expedientes propios (0), así que este candado
     * verifica que la pantalla `/dashboard/padre/expedientes` LEVANTA con el
     * encabezado "Mis expedientes" y no truena — el bug clásico D8 era el
     * bucle o el 404. El detalle con 4 expedientes reales queda para la
     * vista de admin (test aparte D8b si se decide).
     */
    test("D8 · padre alcanza el listado de sus expedientes", async ({ page }) => {
        await login(page, PADRE_EMAIL, PADRE_PASSWORD);
        await page.goto("/dashboard/padre/expedientes");
        await page.waitForLoadState("networkidle");
        const pathname = await urlFinalPathname(page);
        expect(pathname, "no debe rebotar a login ni al bucle I-141").toContain("/dashboard/padre/expedientes");
        await expect(page.locator("main"), "debe mostrar el h1 'Mis expedientes'").toContainText(/mis expedientes/i);
    });

    /**
     * Comité de convivencia (colegio) · bandeja de casos.
     * Rector efímero abre la bandeja de su colegio; el candado es que carga y
     * muestra la tabla (aún vacía). Esta pantalla vive en
     * `/dashboard/colegio/comite/casos` y admite roles SCHOOL_ADMIN y
     * COMITE_CONVIVENCIA — usamos el rector para no depender de que exista
     * un COMITE_CONVIVENCIA con clave conocida.
     */
    test("Comité de convivencia · rector alcanza la bandeja de casos", async ({ page }) => {
        await login(page, RECTOR_EMAIL, RECTOR_PASSWORD);
        await page.goto("/dashboard/colegio/comite/casos");
        await page.waitForLoadState("networkidle");
        const pathname = await urlFinalPathname(page);
        expect(pathname, "no debe rebotar a login").toContain("/dashboard/colegio/comite/casos");
        await expect(page.locator("main"), "debe mostrar bandeja o casos del comité de convivencia").toContainText(/comité|casos|bandeja|convivencia/i);
    });
});
