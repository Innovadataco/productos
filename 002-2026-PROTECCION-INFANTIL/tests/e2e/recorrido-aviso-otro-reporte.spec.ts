/**
 * SPEC-439 (Calidad) · Recorrido — aviso al padre cuando alguien más reporta
 * el mismo identificador que un `ContactoConfianza` de su círculo.
 *
 * ORIGEN. SPEC-439 (radicado 439 + corrección del CEO 04-09 13:38) promete la
 * tercera pata del aviso: además del suscriptor y del vigilante, también el
 * REPORTANTE recibe corroboración cuando otra fuente reporta el mismo
 * identificador. La spec vive en `specs/439-corroboracion-y-aviso-al-padre/`.
 *
 * QUÉ CUBRE — el orden lo fijó el CEO por importancia (encargo 04-09):
 *
 *   (A) Un padre vigila un identificador (lo tiene como
 *       `IdentificadorContacto` dentro de un `ContactoConfianza` de su
 *       círculo). Un SEGUNDO usuario, anónimo, reporta EXACTAMENTE ese
 *       identificador por la misma plataforma. Después del reporte, existe
 *       AL MENOS UNA fila nueva en `notificaciones` cuyo
 *       `destinatarioUsuarioId` es el padre. La spec real fija el `evento`
 *       exacto (SPEC-439 usa `reporte.corroborado_por_otro` para el
 *       reportante y `padre.circulo_confianza.reporte_enriquecido` para el
 *       vigilante); este candado NO acopla al literal — cuenta "cualquier
 *       notificación nueva al padre por ese ContactoConfianza dispara el
 *       candado", como pidió el CEO.
 *
 * ¿POR QUÉ `test.fail`? SPEC-439 aún no está desplegada. El código puede vivir
 * en `main` (`corroboracion-padre.ts` + `notificarCambioCirculoSiCorresponde`)
 * pero el aviso llega por `scripts/worker-reportes.mjs:226`, un worker
 * `fire-and-forget` con `.catch()` — la propia SPEC-439 lo marca como
 * "degradación silenciosa distinta de la ausencia de cableado, no arreglar
 * acá". Hasta que el aviso se demuestre punta a punta contra la BD, este
 * recorrido queda en `test.fail(true, "SPEC-439 …")` — cuando el candado
 * empiece a fallar (porque el aviso YA llega), se retira el marcador.
 *
 * REGLA QUE DEFINE ESTE SPEC (CEO 04-09):
 *   «Caminá la pantalla real, no siembres alrededor. El padre completa el
 *    camino guiado por endpoints reales (consentimiento, datos, hijo,
 *    suscripción) antes de agregar el contacto. El único write directo por
 *    Prisma admitido es la `Suscripcion` (patrón heredado de
 *    `mis-reportes-expediente.spec.ts` — no hay endpoint público para
 *    activar plan freemium desde tests).»
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-439-`. Limpieza
 * FK-safe en `afterAll`. Cero mutación de parámetros globales.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-439-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Aviso439!Seguro";

const EMAIL_PADRE = `${CORRIDA}-padre@proteccion.local`;

// Identificador que el padre vigila; el visitante anónimo lo reporta.
const IDENTIFICADOR_VIGILADO = `+57300E2E${Date.now()}${randomUUID().slice(0, 4)}`;
const PLATAFORMA_CLAVE = "whatsapp";

const sembrados = {
    usuarios: new Set<string>(),
    tokens: new Set<string>(),
    contactos: new Set<string>(),
    suscripciones: new Set<string>(),
    hijos: new Set<string>(),
    reportesIdentificador: IDENTIFICADOR_VIGILADO,
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

/**
 * Simula el correo del enlace de registro (Resend caído en dev): se inserta
 * el `TokenRegistro` con el hash del token que devolveremos. `completar`
 * itera los activos y matchea por hash — igual que el `RegistroEnlaceService`
 * real.
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

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    const res = await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
    // 2xx aceptable (200/204); el guard del camino solo lee la fila creada.
    expect(res.status(), `consentimiento body=${await res.text().catch(() => "")}`).toBeLessThan(300);
}

async function limpiarSembrados() {
    // Reportes creados con el identificador vigilado (por el visitante anónimo).
    await prisma.reporte.deleteMany({ where: { identificador: sembrados.reportesIdentificador } });
    await prisma.identificadorReportado.deleteMany({ where: { identificador: sembrados.reportesIdentificador } });

    // Contactos y sus identificadores (cascade cubre `IdentificadorContacto`).
    if (sembrados.contactos.size > 0) {
        await prisma.contactoConfianza.deleteMany({ where: { id: { in: [...sembrados.contactos] } } });
    }

    if (sembrados.suscripciones.size > 0) {
        await prisma.suscripcion.deleteMany({ where: { id: { in: [...sembrados.suscripciones] } } });
    }

    if (sembrados.hijos.size > 0) {
        await prisma.hijo.deleteMany({ where: { id: { in: [...sembrados.hijos] } } });
    }

    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }

    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PADRE] } },
        select: { id: true },
    });
    const usuarioIds = usuariosCreados.map((u) => u.id);
    if (usuarioIds.length > 0) {
        // Notificaciones que la spec crea al padre — se limpian con FK-safe delete.
        await prisma.notificacion.deleteMany({ where: { destinatarioUsuarioId: { in: usuarioIds } } });
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        // `AuditConsentimiento` cae por cascade FK del Usuario (regla dura:
        // nunca escribir `audit_consentimientos`; el delete-cascade es aceptable).
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }

    sembrados.usuarios.clear();
    sembrados.tokens.clear();
    sembrados.contactos.clear();
    sembrados.suscripciones.clear();
    sembrados.hijos.clear();
}

let padreUsuarioId = "";
let contactoConfianzaId = "";
let plataformaWhatsappId = "";

test.describe.serial("Aviso al padre cuando alguien más reporta lo mismo (SPEC-439)", () => {
    test.beforeAll(async () => {
        // (0) Datos base que el camino guiado consulta.
        const [ciudad, plataforma, planPadreActivo] = await Promise.all([
            prisma.ciudad.findFirst({ select: { id: true, paisId: true } }),
            prisma.plataforma.findFirst({ where: { clave: PLATAFORMA_CLAVE }, select: { id: true } }),
            // Plan del titular PADRE, activo — el catálogo lo siembra `prisma/seed.ts`.
            prisma.plan.findFirst({ where: { tipoTitular: "PADRE", activo: true }, select: { id: true } }),
        ]);
        expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
        expect(plataforma, `prod debe tener la Plataforma clave='${PLATAFORMA_CLAVE}'`).not.toBeNull();
        expect(planPadreActivo, "prod debe tener al menos un Plan activo con tipoTitular=PADRE").not.toBeNull();
        plataformaWhatsappId = plataforma!.id;

        const request = await ctx();
        try {
            // (1) El padre se registra por la pantalla (Resend caído → fabricamos enlace).
            const solicitar = await request.post("/api/auth/registro/solicitar", {
                data: { email: EMAIL_PADRE },
            });
            expect(solicitar.status(), "SPEC-339 solicitar padre responde 202").toBe(202);
            const tokensCreados = await prisma.tokenRegistro.count({ where: { email: EMAIL_PADRE } });
            expect(tokensCreados, "el POST solicitar debe crear al menos un TokenRegistro real").toBeGreaterThanOrEqual(1);

            const token = await fabricarEnlace(EMAIL_PADRE, "PARENT" as RolUsuario);

            const completar = await request.post("/api/auth/registro/completar", {
                data: { token, password: PASSWORD },
            });
            expect(
                completar.status(),
                `completar padre body=${await completar.text().catch(() => "")}`,
            ).toBe(201);

            // (2) Camino guiado — Paso 1: consentimiento por endpoint real.
            await aceptarConsentimiento(request);

            // (3) Camino guiado — Paso 2: datos del padre (PATCH real).
            const putPerfil = await request.patch("/api/padre/perfil", {
                data: {
                    nombre: `Padre E2E ${CORRIDA}`,
                    apellidos: "Del Aviso",
                    documentoTipo: "CC",
                    documentoNumero: `79${Date.now() % 100000000}`,
                    telefono: "+57 300 111 2233",
                    paisId: ciudad!.paisId,
                    ciudadId: ciudad!.id,
                },
            });
            expect(
                putPerfil.status(),
                `PATCH perfil body=${await putPerfil.text().catch(() => "")}`,
            ).toBe(200);

            // (4) Camino guiado — Paso 3: un menor activo por endpoint real.
            const postHijo = await request.post("/api/padre/hijos", {
                data: {
                    nombre: "Menor",
                    apellidos: "Del Aviso",
                    documentoTipo: "TI",
                    documentoNumero: `10${Date.now() % 100000000}`,
                },
            });
            expect(
                postHijo.status(),
                `POST hijo body=${await postHijo.text().catch(() => "")}`,
            ).toBe(201);

            // (5) Buscamos el usuarioId y sembramos la Suscripción ACTIVA.
            //     Único write directo admitido: no hay endpoint público para
            //     activar suscripción freemium desde tests (patrón heredado
            //     de `mis-reportes-expediente.spec.ts`).
            const padre = await prisma.usuario.findUnique({
                where: { email: EMAIL_PADRE },
                select: { id: true },
            });
            expect(padre, "el completar debe haber creado el Usuario padre").not.toBeNull();
            padreUsuarioId = padre!.id;
            sembrados.usuarios.add(padreUsuarioId);

            const hijoDelPadre = await prisma.hijo.findFirst({
                where: { usuarioId: padreUsuarioId },
                select: { id: true },
            });
            if (hijoDelPadre) sembrados.hijos.add(hijoDelPadre.id);

            const suscripcion = await prisma.suscripcion.create({
                data: {
                    tipoTitular: "PADRE",
                    usuarioId: padreUsuarioId,
                    estado: "ACTIVA",
                    planActualId: planPadreActivo!.id,
                    fechaInicio: new Date(),
                    fechaFin: new Date(Date.now() + 365 * 86_400_000),
                    codigoReferidoPropio: `ref-${CORRIDA}`,
                    esFreemium: true,
                },
                select: { id: true },
            });
            sembrados.suscripciones.add(suscripcion.id);

            // (6) El padre agrega un ContactoConfianza con el identificador
            //     vigilado — endpoint real `/api/circulo-confianza` (POST).
            const postContacto = await request.post("/api/circulo-confianza", {
                data: {
                    nombre: "Contacto vigilado E2E",
                    parentesco: "amigo",
                    identificadores: [
                        {
                            valor: IDENTIFICADOR_VIGILADO,
                            tipo: "handle",
                            plataformaId: plataformaWhatsappId,
                        },
                    ],
                },
            });
            expect(
                postContacto.status(),
                `POST circulo-confianza body=${await postContacto.text().catch(() => "")}`,
            ).toBeLessThan(300);
            const contactoBody = (await postContacto.json().catch(() => ({}))) as { contacto?: { id?: string }; id?: string };
            const contactoId = contactoBody.contacto?.id ?? contactoBody.id ?? "";
            // Fallback: recuperar por FK — el shape de la respuesta puede cambiar.
            if (contactoId) {
                contactoConfianzaId = contactoId;
            } else {
                const encontrado = await prisma.contactoConfianza.findFirst({
                    where: { usuarioId: padreUsuarioId },
                    orderBy: { creadoEn: "desc" },
                    select: { id: true },
                });
                expect(encontrado, "el POST circulo-confianza debe haber creado el contacto").not.toBeNull();
                contactoConfianzaId = encontrado!.id;
            }
            sembrados.contactos.add(contactoConfianzaId);
        } finally {
            await request.dispose();
        }
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) un tercero reporta el identificador vigilado → aviso al padre en `notificaciones`", async () => {
        // TEST.FAIL a propósito citando SPEC-439.
        //
        // Encargo del CEO 04-09: "SPEC-439 aún no desplegada — `test.fail`".
        // Aunque el código pueda vivir en `main` (`corroboracion-padre.ts` +
        // `notificarCambioCirculoSiCorresponde`), el aviso llega desde
        // `scripts/worker-reportes.mjs:226` — fire-and-forget con `.catch()`
        // que la propia SPEC-439 marca como degradación silenciosa (no
        // arreglar acá). Hasta que el aviso se demuestre punta a punta en
        // este recorrido, el candado queda con `test.fail`.
        test.fail(
            true,
            "SPEC-439 (Dev X) trae el aviso al padre cuando alguien más reporta lo mismo. Este candado se quita cuando esa spec despliegue.",
        );

        const antes = await prisma.notificacion.count({
            where: { destinatarioUsuarioId: padreUsuarioId },
        });

        // Visitante anónimo — sesión nueva sin cookies.
        const anonimo = await ctx();
        try {
            const reporte = await anonimo.post("/api/reportes", {
                data: {
                    identificador: IDENTIFICADOR_VIGILADO,
                    plataforma: PLATAFORMA_CLAVE,
                    texto:
                        "Un adulto insiste con esta cuenta enviando mensajes cada noche y pide fotos, " +
                        "reporte de prueba SPEC-439 " +
                        CORRIDA,
                    fechaIncidente: new Date(Date.now() - 3_600_000).toISOString(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                },
            });
            expect(
                reporte.status(),
                `POST reportes anon body=${await reporte.text().catch(() => "")}`,
            ).toBe(201);
        } finally {
            await anonimo.dispose();
        }

        // El aviso lo emite el worker (`scripts/worker-reportes.mjs:226`).
        // Damos hasta 10 s de gracia — si el worker no está corriendo el
        // candado falla (comportamiento esperado bajo `test.fail`).
        const deadline = Date.now() + 10_000;
        let despues = antes;
        while (Date.now() < deadline) {
            despues = await prisma.notificacion.count({
                where: { destinatarioUsuarioId: padreUsuarioId },
            });
            if (despues > antes) break;
            await new Promise((r) => setTimeout(r, 500));
        }

        expect(
            despues,
            "SPEC-439: después del reporte del tercero debe existir al menos una " +
                "Notificacion nueva cuyo destinatario es el padre que vigila el " +
                `identificador. antes=${antes} despues=${despues}`,
        ).toBeGreaterThan(antes);
    });
});
