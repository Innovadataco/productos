/**
 * SPEC-410 · El Verificador admite y devuelve.
 *
 * Candado del recorrido §9 y §5-bis del brief A-75 v2.0 (`762b77f`), mockup
 * aprobado por Jelkin (15d8bf42). Este spec mergea ANTES que SPEC-408 (Dev 01)
 * — todo entra con `test.fail` citando SPEC-408. Cuando Dev 01 despliegue el
 * rol `VERIFICADOR`, los modelos y las URLs, Playwright reporta "unexpected
 * pass" y Dev 01 quita los `test.fail` como parte de esa spec.
 *
 * Contrato de rutas fijado por el CEO 03-09 15:3x/15:4x, verificado contra
 * `origin/main` y pasado a Dev 01 como obligatorio (mismo patrón que el
 * comité — rol interno no-ADMIN bajo `/api/admin/` cortado por módulo; cara
 * del profesional bajo `/api/profesional/{recurso}` sin prefijo `mi-`):
 *   · pantalla   `/dashboard/admin/verificacion` (+ `/incidentes`)
 *   · GET        `/api/admin/verificacion-profesionales`
 *   · GET        `/api/admin/verificacion-profesionales/[id]`
 *   · POST       `/api/admin/verificacion-profesionales/[id]/decidir`
 *   · GET        `/api/admin/verificacion-profesionales/incidentes`
 *   · GET        `/api/profesional/perfil`            (YA existe en origin/main)
 *   · GET        `/api/profesional/verificacion`      (SPEC-408)
 *   · POST       `/api/profesional/verificacion/reenviar` (SPEC-408)
 * El endpoint `decidir` acepta los 3 resultados: APROBADO, RECHAZADO,
 * MAS_INFORMACION.
 *
 * Aislamiento como C12 (SPEC-393): usuarios efímeros por corrida, cero
 * mutación de rol real, limpieza en `afterAll`. Los modelos `PerfilProfesional`
 * y `VerificacionProfesional` aún no existen en `origin/main`; la siembra usa
 * `$executeRaw` para no depender del tipo generado por Prisma — cuando SPEC-408
 * los cree, el runtime encontrará las tablas.
 *
 * LOS CINCO CANDADOS (uno por test):
 *   (1) con un requisito en `NO CUMPLE`, aprobar está bloqueado
 *   (2) rechazar sin observación no se puede
 *   (3) al devolver, solo vuelve lo que quedó mal — lo aprobado no se recarga
 *   (4) el ciclo se puede repetir sin límite
 *   (5) `resultado` y `checklist` NUNCA salen por API pública ni los ve el
 *       profesional — barrido tipo H-2 del directorio del padre
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-410-${randomUUID().slice(0, 8)}`;
const PROFESIONAL_EMAIL = `${CORRIDA}-profesional@proteccion.local`;
const PROFESIONAL_PASSWORD = "Profesional123!Secure";
const VERIFICADOR_EMAIL = `${CORRIDA}-verificador@proteccion.local`;
const VERIFICADOR_PASSWORD = "Verificador123!Secure";

const sembrados = {
    usuarios: new Set<string>(),
};

let profesionalId = "";
let verificadorId = "";

async function asegurarUsuario(email: string, rol: string, password: string, nombre: string): Promise<string> {
    // El rol `VERIFICADOR` aún no está en el enum RolUsuario de Prisma (llega
    // con SPEC-408). El cast a RolUsuario evita el error de tipo en tsc; la
    // columna `rol` de Postgres acepta cualquier string, y `rolesConocidos()`
    // lo absorbe igual que hace C12 con su rol efímero de prueba.
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

async function sembrarPerfilYVerificacionEnRevision(): Promise<void> {
    // `PerfilProfesional` y `VerificacionProfesional` los introduce SPEC-408.
    // Siembra por SQL crudo para no depender del tipo generado; cuando la
    // migración desplegada cree las tablas, este bloque queda funcional. Con
    // `test.fail` activo, un runtime error acá también cumple con el candado.
    await prisma.$executeRawUnsafe(`
        INSERT INTO "PerfilProfesional" (
            id, "usuarioId", "nombreVisible", "tituloProfesional",
            "atiendeVirtual", "atiendePresencial", "aniosExperiencia",
            "presentacion", "tarifaConsultaCOP", "duracionMinutos",
            "emiteFactura", estado, "creadoEn", "actualizadoEn"
        ) VALUES (
            $1, $2, 'Psi Efímera 410', 'Psicóloga clínica',
            true, false, 5, 'Presentación de prueba', 120000, 60,
            false, 'EN_REVISION', NOW(), NOW()
        )
    `, `pp-${CORRIDA}`, profesionalId);

    await prisma.$executeRawUnsafe(`
        INSERT INTO "VerificacionProfesional" (
            id, "profesionalId", checklist, resultado, "creadoEn"
        ) VALUES (
            $1, $2, $3::jsonb, 'MAS_INFORMACION', NOW()
        )
    `, `vp-${CORRIDA}`, profesionalId, JSON.stringify([
        { id: "tarjeta", nombre: "Tarjeta profesional vigente", estado: "CUMPLE" },
        { id: "antecedentes", nombre: "Antecedentes del profesional", estado: "CUMPLE" },
        { id: "cedula", nombre: "Cédula", estado: "NO_CUMPLE", observacion: "Foto ilegible" },
        { id: "soporte", nombre: "Otro documento de soporte", estado: "CUMPLE" },
    ]));
}

async function login(page: Page, email: string, password: string) {
    const res = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function limpiarSembrados() {
    // Orden: filas dependientes primero (Verificación y Perfil pertenecen al
    // profesional). SQL raw para no depender de tipos aún ausentes.
    await prisma.$executeRawUnsafe(`DELETE FROM "VerificacionProfesional" WHERE "profesionalId" = $1`, profesionalId).catch(() => undefined);
    await prisma.$executeRawUnsafe(`DELETE FROM "PerfilProfesional" WHERE "usuarioId" = $1`, profesionalId).catch(() => undefined);
    const idsU = [...sembrados.usuarios];
    if (idsU.length > 0) await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
    sembrados.usuarios.clear();
}

test.describe.serial("El Verificador admite y devuelve (SPEC-410 candado)", () => {
    test.beforeAll(async () => {
        profesionalId = await asegurarUsuario(PROFESIONAL_EMAIL, "PROFESIONAL", PROFESIONAL_PASSWORD, "Profesional E2E 410");
        verificadorId = await asegurarUsuario(VERIFICADOR_EMAIL, "VERIFICADOR", VERIFICADOR_PASSWORD, "Verificador E2E 410");
        await sembrarPerfilYVerificacionEnRevision();
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    /**
     * (1) Con un requisito en `NO CUMPLE`, aprobar está bloqueado.
     */
    test("(1) aprobar bloqueado si hay al menos un requisito NO CUMPLE", async ({ page }) => {
        test.fail(true, "URLs y modelo aún no en origin/main; SPEC-408 (Dev 01) los crea. Este candado se quita en esa spec.");
        await login(page, VERIFICADOR_EMAIL, VERIFICADOR_PASSWORD);
        const res = await page.request.post(
            `/api/admin/verificacion-profesionales/${encodeURIComponent(profesionalId)}/decidir`,
            { data: { resultado: "APROBADO" } }
        );
        expect(
            [400, 409, 422].includes(res.status()),
            `aprobar con NO_CUMPLE debe rechazar con 4xx; devolvió ${res.status()}`
        ).toBe(true);
    });

    /**
     * (2) Rechazar sin observación no se puede — el profesional tiene que
     * saber qué corregir (§5-bis).
     */
    test("(2) rechazar/devolver sin observación devuelve 4xx", async ({ page }) => {
        test.fail(true, "SPEC-408 (Dev 01) define el schema de observación obligatoria en /decidir.");
        await login(page, VERIFICADOR_EMAIL, VERIFICADOR_PASSWORD);
        const res = await page.request.post(
            `/api/admin/verificacion-profesionales/${encodeURIComponent(profesionalId)}/decidir`,
            {
                data: {
                    resultado: "MAS_INFORMACION",
                    checklist: [{ id: "cedula", estado: "NO_CUMPLE" /* sin observacion */ }],
                },
            }
        );
        expect(
            [400, 422].includes(res.status()),
            `MAS_INFORMACION sin observación debe rechazar con 4xx; devolvió ${res.status()}`
        ).toBe(true);
    });

    /**
     * (3) Al devolver, solo vuelve lo que quedó mal — los ítems aprobados
     * NO se recargan (§5-bis, §9 momento 2).
     */
    test("(3) devolver mantiene aprobados los ítems que ya cumplían", async ({ page }) => {
        test.fail(true, "SPEC-408 (Dev 01) implementa la semántica de re-envío parcial.");
        await login(page, VERIFICADOR_EMAIL, VERIFICADOR_PASSWORD);
        // Devuelvo con observación en cédula (el único NO CUMPLE).
        const resDev = await page.request.post(
            `/api/admin/verificacion-profesionales/${encodeURIComponent(profesionalId)}/decidir`,
            {
                data: {
                    resultado: "MAS_INFORMACION",
                    checklist: [{ id: "cedula", estado: "NO_CUMPLE", observacion: "Foto ilegible, subir otra" }],
                },
            }
        );
        expect(resDev.status(), "MAS_INFORMACION con observación debe cerrar con 200").toBe(200);

        // Ahora el profesional entra y consulta su vista de re-envío — debe
        // ver SOLO el ítem `cedula` como pendiente de corregir; los otros 3
        // quedan cerrados desde la corrida previa.
        await login(page, PROFESIONAL_EMAIL, PROFESIONAL_PASSWORD);
        const resMi = await page.request.get("/api/profesional/verificacion");
        expect(resMi.status(), "profesional lee su verificación en curso").toBe(200);
        const body = (await resMi.json()) as { pendientes?: Array<{ id: string }> };
        const pendientes = body.pendientes ?? [];
        expect(pendientes.map((p) => p.id).sort(), "solo `cedula` debe estar pendiente").toEqual(["cedula"]);
    });

    /**
     * (4) El ciclo profesional → verificador → devolver → profesional se
     * repite sin límite hasta aprobar. Este candado hace 3 vueltas seguidas
     * — si el sistema pone un tope, truena.
     */
    test("(4) el ciclo de devolución no tiene tope de intentos", async ({ page }) => {
        test.fail(true, "SPEC-408 (Dev 01) confirma que no hay `MAX_INTENTOS` bajo el capó.");
        for (let vuelta = 1; vuelta <= 3; vuelta++) {
            await login(page, VERIFICADOR_EMAIL, VERIFICADOR_PASSWORD);
            const resDev = await page.request.post(
                `/api/admin/verificacion-profesionales/${encodeURIComponent(profesionalId)}/decidir`,
                {
                    data: {
                        resultado: "MAS_INFORMACION",
                        checklist: [{ id: "cedula", estado: "NO_CUMPLE", observacion: `Vuelta ${vuelta}: aún ilegible` }],
                    },
                }
            );
            expect(resDev.status(), `vuelta ${vuelta} debe cerrar con 200`).toBe(200);

            await login(page, PROFESIONAL_EMAIL, PROFESIONAL_PASSWORD);
            const resReenvio = await page.request.post("/api/profesional/verificacion/reenviar", { data: {} });
            expect(resReenvio.status(), `reenvío ${vuelta} debe cerrar con 200`).toBe(200);
        }
    });

    /**
     * (5) `resultado` y `checklist` NUNCA salen por API pública ni los ve
     * el profesional (§5 legal + §5-bis). Barrido tipo H-2 del directorio.
     * Los campos internos también: `numeroTarjetaProfesional`,
     * `datosFacturacion`, `autorizacionArchivoUrl`.
     */
    test("(5) resultado y checklist son reserva legal — barrido de fugas", async ({ page }) => {
        test.fail(true, "SPEC-408 (Dev 01) tapa las fugas con DTO H-2 tipo directorio.");
        const CAMPOS_RESERVA = ["resultado", "checklist", "numeroTarjetaProfesional", "datosFacturacion", "autorizacionArchivoUrl"];

        // (a) Vista pública (padre): perfil del profesional en el directorio.
        const resPub = await page.request.get(`/api/publico/profesionales/${encodeURIComponent(profesionalId)}`);
        const bodyPub = resPub.status() === 200 ? await resPub.text() : "";
        for (const campo of CAMPOS_RESERVA) {
            expect(bodyPub, `campo reservado '${campo}' NO puede salir por /api/publico/profesionales`).not.toContain(`"${campo}"`);
        }

        // (b) Vista propia del profesional autenticado: ve su perfil y su
        // tarjeta (son suyos), NUNCA el `resultado` o el `checklist` (eso es
        // evaluación de IDC sobre él).
        await login(page, PROFESIONAL_EMAIL, PROFESIONAL_PASSWORD);
        const resPerfil = await page.request.get("/api/profesional/perfil");
        const bodyPerfil = resPerfil.status() === 200 ? await resPerfil.text() : "";
        for (const campo of ["resultado", "checklist"]) {
            expect(bodyPerfil, `campo '${campo}' es evaluación de IDC — el profesional NO lo puede ver en /perfil`).not.toContain(`"${campo}"`);
        }

        // (c) La vista `/api/profesional/verificacion` es el punto MÁS delicado
        // (aviso del CEO 15:4x): el profesional DEBE ver las observaciones que
        // le dejaron para poder corregir, pero NUNCA el `resultado` ni el
        // `checklist` — esa es la evaluación de IDC sobre él, no un dato suyo
        // (brief §5). Este es el assert que más importa del test.
        const resVer = await page.request.get("/api/profesional/verificacion");
        const bodyVer = resVer.status() === 200 ? await resVer.text() : "";
        expect(
            bodyVer,
            "el profesional SÍ debe ver las observaciones que le escribieron (para poder corregir)"
        ).toMatch(/observacion|ilegible/i);
        for (const campo of ["resultado", "checklist"]) {
            expect(
                bodyVer,
                `RESERVA LEGAL — /api/profesional/verificacion NUNCA puede exponer '${campo}' (evaluación de IDC sobre el profesional, brief §5)`
            ).not.toContain(`"${campo}"`);
        }
    });
});
