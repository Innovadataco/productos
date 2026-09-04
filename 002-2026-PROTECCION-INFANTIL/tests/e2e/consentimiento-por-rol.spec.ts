/**
 * SPEC-417 · El consentimiento se le pide SOLO a quien es titular del dato.
 *
 * Origen: I-118 cazada por Calidad; el recorrido en vivo del Verificador
 * (SPEC-410) confirmó que hoy `PROFESIONAL` y `VERIFICADOR` también son
 * empujados a `/consentimiento` — como ya lo eran `ADMIN`, `OPERADOR` y
 * `COMITE_*`. Firmar ese consentimiento como interno o como profesional
 * contratado ensucia `audit_consentimientos`, que es prueba LEGAL de que
 * un titular consintió.
 *
 * SPEC-416 (Dev 01) desplegó el guard filtrado por rol; los `test.fail`
 * fueron retirados como parte de esa spec. Los 8 tests corren ahora
 * afirmando el comportamiento correcto — si el bug reincide, truenan
 * de verdad, y en particular el bloque (B) protege que nadie afloje
 * el guard de los titulares por accidente.
 *
 * EL CANDADO VA EN LAS DOS DIRECCIONES — y la segunda importa más:
 *
 *   (A) Pasan sin consentimiento — el guard NO debe empujarlos a /consentimiento:
 *       ADMIN, OPERADOR, COMITE_VALIDACION, COMITE_CONVIVENCIA,
 *       VERIFICADOR, PROFESIONAL
 *       (empleados internos + profesionales contratados = no titulares).
 *
 *   (B) SIGUEN bloqueados sin consentimiento — el guard DEBE mantenerlos
 *       en el muro hasta que firmen:
 *       PARENT, SCHOOL_ADMIN
 *       (padre y rector = únicos titulares del dato de menores).
 *
 * (B) es el candado real. I-211 mostró que estos guardianes ya estuvieron
 * muertos meses. Si alguien mañana exime de más, este test truena en la
 * fila del titular fugado.
 *
 * FORMA DEL ASSERT (idéntica en las dos direcciones):
 *   Sondamos `GET /api/alertas` con la cookie de cada rol efímero.
 *   El middleware aplica el paso 4 (consentimiento) sobre todos los
 *   `/api/**` no exentos, y cuando dispara devuelve el JSON canónico
 *   `{"error":{"message":"…","code":"CONSENTIMIENTO_REQUERIDO",…}}`
 *   con status 403 (`middleware.ts:194-204`, SPEC-329).
 *
 *   - No titular → body NO puede contener `"code":"CONSENTIMIENTO_REQUERIDO"`.
 *     (Cualquier otro estado — 200, 403 por permiso, 404 — es aceptable:
 *     lo único que este spec juzga es el paso 4.)
 *   - Titular → body DEBE contener `"code":"CONSENTIMIENTO_REQUERIDO"` con
 *     status 403.
 *
 * NUNCA insertamos filas en `audit_consentimientos`. La aceptación en el
 * recorrido de SPEC-410 se hizo por el endpoint real; acá no aceptamos
 * nada — el objetivo es sondar quién queda BLOQUEADO. Cero contaminación.
 *
 * AISLAMIENTO: mismo patrón que C12 (SPEC-393). Usuarios efímeros por
 * corrida con `randomUUID`; cero mutación de rol real; limpieza en
 * `afterAll`.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-417-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Consent123!Secure";

// Los dos titulares — el guard DEBE bloquearlos sin consentimiento.
const ROLES_TITULARES = ["PARENT", "SCHOOL_ADMIN"] as const;

// Los seis no titulares — el guard NO debe bloquearlos.
const ROLES_NO_TITULARES = [
    "ADMIN",
    "OPERADOR",
    "COMITE_VALIDACION",
    "COMITE_CONVIVENCIA",
    "VERIFICADOR",
    "PROFESIONAL",
] as const;

const emailFor = (rol: string) => `${CORRIDA}-${rol.toLowerCase()}@proteccion.local`;

const sembrados = { usuarios: new Set<string>() };

async function asegurarUsuario(rol: string): Promise<string> {
    const email = emailFor(rol);
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: rol as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre: `E2E 417 ${rol}`,
            passwordHash: await hashPassword(PASSWORD),
            // Cast necesario para roles que no estén en el enum RolUsuario en
            // tiempo de compilación; el schema Postgres los acepta como
            // string (mismo patrón que C12 con su rol efímero E2E_C12_ROL_*).
            rol: rol as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function loginCookie(request: APIRequestContext, rol: string): Promise<string> {
    const res = await request.post("/api/auth/login", {
        data: { email: emailFor(rol), password: PASSWORD },
    });
    expect(res.status(), `login ${rol}`).toBe(200);
    const raw = res.headers()["set-cookie"] ?? "";
    // El header puede venir como string único con \n entre cookies o array.
    const parts = Array.isArray(raw) ? raw : raw.split(/\n/);
    return parts.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

async function sondaGuard(request: APIRequestContext, cookies: string) {
    const res = await request.get("/api/alertas", { headers: { Cookie: cookies } });
    const text = await res.text();
    return { status: res.status(), tieneCodigo: text.includes("\"CONSENTIMIENTO_REQUERIDO\""), text };
}

async function limpiarSembrados() {
    const ids = [...sembrados.usuarios];
    if (ids.length > 0) {
        // `audit_consentimientos` cae en cascada al borrar Usuario (ON DELETE
        // CASCADE) — aunque este spec nunca acepta consentimiento, si un
        // efímero previo dejó filas por reintento, se limpian.
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    }
    sembrados.usuarios.clear();
}

test.describe.serial("Consentimiento por rol (SPEC-417 candado de I-118)", () => {
    test.beforeAll(async () => {
        for (const rol of [...ROLES_TITULARES, ...ROLES_NO_TITULARES]) {
            await asegurarUsuario(rol);
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    // ── (A) los 6 NO TITULARES deben pasar sin consentimiento ──
    for (const rol of ROLES_NO_TITULARES) {
        test(`(A) ${rol} NO debe recibir CONSENTIMIENTO_REQUERIDO`, async ({ request }) => {
            const cookies = await loginCookie(request, rol);
            const r = await sondaGuard(request, cookies);
            expect(
                r.tieneCodigo,
                `rol ${rol} recibió CONSENTIMIENTO_REQUERIDO (status ${r.status}) — I-118: el guard aplica a un rol no titular`,
            ).toBe(false);
        });
    }

    // ── (B) los 2 TITULARES DEBEN seguir bloqueados sin consentimiento ──
    for (const rol of ROLES_TITULARES) {
        test(`(B) ${rol} SIGUE bloqueado con CONSENTIMIENTO_REQUERIDO`, async ({ request }) => {
            const cookies = await loginCookie(request, rol);
            const r = await sondaGuard(request, cookies);
            // Doble candado: status 403 Y code exacto — un 403 por permiso
            // que no traiga el code no aisla el paso 4.
            expect(
                r.status === 403 && r.tieneCodigo,
                `rol ${rol}: se aflojó el guard de consentimiento sobre un TITULAR (status ${r.status}, code presente=${r.tieneCodigo}). Si esto pasa, alguien exceptuó de más y I-211 vuelve.`,
            ).toBe(true);
        });
    }
});
