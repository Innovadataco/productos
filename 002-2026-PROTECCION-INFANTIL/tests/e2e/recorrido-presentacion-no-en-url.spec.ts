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
 * padre se onboardea por el CAMINO REAL con el builder reutilizable
 * `fixtures/padre-onboarded.ts` (registro → consentimiento → datos → hijo →
 * freemium, todo por endpoints, en orden; nunca se forja `audit_consentimientos`
 * ni se arma el estado por Prisma directo). El profesional se levanta por su flujo real
 * (`/api/auth/registro-profesional/*` + `PUT /api/profesional/perfil`, patrón de
 * `recorrido-verificacion-documentos.spec.ts`); su `estado = ACTIVO` y su franja
 * son andamiaje del actor de apoyo (siembra Prisma sobre el perfil propio del
 * spec, no sobre datos reales). Limpieza FK-safe en `afterAll`.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

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

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

let perfilProfesionalId = "";
let franjaId = "";
let padreUsuarioId = "";
let profesional: ProfesionalVisible | undefined;
let padre: PadreOnboarded | undefined;

test.describe.serial("La presentación del padre no viaja en la URL (SPEC-440)", () => {
    test.beforeAll(async () => {
        // Profesional VISIBLE por su flujo REAL (builder reutilizable): registro →
        // perfil → documentos → autorización → un admin efímero aprueba → ACTIVO +
        // verificación vigente + franja. Un `estado=ACTIVO` puesto a mano NO basta:
        // la ficha del padre exige además verificación vigente (SPEC-690-B) → 404.
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({
                request: reqProf,
                email: EMAIL_PROF,
                password: PASSWORD,
                corrida: CORRIDA,
            });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaId = profesional.franjaId ?? "";

        // Padre onboardeado por el CAMINO REAL (builder reutilizable): registro →
        // login → consentimiento → datos → hijo → freemium, todo por endpoints, en
        // orden — cada paso re-sella la sesión, cero estado armado por Prisma directo.
        // El documento = DOC_PADRE, para que el candado cubra también una fuga del
        // perfil, no solo de la presentación (el body del POST de la cita).
        const reqOnboard = await ctx();
        try {
            padre = await crearPadreOnboarded({
                request: reqOnboard,
                email: EMAIL_PADRE,
                password: PASSWORD,
                documentoNumero: DOC_PADRE,
            });
            padreUsuarioId = padre.usuarioId;
        } finally {
            await reqOnboard.dispose();
        }
    });

    test.afterAll(async () => {
        // Orden FK-safe entre fixtures: el profesional borra las solicitudes por
        // `profesionalId` (cubre la cita agendada), luego el padre borra lo suyo.
        if (profesional) await limpiarProfesionalVisible(profesional);
        if (padre) await limpiarPadreOnboarded(padre);
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
