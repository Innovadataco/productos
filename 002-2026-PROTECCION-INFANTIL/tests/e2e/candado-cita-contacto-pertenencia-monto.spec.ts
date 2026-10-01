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
import type { EstadoReps, ModalidadReps } from "@prisma/client";

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
// SPEC-828 · dos franjas VIRTUALES creadas en el setup MIENTRAS el pro es SIN_VERIFICAR (creación
// legítima, permitida pre Y post-825); el REPS se estrecha/ensancha DESPUÉS, en cada test.
let franjaVirtualRechazoId = "";
let franjaVirtualOkId = "";
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

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

/**
 * SPEC-828 (pieza 2) · planta una VerificacionReps en la BD *_test. Excepción documentada: no hay
 * endpoint real que registre una verificación REPS con la modalidad/vigencia exacta del escenario (la
 * carga manual del admin registra una vigente genérica). `resultado` VIGENTE EXIGE `vigenteHasta`
 * (CHECK de la migración); el motor lee la ÚLTIMA fila (orden verificadoEn desc).
 */
async function plantarReps(
    perfilId: string,
    datos: { resultado: EstadoReps; verificadoEn: Date; vigenteHasta: Date | null; modalidades: ModalidadReps[] },
) {
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilId,
            verificadoEn: datos.verificadoEn,
            fuente: "MANUAL_ADMIN",
            resultado: datos.resultado,
            vigenteHasta: datos.vigenteHasta,
            modalidades: datos.modalidades,
            modalidadesNoMapeadas: [],
            verificadoPorSnapshot: `e2e SPEC-828 (${CORRIDA})`,
        },
    });
}

/** SPEC-828 · publica una franja VIRTUAL fresca por el endpoint real del profesional (atiendeVirtual +
 *  verificación vigente). `diaOffset` evita el solape con la franja +7 del fixture y entre sí. */
async function crearFranjaVirtual(diaOffset: number): Promise<string> {
    const reqProf = await contexto();
    try {
        await login(reqProf, PROFESIONAL_EMAIL);
        const inicio = new Date(Date.now() + diaOffset * DIA).toISOString();
        const fin = new Date(Date.now() + diaOffset * DIA + 3600 * 1000).toISOString();
        const r = await reqProf.post("/api/profesional/franjas", { data: { inicio, fin, modalidad: "VIRTUAL" } });
        expect(r.status(), `crear franja virtual body=${await r.text().catch(() => "")}`).toBeLessThan(300);
        const id = (await r.json())?.data?.id;
        expect(id, "la franja virtual creada trae id").toBeTruthy();
        return id as string;
    } finally {
        await reqProf.dispose();
    }
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

        // SPEC-828 pieza 2 · las franjas de los candados (4)/(5) se crean AHORA, con el pro SIN_VERIFICAR:
        // la creación es LEGÍTIMA (cutover abierto; permitida pre Y post-825). El REPS se estrecha/ensancha
        // en cada test — así el escenario es el TEMPORAL que la compuerta de creación NO cubre sola: una
        // franja creada válidamente deja de ser reservable cuando el REPS CADUCA/se estrecha, no cuando
        // «nunca debió existir». Si se plantara el REPS antes de crear la franja, post-825 la creación misma
        // sería rechazada y el test fallaría en el SETUP, por una razón ajena al contrato que afirma.
        franjaVirtualRechazoId = await crearFranjaVirtual(8);
        franjaVirtualOkId = await crearFranjaVirtual(9);

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
        // SPEC-828: las VerificacionReps plantadas tienen FK Restrict al perfil → se borran ANTES de que
        // limpiarProfesionalVisible borre el perfil (si no, ese delete falla en silencio y deja basura).
        if (profesional)
            await prisma.verificacionReps
                .deleteMany({ where: { profesionalId: profesional.perfilId } })
                // No tira en teardown, pero DEJA RASTRO: si este borrado empieza a fallar, el delete del
                // perfil (limpiarProfesionalVisible, FK Restrict) fallará en silencio y dejará huérfanos.
                .catch((e) => console.warn("[SPEC-828] limpieza de VerificacionReps falló:", e));
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

    // ── SPEC-828 · pieza 2, aserción del CONTRATO (la que sobrevive a la UI) ──────────────────────────
    // El servidor RECHAZA la reserva de una franja en una modalidad que el REPS del profesional NO cubre,
    // llamado por API DIRECTA (sin pantalla). Esconder el menú (SPEC-825, display) NO es la compuerta: la
    // compuerta es el servidor (790 T4b) y debe negar aunque nadie se lo pida por la UI — un gate
    // condicionado a lo que manda el cliente falla ABIERTO. Se usa padre2 (sin cita previa). (La aserción
    // 1 —que post-825 al padre NUNCA se le OFREZCA esa franja— se escribe cuando 825 entre a main.)
    test("(4-SPEC-828) el servidor RECHAZA la reserva DIRECTA de una franja en modalidad sin REPS", async () => {
        // El pro atiende VIRTUAL (franja → TELEMEDICINA en el REPS). Se le planta un REPS VIGENTE que cubre
        // SOLO PRESENCIAL → sigue VISIBLE (el directorio usa modalidad=null y la vigencia pasa) pero la
        // reserva de una franja virtual cae por `esRepsElegibleParaModalidad(TELEMEDICINA)`.
        // La franja virtual YA existe (creada en el setup con el pro SIN_VERIFICAR). AHORA se estrecha el
        // REPS a solo-PRESENCIAL: la franja —legítima— deja de ser reservable por su modalidad.
        await plantarReps(perfilProfesionalId, { resultado: "VIGENTE", verificadoEn: hace(10), vigenteHasta: enDias(120), modalidades: ["PRESENCIAL"] });
        const franjaVirtual = franjaVirtualRechazoId;

        const ctx = await contexto();
        try {
            await login(ctx, PADRE_2_EMAIL);
            const res = await ctx.post("/api/padre/citas", {
                data: {
                    profesionalId: perfilProfesionalId,
                    franjaId: franjaVirtual,
                    presentacion: `SPEC-828 reserva en modalidad sin REPS (debe rechazarse), corrida ${CORRIDA}, texto válido.`,
                    urgencia: "ESTA_SEMANA",
                },
            });
            expect(
                res.status(),
                `reserva de franja VIRTUAL con REPS solo-PRESENCIAL debe RECHAZARSE (no 200). body=${(await res.text().catch(() => "")).slice(0, 200)}`,
            ).not.toBe(200);
            // La compuerta niega ANTES de marcar la franja: no deja rastro de éxito (la franja sigue LIBRE).
            const f = await prisma.franjaDisponible.findUnique({ where: { id: franjaVirtual }, select: { tomada: true } });
            expect(f?.tomada, "la franja rechazada sigue LIBRE — el servidor no la consumió").toBe(false);
        } finally {
            await ctx.dispose();
        }
    });

    test("(5-SPEC-828) control positivo — con el REPS cubriendo TELEMEDICINA, la MISMA reserva directa PASA", async () => {
        // Remoción del discriminador: una verificación más reciente que SÍ cubre TELEMEDICINA (la «última
        // fila» manda). Nada más cambia; que ahora PASE prueba que lo que negaba la reserva era la
        // cobertura de modalidad del REPS, no la visibilidad del pro ni el camino del padre.
        // La franja virtual YA existe (setup). Con el REPS cubriendo TELEMEDICINA, la MISMA reserva directa pasa.
        await plantarReps(perfilProfesionalId, { resultado: "VIGENTE", verificadoEn: new Date(), vigenteHasta: enDias(120), modalidades: ["PRESENCIAL", "TELEMEDICINA"] });
        const franjaVirtual = franjaVirtualOkId;

        const ctx = await contexto();
        try {
            await login(ctx, PADRE_2_EMAIL);
            const res = await ctx.post("/api/padre/citas", {
                data: {
                    profesionalId: perfilProfesionalId,
                    franjaId: franjaVirtual,
                    presentacion: `SPEC-828 control positivo — REPS cubre TELEMEDICINA, corrida ${CORRIDA}, texto válido.`,
                    urgencia: "ESTA_SEMANA",
                },
            });
            expect(
                res.status(),
                `con el REPS cubriendo TELEMEDICINA la MISMA reserva directa PASA (200). body=${(await res.text().catch(() => "")).slice(0, 200)}`,
            ).toBe(200);
        } finally {
            await ctx.dispose();
        }
    });
});
