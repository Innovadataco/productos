/**
 * SPEC-764 (Calidad) · Candados de la cita rescatados de SPEC-430 (#338, cerrado).
 *
 * ORIGEN. El recorrido «psicólogo punta a punta» (#338, escrito el 07-09) dejó de
 * caminar el flujo actual: la siembra referenciaba `autorizacionArchivoUrl` —campo
 * que el cutover de la autorización (SPEC-703 · I-303) reemplazó por
 * `autorizacionArchivoId` (ID OPACO, no ruta)— así que ya NO COMPILA contra main;
 * su `test.fail` de «aprobar sin ver documentos» (I-304) quedó unexpected-pass tras
 * SPEC-436 (#345); y su test de reset de password pegaba un endpoint retirado. Se
 * cerró. Este spec rescata SOLO los invariantes ESTABLES, con el seed corregido y
 * SIN tocar el flujo de la cita en rediseño (operador · enlace · encuesta, A-79).
 *
 * QUÉ SE FIJA (estable, independiente del rediseño):
 *   (1) H-2 · el contacto del profesional NO viaja al padre ANTES de confirmar.
 *   (2) Pertenencia · otro padre → 404 sobre una cita ajena.
 *   (3) Monto de la 1ª cita = PRECIO ESTÁNDAR del parámetro del admin, no la
 *       tarifa del profesional ni un número quemado (SPEC-428 §4).
 *
 * QUÉ **NO** SE FIJA, A PROPÓSITO (aviso del CEO):
 *   · «tras confirmar, el contacto SÍ viaja» — es media verdad EN REDISEÑO:
 *     SPEC-754 (A-79) cierra el contacto mutuo entre padre y profesional (el canal
 *     pasa a ser el enlace de la cita). Fijar el «sí después» nacería correcto y
 *     MORIRÍA con 754 —alguien tendría que decidir si borra el candado o si el
 *     rediseño está mal—. Por eso este spec solo fija el «NO antes».
 *
 * AISLAMIENTO (mismo patrón que los candados de recorrido): usuarios efímeros por
 * corrida (prefijo `e2e-764-`), cero mutación de rol real ni de parámetros
 * globales; el consentimiento se acepta por el flujo real y SOLO para el PADRE,
 * que es el único titular del dato en este recorrido (SPEC-416); limpieza FK-safe
 * en `afterAll`.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const CORRIDA = `e2e-764-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Candado764!Secure";
// Tarifa del profesional DISTINTA del precio-estándar del parámetro: hace del
// assert de monto un control positivo real (si el server cobrara la tarifa del
// profesional en vez del parámetro, el número sería este y el candado caería).
const TARIFA_DISTINTIVA = 999_000;

const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const PADRE_2_EMAIL = `${CORRIDA}-padre2@proteccion.local`;

let perfilProfesionalId = "";
let franjaId = "";
let solicitudId = "";
let precioParametroCOP = 0;
let profesional: ProfesionalVisible | undefined;
let padre1: PadreOnboarded | undefined;
let padre2: PadreOnboarded | undefined;

async function contexto(): Promise<APIRequestContext> {
    // baseURL viene de PLAYWRIGHT_BASE_URL o del playwright.config.
    return playwrightRequest.newContext();
}

async function login(ctx: APIRequestContext, email: string) {
    const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function crearCitaComoElPadre(ctx: APIRequestContext): Promise<{ id: string; montoTotal: number }> {
    const crear = await ctx.post("/api/padre/citas", {
        data: {
            profesionalId: perfilProfesionalId,
            franjaId,
            presentacion: `Solicitud de cita para el candado SPEC-764 corrida ${CORRIDA}, texto válido.`,
            urgencia: "ESTA_SEMANA",
        },
    });
    const body = await crear.json().catch(() => ({}));
    expect(crear.status(), `crear cita body=${JSON.stringify(body).slice(0, 200)}`).toBe(200);
    const id = body?.data?.id ?? "";
    expect(id, "la respuesta trae el id de la solicitud").toBeTruthy();
    return { id, montoTotal: body?.data?.montoTotal };
}

test.describe.serial("Candados de la cita — SPEC-764 (rescate de SPEC-430)", () => {
    test.beforeAll(async () => {
        // Padres onboardeados por el CAMINO REAL (builder reutilizable): el POST de la
        // cita Y el GET de su detalle están detrás del guardián de camino (403
        // CAMINO_INCOMPLETO hasta completarlo, `guardias.ts`), así que un bare-PARENT no
        // alcanza ni la creación ni la comprobación de pertenencia. El consentimiento del
        // padre (único titular, SPEC-416/756) lo firma el builder por el endpoint real.
        const reqP1 = await contexto();
        try { padre1 = await crearPadreOnboarded({ request: reqP1, email: PADRE_EMAIL, password: PASSWORD }); }
        finally { await reqP1.dispose(); }
        const reqP2 = await contexto();
        try { padre2 = await crearPadreOnboarded({ request: reqP2, email: PADRE_2_EMAIL, password: PASSWORD }); }
        finally { await reqP2.dispose(); }

        // Profesional VISIBLE por su flujo REAL (builder reutilizable): registro →
        // perfil → documentos → autorización → un admin efímero aprueba → ACTIVO +
        // verificación vigente + franja. Un `estado=ACTIVO` a mano NO basta: la cita
        // valida al profesional con `obtenerPublicoPorId`, que exige verificación
        // vigente (SPEC-690-B). La TARIFA distintiva se fija POST-hab y es el control
        // positivo del candado (3): el monto de la 1ª cita debe salir del parámetro.
        const reqProf = await contexto();
        try {
            profesional = await crearProfesionalVisible({
                request: reqProf,
                email: PROFESIONAL_EMAIL,
                password: PASSWORD,
                corrida: CORRIDA,
                tarifaConsultaCOP: TARIFA_DISTINTIVA,
            });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaId = profesional.franjaId ?? "";

        // Precio estándar del parámetro (público) — referencia del candado (3).
        const ctxPub = await contexto();
        const res = await ctxPub.get("/api/publico/profesionales/precio-primera-cita");
        expect(res.status(), "precio primera cita público").toBe(200);
        precioParametroCOP = (await res.json())?.data?.precioCOP;
        expect(typeof precioParametroCOP, "el precio del parámetro viene como número").toBe("number");
        expect(precioParametroCOP, "precio > 0").toBeGreaterThan(0);
        await ctxPub.dispose();
    });

    test.afterAll(async () => {
        // El profesional borra las solicitudes por `profesionalId` (cubre la cita);
        // luego cada padre borra lo suyo FK-safe.
        if (profesional) await limpiarProfesionalVisible(profesional);
        if (padre1) await limpiarPadreOnboarded(padre1);
        if (padre2) await limpiarPadreOnboarded(padre2);
    });

    test("(1) H-2 · el contacto del profesional NO viaja al padre antes de confirmar", async () => {
        const ctx = await contexto();
        try {
            await login(ctx, PADRE_EMAIL); // re-sella la cookie con el camino ya completo

            const cita = await crearCitaComoElPadre(ctx);
            solicitudId = cita.id;

            // La cita recién creada NO está confirmada → `debeExponerContacto` = false.
            // Candado estructural (muere con el defecto): si el DTO dejara de gatear el
            // contacto, la subcadena `"contactoProfesional"` (o teléfono/correo) aparece.
            // Se incluye el ENVOLTORIO `contactoProfesional` porque su sola presencia ya
            // es fuga, aunque renombren las claves internas.
            const detalle = await ctx.get(`/api/padre/citas/${solicitudId}`);
            expect(detalle.status(), "el padre lee su propia cita").toBe(200);
            const detalleTxt = await detalle.text();
            for (const campo of ["contactoProfesional", "telefono", "whatsapp", "correoProfesional", "emailProfesional"]) {
                expect(
                    detalleTxt.includes(`"${campo}"`),
                    `H-2: '${campo}' NO puede viajar al padre antes de la confirmación`,
                ).toBe(false);
            }
            // NOTA (A-79 / SPEC-754): el «tras confirmar, SÍ viaja» NO se fija acá —
            // el contacto mutuo está en rediseño y el canal pasa a ser el enlace.
        } finally {
            await ctx.dispose();
        }
    });

    test("(2) pertenencia · otro padre recibe 404 sobre la cita ajena", async () => {
        expect(solicitudId, "el candado (1) dejó una solicitud").toBeTruthy();
        const ctx = await contexto();
        try {
            await login(ctx, PADRE_2_EMAIL);
            const res = await ctx.get(`/api/padre/citas/${solicitudId}`);
            expect(res.status(), "otro padre NO puede leer una cita ajena").toBe(404);
        } finally {
            await ctx.dispose();
        }
    });

    test("(3) monto de la 1ª cita = precio del parámetro, no la tarifa del profesional", async () => {
        expect(solicitudId, "el candado (1) dejó una solicitud").toBeTruthy();
        // El monto de la CONSULTA es el invariante (SPEC-428 §4): sale del precio
        // estándar del admin, no de `tarifaConsultaCOP`. Se lee del registro (fuente
        // de verdad); el `montoTotal` que ve el padre suma la comisión, así que el
        // candado se afirma sobre `montoConsulta`.
        const solicitud = await prisma.solicitudCita.findUnique({
            where: { id: solicitudId },
            select: { montoConsulta: true },
        });
        expect(solicitud?.montoConsulta, "la 1ª cita cobra el PRECIO ESTÁNDAR del parámetro").toBe(precioParametroCOP);
        expect(
            solicitud?.montoConsulta,
            `la consulta NO usa la tarifa del profesional (${TARIFA_DISTINTIVA}) ni un número quemado`,
        ).not.toBe(TARIFA_DISTINTIVA);
    });
});
