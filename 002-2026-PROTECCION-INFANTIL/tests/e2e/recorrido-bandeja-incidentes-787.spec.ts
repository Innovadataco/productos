/**
 * SPEC-787 (recorrido de cobertura, Calidad) · La bandeja de «reportes que no coinciden» — el
 * verificador la camina.
 *
 * EL HUECO de la auditoría. Cuando el padre y el profesional respondieron DISTINTO sobre si la cita
 * se realizó (SPEC-753), se crea un incidente de contradicción que cae en la bandeja interna del
 * verificador (`dashboard/admin/verificacion/reportes-no-coinciden` → `GET …/incidentes-contradiccion`).
 * El motor existe (`listarBandejaIncidentes(now)` arma el DTO; `resolverIncidenteContradiccion` lo
 * cierra) y tiene su candado de integración, pero NINGÚN e2e camina la SUPERFICIE REAL: un verificador
 * logueado que LEE la bandeja por HTTP, RESUELVE por HTTP y la ve cambiar. Es un rol privilegiado sobre
 * datos sensibles de un menor: un defecto acá deja una contradicción sin adjudicar.
 *
 * QUÉ AFIRMA (camino REAL — el incidente se siembra por el CRUCE real de dos encuestas que difieren;
 * la bandeja y la resolución van por los endpoints REALES, con una sesión REAL de verificador):
 *   (1) ENTRA Y SE VE: el incidente aparece en la bandeja con sus DOS lados (padre/profesional, MISMO
 *       shape, simétricos), la pregunta divergente (SE_REALIZO) y el reloj LEGAL (el padre reclamó).
 *   (2) SE RESUELVE Y SALE: el verificador resuelve por el endpoint → el incidente DEJA la bandeja, y
 *       queda registrado QUIÉN lo resolvió (`resueltoPor` = usuarioId del verificador, snapshot durable).
 *   (3) SLA en días hábiles, con `now` INYECTADO: un vencido y uno dentro de plazo CONVIVEN en la misma
 *       lectura (sin el vencido, un bug de SLA pasaría). Vencido → `incumplida` (no «quedan N»); dentro →
 *       cuenta los hábiles restantes. El conteo EXACTO se prueba con el reloj inyectado (no de pared):
 *       anclado en `reclamadoEn`, faltan los 15 hábiles legales completos.
 *   (4) 🔒 NO-FUGA del contenido del menor: la bandeja trae lo que el verificador necesita para adjudicar
 *       (respuestas mecánicas), NUNCA la presentación cruda del caso. Se planta el dato sensible real
 *       detrás y se afirma que la respuesta NO lo expone (misma disciplina de `registro-columnas-sensibles`),
 *       con las claves del DTO fijadas exactas.
 *
 * Se LEE, no se toca, `bandeja-incidentes.service` ni el repo de incidentes: el recorrido los invoca por
 * HTTP (bandeja/resolución) y una vez en proceso con reloj inyectado (solo lectura del conteo exacto).
 *
 * ROL TITULAR · el VERIFICADOR, sin que Calidad toque contraseñas — el patrón de la 790: (a) la fixture
 * persistente del entorno (`E2E_VERIFICADOR_*`, clave ESTABLE) si el despliegue la trae; (b) por defecto
 * (CI hoy) un ADMIN efímero lo crea por el endpoint real, que DEVUELVE la temporal (no se escribe ni se lee).
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-787-`. Limpieza FK-safe en afterAll — NUNCA borra la
 * cuenta persistente (a): solo las efímeras de la corrida.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { cruzarEncuestasCita } from "@/lib/profesional/cita/encuestas-cita-cruce.service";
import { listarBandejaIncidentes } from "@/lib/profesional/cita/bandeja-incidentes.service";
import { PLAZO_REVERSION_DIAS_HABILES } from "@/lib/profesional/cita/plazo-incidente";

const CORRIDA = `e2e-787-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Bandeja787!Secure";
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const PROF_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const VERIFICADOR_EMAIL = `${CORRIDA}-verif@proteccion.local`;

// Contenido sensible del caso (va en `solicitud.presentacion`): JAMÁS debe salir en la bandeja.
const MARCADOR_VENCIDO = `PRESENTACION-SECRETA-vencido-${CORRIDA}-el-menor-relato-crudo`;
const MARCADOR_DENTRO = `PRESENTACION-SECRETA-dentro-${CORRIDA}-el-menor-relato-crudo`;
const MARCADOR_RESOLVER = `PRESENTACION-SECRETA-resolver-${CORRIDA}-el-menor-relato-crudo`;

// Respuestas mecánicas de las dos encuestas (mismas que el poblador de 753).
const SERVICIO_OK = { operador: "SI", inicio: "A_TIEMPO", enlace: "SI", duracion: "ENTRE_30_45" } as const;
const SIN_SESION = { operador: "NO_HUBO_OPERADOR", inicio: "NO_COMENZO", enlace: "NO_FUNCIONO", duracion: null } as const;
const RAZON_NO_SESION = "OTRA_PARTE_NO_CONECTO" as const;

const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA);
const enDias = (n: number) => new Date(Date.now() + n * DIA);

interface IncidenteSembrado {
    incidenteId: string;
    solicitudId: string;
    franjaId: string;
    reclamadoEn: Date;
    venceEn: Date;
}

interface LadoDto {
    rol: string;
    seRealizo: boolean;
    operador: string;
    inicio: string;
    enlace: string;
    duracion: string | null;
    respondidaEn: string;
}
interface IncidenteDto {
    id: string;
    solicitudId: string;
    estado: string;
    incumplida: boolean;
    relojLegal: boolean;
    venceEn: string;
    quedanDiasHabiles: number;
    preguntaDivergente: string;
    padreValor: string;
    profesionalValor: string;
    lados: LadoDto[];
}

let padreUsuarioId = "";
let perfilProfesionalId = "";
let verificadorEmail = "";
let verificadorPassword = "";
let verificadorUsuarioId = "";
let emailsEfimeros: string[] = [];

let incVencido: IncidenteSembrado;
let incDentro: IncidenteSembrado;
let incResolver: IncidenteSembrado;

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

/** (b) · el admin efímero crea el verificador por el endpoint real; el server DEVUELVE la temporal, que
 *  el verificador cambia. Calidad no escribe ni lee ninguna credencial. Devuelve email + clave cambiada. */
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

    const passwordNueva = `Bandeja787-Nueva!${CORRIDA.slice(-4)}`;
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
    emailsEfimeros = [ADMIN_EMAIL, VERIFICADOR_EMAIL];
    return { email: VERIFICADOR_EMAIL, password: passwordNueva };
}

/** (a) la fixture persistente del env si el despliegue la trae; (b) el alta efímera por endpoint, por
 *  defecto. El contrato NO cambia — solo de dónde sale el actor. */
async function obtenerSesionVerificador(): Promise<{ email: string; password: string }> {
    const emailEnv = process.env.E2E_VERIFICADOR_EMAIL?.trim();
    const passEnv = process.env.E2E_VERIFICADOR_PASSWORD?.trim();
    if (emailEnv && passEnv) {
        emailsEfimeros = []; // (a): la cuenta persistente NUNCA se borra.
        return { email: emailEnv.toLowerCase(), password: passEnv };
    }
    return aprovisionarVerificadorEfimero(); // (b)
}

/**
 * Siembra un incidente por el CAMINO REAL: una solicitud CUMPLIDA + sus DOS encuestas que difieren en
 * SE_REALIZO (el padre dice que NO, el profesional que SÍ) → el cruce real registra el incidente con su
 * reloj legal. `padreRespondidaEn` es el ANCLA del término legal (su respuesta ES el reclamo): mandarla
 * al pasado hace al incidente VENCIDO; dejarla en ahora lo deja DENTRO de plazo.
 */
async function sembrarIncidente(opts: { padreRespondidaEn: Date; franjaInicio: Date; presentacion: string }): Promise<IncidenteSembrado> {
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfilProfesionalId, inicio: opts.franjaInicio, fin: new Date(opts.franjaInicio.getTime() + 50 * 60 * 1000), modalidad: "VIRTUAL", tomada: true },
    });
    const sol = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId,
            profesionalId: perfilProfesionalId,
            franjaId: franja.id,
            presentacion: opts.presentacion, // contenido sensible del caso: NO debe filtrarse al verificador
            urgencia: "SIN_APURO",
            estado: "CUMPLIDA",
            venceEn: enDias(3),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
        },
    });
    // El padre dice que NO se realizó (su respuesta es el reclamo del consumidor → término LEGAL).
    await prisma.encuestaCita.create({
        data: { solicitudId: sol.id, origen: "PADRE", seRealizo: false, razonNoRealizo: RAZON_NO_SESION, ...SIN_SESION, respondidaEn: opts.padreRespondidaEn },
    });
    // El profesional dice que SÍ.
    await prisma.encuestaCita.create({
        data: { solicitudId: sol.id, origen: "PROFESIONAL", seRealizo: true, ...SERVICIO_OK },
    });
    // El CRUCE REAL registra el incidente (clase NO_PRESTACION_RECLAMO_PADRE → legal, venceEn = reclamadoEn + 15 hábiles).
    const cruce = await cruzarEncuestasCita(sol.id, prisma);
    expect(cruce.contradicciones.length, "el cruce detecta la contradicción en SE_REALIZO").toBe(1);
    const inc = await prisma.incidenteContradiccionEncuesta.findFirstOrThrow({
        where: { solicitudId: sol.id },
        select: { id: true, reclamadoEn: true, venceEn: true },
    });
    return { incidenteId: inc.id, solicitudId: sol.id, franjaId: franja.id, reclamadoEn: inc.reclamadoEn, venceEn: inc.venceEn };
}

/** GET de la bandeja real, con una sesión del verificador. Devuelve el status y los incidentes. */
async function leerBandeja(): Promise<{ status: number; body: string; incidentes: IncidenteDto[] }> {
    const req = await ctx();
    try {
        await login(req, verificadorEmail, verificadorPassword);
        const res = await req.get("/api/admin/verificacion-profesionales/incidentes-contradiccion");
        const body = await res.text();
        const incidentes: IncidenteDto[] = res.status() === 200 ? (JSON.parse(body)?.incidentes ?? []) : [];
        return { status: res.status(), body, incidentes };
    } finally {
        await req.dispose();
    }
}

test.describe.serial("SPEC-787 · la bandeja de reportes que no coinciden (el verificador la camina)", () => {
    test.beforeAll(async () => {
        const { ciudad } = await crearPaisCiudad();
        const padre = await crearUsuario("PARENT", PADRE_EMAIL, PASSWORD);
        padreUsuarioId = padre.id;
        const profUsuario = await crearUsuario("PROFESIONAL", PROF_EMAIL, PASSWORD);
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: profUsuario.id,
                nombreVisible: `Prof. Bandeja ${CORRIDA}`,
                tituloProfesional: "Psicólogo clínico",
                especialidades: ["TRAUMA_INFANTIL"],
                ciudadId: ciudad.id,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 3,
                presentacion: "Trabaja con niños.",
                tarifaConsultaCOP: 120_000,
                duracionMinutos: 50,
                estado: "ACTIVO",
            },
        });
        perfilProfesionalId = perfil.id;

        const verif = await obtenerSesionVerificador();
        verificadorEmail = verif.email;
        verificadorPassword = verif.password;
        const verifRow = await prisma.usuario.findUniqueOrThrow({ where: { email: verificadorEmail }, select: { id: true, rol: true } });
        expect(verifRow.rol, "la cuenta del actor es VERIFICADOR").toBe("VERIFICADOR");
        verificadorUsuarioId = verifRow.id;

        // Vencido: el reclamo del padre fue hace 40 días → venceEn (reclamo + 15 hábiles) quedó ~19 días atrás.
        incVencido = await sembrarIncidente({ padreRespondidaEn: haceDias(40), franjaInicio: enDias(3), presentacion: MARCADOR_VENCIDO });
        // Dentro: el padre reclamó ahora → venceEn ~21 días adelante (15 hábiles).
        incDentro = await sembrarIncidente({ padreRespondidaEn: new Date(), franjaInicio: enDias(5), presentacion: MARCADOR_DENTRO });
        // Dentro (aparte): este es el que se resuelve, sin perturbar a los otros dos.
        incResolver = await sembrarIncidente({ padreRespondidaEn: new Date(), franjaInicio: enDias(7), presentacion: MARCADOR_RESOLVER });
    });

    test.afterAll(async () => {
        const solicitudIds = [incVencido?.solicitudId, incDentro?.solicitudId, incResolver?.solicitudId].filter(Boolean) as string[];
        const franjaIds = [incVencido?.franjaId, incDentro?.franjaId, incResolver?.franjaId].filter(Boolean) as string[];
        await prisma.incidenteContradiccionEncuesta.deleteMany({ where: { solicitudId: { in: solicitudIds } } }).catch(() => undefined);
        await prisma.encuestaCita.deleteMany({ where: { solicitudId: { in: solicitudIds } } }).catch(() => undefined);
        await prisma.solicitudCita.deleteMany({ where: { id: { in: solicitudIds } } }).catch(() => undefined);
        await prisma.franjaDisponible.deleteMany({ where: { id: { in: franjaIds } } }).catch(() => undefined);
        if (perfilProfesionalId) await prisma.perfilProfesional.deleteMany({ where: { id: perfilProfesionalId } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { email: { in: [PADRE_EMAIL, PROF_EMAIL] } } }).catch(() => undefined);
        // Solo las cuentas EFÍMERAS de la corrida (b). En (a) `emailsEfimeros` está vacío: la persistente NUNCA se toca.
        if (emailsEfimeros.length) await prisma.usuario.deleteMany({ where: { email: { in: emailsEfimeros } } }).catch(() => undefined);
    });

    test("(1) ENTRA Y SE VE · el incidente está en la bandeja con sus DOS lados simétricos y el reloj legal", async () => {
        const { status, incidentes } = await leerBandeja();
        expect(status, "el verificador LEE su bandeja").toBe(200);

        const inc = incidentes.find((i) => i.id === incDentro.incidenteId);
        expect(inc, "el incidente sembrado aparece en la bandeja").toBeTruthy();
        expect(inc!.preguntaDivergente, "la pregunta en disputa es SE_REALIZO").toBe("SE_REALIZO");
        expect(inc!.padreValor, "el padre dijo que NO se realizó").toBe("false");
        expect(inc!.profesionalValor, "el profesional dijo que SÍ").toBe("true");
        expect(inc!.relojLegal, "el padre reclamó la no-prestación → término LEGAL").toBe(true);

        // Los DOS lados, MISMO shape, simétricos — ninguna versión es «la verdadera».
        const padre = inc!.lados.find((l) => l.rol === "PADRE");
        const prof = inc!.lados.find((l) => l.rol === "PROFESIONAL");
        expect(padre, "sale el lado del padre").toBeTruthy();
        expect(prof, "sale el lado del profesional").toBeTruthy();
        expect(Object.keys(padre!).sort(), "los dos lados tienen EXACTAMENTE las mismas claves").toEqual(Object.keys(prof!).sort());
        expect(padre!.seRealizo, "el lado del padre refleja su respuesta (no se realizó)").toBe(false);
        expect(prof!.seRealizo, "el lado del profesional refleja la suya (sí se realizó)").toBe(true);
    });

    test("(2) SE RESUELVE Y SALE · el verificador resuelve por el endpoint; el incidente deja la bandeja y queda QUIÉN", async () => {
        const antes = await leerBandeja();
        expect(antes.incidentes.some((i) => i.id === incResolver.incidenteId), "antes de resolver, el incidente está en la bandeja").toBe(true);

        const req = await ctx();
        try {
            await login(req, verificadorEmail, verificadorPassword);
            const res = await req.post(`/api/admin/verificacion-profesionales/incidentes-contradiccion/${incResolver.incidenteId}/resolver`);
            expect(res.status(), `resolver por el endpoint real. body=${(await res.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        } finally {
            await req.dispose();
        }

        const despues = await leerBandeja();
        expect(despues.incidentes.some((i) => i.id === incResolver.incidenteId), "resuelto → DEJA la bandeja (conducta, no marcado)").toBe(false);

        // El rastro del HECHO: quién resolvió (snapshot durable del verificador) + cuándo.
        const fila = await prisma.incidenteContradiccionEncuesta.findUniqueOrThrow({
            where: { id: incResolver.incidenteId },
            select: { resueltoPor: true, resueltoEn: true },
        });
        expect(fila.resueltoPor, "queda registrado QUIÉN resolvió (el usuarioId del verificador)").toBe(verificadorUsuarioId);
        expect(fila.resueltoEn, "queda registrado CUÁNDO se resolvió").not.toBeNull();
    });

    test("(3) SLA en días hábiles, con `now` INYECTADO · vencido y dentro conviven; el conteo exacto no es de pared", async () => {
        // Las DOS direcciones en la MISMA lectura real (sin el vencido, un bug de SLA pasaría).
        const { incidentes } = await leerBandeja();
        const v = incidentes.find((i) => i.id === incVencido.incidenteId);
        const d = incidentes.find((i) => i.id === incDentro.incidenteId);
        expect(v, "el vencido está en la bandeja").toBeTruthy();
        expect(d, "el dentro-de-plazo está en la bandeja").toBeTruthy();

        expect(v!.incumplida, "vencido → incumplida (la bandeja muestra el estado, no «quedan N»)").toBe(true);
        expect(v!.quedanDiasHabiles, "vencido → no quedan hábiles").toBeLessThanOrEqual(0);
        expect(d!.incumplida, "dentro de plazo → NO incumplida").toBe(false);
        expect(d!.quedanDiasHabiles, "dentro de plazo → quedan hábiles por correr").toBeGreaterThanOrEqual(1);

        // Reloj INYECTADO (no de pared): anclado en el reclamo, faltan los 15 hábiles legales COMPLETOS.
        // (Se LEE el servicio en proceso; el conteo exacto es imposible de afirmar contra el reloj de pared.)
        const bandejaInyectada = await listarBandejaIncidentes(incDentro.reclamadoEn);
        const dIny = bandejaInyectada.incidentes.find((i) => i.id === incDentro.incidenteId);
        expect(dIny, "el incidente también sale con el reloj inyectado").toBeTruthy();
        expect(dIny!.quedanDiasHabiles, "con now = reclamadoEn faltan EXACTAMENTE los 15 hábiles legales").toBe(PLAZO_REVERSION_DIAS_HABILES);
        expect(dIny!.incumplida, "con now = reclamadoEn todavía NO está vencido").toBe(false);
    });

    test("(4) 🔒 NO-FUGA · la bandeja no expone la presentación cruda del caso; solo las claves de metadato", async () => {
        const { body, incidentes } = await leerBandeja();

        // El contenido sensible del caso (presentación) de los incidentes VIVOS nunca viaja en la respuesta.
        expect(body.includes(MARCADOR_VENCIDO), "la presentación del caso vencido NO aparece").toBe(false);
        expect(body.includes(MARCADOR_DENTRO), "la presentación del caso dentro-de-plazo NO aparece").toBe(false);
        expect(body.includes(RAZON_NO_SESION), "la razón de no-sesión del padre tampoco viaja").toBe(false);
        expect(body.includes("razonNoRealizo"), "ni la llave del campo sensible").toBe(false);

        // Las claves del DTO quedan FIJADAS: nada sensible se cuela por un campo nuevo.
        const inc = incidentes.find((i) => i.id === incDentro.incidenteId)!;
        expect(Object.keys(inc).sort(), "el incidente trae SOLO las claves de metadato del DTO").toEqual(
            ["estado", "id", "incumplida", "lados", "padreValor", "preguntaDivergente", "profesionalValor", "quedanDiasHabiles", "relojLegal", "solicitudId", "venceEn"],
        );
        for (const lado of inc.lados) {
            expect(Object.keys(lado).sort(), "cada lado trae SOLO respuestas mecánicas").toEqual(
                ["duracion", "enlace", "inicio", "operador", "respondidaEn", "rol", "seRealizo"],
            );
        }
    });
});
