/**
 * SPEC-449 (Calidad) · Recorrido: un perfil de profesional en estado VENCIDO
 * desaparece del directorio del padre y su ficha no expone contacto (H-2).
 *
 * ORIGEN. Encargo del CEO 04-09: el enum `EstadoPerfilProfesional` incluye
 * `VENCIDO` (prisma/schema.prisma L3419-3424) y el brief H-1/H-2 exige que un
 * perfil vencido salga del directorio y NO revele contacto profesional al
 * padre. Hoy la DAL filtra `estado: "ACTIVO"` en `listarActivos` y
 * `obtenerPublicoPorId` (perfil-profesional.ts L204/L223), pero no hay
 * recorrido que camine la pantalla real del padre y afirme que:
 *
 *   (A) un perfil que en algún momento estuvo ACTIVO y se pasó a VENCIDO,
 *       DESAPARECE del listado `GET /api/padre/profesionales?seed=...`.
 *   (B) la ficha individual `GET /api/padre/profesionales/[id]` de ese perfil
 *       responde 404 (mejor: el perfil VENCIDO no existe públicamente); si
 *       algún cambio lo devolviera con 200, el cuerpo NO puede contener
 *       ningún campo de contacto profesional (`telefono`, `whatsapp`,
 *       `correoProfesional`, `emailProfesional`, `contactoProfesional`).
 *
 * REGLA QUE DEFINE ESTE SPEC (memoria del CEO — «caminá la pantalla real»):
 *   El profesional se registra, completa perfil, sube autorización + documentos
 *   y el ADMIN lo aprueba por el endpoint real. No se toca `PerfilProfesional`
 *   por Prisma directo salvo la ÚNICA excepción documentada abajo: forzar el
 *   estado a VENCIDO — no existe endpoint público que fuerce el vencimiento
 *   manual (el flujo real es que `venceEn` en `VerificacionProfesional` expira
 *   pasados ~4 meses), así que la mutación directa por Prisma es la ÚNICA
 *   forma de reproducir el escenario sin esperar cuatro meses en CI.
 *
 * ESTADO. SPEC-449 (#358) YA está en main y desplegada — el directorio
 * `/api/padre/profesionales` ya filtra `estado = ACTIVO`. Los tests afirman
 * el comportamiento bueno (aviso CEO 23:2x). El patrón original era
 * «candado antes del fix» que la memoria «calidad-candado-antes-del-fix»
 * fija: la spec de Calidad mergea antes que la implementación de Dev; cuando
 * SPEC-449 despliegue y el recorrido real quede bendecido en producción
 * (incluida la garantía formal de que el listado + ficha nunca devuelven un
 * VENCIDO ni sus campos de contacto), se remueve el `test.fail`.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-449-`. Limpieza FK-safe
 * en `afterAll`. Cero mutación de rol real ni parámetros globales.
 *
 * SPEC-828 (extensión) · la mitad REPS de la compuerta del directorio (SPEC-790). 449/690 cubre la
 * vigencia INTERNA; acá se cubre la REPS, que es OTRA noción de «vigente». Sobre el MISMO perfil ACTIVO
 * (vigencia interna OK), se planta una verificación REPS caducada → sale del directorio, y una vigente →
 * reaparece (control positivo). Así la exclusión queda atribuida al REPS, no a la vigencia interna — el
 * discriminador que el radicado exige no confundir.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario, EstadoReps, ModalidadReps } from "@prisma/client";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const CORRIDA = `e2e-449-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Vencido449!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;
const EMAIL_PADRE = `${CORRIDA}-padre@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
    perfiles: new Set<string>(),
    tokens: new Set<string>(),
};

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

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
}

/** El padre onboardeado por el CAMINO REAL (builder): el directorio
 *  `/api/padre/profesionales` está detrás del guardián de camino (403
 *  CAMINO_INCOMPLETO hasta completarlo), así que un padre con el consentimiento
 *  puesto a mano pero sin datos/hijo/plan no llega a listar. Cada login re-sella
 *  la sesión con el camino completo. Se limpia con `limpiarPadreOnboarded`. */
async function asegurarPadre(): Promise<void> {
    const req = await ctx();
    try {
        padre = await crearPadreOnboarded({ request: req, email: EMAIL_PADRE, password: PASSWORD });
    } finally {
        await req.dispose();
    }
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

/**
 * PDF mínimo válido — pasa el número mágico `%PDF-` del validador
 * (`autorizacion-storage.ts:MAGIA_PDF = 25 50 44 46 2d`).
 */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

const CAMPOS_CONTACTO_PROHIBIDOS = [
    "telefono",
    "whatsapp",
    "correoProfesional",
    "emailProfesional",
    "contactoProfesional",
] as const;

async function limpiarSembrados() {
    // El PADRE lo limpia su propio fixture (tiene suscripción + hijo → FK). Acá solo
    // el profesional y el admin.
    const usuariosCreados = await prisma.usuario.findMany({
        where: { email: { in: [EMAIL_PROF, EMAIL_ADMIN] } },
        select: { id: true },
    });
    const usuarioIds = usuariosCreados.map((u) => u.id);
    if (usuarioIds.length > 0) {
        const perfiles = await prisma.perfilProfesional.findMany({
            where: { usuarioId: { in: usuarioIds } },
            select: { id: true },
        });
        const perfilIds = perfiles.map((p) => p.id);
        if (perfilIds.length > 0) {
            await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            // SPEC-828: las VerificacionReps plantadas tienen FK Restrict al perfil → se borran ANTES del perfil.
            await prisma.verificacionReps.deleteMany({ where: { profesionalId: { in: perfilIds } } });
            await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
            await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
        }
    }
    if (sembrados.tokens.size > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: [...sembrados.tokens] } } });
    }
    if (usuarioIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.perfiles.clear();
    sembrados.tokens.clear();
}

/**
 * Estado compartido entre tests (describe.serial): el profesional se crea y
 * su perfil queda ACTIVO una vez; los dos candados (A/B) operan sobre él.
 */
let perfilProfesionalId = "";
let padre: PadreOnboarded | undefined;
const semillaDirectorio = `seed-449-${randomUUID().slice(0, 8)}`;

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

/**
 * SPEC-828 · planta una VerificacionReps (BD *_test) para el perfil ACTIVO. Excepción documentada
 * (como el estado VENCIDO del 449): no hay endpoint real que registre una verificación REPS ya
 * CADUCADA —la carga manual del admin registra una vigente—, así que se planta por Prisma. `resultado`
 * VIGENTE EXIGE `vigenteHasta` (CHECK de la migración); el motor la cierra si esa fecha ya pasó.
 */
async function plantarReps(datos: {
    resultado: EstadoReps;
    verificadoEn: Date;
    vigenteHasta: Date | null;
    modalidades?: ModalidadReps[];
}) {
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilProfesionalId,
            verificadoEn: datos.verificadoEn,
            fuente: "MANUAL_ADMIN",
            resultado: datos.resultado,
            vigenteHasta: datos.vigenteHasta,
            modalidades: datos.modalidades ?? ["TELEMEDICINA"],
            modalidadesNoMapeadas: [],
            verificadoPorSnapshot: `e2e SPEC-828 (${CORRIDA})`,
        },
    });
}

test.describe.serial("Perfil VENCIDO fuera del directorio (SPEC-449)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
        await asegurarPadre();

        const request = await ctx();
        try {
            // (1) el profesional se registra por la pantalla
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", {
                data: { email: EMAIL_PROF },
            });
            expect(solicitar.status(), "SPEC-391: solicitar profesional responde 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(
                completar.status(),
                `completar profesional body=${await completar.text().catch(() => "")}`,
            ).toBe(201);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF);

            // (2) el profesional completa su ficha
            const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
            expect(ciudad, "prod debe tener al menos una Ciudad sembrada").not.toBeNull();
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi E2E ${CORRIDA}`,
                    profesion: "psicologo",
                    areasAtencion: ["ansiedad"],
                    rangoEtario: ["12-17"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: "Presentación efímera SPEC-449.",
                    // Sin tarifa: un profesional no habilitado no puede fijarla (route.ts:166,
                    // SPEC-685). Acá no se usa: el directorio filtra por estado ACTIVO, no por tarifa.
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            expect(
                putPerfil.status(),
                `PUT perfil body=${await putPerfil.text().catch(() => "")}`,
            ).toBeLessThan(300);

            const perfil = await prisma.perfilProfesional.findFirst({
                where: { usuario: { email: EMAIL_PROF } },
                select: { id: true },
            });
            expect(perfil, "el PUT perfil debe haber creado el PerfilProfesional").not.toBeNull();
            perfilProfesionalId = perfil!.id;

            // SPEC-686/706: aceptar la autorización en pantalla ANTES de subir el archivo —
            // sin la aceptación (`yaAceptoVersionVigente`) el perfil NO pasa a EN_REVISION.
            const aceptarAutor = await request.post("/api/profesional/autorizacion/aceptar", {});
            expect(aceptarAutor.status(), `aceptar autorización body=${await aceptarAutor.text().catch(() => "")}`).toBeLessThan(300);

            // (3) el profesional sube autorización — transiciona a EN_REVISION
            const subirAutorizacion = await request.post("/api/profesional/autorizacion", {
                multipart: {
                    archivo: {
                        name: "autorizacion.pdf",
                        mimeType: "application/pdf",
                        buffer: pdfMinimo(`${CORRIDA}-autorizacion`),
                    },
                },
            });
            expect(
                subirAutorizacion.status(),
                `POST autorización body=${await subirAutorizacion.text().catch(() => "")}`,
            ).toBeLessThan(300);

            // (4) el profesional carga documentos para TODOS los requisitos
            const estado = await request.get("/api/profesional/documentos");
            expect(estado.status(), "GET estado documentos").toBe(200);
            const items: Array<{ clave: string }> = (await estado.json())?.data ?? [];
            expect(
                items.length,
                "el parámetro `verificacion.requisitos` debe traer al menos 1 requisito",
            ).toBeGreaterThanOrEqual(1);
            for (const it of items) {
                const subir = await request.post("/api/profesional/documentos", {
                    multipart: {
                        requisito: it.clave,
                        archivo: {
                            name: `${it.clave}.pdf`,
                            mimeType: "application/pdf",
                            buffer: pdfMinimo(`${CORRIDA}-${it.clave}`),
                        },
                    },
                });
                expect(
                    subir.status(),
                    `POST subir documento ${it.clave} body=${await subir.text().catch(() => "")}`,
                ).toBeLessThan(300);
            }
        } finally {
            await request.dispose();
        }

        // (5) el ADMIN aprueba la ficha por el endpoint real → estado ACTIVO
        const admReq = await ctx();
        try {
            await login(admReq, EMAIL_ADMIN);
            await aceptarConsentimiento(admReq);
            await login(admReq, EMAIL_ADMIN);

            const ficha = await admReq.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            // La ficha devuelve `checklist` como Record<clave, item> (objeto), no array (SPEC-408).
            const claves: string[] = Object.keys(((await ficha.json())?.data?.checklist) ?? {});
            expect(claves.length, "checklist con al menos 1 requisito").toBeGreaterThanOrEqual(1);
            const checklist: Record<string, { estado: "CUMPLE" }> = {};
            for (const k of claves) checklist[k] = { estado: "CUMPLE" };

            const decidir = await admReq.post(
                `/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`,
                { data: { checklist } },
            );
            expect(
                decidir.status(),
                `decidir APROBADO body=${await decidir.text().catch(() => "")}`,
            ).toBe(200);
        } finally {
            await admReq.dispose();
        }

        const estadoFinal = await prisma.perfilProfesional.findUnique({
            where: { id: perfilProfesionalId },
            select: { estado: true },
        });
        expect(estadoFinal?.estado, "el perfil debe quedar ACTIVO tras la aprobación").toBe("ACTIVO");
    });

    test.afterAll(async () => {
        if (padre) await limpiarPadreOnboarded(padre);
        await limpiarSembrados();
    });

    test("prevuelo · el perfil ACTIVO aparece en el directorio antes de vencerlo", async () => {
        // Este candado se marca como fail junto con los otros dos: SPEC-449
        // exige que la cadena entera (aparece → se vence → desaparece) se
        // pruebe como un solo recorrido. Si el prevuelo se saliera de la
        // marca, un fallo del setup (perfil que nunca aparece) enmascararía
        // el bug real (el listado no filtra VENCIDO).

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(
                `/api/padre/profesionales?seed=${encodeURIComponent(semillaDirectorio)}`,
            );
            expect(
                res.status(),
                `listado directorio body=${await res.text().catch(() => "")}`,
            ).toBe(200);
            const body = await res.json();
            const items: Array<{ id: string }> = body?.items ?? [];
            expect(
                items.some((it) => it.id === perfilProfesionalId),
                `el perfil recién aprobado debe aparecer en el listado. ids=${items.map((i) => i.id).join(",")}`,
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    // ── SPEC-828 · la mitad REPS de la compuerta (790), ENTRE «aparece» (prevuelo) y «vencido interno» (A) ──
    // El prevuelo ya probó que el perfil ACTIVO (vigencia INTERNA 690 OK) APARECE con REPS SIN_VERIFICAR.
    // Acá se mueve SOLO la habilitación REPS (790) y se mira la MISMA pantalla del padre. La vigencia
    // interna NO se toca hasta (A), así que una exclusión en este bloque solo puede ser del REPS — es el
    // discriminador que el radicado exige no confundir.

    test("(SPEC-828) con REPS CADUCADO y vigencia interna OK, el perfil SALE del directorio", async () => {
        const activo = await prisma.perfilProfesional.findUnique({
            where: { id: perfilProfesionalId },
            select: { estado: true },
        });
        expect(activo?.estado, "pre-condición: el perfil sigue ACTIVO — la vigencia INTERNA no se tocó").toBe("ACTIVO");

        // REPS VIGENTE cuya vigencia de la AUTORIDAD ya pasó = «caducado». `repsElegible` lo cierra por el
        // reloj de la autoridad (vigenteHasta <= now) aunque nuestro chequeo sea reciente y el cutover esté
        // abierto. Es la OTRA vigencia, no la interna.
        await plantarReps({ resultado: "VIGENTE", verificadoEn: hace(10), vigenteHasta: hace(1) });

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/profesionales?seed=${encodeURIComponent(semillaDirectorio)}`);
            expect(res.status(), `listado body=${await res.text().catch(() => "")}`).toBe(200);
            const items: Array<{ id: string }> = (await res.json())?.items ?? [];
            expect(
                items.every((it) => it.id !== perfilProfesionalId),
                `REPS caducado: el perfil NO debe aparecer (compuerta 790), aunque su vigencia interna siga OK. ids=${items.map((i) => i.id).join(",")}`,
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    test("(SPEC-828) control positivo — con REPS VIGENTE el MISMO perfil REAPARECE (la exclusión era del REPS)", async () => {
        // Remoción del discriminador: una verificación MÁS RECIENTE, VIGENTE y con vigencia futura. La
        // «última fila» (orden verificadoEn desc) manda. Nada de la vigencia interna cambió entre este test
        // y el anterior; que reaparezca prueba que lo que lo sacaba era el REPS, no la vigencia interna.
        await plantarReps({ resultado: "VIGENTE", verificadoEn: new Date(), vigenteHasta: enDias(120), modalidades: ["TELEMEDICINA"] });

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/profesionales?seed=${encodeURIComponent(semillaDirectorio)}`);
            expect(res.status(), `listado body=${await res.text().catch(() => "")}`).toBe(200);
            const items: Array<{ id: string }> = (await res.json())?.items ?? [];
            expect(
                items.some((it) => it.id === perfilProfesionalId),
                `REPS vigente: el perfil DEBE reaparecer (control positivo). ids=${items.map((i) => i.id).join(",")}`,
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    test("(A) tras pasar a VENCIDO, el perfil DESAPARECE del listado del padre", async () => {

        // EXCEPCIÓN documentada: no existe endpoint público para forzar el
        // vencimiento manual (el flujo real es que `venceEn` en
        // `VerificacionProfesional` expira). Mutamos el estado por Prisma
        // solo aquí — es la única forma sin esperar 4 meses en CI.
        await prisma.perfilProfesional.update({
            where: { id: perfilProfesionalId },
            data: { estado: "VENCIDO" },
        });

        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(
                `/api/padre/profesionales?seed=${encodeURIComponent(semillaDirectorio)}`,
            );
            expect(
                res.status(),
                `listado directorio body=${await res.text().catch(() => "")}`,
            ).toBe(200);
            const body = await res.json();
            const items: Array<{ id: string }> = body?.items ?? [];
            expect(
                items.every((it) => it.id !== perfilProfesionalId),
                `un perfil VENCIDO NUNCA debe aparecer en el listado público. ids=${items.map((i) => i.id).join(",")}`,
            ).toBe(true);
        } finally {
            await request.dispose();
        }
    });

    test("(B) la ficha individual de un VENCIDO responde 404 (o al menos no expone contacto H-2)", async () => {

        // El estado ya está mutado a VENCIDO por el candado (A) (describe.serial).
        // La forma óptima es 404: el perfil VENCIDO no existe públicamente.
        // Si un cambio futuro devolviera 200, el body NO puede contener
        // ningún campo de contacto profesional — es la reserva legal H-2
        // (Ley 2375/2024 · brief §1).
        const request = await ctx();
        try {
            await login(request, EMAIL_PADRE);
            const res = await request.get(`/api/padre/profesionales/${perfilProfesionalId}`);

            if (res.status() === 404) {
                // Camino preferido: el perfil VENCIDO no existe públicamente.
                expect(res.status()).toBe(404);
                return;
            }

            expect(
                res.status(),
                `ficha VENCIDO status inesperado body=${(await res.text().catch(() => "")).slice(0, 220)}`,
            ).toBe(200);
            const body = await res.json();
            const serializado = JSON.stringify(body);
            for (const campo of CAMPOS_CONTACTO_PROHIBIDOS) {
                expect(
                    serializado.includes(`"${campo}"`),
                    `H-2 (Ley 2375/2024): la ficha de un VENCIDO no puede contener el campo "${campo}". body=${serializado.slice(0, 220)}`,
                ).toBe(false);
            }
        } finally {
            await request.dispose();
        }
    });
});
