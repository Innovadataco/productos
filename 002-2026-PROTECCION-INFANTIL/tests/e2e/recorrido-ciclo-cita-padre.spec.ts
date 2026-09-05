/**
 * SPEC-447 (Calidad) · Recorrido del CICLO COMPLETO del padre — de elegir
 * psicóloga a que se le abra el contacto. Afirma comportamiento BUENO (sin
 * `test.fail`): SPEC-444 (identificadores cuid) y SPEC-447 (calendario/reserva)
 * ya están desplegadas.
 *
 * EL RECORRIDO, todo por endpoints reales (caminar la pantalla, no sembrar el
 * perfil/las cuentas por Prisma — lección de SPEC-430):
 *
 *   1. Profesional efímero ACTIVO por el flujo real: registro →
 *      `PUT /api/profesional/perfil` → un documento por requisito
 *      (`POST /api/profesional/documentos`) → autorización firmada
 *      (`POST /api/profesional/autorizacion`, que transiciona el perfil a
 *      EN_REVISION) → un ADMIN efímero aprueba con checklist TODO CUMPLE
 *      (`POST /api/admin/verificacion-profesionales/[id]/decidir`).
 *   2. El profesional publica una franja +7 días
 *      (`POST /api/profesional/franjas`, modalidad VIRTUAL). OJO: la ruta exige
 *      una verificación aprobada vigente (`venceEnVigente`), así que la franja
 *      se publica DESPUÉS de la aprobación, no antes.
 *   3. Padre efímero con camino guiado: la cuenta se crea por endpoint
 *      (`/api/auth/registro/solicitar` + `completar`); los datos personales,
 *      un `Hijo` activo y una `Suscripcion` ACTIVA se siembran por Prisma
 *      (no hay endpoint para "forzar suscripción"). Consentimiento por
 *      `POST /api/consentimiento/aceptar` (POLITICA_DATOS), nunca por INSERT.
 *   4. Padre reserva: `POST /api/padre/citas` con `profesionalId`
 *      (= `PerfilProfesional.id`, un cuid) + `franjaId` (cuid) + presentación
 *      (>= 20 chars) + urgencia. Queda SIN_CONFIRMAR y el monto es el PRECIO
 *      ESTÁNDAR del parámetro (SPEC-428), no la tarifa del profesional.
 *   5. "Pago": el ADMIN activa el pago manual
 *      (`POST /api/admin/pagos/cita/[id]/activar`) → PAGADA_PENDIENTE. Es el
 *      paso que la descripción llama "llega al pago": sin él el profesional no
 *      puede confirmar (`confirmarPorProfesional` exige PAGADA_PENDIENTE).
 *   6. El profesional confirma: `PATCH /api/profesional/solicitudes/[id]/confirmar`
 *      → CONFIRMADA.
 *
 * EL CANDADO — H-2 EN LAS DOS DIRECCIONES (reserva legal · Ley 2375/2024):
 *   El teléfono y el correo del profesional NO viajan al padre antes de que la
 *   cita esté CONFIRMADA. El candado vive en el código (`debeExponerContacto`
 *   en `src/lib/profesional/cita/dto.ts`) y acá se afirma sobre el CUERPO real
 *   del endpoint que la pantalla del padre consume:
 *     · SIN_CONFIRMAR   → el body NO trae el contacto.
 *     · PAGADA_PENDIENTE → sigue SIN traerlo (pagar no es confirmar).
 *     · CONFIRMADA       → AHORA sí: correo y teléfono del profesional.
 *
 * DESVIACIONES respecto del encargo, documentadas a propósito:
 *   · `confirmar` es **PATCH**, no POST (única verbo que exporta la ruta).
 *   · El monto de la reserva es `montoTotal = precioEstándar + comisión` (la
 *     comisión `comision.porcentaje` es 10 %). `montoTotal === precioCOP` no se
 *     cumple; lo que SÍ cierra SPEC-428 es que `montoConsulta === precioCOP`
 *     (la 1ª cita se cobra al precio estándar, no a la tarifa del profesional).
 *     Se afirma esa invariante contra la fila en BD, y la composición del total.
 *   · `POST /api/padre/citas` NO exige suscripción vigente (verificado:
 *     `verifyAuth("PARENT")` no la mira y `crearSolicitudCita` tampoco). La
 *     `Suscripcion` ACTIVA se siembra igual, por fidelidad del recorrido, y es
 *     no-cargante: si prod no tiene un `Plan` de titular PADRE, se omite sin
 *     hundir el candado real.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-447-`. Limpieza FK-safe
 * en `afterAll`. Cero mutación de rol real ni de parámetros globales.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-447-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Ciclo447!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;
const EMAIL_PADRE = `${CORRIDA}-padre@proteccion.local`;

// Contacto del profesional que el candado H-2 debe ocultar antes de confirmar
// y exponer después. Distintivo por corrida para afirmarlo por substring.
const TELEFONO_PROF = `+57-300-${CORRIDA}`;

const sembrados = {
    tokens: new Set<string>(),
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

/**
 * Simula "llegó el correo con el enlace": crea el `TokenRegistro` con
 * `bcrypt.hash(token, 12)` — mismo `hashToken` de producción (verificado en
 * `src/lib/token-recuperacion.ts`). Devuelve el token en claro para pasarlo a
 * `/completar`, como el humano lo copiaría del email si Resend no estuviera caído.
 */
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
    await prisma.usuario.upsert({
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

/** PDF mínimo válido — pasa el número mágico `%PDF-` del validador. */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

// ── Estado compartido entre los pasos serializados ──────────────────────────
let profesionalPerfilId = "";
let franjaId = "";
let solicitudId = "";
let precioCOP = 0;

async function limpiarSembrados() {
    const usuarios = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PROF, EMAIL_ADMIN, EMAIL_PADRE] } },
        select: { id: true },
    });
    const usuarioIds = usuarios.map((u) => u.id);
    const perfiles = await prisma.perfilProfesional.findMany({
        where: { usuarioId: { in: usuarioIds } },
        select: { id: true },
    });
    const perfilIds = perfiles.map((p) => p.id);

    // FK-safe: solicitudes → franjas → documentos/verificaciones → perfil →
    //          suscripciones → hijos → tokens → auditoría → usuarios.
    if (usuarioIds.length > 0 || perfilIds.length > 0) {
        await prisma.solicitudCita.deleteMany({
            where: {
                OR: [
                    { padreUsuarioId: { in: usuarioIds } },
                    { profesionalId: { in: perfilIds } },
                ],
            },
        });
    }
    if (perfilIds.length > 0) {
        await prisma.franjaDisponible.deleteMany({ where: { profesionalId: { in: perfilIds } } });
        await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
        await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
        await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
    }
    if (usuarioIds.length > 0) {
        await prisma.suscripcion.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.hijo.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (usuarioIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.tokens.clear();
}

test.describe.serial("Ciclo completo del padre: reserva → pago → confirmación → contacto H-2 (SPEC-447)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();

        // ── (1) Profesional efímero ACTIVO por el flujo real ────────────────
        const prof = await ctx();
        try {
            const solicitar = await prof.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await prof.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBeLessThan(300);
            await aceptarConsentimiento(prof);
            await login(prof, EMAIL_PROF);

            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
            const putPerfil = await prof.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi E2E ${CORRIDA}`,
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-447 ciclo de cita.",
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(putPerfil.status(), `PUT perfil body=${await putPerfil.text().catch(() => "")}`).toBeLessThan(300);

            const perfil = await prisma.perfilProfesional.findFirst({
                where: { usuario: { email: EMAIL_PROF } },
                select: { id: true, usuarioId: true },
            });
            expect(perfil, "el PUT perfil debe haber creado el PerfilProfesional").not.toBeNull();
            profesionalPerfilId = perfil!.id;

            // Contacto del profesional (lo que H-2 protege). Es un campo del
            // usuario efímero, no una mutación de rol/parametro global.
            await prisma.usuario.update({
                where: { id: perfil!.usuarioId },
                data: { telefono: TELEFONO_PROF },
            });

            // Un documento por cada requisito configurado (sin ellos el admin no
            // puede marcar CUMPLE — candado servidor de SPEC-436).
            const estadoDocs = await prof.get("/api/profesional/documentos");
            expect(estadoDocs.status(), "GET estado documentos").toBe(200);
            const requisitos: Array<{ clave: string }> = (await estadoDocs.json())?.data ?? [];
            expect(requisitos.length, "el parámetro `verificacion.requisitos` debe traer al menos 1 requisito").toBeGreaterThan(0);
            const clavesRequisitos = requisitos.map((r) => r.clave);
            for (const clave of clavesRequisitos) {
                const subir = await prof.post("/api/profesional/documentos", {
                    multipart: {
                        requisito: clave,
                        archivo: { name: `${clave}.pdf`, mimeType: "application/pdf", buffer: pdfMinimo(`${CORRIDA} ${clave}`) },
                    },
                });
                expect(subir.status(), `subir documento ${clave} body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
            }

            // Autorización firmada: setea `autorizacionArchivoId` y, con el perfil
            // completo, transiciona BORRADOR → EN_REVISION (sin esto el admin no
            // puede decidir).
            const autoriz = await prof.post("/api/profesional/autorizacion", {
                multipart: {
                    archivo: { name: "autorizacion.pdf", mimeType: "application/pdf", buffer: pdfMinimo(`${CORRIDA} autorizacion`) },
                },
            });
            expect(autoriz.status(), `subir autorización body=${await autoriz.text().catch(() => "")}`).toBeLessThan(300);

            const perfilEnRevision = await prisma.perfilProfesional.findUnique({
                where: { id: profesionalPerfilId },
                select: { estado: true },
            });
            expect(perfilEnRevision?.estado, "el perfil debe quedar EN_REVISION antes de decidir").toBe("EN_REVISION");

            // El admin aprueba: checklist TODO CUMPLE → perfil ACTIVO + vigencia.
            const admin = await ctx();
            try {
                await login(admin, EMAIL_ADMIN);
                await aceptarConsentimiento(admin);
                await login(admin, EMAIL_ADMIN);
                const checklist: Record<string, { estado: "CUMPLE" }> = {};
                for (const clave of clavesRequisitos) checklist[clave] = { estado: "CUMPLE" };
                const decidir = await admin.post(`/api/admin/verificacion-profesionales/${profesionalPerfilId}/decidir`, {
                    data: { checklist },
                });
                expect(decidir.status(), `admin aprueba body=${await decidir.text().catch(() => "")}`).toBe(200);
            } finally {
                await admin.dispose();
            }

            const perfilActivo = await prisma.perfilProfesional.findUnique({
                where: { id: profesionalPerfilId },
                select: { estado: true },
            });
            expect(perfilActivo?.estado, "tras aprobar, el perfil debe quedar ACTIVO").toBe("ACTIVO");

            // ── (2) El profesional publica una franja (ya con vigencia) ─────
            const inicio = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
            const fin = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
            const crearFranja = await prof.post("/api/profesional/franjas", {
                data: { inicio, fin, modalidad: "VIRTUAL" },
            });
            expect(crearFranja.status(), `POST franja body=${await crearFranja.text().catch(() => "")}`).toBeLessThan(300);
            franjaId = (await crearFranja.json())?.data?.id ?? "";
            expect(franjaId, "la franja creada debe traer id (cuid)").toBeTruthy();
        } finally {
            await prof.dispose();
        }

        // ── (3) Padre efímero con camino guiado ─────────────────────────────
        const padre = await ctx();
        try {
            const solicitar = await padre.post("/api/auth/registro/solicitar", { data: { email: EMAIL_PADRE } });
            expect(solicitar.status(), "SPEC-339: solicitar padre 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_PADRE, "PARENT" as RolUsuario);
            const completar = await padre.post("/api/auth/registro/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar padre body=${await completar.text().catch(() => "")}`).toBeLessThan(300);
        } finally {
            await padre.dispose();
        }

        const padreUsuario = await prisma.usuario.findUnique({ where: { email: EMAIL_PADRE }, select: { id: true } });
        expect(padreUsuario, "la cuenta del padre debe existir tras completar").not.toBeNull();
        const padreId = padreUsuario!.id;

        // Datos personales completos + un Hijo activo (Prisma: no hay endpoint
        // para "forzar" el camino guiado completo desde afuera de la pantalla).
        const pais = await prisma.pais.findFirst({ select: { id: true } });
        const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
        await prisma.usuario.update({
            where: { id: padreId },
            data: {
                nombre: `Padre E2E ${CORRIDA}`,
                apellidos: "Prueba",
                documentoTipo: "CC",
                documentoNumero: `DOC-${CORRIDA}`,
                telefono: "+57-301-0000000",
                paisId: pais?.id ?? null,
                ciudadId: ciudad?.id ?? null,
            },
        });
        await prisma.hijo.create({
            data: {
                usuarioId: padreId,
                nombre: "Hijo",
                apellidos: "Prueba",
                documentoTipo: "TI",
                documentoNumero: `HIJO-${CORRIDA}`,
                estado: "activo",
            },
        });

        // Suscripción ACTIVA (no-cargante: el endpoint de citas no la exige;
        // se siembra por fidelidad del recorrido). Requiere un Plan de titular
        // PADRE; si prod no lo tiene, se omite sin hundir el candado.
        const planPadre = await prisma.plan.findFirst({ where: { tipoTitular: "PADRE" }, select: { id: true } });
        if (planPadre) {
            const ahora = new Date();
            await prisma.suscripcion.create({
                data: {
                    tipoTitular: "PADRE",
                    usuarioId: padreId,
                    estado: "ACTIVA",
                    planActualId: planPadre.id,
                    fechaInicio: ahora,
                    fechaFin: new Date(ahora.getTime() + 365 * 24 * 3600 * 1000),
                    codigoReferidoPropio: `REF-${CORRIDA}`,
                },
            });
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(1) el padre reserva → 200, SIN_CONFIRMAR y monto al PRECIO ESTÁNDAR (SPEC-428/444)", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PADRE);

            // El precio estándar que la pantalla de pago le muestra al padre.
            const precioRes = await request.get("/api/publico/profesionales/precio-primera-cita");
            expect(precioRes.status(), "GET precio-primera-cita").toBe(200);
            precioCOP = (await precioRes.json())?.data?.precioCOP ?? 0;
            expect(precioCOP, "el precio estándar debe ser un entero positivo (COP)").toBeGreaterThan(0);

            // SPEC-444: `profesionalId` y `franjaId` son cuid; el schema real ya
            // los acepta (validarlos como uuid dejaba la ruta en 400 permanente).
            const reservar = await request.post("/api/padre/citas", {
                data: {
                    profesionalId: profesionalPerfilId,
                    franjaId,
                    presentacion: "Solicito una primera cita para orientación familiar de mi hijo.",
                    urgencia: "ESTA_SEMANA",
                },
            });
            expect(reservar.status(), `POST reserva body=${(await reservar.text().catch(() => "")).slice(0, 300)}`).toBe(200);
            const data = (await reservar.json())?.data;
            solicitudId = data?.id ?? "";
            expect(solicitudId, "la reserva debe devolver el id de la solicitud").toBeTruthy();
            expect(data?.estado, "la reserva recién creada queda SIN_CONFIRMAR").toBe("SIN_CONFIRMAR");

            // SPEC-428: la 1ª cita se cobra al PRECIO ESTÁNDAR (no a la tarifa del
            // profesional, 120.000). Afirmamos la invariante contra la fila en BD
            // y la composición del total (precio + comisión).
            const fila = await prisma.solicitudCita.findUnique({
                where: { id: solicitudId },
                select: { montoConsulta: true, montoServicio: true, montoTotal: true },
            });
            expect(fila, "la solicitud debe existir en BD").not.toBeNull();
            expect(fila!.montoConsulta, "SPEC-428: la 1ª cita se cobra al precio estándar, no a la tarifa del profesional").toBe(precioCOP);
            expect(fila!.montoTotal, "montoTotal = consulta + comisión").toBe(fila!.montoConsulta + fila!.montoServicio);
            expect(data?.montoTotal, "el DTO al padre expone el mismo total que la BD").toBe(fila!.montoTotal);
            expect(data?.montoTotal, "el total nunca es menor al precio estándar").toBeGreaterThanOrEqual(precioCOP);
        } finally {
            await request.dispose();
        }
    });

    test("(2) H-2 antes de confirmar: SIN_CONFIRMAR no expone el contacto del profesional", async () => {
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/citas/${solicitudId}`);
            expect(res.status(), "GET detalle de la cita").toBe(200);
            const body = await res.text();
            for (const prohibido of ["contactoProfesional", "whatsapp", "emailProfesional", "correoProfesional", TELEFONO_PROF, EMAIL_PROF]) {
                expect(body.includes(prohibido), `H-2 (SIN_CONFIRMAR): el body NO debe contener "${prohibido}"`).toBe(false);
            }
        } finally {
            await request.dispose();
        }
    });

    test("(3) pago: el admin activa el pago → PAGADA_PENDIENTE y H-2 SIGUE cerrado", async () => {
        const admin = await ctx();
        try {
            await login(admin, EMAIL_ADMIN);
            const activar = await admin.post(`/api/admin/pagos/cita/${solicitudId}/activar`);
            expect(activar.status(), `activar pago body=${await activar.text().catch(() => "")}`).toBe(200);
            expect((await activar.json())?.data?.estado, "el pago aprobado deja la cita PAGADA_PENDIENTE").toBe("PAGADA_PENDIENTE");
        } finally {
            await admin.dispose();
        }

        // Pagar NO es confirmar: el contacto sigue oculto en PAGADA_PENDIENTE.
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/citas/${solicitudId}`);
            expect(res.status(), "GET detalle tras el pago").toBe(200);
            const body = await res.text();
            for (const prohibido of ["contactoProfesional", TELEFONO_PROF, EMAIL_PROF]) {
                expect(body.includes(prohibido), `H-2 (PAGADA_PENDIENTE): el body NO debe contener "${prohibido}"`).toBe(false);
            }
        } finally {
            await request.dispose();
        }
    });

    test("(4) el profesional confirma → CONFIRMADA y H-2 AHORA sí expone el contacto", async () => {
        const prof = await ctx();
        try {
            await login(prof, EMAIL_PROF);
            // La ruta exporta PATCH (no POST): el profesional confirma dentro de las 48h.
            const confirmar = await prof.patch(`/api/profesional/solicitudes/${solicitudId}/confirmar`);
            expect(confirmar.status(), `confirmar body=${await confirmar.text().catch(() => "")}`).toBe(200);
            expect((await confirmar.json())?.data?.estado, "la cita queda CONFIRMADA").toBe("CONFIRMADA");
        } finally {
            await prof.dispose();
        }

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/citas/${solicitudId}`);
            expect(res.status(), "GET detalle tras confirmar").toBe(200);
            const body = await res.text();
            expect(body.includes("contactoProfesional"), "H-2 (CONFIRMADA): el body DEBE traer el bloque de contacto").toBe(true);
            expect(body.includes(EMAIL_PROF), "H-2 (CONFIRMADA): el body DEBE exponer el correo del profesional").toBe(true);
            expect(body.includes(TELEFONO_PROF), "H-2 (CONFIRMADA): el body DEBE exponer el teléfono del profesional").toBe(true);
        } finally {
            await request.dispose();
        }
    });
});
