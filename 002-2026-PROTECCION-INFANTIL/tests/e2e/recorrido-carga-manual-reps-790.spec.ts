/**
 * SPEC-790 (recorrido de cobertura, Calidad) · La CARGA MANUAL de la verificación REPS — la mitad que
 * NADIE caminaba, y la LLAVE de todo lo de aguas abajo.
 *
 * POR QUÉ ES LA #1 (auditoría de la jornada). El gate del directorio (828), el display del padre (825), el
 * rechazo al reservar (828-p2) y el aviso al profesional (813) LEEN una verificación REPS que SOLO entra por
 * `POST /api/admin/verificacion-profesionales/[id]/reps`. Si esta carga no corre, ningún profesional queda
 * verificado → todos `SIN_VERIFICAR`. Medido en prod: 0 verificadores activos / 64 perfiles. Esto lo camina.
 *
 * QUÉ AFIRMA (veredicto del CEO):
 *   (A) La carga CREA la constancia: `SIN_VERIFICAR` (cero filas) → el verificador transcribe VIGENTE → nace
 *       la fila (append-only, `MANUAL_ADMIN`, modalidades, vigencia, y el ACTOR en el snapshot durable).
 *   (B) La carga valida en CÓDIGO: un VIGENTE sin fecha se rechaza 400 (compuerta de código ANTES del CHECK
 *       de la base), no el error crudo.
 *   (C) LA LLAVE DE AGUAS ABAJO: con la VIGENTE cargada, el profesional es OFRECIBLE y el padre VE su franja
 *       en el picker; al cargar una VENCIDA, el profesional SALE de la oferta (el picker da 404). El RESULTADO
 *       de la carga controla lo de aguas abajo — sin tocar el flag global (`exigirRepsVerificado`): una VENCIDA
 *       cierra siempre. (Con el flag prendido, además, un `SIN_VERIFICAR` saldría de la oferta — eso es 813/828,
 *       no se re-prueba acá ni se muta el parámetro global.)
 *
 * ROL TITULAR · el VERIFICADOR, sin que Calidad toque contraseñas, con las DOS salidas conviviendo:
 *   · (a) SALIDA DECLARADA — si el despliegue trae la fixture persistente (`E2E_VERIFICADOR_*`, sembrada por
 *     `seed-e2e-credenciales-roles`, clave ESTABLE del entorno), el recorrido entra con ELLA. La vida larga.
 *   · (b) por defecto (CI hoy) — un ADMIN efímero crea el verificador por el ENDPOINT real
 *     (`/api/admin/verificadores`), que DEVUELVE la temporal (no la escribo ni la leo); el verificador la
 *     cambia. Alta REAL, autocontenida, lo opuesto a I-439 — el patrón que el CEO bendijo en pieza 2.
 *   El helper elige por la presencia del env: cuando el CEO ponga `E2E_VERIFICADOR_*`, (a) corre sin reescribir.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-790-`. Limpieza FK-safe en afterAll — NUNCA borra la
 * cuenta persistente (a): solo las efímeras de la corrida.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

const CORRIDA = `e2e-790-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Carga790!Secure";
const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const VERIFICADOR_EMAIL = `${CORRIDA}-verif@proteccion.local`;

let profesional: ProfesionalVisible | undefined;
let perfilProfesionalId = "";
let franjaVirtualId = "";
let verificadorEmail = "";
let verificadorPassword = "";

const DIA = 24 * 60 * 60 * 1000;
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string, password: string) {
    const res = await request.post("/api/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", { data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false } });
}

async function asegurarAdmin(): Promise<void> {
    await prisma.usuario.upsert({
        where: { email: ADMIN_EMAIL },
        update: { rol: "ADMIN" as RolUsuario, estado: "activo" },
        create: { email: ADMIN_EMAIL, nombre: `Admin E2E ${CORRIDA}`, passwordHash: await hashPassword(PASSWORD), rol: "ADMIN" as RolUsuario, estado: "activo" },
    });
}

/** (b) · el admin efímero crea el verificador por el endpoint real; el server DEVUELVE la temporal, que el
 *  verificador cambia. Calidad no escribe ni lee ninguna credencial. Devuelve email + clave ya cambiada. */
async function aprovisionarVerificadorEfimero(): Promise<{ email: string; password: string }> {
    await asegurarAdmin();
    let passwordTemporal = "";
    const reqAdmin = await ctx();
    try {
        await login(reqAdmin, ADMIN_EMAIL, PASSWORD);
        await aceptarConsentimiento(reqAdmin);
        await login(reqAdmin, ADMIN_EMAIL, PASSWORD);
        const alta = await reqAdmin.post("/api/admin/verificadores", { data: { email: VERIFICADOR_EMAIL, nombre: `Verif E2E ${CORRIDA}` } });
        const altaBody = await alta.text().catch(() => "");
        expect([200, 201].includes(alta.status()), `alta de VERIFICADOR 200/201. status=${alta.status()} body=${altaBody.slice(0, 200)}`).toBe(true);
        const json = JSON.parse(altaBody) as { passwordTemporal?: string };
        expect(typeof json.passwordTemporal === "string" && json.passwordTemporal.length > 0, "el server DEVUELVE la temporal").toBe(true);
        passwordTemporal = json.passwordTemporal!;
    } finally {
        await reqAdmin.dispose();
    }

    const passwordNueva = `Carga790-Nueva!${CORRIDA.slice(-4)}`;
    const reqVerif = await ctx();
    try {
        await login(reqVerif, VERIFICADOR_EMAIL, passwordTemporal);
        const cambio = await reqVerif.post("/api/auth/cambiar-password", { data: { passwordActual: passwordTemporal, passwordNueva } });
        expect(cambio.status(), `cambiar-password del verificador. body=${(await cambio.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        await login(reqVerif, VERIFICADOR_EMAIL, passwordNueva);
        await aceptarConsentimiento(reqVerif);
    } finally {
        await reqVerif.dispose();
    }

    const creado = await prisma.usuario.findUnique({ where: { email: VERIFICADOR_EMAIL }, select: { rol: true } });
    expect(creado?.rol, "la cuenta creada por el endpoint es VERIFICADOR").toBe("VERIFICADOR");
    return { email: VERIFICADOR_EMAIL, password: passwordNueva };
}

/** Elige la sesión del verificador: (a) la fixture persistente del env si el despliegue la trae; (b) el alta
 *  efímera por endpoint, por defecto. El contrato NO cambia — solo de dónde sale el actor. */
async function obtenerSesionVerificador(): Promise<{ email: string; password: string }> {
    const emailEnv = process.env.E2E_VERIFICADOR_EMAIL?.trim();
    const passEnv = process.env.E2E_VERIFICADOR_PASSWORD?.trim();
    if (emailEnv && passEnv) {
        // (a) SALIDA DECLARADA · la cuenta la sembró Datos con clave ESTABLE; Calidad solo la referencia por env.
        return { email: emailEnv.toLowerCase(), password: passEnv };
    }
    return aprovisionarVerificadorEfimero(); // (b)
}

async function contarReps(): Promise<number> {
    return prisma.verificacionReps.count({ where: { profesionalId: perfilProfesionalId } });
}

async function cargarReps(datos: { resultado: string; vigenteHasta: string | null; modalidades: string[] }): Promise<number> {
    const req = await ctx();
    try {
        await login(req, verificadorEmail, verificadorPassword);
        const res = await req.post(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/reps`, { data: datos });
        const status = res.status();
        if (status === 200) return 200;
        // el cuerpo ayuda a diagnosticar un rechazo esperado (B) o inesperado.
        return status;
    } finally {
        await req.dispose();
    }
}

/** El picker PÚBLICO del padre (visor real; el profesional es de flujo real, no sembrado): 200 + franjas, o 404 si salió de la oferta. */
async function pickerDelProfesional(): Promise<{ status: number; franjaIds: string[] }> {
    const req = await ctx();
    try {
        const res = await req.get(`/api/publico/profesionales/${perfilProfesionalId}/franjas`);
        if (res.status() !== 200) return { status: res.status(), franjaIds: [] };
        const data: Array<{ id: string }> = (await res.json())?.data ?? [];
        return { status: 200, franjaIds: data.map((f) => f.id) };
    } finally {
        await req.dispose();
    }
}

test.describe.serial("SPEC-790 · la carga manual de la verificación REPS (la llave de aguas abajo)", () => {
    test.beforeAll(async () => {
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({ request: reqProf, email: PROFESIONAL_EMAIL, password: PASSWORD, corrida: CORRIDA });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaVirtualId = profesional.franjaId ?? "";
        expect(franjaVirtualId, "el profesional nace con una franja VIRTUAL +7d").toBeTruthy();

        const verif = await obtenerSesionVerificador();
        verificadorEmail = verif.email;
        verificadorPassword = verif.password;
    });

    test.afterAll(async () => {
        await prisma.verificacionReps.deleteMany({ where: { profesionalId: perfilProfesionalId } }).catch((e) => console.warn("[SPEC-790] limpieza VerificacionReps falló:", e));
        if (profesional) await limpiarProfesionalVisible(profesional);
        // Solo las cuentas EFÍMERAS de la corrida (b). En (a) estos emails no existen (no-op) y la cuenta
        // persistente del env NUNCA se toca — su email es otro.
        await prisma.usuario.deleteMany({ where: { email: { in: [ADMIN_EMAIL, VERIFICADOR_EMAIL] } } }).catch(() => undefined);
    });

    test("(A) la carga CREA la constancia · SIN_VERIFICAR (0 filas) → VIGENTE (append-only, MANUAL_ADMIN, actor durable)", async () => {
        expect(await contarReps(), "antes de la carga, cero verificaciones REPS").toBe(0);

        const status = await cargarReps({ resultado: "VIGENTE", vigenteHasta: enDias(120).toISOString(), modalidades: ["TELEMEDICINA", "PRESENCIAL"] });
        expect(status, "la carga VIGENTE cierra 200").toBe(200);

        expect(await contarReps(), "la carga creó exactamente una verificación").toBe(1);
        const fila = await prisma.verificacionReps.findFirst({
            where: { profesionalId: perfilProfesionalId },
            orderBy: { verificadoEn: "desc" },
            select: { resultado: true, fuente: true, modalidades: true, verificadoPorSnapshot: true, vigenteHasta: true },
        });
        expect(fila?.resultado, "quedó VIGENTE").toBe("VIGENTE");
        expect(fila?.fuente, "carga manual → fuente MANUAL_ADMIN").toBe("MANUAL_ADMIN");
        expect([...(fila?.modalidades ?? [])].sort(), "las modalidades transcritas").toEqual(["PRESENCIAL", "TELEMEDICINA"]);
        expect(fila?.verificadoPorSnapshot, "el actor queda en el snapshot durable (el verificador que cargó)").toBe(verificadorEmail);
        expect(fila?.vigenteHasta, "VIGENTE lleva la vigencia de la autoridad").not.toBeNull();
    });

    test("(B) la carga valida en CÓDIGO · un VIGENTE sin fecha → 400 (no el error crudo de la base)", async () => {
        const status = await cargarReps({ resultado: "VIGENTE", vigenteHasta: null, modalidades: [] });
        expect(status, "VIGENTE sin fecha → 400 por la compuerta de código (antes del CHECK)").toBe(400);
        expect(await contarReps(), "la carga rechazada no agregó fila (sigue la VIGENTE de A)").toBe(1);
    });

    test("(C) LA LLAVE DE AGUAS ABAJO · con la VIGENTE el padre VE la franja; con una VENCIDA el profesional SALE de la oferta", async () => {
        // Con la VIGENTE cargada en (A) (cubre TELEMEDICINA = la modalidad de la franja VIRTUAL), el padre la VE.
        const conVigente = await pickerDelProfesional();
        expect(conVigente.status, "con la VIGENTE el profesional es ofrecible (picker 200)").toBe(200);
        expect(conVigente.franjaIds, "el padre VE la franja del profesional recién verificado").toContain(franjaVirtualId);

        // La carga es la LLAVE: una VENCIDA (cierra SIEMPRE, sin depender del flag) lo saca de la oferta.
        const status = await cargarReps({ resultado: "VENCIDA", vigenteHasta: null, modalidades: [] });
        expect(status, "la carga VENCIDA cierra 200").toBe(200);

        const conVencida = await pickerDelProfesional();
        expect(conVencida.status, "con la VENCIDA el profesional SALE de la oferta (picker 404)").toBe(404);
    });
});
