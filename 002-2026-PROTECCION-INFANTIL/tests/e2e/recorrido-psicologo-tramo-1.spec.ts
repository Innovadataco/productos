/**
 * SPEC-430 (Calidad) · Recorrido «psicólogo de punta a punta» — tramo 1.
 *
 * ORIGEN. Encargo del CEO: correr contra producción apenas despliegue el lote
 * SPEC-423 / 424 / 425 / 428 / 403. Jelkin prueba detrás. Sin `test.fail` —
 * lo que dé rojo es hallazgo real con I-xx.
 *
 * LO QUE DEBE ESTAR EN PROD (contrato verificado por el CEO en `origin/main`):
 *   · Panel del profesional        · `/dashboard/profesional`
 *                                    · `GET /api/profesional/panel` (SPEC-425)
 *   · Menú propio del profesional   · Panel, Verificación, Mi ficha — SIN
 *                                     ítems del padre (SPEC-424)
 *   · Aterrizaje                    · `homeParaRol("PROFESIONAL") = /dashboard/profesional`
 *   · Credencial siempre visible    · `POST /api/admin/(padres|profesionales)/[id]/restablecer-password`
 *                                     devuelve `passwordTemporal` cuando el
 *                                     correo no sale (SPEC-421/423)
 *   · Padre agenda                  · `GET /api/publico/profesionales/precio-primera-cita` (público)
 *                                     `POST /api/padre/citas` cobra el precio
 *                                     estándar del parámetro, no la tarifa del
 *                                     profesional (SPEC-428)
 *                                     `GET /api/padre/citas/[id]` es 404 para
 *                                     otro padre
 *                                     `POST /api/padre/citas/[id]/reasignar`
 *                                     hereda pago (no re-cobra)
 *   · H-2 en la respuesta          · `debeExponerContacto` — teléfono/email
 *                                     del profesional NO viajan al padre hasta
 *                                     que el profesional confirme
 *   · Comisión                      · parámetro `comision.porcentaje` (SPEC-403)
 *
 * AISLAMIENTO. Mismo patrón que C12 (SPEC-393) y los demás candados de hoy:
 *   · Usuarios efímeros por corrida con `randomUUID` (prefijo `e2e-430-`).
 *   · Cero mutación de rol real ni de parámetros globales.
 *   · Aceptación del consentimiento por el flujo real (mismo patrón que
 *     SPEC-410) — NUNCA se inserta en `audit_consentimientos` a mano.
 *   · Limpieza FK-safe en `afterAll`.
 *
 * QUÉ **NO** CUBRE ESTE TRAMO (aviso del CEO 04-09 12:47 · leer el verde con
 * pinzas):
 *
 *   · La pantalla `/perfil-profesional/completar` — hoy revienta con HTTP 500
 *     al primer render (I-302, cero fichas en la historia de producción). Este
 *     spec la SALTA: escribe el `PerfilProfesional` directo por Prisma en
 *     `crearPerfilProfesionalEnRevision`, cablea el estado `EN_REVISION` y
 *     sigue. Un verde acá NO dice nada del flujo real del profesional para
 *     llenar su ficha — SPEC-435 es lo que lo destraba.
 *
 *   · La forma real de `autorizacionArchivoUrl` — en producción es un UUID
 *     pelado (I-303: el DTO/DAO asume string opaco y explota si le llega una
 *     ruta). Este spec siembra una ruta larga (`protected/e2e/<uuid>.pdf`)
 *     por comodidad; NO reproduce I-303. Un verde acá tampoco dice nada del
 *     path del archivo.
 *
 *   · SPEC-436 (cargar y ver los documentos antes de aprobar) — hasta que
 *     entre, el test (2) queda con `test.fail` citando I-304 (ver abajo).
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-430-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Recorrido430!Secure";

const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const VERIFICADOR_EMAIL = `${CORRIDA}-ver@proteccion.local`;
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const PADRE_2_EMAIL = `${CORRIDA}-padre2@proteccion.local`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
    perfiles: new Set<string>(),
    franjas: new Set<string>(),
    solicitudes: new Set<string>(),
};

let profesionalUsuarioId = "";
let perfilProfesionalId = "";
let franjaId = "";
let solicitudId = "";

async function asegurarUsuario(email: string, rol: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: rol as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(PASSWORD),
            rol: rol as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

async function crearPerfilProfesionalEnRevision(usuarioId: string): Promise<string> {
    const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
    if (!ciudad) throw new Error("prod debe tener al menos una Ciudad sembrada");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId,
            nombreVisible: `Prof E2E ${CORRIDA}`,
            tituloProfesional: "Psicóloga clínica",
            especialidades: ["Familia"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 5,
            presentacion: "Presentación efímera para el recorrido SPEC-430.",
            tarifaConsultaCOP: 120_000,
            duracionMinutos: 60,
            emiteFactura: false,
            estado: "EN_REVISION",
            autorizacionArchivoUrl: `protected/e2e/${CORRIDA}.pdf`,
            autorizacionSubidaEn: new Date(),
        },
    });
    sembrados.perfiles.add(perfil.id);
    return perfil.id;
}

async function crearFranjaVirtual(perfilId: string): Promise<string> {
    const inicio = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // +7 días
    const fin = new Date(inicio.getTime() + 1000 * 60 * 60);       // +1h
    const franja = await prisma.franjaDisponible.create({
        data: {
            profesionalId: perfilId,
            inicio,
            fin,
            modalidad: "VIRTUAL",
            tomada: false,
        },
    });
    sembrados.franjas.add(franja.id);
    return franja.id;
}

async function contexto(): Promise<APIRequestContext> {
    // baseURL viene de PLAYWRIGHT_BASE_URL o del playwright.config; el spec
    // no lo fija — permite correrlo local o contra prod cambiando el env.
    return playwrightRequest.newContext();
}

async function login(ctx: APIRequestContext, email: string) {
    const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(ctx: APIRequestContext) {
    // Aceptación honesta por el endpoint real — la fila que quede en
    // audit_consentimientos afirma exactamente lo que pasó (lección SPEC-410).
    await ctx.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

async function limpiarSembrados() {
    // Orden FK-safe: solicitudes → franjas → verificaciones → perfil → usuarios.
    if (sembrados.solicitudes.size > 0) {
        await prisma.solicitudCita.deleteMany({ where: { id: { in: [...sembrados.solicitudes] } } });
    }
    if (sembrados.franjas.size > 0) {
        await prisma.franjaDisponible.deleteMany({ where: { id: { in: [...sembrados.franjas] } } });
    }
    if (sembrados.perfiles.size > 0) {
        await prisma.verificacionProfesional.deleteMany({
            where: { perfilProfesionalId: { in: [...sembrados.perfiles] } },
        });
        await prisma.perfilProfesional.deleteMany({ where: { id: { in: [...sembrados.perfiles] } } });
    }
    if (sembrados.usuarios.size > 0) {
        await prisma.usuario.deleteMany({ where: { id: { in: [...sembrados.usuarios] } } });
    }
    sembrados.solicitudes.clear();
    sembrados.franjas.clear();
    sembrados.perfiles.clear();
    sembrados.usuarios.clear();
}

test.describe.serial("Recorrido psicólogo tramo 1 (SPEC-430)", () => {
    test.beforeAll(async () => {
        profesionalUsuarioId = await asegurarUsuario(PROFESIONAL_EMAIL, "PROFESIONAL", `Prof E2E ${CORRIDA}`);
        await asegurarUsuario(VERIFICADOR_EMAIL, "VERIFICADOR", `Ver E2E ${CORRIDA}`);
        await asegurarUsuario(PADRE_EMAIL, "PARENT", `Padre E2E ${CORRIDA}`);
        await asegurarUsuario(PADRE_2_EMAIL, "PARENT", `Padre2 E2E ${CORRIDA}`);
        await asegurarUsuario(ADMIN_EMAIL, "ADMIN", `Admin E2E ${CORRIDA}`);
        perfilProfesionalId = await crearPerfilProfesionalEnRevision(profesionalUsuarioId);
        franjaId = await crearFranjaVirtual(perfilProfesionalId);
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(1) profesional aterriza en /dashboard/profesional y su menú NO ofrece ítems del padre", async () => {
        const ctx = await contexto();
        try {
            await login(ctx, PROFESIONAL_EMAIL);
            await aceptarConsentimiento(ctx);
            await login(ctx, PROFESIONAL_EMAIL); // refresco cookie sesion_estado

            // Aterrizaje: GET /dashboard sin path debe llevar a /dashboard/profesional.
            const home = await ctx.get("/dashboard");
            const urlFinal = new URL(home.url()).pathname;
            expect(urlFinal, "aterrizaje del rol PROFESIONAL").toBe("/dashboard/profesional");

            // Menú: HTML NO puede pintar los ítems del padre.
            const panelHtml = await ctx.get("/dashboard/profesional");
            const html = await panelHtml.text();
            for (const itemPadre of ["Mis reportes", "Círculo", "Circulo", "A quién vigilo", "Suscripción"]) {
                expect(
                    html.includes(itemPadre),
                    `el menú del profesional NO debe pintar '${itemPadre}' (es del padre)`,
                ).toBe(false);
            }
        } finally {
            await ctx.dispose();
        }
    });

    test("(2) verificador aprueba → panel del profesional muestra verificación al día", async () => {
        // TEST.FAIL a propósito citando SPEC-436 e I-304 — aviso del CEO 04-09 12:47:
        //
        //   «este candado hoy PASA porque no existe ni un documento cargado. El
        //    profesional nunca sube los 4 requisitos y el verificador aprueba a
        //    ciegas. SPEC-436 va a prohibir exactamente eso: no se puede
        //    aprobar sin haber visto documento. Cuando 436 entre, este test se
        //    pone rojo y va a parecer una regresión del Dev — no lo es.
        //    Dejarlo como está sería CERTIFICAR el defecto de I-304.»
        //
        // Al mergear SPEC-436, este `test.fail` se convierte en "unexpected
        // pass" y hay que partir el test en dos: (2a) `aprobar sin ver
        // documentos → 4xx` como el candado real, y (2b) el flujo feliz con
        // documentos cargados en Storage. Quitar el `test.fail` es parte de
        // esa spec, no de este PR.
        test.fail(true, "SPEC-436 (Dev 01) prohibirá aprobar sin haber visto documentos — I-304. Este candado se parte cuando esa spec despliegue.");

        const ctxVer = await contexto();
        try {
            await login(ctxVer, VERIFICADOR_EMAIL);
            await aceptarConsentimiento(ctxVer);
            await login(ctxVer, VERIFICADOR_EMAIL);

            // Descubrir las claves reales de checklist (parámetro editable en prod).
            const ficha = await ctxVer.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            expect(ficha.status(), "ficha del verificador").toBe(200);
            const items = (await ficha.json())?.data?.checklist ?? [];
            const claves: string[] = Array.isArray(items) ? items.map((it: any) => it.clave ?? it.id ?? it.key).filter(Boolean) : Object.keys(items);
            expect(claves.length, "la ficha debe traer los ítems configurados del parámetro").toBeGreaterThan(0);
            const todosCumple = Object.fromEntries(claves.map((k) => [k, { estado: "CUMPLE" }]));

            const decidir = await ctxVer.post(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`, {
                data: { checklist: todosCumple },
            });
            // Hoy pasa; SPEC-436 lo hará devolver 4xx porque no hay documentos cargados.
            expect(decidir.status(), `decidir APROBAR sin documentos cargados — hoy PASA (I-304); SPEC-436 lo prohíbe. body=${await decidir.text().catch(() => "")}`).toBe(200);
            const resultado = (await decidir.json())?.data?.resultado;
            expect(resultado, "todo CUMPLE debe cerrar con APROBADO (bajo I-304)").toBe("APROBADO");

            const perfilTrasAprobar = await prisma.perfilProfesional.findUnique({
                where: { id: perfilProfesionalId },
                select: { estado: true },
            });
            expect(perfilTrasAprobar?.estado, "perfil activo tras aprobar").toBe("ACTIVO");
        } finally {
            await ctxVer.dispose();
        }

        const ctxProf = await contexto();
        try {
            await login(ctxProf, PROFESIONAL_EMAIL);
            const panel = await ctxProf.get("/api/profesional/panel");
            expect(panel.status(), "panel del profesional").toBe(200);
            const txt = await panel.text();
            expect(
                /verificaci[oó]n|APROBADO|activo/i.test(txt),
                "el panel debe reflejar la verificación al día",
            ).toBe(true);
        } finally {
            await ctxProf.dispose();
        }
    });

    test("(3a) precio primera cita público sin sesión", async () => {
        const ctx = await contexto();
        try {
            const res = await ctx.get("/api/publico/profesionales/precio-primera-cita");
            expect(res.status(), "precio primera cita público").toBe(200);
            const body = await res.json();
            const precio = body?.data?.precio ?? body?.precio ?? body?.data?.precioBaseCOP;
            expect(typeof precio, "el precio viene como número").toBe("number");
            expect(precio, "precio > 0").toBeGreaterThan(0);
        } finally {
            await ctx.dispose();
        }
    });

    test("(3b) padre pide cita: precio del PARÁMETRO, respuesta sin contacto del profesional (H-2)", async () => {
        // Precio parámetro (para el assert de monto).
        const ctxPub = await contexto();
        const precioRes = await ctxPub.get("/api/publico/profesionales/precio-primera-cita");
        const precioBody = await precioRes.json();
        const precioParametro = precioBody?.data?.precio ?? precioBody?.precio ?? precioBody?.data?.precioBaseCOP;
        await ctxPub.dispose();

        const ctxPadre = await contexto();
        try {
            await login(ctxPadre, PADRE_EMAIL);
            await aceptarConsentimiento(ctxPadre);
            await login(ctxPadre, PADRE_EMAIL);

            const crear = await ctxPadre.post("/api/padre/citas", {
                data: {
                    profesionalId: perfilProfesionalId,
                    franjaId,
                    presentacion: `Solicitud de cita para el recorrido SPEC-430 corrida ${CORRIDA}, texto largo válido.`,
                    urgencia: "ESTA_SEMANA",
                },
            });
            const bodyCrear = await crear.json().catch(() => ({}));
            expect(crear.status(), `crear cita body=${JSON.stringify(bodyCrear).slice(0,200)}`).toBe(200);
            solicitudId = bodyCrear?.data?.id ?? "";
            sembrados.solicitudes.add(solicitudId);
            expect(solicitudId, "la respuesta trae el id de la solicitud").toBeTruthy();

            // Monto cobrado = precio parámetro (no la tarifa del profesional).
            const montoTotal = bodyCrear?.data?.montoTotal ?? bodyCrear?.data?.montoConsulta;
            expect(montoTotal, "el monto debe salir del parámetro precio-primera-cita").toBe(precioParametro);

            // H-2: el body al padre NO expone contacto del profesional.
            //
            // Probado muriendo (aviso CEO 04-09 12:47): al comentar
            // `if (!debeExponerContacto(...)) return dto;` en
            // `src/lib/profesional/cita/dto.ts:toCitaParaPadre`, el DTO devuelve
            // `contactoProfesional: {email, telefono}` incondicionalmente. El
            // assert de abajo detecta la subcadena `"telefono"` dentro del
            // objeto y se pone rojo — el candado MUERE con el defecto.
            //
            // La lista incluye `contactoProfesional` como candado estructural:
            // si un día el DTO renombra las claves internas (por ejemplo
            // `contactoProfesional.correo` en vez de `.email`), la presencia
            // del envoltorio ya es fuga.
            const detalle = await ctxPadre.get(`/api/padre/citas/${solicitudId}`);
            const detalleTxt = await detalle.text();
            for (const campo of ["contactoProfesional", "telefono", "whatsapp", "correoProfesional", "emailProfesional"]) {
                expect(
                    detalleTxt.includes(`"${campo}"`),
                    `H-2: '${campo}' NO puede viajar al padre antes de la confirmación`,
                ).toBe(false);
            }
        } finally {
            await ctxPadre.dispose();
        }
    });

    test("(3c) tras confirmar el profesional, el contacto SÍ se expone al padre", async () => {
        expect(solicitudId, "el test previo dejó una solicitud").toBeTruthy();

        // Confirmar por el profesional.
        const ctxProf = await contexto();
        try {
            await login(ctxProf, PROFESIONAL_EMAIL);
            const confirmar = await ctxProf.post(`/api/profesional/solicitudes/${solicitudId}/confirmar`);
            expect(confirmar.status(), `confirmar body=${await confirmar.text().catch(() => "")}`).toBe(200);
        } finally {
            await ctxProf.dispose();
        }

        // Vista del padre debe traer contacto ahora.
        const ctxPadre = await contexto();
        try {
            await login(ctxPadre, PADRE_EMAIL);
            const detalle = await ctxPadre.get(`/api/padre/citas/${solicitudId}`);
            const detalleTxt = await detalle.text();
            expect(
                /telefono|whatsapp|correoProfesional|emailProfesional/i.test(detalleTxt),
                "tras confirmar, el contacto del profesional DEBE viajar",
            ).toBe(true);
        } finally {
            await ctxPadre.dispose();
        }
    });

    test("(3d) otro padre recibe 404 al leer la cita", async () => {
        expect(solicitudId, "solicitud del test previo").toBeTruthy();
        const ctx = await contexto();
        try {
            await login(ctx, PADRE_2_EMAIL);
            await aceptarConsentimiento(ctx);
            await login(ctx, PADRE_2_EMAIL);
            const res = await ctx.get(`/api/padre/citas/${solicitudId}`);
            expect(res.status(), "otro padre NO puede leer una cita ajena").toBe(404);
        } finally {
            await ctx.dispose();
        }
    });

    test("(4) admin restablece la password del profesional → respuesta trae passwordTemporal", async () => {
        const ctx = await contexto();
        try {
            await login(ctx, ADMIN_EMAIL);
            await aceptarConsentimiento(ctx);
            await login(ctx, ADMIN_EMAIL);

            const res = await ctx.post(`/api/admin/profesionales/${profesionalUsuarioId}/restablecer-password`);
            const body = await res.json().catch(() => ({}));
            expect(res.status(), `restablecer body=${JSON.stringify(body).slice(0,200)}`).toBe(200);
            expect(
                typeof (body?.data?.passwordTemporal ?? body?.passwordTemporal),
                "SPEC-423: la respuesta SIEMPRE trae passwordTemporal (correo caído por cuota)",
            ).toBe("string");
        } finally {
            await ctx.dispose();
        }
    });
});
