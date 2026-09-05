/**
 * SPEC-441 (Calidad) · Recorrido: tarjeta y ficha del profesional muestran el
 * MISMO precio + H-2 (Ley 2375/2024) en las DOS direcciones.
 *
 * ORIGEN (aviso CEO 04-09). El directorio del padre exhibe el precio del
 * profesional en dos vistas — la TARJETA (listado) y la FICHA (detalle). No
 * hay garantía dura de que ambas cifras coincidan, y SPEC-428 metió una
 * variable nueva: `profesional.cita.precio_estandar_primera_cita_cop` — el
 * padre paga ese precio estándar, NO la `tarifaConsultaCOP` que declara el
 * profesional (esa aplica desde la 2ª cita y se muestra como informativa).
 * Si tarjeta y ficha muestran cifras distintas — o si alguna muestra
 * `tarifaConsultaCOP` mientras el pago cobra `precioPrimeraCita` — el padre
 * agenda con expectativa falsa: se cae la plata, la métrica y la confianza.
 *
 * Al mismo tiempo, H-2 (Ley 2375/2024 · brief §5) manda: cero contacto del
 * profesional viaja al padre ANTES de una cita CONFIRMADA. El DAL
 * (`PerfilProfesionalRepository.listarActivos` / `obtenerPublicoPorId`) lo
 * respeta con allowlist estricta — pero cualquier cambio nuevo en el DTO (por
 * ejemplo, para exponer el precio estándar) es una oportunidad de fuga. Este
 * candado barre las DOS respuestas.
 *
 * QUÉ CUBRE (los tres tests atacan los endpoints REALES que el directorio del
 * padre dispara; nada de siembra directa sobre `PerfilProfesional`):
 *
 *   A · TARJETA y FICHA del MISMO profesional muestran EL MISMO precio, y
 *       ese precio coincide con `/api/publico/profesionales/precio-primera-cita`
 *       — la fuente única de lo que el padre PAGA (SPEC-428).
 *
 *   B · TARJETA: la respuesta JSON del listado NO contiene ningún campo de
 *       contacto del profesional (`telefono`, `whatsapp`, `correoProfesional`,
 *       `emailProfesional`, `contactoProfesional`) NI el email real del
 *       profesional sembrado — barrido por sustring sobre el JSON crudo,
 *       independiente del nombre que el DTO le ponga a la clave.
 *
 *   C · FICHA: idéntico barrido sobre el detalle — H-2 no depende de si la
 *       vista es lista o detalle.
 *
 * ESTADO. **SPEC-441 aún no despliega**: los tres tests corren con
 * `test.fail(true, ...)` citando 441. Cuando esa spec entre a `main`, los tres
 * pasan a verde y Playwright marca cada `test.fail` como fallo — esa transición
 * es la señal para que Calidad quite los tres `test.fail`.
 *
 * REGLA. Aviso permanente del CEO: «Caminá la pantalla real, no siembres
 * alrededor.» El profesional se levanta caminando el flujo real (registro por
 * endpoint → completar → PUT perfil → subir autorización → subir documentos →
 * admin decide APROBADO). Sin siembra directa de `PerfilProfesional`, sin
 * mutar rol de usuarios reales, sin forjar `audit_consentimientos` (aceptar
 * por `POST /api/consentimiento/aceptar`).
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-441-`. Limpieza FK-safe
 * en `afterAll` (documentos → verificaciones → perfil → tokens → auditoría →
 * usuarios). Cero mutación de parámetros globales.
 *
 * NOTA sobre el endpoint del directorio. El "directorio público del padre" es
 * `/api/padre/profesionales` — está PARENT-autenticado (guard de rol), no
 * anónimo. "Público" en el brief se refiere a que el JSON no expone contacto
 * (candado H-2), no a que el endpoint sea sin sesión. El único endpoint sin
 * sesión relacionado es `/api/publico/profesionales/precio-primera-cita`
 * (SPEC-428), y este spec lo usa para leer el precio de referencia contra el
 * que se comparan tarjeta y ficha.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-441-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Precio441!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;
const EMAIL_PADRE = `${CORRIDA}-padre@proteccion.local`;

// El profesional declara una tarifa DISTINTA del `precio_estandar_primera_cita_cop`
// sembrado (50_000 por defecto en `prisma/seed.ts:seedParametrosPrimeraCita`),
// para que el test A pueda distinguir cuál de las dos cifras viaja al padre.
const TARIFA_PROF_COP = 120_000;

// H-2 (Ley 2375/2024). El brief nombra estos cinco explícitamente; barrido por
// substring `"clave"` sobre el JSON crudo — pilla la clave sin importar dónde
// esté anidada. NO alcanza para todo (una fuga con nombre nuevo se escapa),
// por eso se combina con el barrido del email real del profesional.
const CAMPOS_CONTACTO_PROHIBIDOS = [
    "telefono",
    "whatsapp",
    "correoProfesional",
    "emailProfesional",
    "contactoProfesional",
];

const sembrados = {
    usuarios: new Set<string>(),
    perfiles: new Set<string>(),
    tokens: new Set<string>(),
};

let perfilProfesionalId = "";
let ciudadIdReal = "";

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function fabricarEnlace(email: string, rol: RolUsuario): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    sembrados.tokens.add(registro.id);
    return token;
}

async function asegurarAdmin(): Promise<void> {
    const u = await prisma.usuario.upsert({
        where: { email: EMAIL_ADMIN },
        update: { rol: "ADMIN" as RolUsuario, estado: "activo" },
        create: {
            email: EMAIL_ADMIN,
            nombre: `Admin E2E ${CORRIDA}`,
            passwordHash: await hashPassword(PASSWORD),
            rol: "ADMIN" as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
}

async function asegurarPadre(): Promise<void> {
    const u = await prisma.usuario.upsert({
        where: { email: EMAIL_PADRE },
        update: { rol: "PARENT" as RolUsuario, estado: "activo" },
        create: {
            email: EMAIL_PADRE,
            nombre: `Padre E2E ${CORRIDA}`,
            passwordHash: await hashPassword(PASSWORD),
            rol: "PARENT" as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

/**
 * PDF mínimo válido — pasa el número mágico `%PDF-` que valida el storage
 * (`autorizacion-storage.ts:MAGIA_PDF = 25 50 44 46 2d`). El cuerpo no importa.
 */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

/**
 * Devuelve el primer campo prohibido presente en `payload` (por substring
 * `"clave"` sobre el JSON crudo), o `null` si ninguno aparece. Usar con el
 * JSON stringificado en la aserción para que el mensaje de fallo muestre el
 * cuerpo real y quede evidencia dura del leak.
 */
function contieneCampoProhibido(payload: unknown, campos: string[]): string | null {
    const crudo = JSON.stringify(payload);
    for (const campo of campos) {
        if (crudo.includes(`"${campo}"`)) return campo;
    }
    return null;
}

async function limpiarSembrados() {
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PROF, EMAIL_ADMIN, EMAIL_PADRE] } },
        select: { id: true },
    });
    const usuarioIds = usuariosCreados.map((u) => u.id);
    if (usuarioIds.length > 0) {
        const perfiles = await prisma.perfilProfesional.findMany({
            where: { usuarioId: { in: usuarioIds } },
            select: { id: true },
        });
        const perfilIds = perfiles.map((p) => p.id);
        if (perfilIds.length > 0) {
            await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
        }
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (usuarioIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.perfiles.clear();
    sembrados.tokens.clear();
}

test.describe.serial("Directorio del padre · tarjeta y ficha coherentes + H-2 (SPEC-441)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
        await asegurarPadre();

        // (1) el profesional se registra caminando la pantalla real.
        const request = await ctx();
        try {
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional 202").toBe(202);
            const tokensCreados = await prisma.tokenRegistro.count({ where: { email: EMAIL_PROF } });
            expect(tokensCreados, "el POST solicitar debe crear un TokenRegistro real").toBeGreaterThanOrEqual(1);

            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(200);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF);

            // (2) PUT perfil por el endpoint real, con `tarifaConsultaCOP`
            // distinto del `precio_estandar_primera_cita_cop` sembrado.
            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
            ciudadIdReal = ciudad!.id;
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi E2E ${CORRIDA}`,
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-441.",
                    tarifaConsultaCOP: TARIFA_PROF_COP,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(putPerfil.status(), `PUT perfil body=${await putPerfil.text().catch(() => "")}`).toBeLessThan(300);

            const perfil = await prisma.perfilProfesional.findFirst({
                where: { usuario: { email: EMAIL_PROF } },
                select: { id: true },
            });
            expect(perfil, "el PUT perfil debe haber creado el PerfilProfesional").not.toBeNull();
            perfilProfesionalId = perfil!.id;
            sembrados.perfiles.add(perfilProfesionalId);

            // (3) Autorización firmada (SPEC-391) — sin ella el admin no puede
            // decidir (service.ts:210). Endpoint espera multipart `archivo` con
            // magic `%PDF-`.
            const autor = await request.post("/api/profesional/autorizacion", {
                multipart: {
                    archivo: { name: "autorizacion.pdf", mimeType: "application/pdf", buffer: pdfMinimo(`${CORRIDA}-autor`) },
                },
            });
            expect(autor.status(), `POST autorizacion body=${await autor.text().catch(() => "")}`).toBeLessThan(300);

            // (4) Un documento por requisito parametrizable — el decidir exige
            // checklist completo (service.ts:227) y CUMPLE sin documento truena
            // (service.ts:246, SPEC-436).
            const estado = await request.get("/api/profesional/documentos");
            expect(estado.status(), "GET estado documentos").toBe(200);
            const items: Array<{ clave: string }> = (await estado.json())?.data ?? [];
            expect(items.length, "parámetro verificacion.requisitos con al menos 1 item").toBeGreaterThan(0);
            for (const it of items) {
                const subir = await request.post("/api/profesional/documentos", {
                    multipart: {
                        requisito: it.clave,
                        archivo: {
                            name: `${it.clave}.pdf`,
                            mimeType: "application/pdf",
                            buffer: pdfMinimo(`${CORRIDA}-${it.clave}`),
                        },
                    },
                });
                expect(subir.status(), `subir ${it.clave} body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
            }
        } finally {
            await request.dispose();
        }

        // (5) Admin aprueba — checklist TODO en CUMPLE → perfil pasa a ACTIVO
        // (service.ts:277) y entra al directorio del padre.
        const requestAdmin = await ctx();
        try {
            await login(requestAdmin, EMAIL_ADMIN);
            await aceptarConsentimiento(requestAdmin);
            await login(requestAdmin, EMAIL_ADMIN);
            const ficha = await requestAdmin.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            const items: Array<{ clave?: string; id?: string; key?: string }> = ((await ficha.json())?.data?.checklist) ?? [];
            const claves = items.map((it) => it.clave ?? it.id ?? it.key ?? "").filter(Boolean);
            expect(claves.length, "la ficha del admin debe traer checklist con claves").toBeGreaterThan(0);
            const checklist = Object.fromEntries(claves.map((k) => [k, { estado: "CUMPLE" }]));
            const decidir = await requestAdmin.post(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`, {
                data: { checklist },
            });
            expect(decidir.status(), `admin aprueba body=${await decidir.text().catch(() => "")}`).toBe(200);

            const perfilActivo = await prisma.perfilProfesional.findUnique({
                where: { id: perfilProfesionalId },
                select: { estado: true },
            });
            expect(perfilActivo?.estado, "perfil debe quedar ACTIVO para entrar al directorio").toBe("ACTIVO");
        } finally {
            await requestAdmin.dispose();
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) tarjeta y ficha muestran EL MISMO precio, y coincide con precio-primera-cita público", async () => {
        test.fail(
            true,
            "SPEC-441 (Dev X) alinea el precio entre tarjeta y ficha del profesional y refuerza H-2. Este candado se quita cuando esa spec despliegue.",
        );

        // Precio estándar de referencia — SPEC-428, endpoint público sin sesión.
        const anon = await ctx();
        let precioEstandar = 0;
        try {
            const res = await anon.get("/api/publico/profesionales/precio-primera-cita");
            expect(res.status(), "precio-primera-cita público debe responder 200").toBe(200);
            precioEstandar = ((await res.json())?.data?.precioCOP as number) ?? 0;
            expect(precioEstandar, "el parámetro precio_estandar_primera_cita_cop debe estar sembrado").toBeGreaterThan(0);
        } finally {
            await anon.dispose();
        }

        // Padre autenticado consulta el directorio y la ficha.
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PADRE);

            const seed = randomUUID();
            const lista = await request.get(
                `/api/padre/profesionales?ciudadId=${encodeURIComponent(ciudadIdReal)}&seed=${encodeURIComponent(seed)}`,
            );
            expect(lista.status(), `GET directorio body=${(await lista.text().catch(() => "")).slice(0, 200)}`).toBe(200);
            const items: Array<Record<string, unknown>> = ((await lista.json())?.items as Array<Record<string, unknown>>) ?? [];
            const tarjeta = items.find((it) => it["id"] === perfilProfesionalId);
            expect(
                tarjeta,
                `nuestro profesional recién aprobado debe aparecer en el directorio (perfil=${perfilProfesionalId}, items=${items.length})`,
            ).toBeTruthy();

            const detalle = await request.get(`/api/padre/profesionales/${perfilProfesionalId}`);
            expect(detalle.status(), `GET ficha body=${(await detalle.text().catch(() => "")).slice(0, 200)}`).toBe(200);
            const ficha = (await detalle.json()) as Record<string, unknown>;

            const precioTarjeta = tarjeta!["tarifaConsultaCOP"] as number;
            const precioFicha = ficha["tarifaConsultaCOP"] as number;

            expect(typeof precioTarjeta, "tarjeta debe traer el precio como número").toBe("number");
            expect(typeof precioFicha, "ficha debe traer el precio como número").toBe("number");

            expect(
                precioTarjeta,
                `tarjeta (${precioTarjeta}) y ficha (${precioFicha}) deben mostrar EL MISMO precio`,
            ).toBe(precioFicha);

            expect(
                precioTarjeta,
                `el precio del directorio (${precioTarjeta}) debe coincidir con precio-primera-cita público (${precioEstandar}). SPEC-441 alinea el número que ve el padre con el que cobra el pago (SPEC-428). Tarifa declarada por el profesional en el setup = ${TARIFA_PROF_COP}`,
            ).toBe(precioEstandar);
        } finally {
            await request.dispose();
        }
    });

    test("(B) TARJETA del directorio no expone contacto del profesional — H-2 (Ley 2375/2024)", async () => {
        test.fail(
            true,
            "SPEC-441 (Dev X) alinea el precio entre tarjeta y ficha del profesional y refuerza H-2. Este candado se quita cuando esa spec despliegue.",
        );

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PADRE);
            const seed = randomUUID();
            const lista = await request.get(
                `/api/padre/profesionales?ciudadId=${encodeURIComponent(ciudadIdReal)}&seed=${encodeURIComponent(seed)}`,
            );
            expect(lista.status(), "GET directorio").toBe(200);
            const items: Array<Record<string, unknown>> = ((await lista.json())?.items as Array<Record<string, unknown>>) ?? [];
            const tarjeta = items.find((it) => it["id"] === perfilProfesionalId);
            expect(tarjeta, "nuestro profesional debe aparecer en el directorio").toBeTruthy();

            const crudoTarjeta = JSON.stringify(tarjeta);
            const filtrado = contieneCampoProhibido(tarjeta, CAMPOS_CONTACTO_PROHIBIDOS);
            expect(
                filtrado,
                `H-2 tarjeta: campo prohibido presente = '${filtrado}'. JSON=${crudoTarjeta.slice(0, 400)}`,
            ).toBeNull();
            // El email real del profesional NUNCA puede aparecer en el JSON de
            // la tarjeta — barrido por sustring, independiente del nombre del
            // campo. Si el DAL cambia y agrega una clave nueva que lo publique,
            // este assert lo caza aunque el nombre no esté en la lista de arriba.
            expect(
                crudoTarjeta.includes(EMAIL_PROF),
                `H-2 tarjeta: el email real del profesional (${EMAIL_PROF}) NO puede aparecer en el JSON del directorio. JSON=${crudoTarjeta.slice(0, 400)}`,
            ).toBe(false);
        } finally {
            await request.dispose();
        }
    });

    test("(C) FICHA del directorio no expone contacto del profesional — H-2 (Ley 2375/2024)", async () => {
        test.fail(
            true,
            "SPEC-441 (Dev X) alinea el precio entre tarjeta y ficha del profesional y refuerza H-2. Este candado se quita cuando esa spec despliegue.",
        );

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PADRE);
            const detalle = await request.get(`/api/padre/profesionales/${perfilProfesionalId}`);
            expect(detalle.status(), "GET ficha").toBe(200);
            const ficha = (await detalle.json()) as Record<string, unknown>;

            const crudoFicha = JSON.stringify(ficha);
            const filtrado = contieneCampoProhibido(ficha, CAMPOS_CONTACTO_PROHIBIDOS);
            expect(
                filtrado,
                `H-2 ficha: campo prohibido presente = '${filtrado}'. JSON=${crudoFicha.slice(0, 400)}`,
            ).toBeNull();
            expect(
                crudoFicha.includes(EMAIL_PROF),
                `H-2 ficha: el email real del profesional (${EMAIL_PROF}) NO puede aparecer en el JSON del detalle. JSON=${crudoFicha.slice(0, 400)}`,
            ).toBe(false);
        } finally {
            await request.dispose();
        }
    });
});
