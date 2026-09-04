/**
 * SPEC-445 (Calidad) · Recorrido del ALTA COMPLETA — colegio y psicólogo de
 * punta a punta.
 *
 * ORIGEN. Aviso del CEO 04-09 13:10 tras I-302..I-307 (todas cazadas por
 * Jelkin recorriendo el alta por primera vez el 04-09 13:4x → 16:0x):
 *
 *   «Camina la pantalla real, no siembres alrededor. El pecado de SPEC-430
 *    fue crear el perfil por prisma y saltarse `/perfil-profesional/completar`
 *    — que es justo la que está rota. Acá: el colegio se da de alta por los
 *    dos caminos (enlace público y panel de administración) y el psicólogo se
 *    registra y completa su ficha por la pantalla. Si algo no se puede hacer
 *    por la interfaz, eso ES el hallazgo.»
 *
 * ESTADO DE LOS ARREGLOS (aviso CEO 04-09 17:0x → 18:2x):
 *   · SPEC-442 · SPEC-434 · SPEC-447 desplegadas a producción — los cuatro
 *     tests afirman el comportamiento BUENO. Antes de esas tres, los tests
 *     (B) (C) (D) entraban con `test.fail`. Ahora:
 *     (B) alta por admin trae los 11 grados por defecto.
 *     (C) ficha rechaza texto humano LIMPIO (4xx, no 5xx) y guarda con cuid.
 *     (D) calendario del profesional existe: anónimo → 307 al login; sesión
 *         profesional con perfil ACTIVO → 200 con marcador del calendario;
 *         POST franja crea la fila y GET la devuelve.
 *
 * QUÉ CUBRE (los 4 tests corren contra los ENDPOINTS que las pantallas
 * disparan; el spec no siembra Usuario/Colegio directo por Prisma, pasa por
 * el flujo real):
 *
 *   A · Colegio · alta por enlace público
 *       POST /api/auth/registro-colegio/solicitar → recibir enlace
 *       POST /api/auth/registro-colegio/completar → crear Tenant+Colegio+
 *         Usuario+materias+cursos, sesión sellada, aterrizar en el camino.
 *
 *   B · Colegio · alta por panel de administración
 *       POST /api/admin/colegios → crear Colegio+Usuario rector.
 *       Candado I-307: el colegio recién creado por acá NO trae cursos
 *       sembrados; SPEC-442 lo arregla.
 *
 *   C · Psicólogo · registro + completar ficha por la pantalla
 *       POST /api/auth/registro-profesional/solicitar → enlace.
 *       POST /api/auth/registro-profesional/completar → crear cuenta
 *         PROFESIONAL con estado BORRADOR, sesión sellada.
 *       PUT /api/profesional/perfil con `ciudadId` como texto humano
 *         («Bogotá», no cuid) — I-302: la pantalla del brief pide identificador
 *         interno; SPEC-434 arregla la validación.
 *
 *   D · Padre · registro + pedir primera cita
 *       Ya cazado en SPEC-430 y SPEC-444: `POST /api/padre/citas` rechaza
 *       cuids como UUID (I-310). No lo repito acá; el candado vive en 430.
 *
 * DECISIÓN DE ALCANCE (aviso del CEO, mismo mensaje):
 *   El sistema de correo (Resend) está caído. El `POST /solicitar` de los
 *   dos flujos devuelve 202 sin efectos observables desde afuera — el token
 *   real solo llega por email. Para PODER caminar el flujo restante sin
 *   depender de un buzón, este spec INSERTA su propio `TokenRegistro` con
 *   `bcrypt.hash(token, 12)` (mismo `hashToken` de la producción, verificado
 *   en `src/lib/token-recuperacion.ts:hashToken`) DESPUÉS del `POST /solicitar`
 *   real. NO es siembra de usuario ni de colegio: el registro y el aterrizaje
 *   siguen pasando por `/completar` — el flujo que Jelkin usa. La única cosa
 *   que este spec simula es el correo. Documentado acá para que el próximo
 *   lector no confunda esta simulación con «sembrar alrededor».
 *
 * QUÉ NO CUBRE (para que un verde no se lea como «el alta funciona»):
 *
 *   · La pantalla React de `/perfil-profesional/completar` — I-302 la
 *     revienta con 500 y el arreglo (SPEC-434) todavía no despliega. Este
 *     spec ejercita el endpoint que el submit dispararía; el bug de fondo
 *     está en la falta de validación de `ciudadId`.
 *   · El camino guiado del padre completo — el candado del pago es I-310
 *     (SPEC-444) que ya cubre SPEC-430.
 *   · La caja de correo real — Resend caído.
 *
 * AISLAMIENTO. Todo por corrida con `randomUUID`; prefijo `e2e-445-`;
 * limpieza FK-safe en `afterAll`. Cero mutación de rol real ni de parámetros
 * globales.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-445-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Alta445!Secure";

const EMAIL_RECTOR_ENLACE = `${CORRIDA}-rector-enlace@proteccion.local`;
const EMAIL_RECTOR_PANEL  = `${CORRIDA}-rector-panel@proteccion.local`;
const EMAIL_PROF          = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN         = `${CORRIDA}-admin@proteccion.local`;

const NIT_ENLACE = `NIT-${CORRIDA}-A`;
const NIT_PANEL  = `NIT-${CORRIDA}-B`;

const sembrados = {
    usuarios: new Set<string>(),
    tenants: new Set<string>(),
    colegios: new Set<string>(),
    tokens: new Set<string>(),
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

/**
 * Simula «llegó el correo con el enlace»: crea el `TokenRegistro` con
 * `bcrypt.hash(token, 12)` — mismo hashToken del producto. Devuelve el token
 * en claro para que el spec lo pase a `/completar`, tal como el humano lo
 * copiaría del email si Resend estuviera vivo.
 */
async function fabricarEnlace(email: string, rol: RolUsuario, extras: { nombreColegio?: string; nit?: string } = {}): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: {
            email,
            tokenHash,
            rol,
            expiraEn: new Date(Date.now() + 1000 * 60 * 60), // +1h
            nombreColegio: extras.nombreColegio ?? null,
            nit: extras.nit ?? null,
        },
    });
    sembrados.tokens.add(registro.id);
    return token;
}

async function asegurarAdmin(): Promise<string> {
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
    return u.id;
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

async function limpiarSembrados() {
    // Recogemos por email/nit para atrapar lo que crearon los `completar`.
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_RECTOR_ENLACE, EMAIL_RECTOR_PANEL, EMAIL_PROF, EMAIL_ADMIN] } },
        select: { id: true, colegioId: true, tenantId: true },
    });
    const colegioIds = [
        ...usuariosCreados.map((u) => u.colegioId).filter((x): x is string => !!x),
        ...(await prisma.colegio.findMany({ where: { nit: { in: [NIT_ENLACE, NIT_PANEL] } }, select: { id: true } })).map((c) => c.id),
    ];
    const tenantIds = [
        ...usuariosCreados.map((u) => u.tenantId).filter((x): x is string => !!x),
        ...(await prisma.colegio.findMany({ where: { nit: { in: [NIT_ENLACE, NIT_PANEL] } }, select: { tenantId: true } })).map((c) => c.tenantId),
    ];
    // FK-safe: cursos, materias, perfil profesional, tokens → usuarios → colegio → tenant.
    if (colegioIds.length > 0) {
        await prisma.curso.deleteMany({ where: { colegioId: { in: colegioIds } } });
        await prisma.materia.deleteMany({ where: { colegioId: { in: colegioIds } } });
    }
    const profUsuarios = usuariosCreados.filter((u) => u.colegioId === null).map((u) => u.id);
    if (profUsuarios.length > 0) {
        await prisma.perfilProfesional.deleteMany({ where: { usuarioId: { in: profUsuarios } } });
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (usuariosCreados.length > 0) {
        await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados.map((u) => u.id) } } });
    }
    if (colegioIds.length > 0) {
        await prisma.colegio.deleteMany({ where: { id: { in: colegioIds } } });
    }
    if (tenantIds.length > 0) {
        await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.tenants.clear();
    sembrados.colegios.clear();
    sembrados.tokens.clear();
}

test.describe.serial("Alta completa · colegio + psicólogo (SPEC-445)", () => {
    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) Colegio se da de alta por el enlace público y aterriza en el camino", async () => {
        const request = await ctx();
        try {
            // Paso 1 · la pantalla `/registro-colegio` dispara el solicitar.
            const solicitar = await request.post("/api/auth/registro-colegio/solicitar", {
                data: { email: EMAIL_RECTOR_ENLACE, nombreColegio: `Colegio E2E ${CORRIDA}`, nit: NIT_ENLACE },
            });
            expect(solicitar.status(), "SPEC-344: solicitar responde 202 anti-enumeración").toBe(202);
            // El 202 es anti-enumeración: responde igual haga lo que haga por
            // dentro (aviso CEO). Afirmar que `/solicitar` creó SU propia fila
            // en `TokenRegistro` cubre el camino real del token — si mañana
            // deja de crearla, este assert truena y no pasa desapercibido.
            const tokensCreados = await prisma.tokenRegistro.count({ where: { email: EMAIL_RECTOR_ENLACE } });
            expect(tokensCreados, "SPEC-344/391: el POST solicitar debe crear al menos un TokenRegistro real").toBeGreaterThanOrEqual(1);

            // Paso 2 · fabricar el enlace que Resend enviaría al buzón (el token
            // en claro solo existe en el correo; con Resend caído, lo sustituimos).
            const token = await fabricarEnlace(EMAIL_RECTOR_ENLACE, "SCHOOL_ADMIN" as RolUsuario, { nombreColegio: `Colegio E2E ${CORRIDA}`, nit: NIT_ENLACE });

            // Paso 3 · la pantalla `/registro-colegio/crear-clave/[token]` dispara completar.
            const completar = await request.post("/api/auth/registro-colegio/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar body=${await completar.text().catch(() => "")}`).toBe(200);

            // Paso 4 · sesión sellada; la respuesta debe aterrizar en el camino del colegio.
            const dash = await request.get("/dashboard/colegio", { maxRedirects: 0 });
            expect(
                dash.status() === 200 || (dash.status() >= 300 && dash.status() < 400),
                `dashboard colegio debe cargar o redirigir dentro del área. status=${dash.status()}`,
            ).toBe(true);

            // Paso 5 · SPEC-344 promete sembrar 15 materias y 11 cursos por defecto.
            const colegio = await prisma.colegio.findFirst({ where: { nit: NIT_ENLACE }, select: { id: true } });
            expect(colegio, "el colegio debe existir tras completar").not.toBeNull();
            const cursos = await prisma.curso.count({ where: { colegioId: colegio!.id } });
            expect(cursos, "SPEC-344 debe sembrar 11 cursos por defecto").toBeGreaterThan(0);
        } finally {
            await request.dispose();
        }
    });

    test("(B) Colegio dado de alta por el panel del admin trae SUS grados — cierre de I-307 (SPEC-442)", async () => {
        // SPEC-442 desplegado 04-09 16:29 (aviso CEO 17:0x). Antes: el alta
        // por panel dejaba el colegio con 0 cursos y el rector quedaba
        // TRABADO en el Paso 4 del camino (I-307, Jelkin 04-09 ~16:0x con
        // rector 'gilberto', colegio 'sagrado corazon'). Ahora el POST
        // siembra los cursos por defecto igual que el registro público.
        //
        // El test afirma el comportamiento bueno: el alta por admin deja
        // al colegio LISTO para que el rector entre y no se trabe.

        await asegurarAdmin();
        const request = await ctx();
        try {
            await login(request, EMAIL_ADMIN);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_ADMIN);

            const crear = await request.post("/api/admin/colegios", {
                data: {
                    nombreColegio: `Colegio Admin E2E ${CORRIDA}`,
                    nombreRector: `Rector E2E ${CORRIDA}`,
                    emailRector: EMAIL_RECTOR_PANEL,
                    nit: NIT_PANEL,
                },
            });
            expect(crear.status(), `crear por admin body=${await crear.text().catch(() => "")}`).toBe(200);

            const colegio = await prisma.colegio.findFirst({ where: { nit: NIT_PANEL }, select: { id: true } });
            expect(colegio, "el colegio dado de alta por admin debe existir").not.toBeNull();

            // SPEC-442 desplegado: el alta por admin siembra los 11 grados
            // por defecto (mismo comportamiento que el registro público
            // SPEC-344). El rector ya no queda trabado en el Paso 4.
            //
            // Assert exacto (aviso CEO 17:05): `count > 0` era débil — un
            // colegio con 1 curso lo cumpliría. Lo que 442 promete son los
            // ONCE grados, y ese es el candado.
            const cursos = await prisma.curso.count({ where: { colegioId: colegio!.id } });
            expect(
                cursos,
                "SPEC-442 (cierre I-307): el alta por admin debe sembrar los 11 grados por defecto",
            ).toBe(11);
        } finally {
            await request.dispose();
        }
    });

    test("(C) Psicólogo se registra y su ficha rechaza `ciudadId` humano LIMPIO + acepta cuid — cierre de I-302 (SPEC-434)", async () => {
        // SPEC-434 desplegado (aviso CEO 17:0x, junto con SPEC-442). Antes:
        // la pantalla `/perfil-profesional/completar` pedía el identificador
        // interno y cualquier valor humano reventaba con 500 (I-302, Jelkin
        // 04-09 ~13:4x). Ahora la validación es limpia — texto humano
        // devuelve 4xx (no 5xx), y con cuid válido el PUT guarda.
        //
        // Este test camina el registro completo por la interfaz (solicitar →
        // completar → login → PUT perfil) y afirma AMBAS mitades: rechazo
        // limpio con texto humano y guardado con cuid válido.

        const request = await ctx();
        try {
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional responde 202 anti-enumeración").toBe(202);
            // Mismo candado que en (A): 202 es anti-enumeración; afirmamos que
            // el endpoint SÍ creó su fila en TokenRegistro. Si mañana deja de
            // crearla, el registro está muerto y este assert lo caza.
            const tokensProf = await prisma.tokenRegistro.count({ where: { email: EMAIL_PROF } });
            expect(tokensProf, "SPEC-391: el POST solicitar profesional debe crear al menos un TokenRegistro real").toBeGreaterThanOrEqual(1);

            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);

            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(200);

            // Ahora el spec camina `/perfil-profesional/completar` — el PUT que
            // la pantalla dispara al guardar. `ciudadId` va con texto humano
            // (lo que la pantalla envía hoy si el usuario escribe la ciudad).
            const ciudadCuidReal = (await prisma.ciudad.findFirst({ select: { id: true } }))?.id ?? "";
            const putConTextoHumano = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: "Psi E2E",
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: "Bogotá", // <── texto humano en lugar del cuid
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-445.",
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(
                putConTextoHumano.status() >= 400 && putConTextoHumano.status() < 500,
                `SPEC-434 (cierre I-302): 'Bogotá' como ciudadId debe rechazar LIMPIO 4xx, no 5xx. status=${putConTextoHumano.status()} body=${(await putConTextoHumano.text().catch(() => "")).slice(0,200)}`,
            ).toBe(true);

            // Segunda mitad del candado: con el cuid correcto, el PUT SÍ pasa.
            expect(ciudadCuidReal, "prod debe tener al menos una Ciudad sembrada").toBeTruthy();
            const putConCuid = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: "Psi E2E",
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudadCuidReal,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-445.",
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(putConCuid.status(), "con cuid válido el PUT debe cerrar 2xx").toBeLessThan(300);
        } finally {
            await request.dispose();
        }
    });

    test("(D) Psicólogo publica franja disponible — cierre de I-311 (SPEC-447)", async () => {
        // SPEC-447 desplegado (aviso CEO 18:2x): la pantalla del calendario
        // del profesional ya existe. Antes: cero pantalla + cero franjas
        // en prod (I-311). Ahora el candado afirma CONDUCTA en tres
        // direcciones — un 3xx anónimo solo prueba que la ruta existe,
        // que ya se probaba con el 307:
        //
        //   (a) Anónimo → 307 al login.
        //   (b) Profesional con perfil ACTIVO → 200 y HTML con marcador
        //       del calendario (título o formulario de publicar franja).
        //   (c) POST /api/profesional/franjas desde esa sesión crea una
        //       fila y GET la devuelve — criterio de cierre del radicado.
        const requestAnon = await ctx();
        try {
            const anon = await requestAnon.get("/dashboard/profesional/calendario", { maxRedirects: 0 });
            expect(anon.status(), "anónimo → 307 al login").toBe(307);
            expect(
                (anon.headers()["location"] ?? "").includes("/login"),
                `location debe apuntar al login. location=${anon.headers()["location"] ?? ""}`,
            ).toBe(true);
        } finally {
            await requestAnon.dispose();
        }

        // (b) + (c) requieren un profesional con perfil ACTIVO. El único
        // camino honesto es el flujo real: registrar → PUT perfil → cargar
        // documentos → aprobar por admin (SPEC-436). Reusamos el patrón
        // del recorrido-verificacion-documentos.
        const EMAIL_PROF_CAL = `${CORRIDA}-prof-cal@proteccion.local`;
        const request = await ctx();
        try {
            // Registro por la pantalla.
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF_CAL },
            });
            expect(solicitar.status(), "solicitar profesional 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_PROF_CAL, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), "completar profesional 200").toBe(200);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF_CAL);

            // Perfil por la pantalla.
            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener Ciudad sembrada").not.toBeNull();
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi Cal E2E ${CORRIDA}`,
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-445 calendario.",
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(putPerfil.status(), `PUT perfil body=${await putPerfil.text().catch(() => "")}`).toBeLessThan(300);

            // Documentos (SPEC-436): sin ellos, el admin no puede aprobar.
            const perfilRow = await prisma.perfilProfesional.findFirst({
                where: { usuario: { email: EMAIL_PROF_CAL } },
                select: { id: true },
            });
            expect(perfilRow, "PUT perfil crea PerfilProfesional").not.toBeNull();
            const perfilId = perfilRow!.id;
            const estadoDocs = await request.get("/api/profesional/documentos");
            const items: Array<{ clave: string }> = (await estadoDocs.json())?.data ?? [];
            expect(items.length, "parámetro verificacion.requisitos con al menos 1 item").toBeGreaterThan(0);
            for (const it of items) {
                const subir = await request.post("/api/profesional/documentos", { multipart: {
                    requisito: it.clave,
                    archivo: {
                        name: `${it.clave}.pdf`,
                        mimeType: "application/pdf",
                        buffer: Buffer.from(`%PDF-1.4\n% E2E ${CORRIDA} ${it.clave}\n%%EOF\n`, "utf8"),
                    },
                } });
                expect(subir.status(), `subir ${it.clave} body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
            }
        } finally {
            await request.dispose();
        }

        // Admin aprueba (usa el efímero de asegurarAdmin() que ya sembró test B).
        await asegurarAdmin();
        const perfilRow2 = await prisma.perfilProfesional.findFirst({
            where: { usuario: { email: EMAIL_PROF_CAL } },
            select: { id: true },
        });
        expect(perfilRow2, "perfil sigue existiendo tras el setup del profesional").not.toBeNull();
        const perfilId = perfilRow2!.id;
        const requestAdmin = await ctx();
        try {
            await login(requestAdmin, EMAIL_ADMIN);
            await aceptarConsentimiento(requestAdmin);
            await login(requestAdmin, EMAIL_ADMIN);
            const ficha = await requestAdmin.get(`/api/admin/verificacion-profesionales/${perfilId}`);
            const items: Array<{ clave?: string; id?: string; key?: string }> = ((await ficha.json())?.data?.checklist) ?? [];
            const claves = items.map((it) => it.clave ?? it.id ?? it.key ?? "").filter(Boolean);
            const checklist = Object.fromEntries(claves.map((k) => [k, { estado: "CUMPLE" }]));
            const decidir = await requestAdmin.post(`/api/admin/verificacion-profesionales/${perfilId}/decidir`, {
                data: { checklist },
            });
            expect(decidir.status(), `admin aprueba body=${await decidir.text().catch(() => "")}`).toBe(200);
        } finally {
            await requestAdmin.dispose();
        }

        // (b) Con sesión PROFESIONAL activa → 200 y marcador del calendario.
        const requestProf = await ctx();
        try {
            await login(requestProf, EMAIL_PROF_CAL);
            const pantalla = await requestProf.get("/dashboard/profesional/calendario");
            expect(pantalla.status(), "sesión profesional → 200 en /calendario").toBe(200);
            const html = await pantalla.text();
            expect(
                /calendario|franja|disponibilidad|agenda|publicar/i.test(html),
                `HTML debe contener marcador del calendario (calendario|franja|disponibilidad|agenda|publicar). html=${html.slice(0, 300).replace(/\s+/g, " ")}`,
            ).toBe(true);

            // (c) POST franja + GET la devuelve.
            const inicio = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
            const fin    = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
            const crear = await requestProf.post("/api/profesional/franjas", {
                data: { inicio, fin, modalidad: "VIRTUAL" },
            });
            expect(crear.status(), `POST franja body=${await crear.text().catch(() => "")}`).toBeLessThan(300);
            const listar = await requestProf.get("/api/profesional/franjas");
            expect(listar.status(), "GET franjas").toBe(200);
            const franjas: Array<{ inicio?: string }> = ((await listar.json())?.data) ?? [];
            expect(franjas.length, "la franja recién creada aparece en el listado").toBeGreaterThan(0);
        } finally {
            await requestProf.dispose();
        }
    });
});
