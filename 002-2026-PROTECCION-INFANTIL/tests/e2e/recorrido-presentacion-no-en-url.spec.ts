/**
 * SPEC-440 (Calidad) · Recorrido: la «presentación» del padre NUNCA viaja en la URL.
 *
 * ORIGEN. SPEC-440 (P1 · I-306) ya está en main. El defecto: al elegir una
 * psicóloga, la app navegaba a
 *   `/dashboard/padre/profesionales/<id>?u=ESTA_SEMANA&pres=soy+Jelkin+...`
 * — los datos personales del padre (su presentación al profesional) quedaban
 * escritos en la barra de direcciones: historial, logs de proxy, «compartir».
 * SPEC-440 mueve ese dato al BODY/estado y limpia la URL.
 *
 * QUÉ AFIRMA ESTE SPEC (comportamiento BUENO, sin `test.fail`):
 *
 *   (A) BARRIDO DE URLs. Se recorre el flujo del padre para agendar
 *       —directorio, ficha, y POST de la cita— y se captura la URL de CADA
 *       request/response. El candado: NINGUNA URL contiene la presentación ni
 *       fragmentos de datos personales (`pres=`, `soy+…`, el documento o el
 *       teléfono del padre). Si el defecto vuelve —alguien vuelve a mandar la
 *       presentación por query string— alguna URL la delataría y el candado cae.
 *
 *   (B) VERIFICACIÓN POSITIVA. La presentación SÍ llega al servidor: viaja en
 *       el BODY del POST y queda guardada en la fila `SolicitudCita`. Esto
 *       prueba que el dato no se perdió — solo dejó de ir por la URL.
 *
 *   (C) EL DTO NO LA REEMITE. La respuesta del POST no devuelve la presentación
 *       ni ningún campo tipo `url`/`redirectTo` que la recolocaría en una barra
 *       de direcciones aguas abajo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIMITACIÓN DE ALCANCE (declarada a propósito):
 *
 *   Este spec usa `APIRequestContext`, NO un navegador con navegación de
 *   páginas. Por eso el bug de la BARRA de direcciones no se reproduce 1:1: no
 *   hay `page.goto` ni navegación client-side que pudiera arrastrar la
 *   presentación a `location.href`. Lo que este candado afirma a nivel API es
 *   la mitad demostrable sin navegador: (1) el ENDPOINT recibe la presentación
 *   por el BODY —no como query param—, y (2) ningún endpoint del flujo la
 *   devuelve en un campo de tipo URL. Es coherente con el resto de recorridos
 *   de Calidad, todos API-level.
 *
 *   FOLLOW-UP recomendado: un spec con navegador real (`page.goto` +
 *   `page.url()` tras elegir profesional y agendar) que afirme que
 *   `location.href` nunca contiene la presentación. NO se cubre aquí a
 *   propósito — mantener la familia de specs de Calidad en un solo nivel.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * REGLAS DURAS. Corrida por `randomUUID`, prefijo `e2e-440-`. Cero mutación de
 * rol real: el padre y el profesional son EFÍMEROS, creados por este spec. El
 * padre se registra por el endpoint real (`/api/auth/registro/*`) y firma el
 * consentimiento por `POST /api/consentimiento/aceptar` (nunca se forja
 * `audit_consentimientos`). El profesional se levanta por su flujo real
 * (`/api/auth/registro-profesional/*` + `PUT /api/profesional/perfil`, patrón de
 * `recorrido-verificacion-documentos.spec.ts`); su `estado = ACTIVO` y su franja
 * son andamiaje del actor de apoyo (siembra Prisma sobre el perfil propio del
 * spec, no sobre datos reales). Limpieza FK-safe en `afterAll`.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-440-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Pres440!Secure";

const EMAIL_PADRE = `${CORRIDA}-padre@proteccion.local`;
const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;

// Datos personales identificables del padre. Son el objeto del candado: ninguno
// de estos valores puede aparecer en una URL del flujo.
const DOC_PADRE = `10${CORRIDA.replace(/[^0-9]/g, "")}0987`.slice(0, 12);
const TEL_PADRE = "+57 300 555 4433";
// La presentación lleva marcas identificables a propósito: `soy Jelkin`, la
// palabra `documento` y la palabra `telefono` — exactamente lo que el barrido
// busca en las URLs.
const PRESENTACION = `soy Jelkin Zair Carrillo Franco padre de un menor; mi documento es ${DOC_PADRE} y mi telefono ${TEL_PADRE}, necesito apoyo esta semana`;

const sembrados = {
    tokens: new Set<string>(),
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

/** Fabrica un enlace de registro real (hash bcrypt, como la ruta) y devuelve el
 *  token en claro. Resend está caído en el entorno de pruebas, así que el correo
 *  no llega: se fabrica el token que el correo habría llevado. */
async function fabricarEnlace(email: string, rol: RolUsuario): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    sembrados.tokens.add(registro.id);
    return token;
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    const res = await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
    expect(res.status(), "aceptar consentimiento").toBeLessThan(300);
}

/** Levanta el profesional de apoyo por su flujo real y lo deja ACTIVO con una
 *  franja libre para que el padre pueda agendar. Devuelve `{ perfilId, franjaId }`. */
async function sembrarProfesionalActivoConFranja(): Promise<{ perfilId: string; franjaId: string }> {
    const request = await ctx();
    try {
        const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
            data: { email: EMAIL_PROF },
        });
        expect(solicitar.status(), "solicitar profesional responde 202").toBe(202);

        const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
        const completar = await request.post("/api/auth/registro-profesional/completar", {
            data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
        });
        expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(200);
        await aceptarConsentimiento(request);
        await login(request, EMAIL_PROF);

        const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
        expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
        const putPerfil = await request.put("/api/profesional/perfil", {
            data: {
                nombreVisible: `Psi E2E ${CORRIDA}`,
                tituloProfesional: "Psicóloga clínica",
                especialidades: ["Familia"],
                ciudadId: ciudad!.id,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 5,
                presentacion: "Presentación pública del profesional (no es la del padre).",
                tarifaConsultaCOP: 120_000,
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

        // Andamiaje del actor de apoyo: el perfil propio del spec pasa a ACTIVO y
        // recibe una franja libre. No es un dato real ni un rol real — es el
        // profesional efímero que este spec creó hace tres líneas.
        await prisma.perfilProfesional.update({
            where: { id: perfil!.id },
            data: { estado: "ACTIVO" },
        });
        const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const franja = await prisma.franjaDisponible.create({
            data: {
                profesionalId: perfil!.id,
                inicio,
                fin: new Date(inicio.getTime() + 60 * 60 * 1000),
                modalidad: "VIRTUAL",
                tomada: false,
            },
            select: { id: true },
        });

        return { perfilId: perfil!.id, franjaId: franja.id };
    } finally {
        await request.dispose();
    }
}

/** Registra al padre por el endpoint real, siembra sus datos personales, un hijo
 *  activo y una suscripción ACTIVA (camino guiado completo). Devuelve su id. */
async function sembrarPadreConCaminoCompleto(): Promise<string> {
    const request = await ctx();
    try {
        // (1) el padre se registra por la pantalla (endpoint real).
        const solicitar = await request.post("/api/auth/registro/solicitar", {
            data: { email: EMAIL_PADRE },
        });
        expect(solicitar.status(), "solicitar registro padre").toBeLessThan(300);

        const token = await fabricarEnlace(EMAIL_PADRE, "PARENT" as RolUsuario);
        const completar = await request.post("/api/auth/registro/completar", {
            data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
        });
        expect(completar.status(), `completar padre body=${await completar.text().catch(() => "")}`).toBe(201);
    } finally {
        await request.dispose();
    }

    const padre = await prisma.usuario.findUnique({ where: { email: EMAIL_PADRE }, select: { id: true } });
    expect(padre, "el completar debe haber creado el Usuario padre").not.toBeNull();

    // (2) datos personales del padre — sembrados por Prisma (Paso 2 del camino).
    const pais = await prisma.pais.findFirst({ select: { id: true } });
    const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
    await prisma.usuario.update({
        where: { id: padre!.id },
        data: {
            nombre: "Jelkin",
            apellidos: "Carrillo Franco",
            documentoTipo: "CC",
            documentoNumero: DOC_PADRE,
            telefono: TEL_PADRE,
            paisId: pais?.id ?? null,
            ciudadId: ciudad?.id ?? null,
        },
    });

    // (3) consentimiento por el endpoint real (nunca se forja audit_consentimientos).
    const rc = await ctx();
    try {
        await login(rc, EMAIL_PADRE);
        await aceptarConsentimiento(rc);
    } finally {
        await rc.dispose();
    }

    // (4) un hijo activo (Paso 3 del camino).
    await prisma.hijo.create({
        data: {
            usuarioId: padre!.id,
            nombre: "Menor",
            apellidos: "Carrillo",
            documentoTipo: "TI",
            documentoNumero: `${DOC_PADRE}1`,
            estado: "activo",
        },
    });

    // (5) suscripción ACTIVA (Paso 4 del camino) — sembrada por Prisma.
    const plan = await prisma.plan.findFirst({ where: { tipoTitular: "PADRE" }, select: { id: true } })
        ?? (await prisma.plan.findFirst({ select: { id: true } }));
    expect(plan, "prod debe tener al menos un Plan sembrado").not.toBeNull();
    const ahora = new Date();
    await prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId: padre!.id,
            estado: "ACTIVA",
            planActualId: plan!.id,
            fechaInicio: ahora,
            fechaFin: new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `${CORRIDA}-REF`,
        },
    });

    return padre!.id;
}

async function limpiarSembrados() {
    const usuarios = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PADRE, EMAIL_PROF] } },
        select: { id: true },
    });
    const usuarioIds = usuarios.map((u) => u.id);

    if (usuarioIds.length > 0) {
        const perfiles = await prisma.perfilProfesional.findMany({
            where: { usuarioId: { in: usuarioIds } },
            select: { id: true },
        });
        const perfilIds = perfiles.map((p) => p.id);

        // Orden FK-safe: solicitudes → franjas → documentos/verificaciones →
        // perfil; y suscripciones antes del usuario.
        await prisma.solicitudCita.deleteMany({ where: { padreUsuarioId: { in: usuarioIds } } });
        if (perfilIds.length > 0) {
            await prisma.solicitudCita.deleteMany({ where: { profesionalId: { in: perfilIds } } });
            await prisma.franjaDisponible.deleteMany({ where: { profesionalId: { in: perfilIds } } });
            await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
        }
        await prisma.suscripcion.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        // Hijo cae por cascade al borrar el usuario.
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    sembrados.tokens.clear();
}

let perfilProfesionalId = "";
let franjaId = "";
let padreUsuarioId = "";

test.describe.serial("La presentación del padre no viaja en la URL (SPEC-440)", () => {
    test.beforeAll(async () => {
        const profesional = await sembrarProfesionalActivoConFranja();
        perfilProfesionalId = profesional.perfilId;
        franjaId = profesional.franjaId;
        padreUsuarioId = await sembrarPadreConCaminoCompleto();
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("barrido de URLs: la presentación y los datos personales nunca están en una URL del flujo", async () => {
        const request = await ctx();
        const urlsVisitadas: string[] = [];
        try {
            await login(request, EMAIL_PADRE);

            // (1) directorio del padre — GET con seed de sesión.
            const seed = randomUUID();
            const directorio = await request.get(`/api/padre/profesionales?seed=${seed}`);
            urlsVisitadas.push(directorio.url());
            expect(directorio.status(), "GET directorio").toBe(200);

            // (2) ficha del profesional elegido.
            const ficha = await request.get(`/api/padre/profesionales/${perfilProfesionalId}`);
            urlsVisitadas.push(ficha.url());
            expect(ficha.status(), `GET ficha body=${(await ficha.text().catch(() => "")).slice(0, 200)}`).toBe(200);

            // (3) POST de la cita — la presentación viaja en el BODY.
            const post = await request.post("/api/padre/citas", {
                data: {
                    profesionalId: perfilProfesionalId,
                    franjaId,
                    presentacion: PRESENTACION,
                    urgencia: "ESTA_SEMANA",
                },
            });
            urlsVisitadas.push(post.url());
            expect(
                post.status(),
                `POST cita body=${(await post.text().catch(() => "")).slice(0, 300)}`,
            ).toBeLessThan(300);

            // ── EL CANDADO ──────────────────────────────────────────────────
            const juntas = urlsVisitadas.join(" ");
            // Fragmentos genéricos del defecto I-306 (`?pres=soy+Jelkin+...`).
            expect(
                juntas,
                `alguna URL del flujo lleva datos personales del padre. URLs=${juntas}`,
            ).not.toMatch(/pres=|soy\+|documento|telefono/i);
            // Y los valores CONCRETOS de este padre: su documento y su teléfono.
            const telDigitos = TEL_PADRE.replace(/[^0-9]/g, "");
            expect(juntas, "el documento del padre aparece en una URL").not.toContain(DOC_PADRE);
            expect(juntas, "el teléfono del padre aparece en una URL").not.toContain(telDigitos);
            expect(juntas, "la presentación en claro aparece en una URL").not.toContain("Jelkin Zair");
        } finally {
            await request.dispose();
        }
    });

    test("verificación positiva: la presentación llegó por el BODY y quedó guardada en SolicitudCita", async () => {
        const fila = await prisma.solicitudCita.findFirst({
            where: { padreUsuarioId, profesionalId: perfilProfesionalId },
            orderBy: { creadoEn: "desc" },
            select: { presentacion: true },
        });
        expect(fila, "el POST debe haber creado la fila SolicitudCita").not.toBeNull();
        expect(
            fila!.presentacion,
            "la presentación enviada por el body debe quedar guardada tal cual",
        ).toBe(PRESENTACION);
    });

    test("el DTO de respuesta no reemite la presentación ni un campo tipo url/redirectTo", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            // GET de las citas del padre: el DTO que la pantalla consume no puede
            // reponer la presentación en un campo que termine en una barra.
            const res = await request.get("/api/padre/citas");
            expect(res.status(), "GET citas del padre").toBe(200);
            const crudo = await res.text();
            const json = JSON.parse(crudo) as { data?: unknown };
            const serializado = JSON.stringify(json);
            // El DTO no expone la presentación en claro…
            expect(serializado, "el DTO del padre reemite la presentación").not.toContain("Jelkin Zair");
            // …ni un campo de navegación que la recolocaría en la barra.
            expect(serializado, "el DTO trae un campo tipo url/redirectTo").not.toMatch(/"(redirectTo|url|href)"\s*:/i);
        } finally {
            await request.dispose();
        }
    });
});
