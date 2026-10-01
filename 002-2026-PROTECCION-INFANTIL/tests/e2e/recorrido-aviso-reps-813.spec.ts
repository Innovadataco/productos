/**
 * SPEC-813 (Calidad) · Recorrido del AVISO de habilitación REPS — las DOS caras, con sus roles.
 *
 * ORIGEN. #806 construyó el aviso de REPS caducado al profesional + la alarma de admin para los estados
 * que NO son suyos, y nadie lo caminó end-to-end. Los candados de #806 son unitarios/render
 * (`aviso-estado-reps.candado.test.ts`, `aviso-reps-caducado.candado.test.tsx`,
 * `alarma-admin-reps.candado.test.tsx`): prueban la CLASIFICACIÓN y la FORMA, no que el dato llegue por
 * las superficies REALES con el rol TITULAR. Este recorrido camina eso.
 *
 * PESO EXTRA (CEO 01-10). El aviso es el PRIMER eslabón de una cadena de cuatro construida encima del
 * REPS: SPEC-825 oculta del padre las franjas sin cobertura, SPEC-834 rechaza su publicación, SPEC-814
 * reubica las citas del no-vigente. Si este aviso no llega o no se entiende, las otras tres tratan al
 * profesional como si ya lo supiera. Por eso se afirma que el profesional RECIBE el aviso y que el admin
 * VE la alarma — y si en algún estado el aviso no llega a donde debe, es hallazgo de PRODUCTO.
 *
 * EL MODELO (medido en `aviso-estado-reps.ts`, decisión del CEO en el radicado SPEC-813). `clasificarAvisoReps`
 * mapea los 8 estados a 4 clasificaciones:
 *   · CADUCADO      (4 VENCIDA · 6 VIGENTE con vigencia pasada)  → AVISO AL PROFESIONAL (caducó de verdad).
 *   · REVISION_ADMIN(5 NO_ENCONTRADA · 7 nuestro re-chequeo > ventana · 8 sin fecha) → ALARMA DE ADMIN, NO
 *                   al profesional: decirle «renueve» cuando la autoridad lo da por vigente lo CULPA de
 *                   NUESTRA desactualización y es un callejón (la acción es del admin). `zonaAdmin` separa
 *                   el 5/8 graves (REVISAR) del 7 rutinario (RE_VERIFICAR) para que el goteo no sepulte al 5.
 *   · AL_DIA · SIN_VERIFICAR → sin aviso.
 *
 * SUPERFICIES REALES (medidas): el profesional lo lee en `GET /api/profesional/panel` (campo `avisoReps`
 * del DTO); el admin en `GET /api/admin/verificacion-profesionales/reps` (lista de carga REPS, con
 * `avisoReps` + `zonaAdmin` por profesional). REPS y «habilitado interno» son EJES SEPARADOS (SPEC-790 §7,
 * candado `habilitacion-reps-separado`): un profesional con REPS caducado SIGUE entrando a su panel —por
 * eso puede leer ahí el aviso que le explica por qué está fuera de la oferta—.
 *
 * ROLES TITULARES (criterio 822): el profesional lee su panel COMO profesional; el admin lee la alarma
 * COMO admin. El admin EFÍMERO solo aprovisiona (crear/aprobar es acción de admin) y lee su propia alarma.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-813-`. UN profesional ACTIVO; cada test RE-PLANTA
 * su estado REPS (borra + crea una fila) para dejar el estado inequívoco. Limpieza FK-safe en afterAll.
 * Cero mutación de rol real ni de parámetros globales. Cero estado compartido entre corridas.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario, EstadoReps, ModalidadReps } from "@prisma/client";

const CORRIDA = `e2e-813-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Aviso813!Secure";

const EMAIL_PROF = `${CORRIDA}-prof@proteccion.local`;
const EMAIL_ADMIN = `${CORRIDA}-admin@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
    tokens: new Set<string>(),
};

let perfilProfesionalId = "";

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

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

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
}

/** PDF mínimo válido — pasa el número mágico `%PDF-` del validador (`autorizacion-storage.ts`). */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

/**
 * Planta el estado REPS del profesional ACTIVO: BORRA las filas previas y crea UNA — así el estado que el
 * motor deriva (última fila por `verificadoEn`) es inequívoco en cada test. Excepción documentada (como el
 * VENCIDO del 449/828): no hay endpoint que registre una verificación caducada/no-encontrada —la carga
 * manual del admin registra una vigente—, así que se planta por Prisma. `VIGENTE` EXIGE `vigenteHasta`
 * (CHECK VALIDADO de #792); los demás resultados lo admiten nulo.
 */
async function plantarReps(datos: {
    resultado: EstadoReps;
    verificadoEn: Date;
    vigenteHasta: Date | null;
    modalidades?: ModalidadReps[];
}) {
    await prisma.verificacionReps.deleteMany({ where: { profesionalId: perfilProfesionalId } });
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilProfesionalId,
            verificadoEn: datos.verificadoEn,
            fuente: "MANUAL_ADMIN",
            resultado: datos.resultado,
            vigenteHasta: datos.vigenteHasta,
            modalidades: datos.modalidades ?? ["TELEMEDICINA"],
            modalidadesNoMapeadas: [],
            verificadoPorSnapshot: `e2e SPEC-813 (${CORRIDA})`,
        },
    });
}

/** La cara del PROFESIONAL: entra COMO profesional a su panel y devuelve la clasificación del aviso. */
async function avisoDelPanel(): Promise<string> {
    const req = await ctx();
    try {
        await login(req, EMAIL_PROF);
        const res = await req.get("/api/profesional/panel");
        expect(res.status(), `GET panel del profesional body=${(await res.text().catch(() => "")).slice(0, 220)}`).toBe(200);
        const data = (await res.json())?.data ?? {};
        return data.avisoReps ?? "";
    } finally {
        await req.dispose();
    }
}

/** La cara del ADMIN: entra COMO admin a la lista de carga REPS y devuelve el item de ESTE profesional. */
async function itemEnCargaReps(): Promise<{ avisoReps: string; zonaAdmin: string | null }> {
    const req = await ctx();
    try {
        await login(req, EMAIL_ADMIN);
        const res = await req.get("/api/admin/verificacion-profesionales/reps");
        expect(res.status(), `GET lista carga REPS (admin) body=${(await res.text().catch(() => "")).slice(0, 220)}`).toBe(200);
        const items: Array<{ id: string; avisoReps: string; zonaAdmin: string | null }> = (await res.json())?.data ?? [];
        const item = items.find((x) => x.id === perfilProfesionalId);
        expect(item, "el profesional ACTIVO debe aparecer en la lista de carga REPS del admin").toBeTruthy();
        return { avisoReps: item!.avisoReps, zonaAdmin: item!.zonaAdmin ?? null };
    } finally {
        await req.dispose();
    }
}

async function limpiarSembrados() {
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
            // Las VerificacionReps tienen FK Restrict al perfil → se borran ANTES del perfil.
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
        await prisma.auditConsentimiento.deleteMany({ where: { usuarioId: { in: usuarioIds } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    sembrados.usuarios.clear();
    sembrados.tokens.clear();
}

test.describe.serial("SPEC-813 · aviso REPS caducado (profesional) + alarma de admin (5/7/8)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();

        // El profesional llega a ACTIVO por el CAMINO REAL (registro → ficha → autorización →
        // documentos → aprobación del admin). REPS y «habilitado interno» son ejes separados: queda
        // habilitado (entra a su panel) y encima le plantamos el estado REPS de cada test.
        const request = await ctx();
        try {
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", { data: { email: EMAIL_PROF } });
            expect(solicitar.status(), "SPEC-391: solicitar profesional responde 202").toBe(202);
            const token = await fabricarEnlace(EMAIL_PROF, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(201);
            await aceptarConsentimiento(request);
            await login(request, EMAIL_PROF);

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
                    presentacion: "Presentación efímera SPEC-813.",
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
            perfilProfesionalId = perfil!.id;

            // Aceptar la autorización en pantalla ANTES de subir el archivo (SPEC-686/706).
            const aceptarAutor = await request.post("/api/profesional/autorizacion/aceptar", {});
            expect(aceptarAutor.status(), `aceptar autorización body=${await aceptarAutor.text().catch(() => "")}`).toBeLessThan(300);

            const subirAutorizacion = await request.post("/api/profesional/autorizacion", {
                multipart: { archivo: { name: "autorizacion.pdf", mimeType: "application/pdf", buffer: pdfMinimo(`${CORRIDA}-autorizacion`) } },
            });
            expect(subirAutorizacion.status(), `POST autorización body=${await subirAutorizacion.text().catch(() => "")}`).toBeLessThan(300);

            const estado = await request.get("/api/profesional/documentos");
            expect(estado.status(), "GET estado documentos").toBe(200);
            const items: Array<{ clave: string }> = (await estado.json())?.data ?? [];
            expect(items.length, "el parámetro `verificacion.requisitos` debe traer al menos 1 requisito").toBeGreaterThanOrEqual(1);
            for (const it of items) {
                const subir = await request.post("/api/profesional/documentos", {
                    multipart: { requisito: it.clave, archivo: { name: `${it.clave}.pdf`, mimeType: "application/pdf", buffer: pdfMinimo(`${CORRIDA}-${it.clave}`) } },
                });
                expect(subir.status(), `POST subir documento ${it.clave} body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
            }
        } finally {
            await request.dispose();
        }

        // El ADMIN aprueba la ficha por el endpoint real → ACTIVO (y deja su consentimiento aceptado,
        // que la cara de admin reusa en los tests).
        const admReq = await ctx();
        try {
            await login(admReq, EMAIL_ADMIN);
            await aceptarConsentimiento(admReq);
            await login(admReq, EMAIL_ADMIN);
            const ficha = await admReq.get(`/api/admin/verificacion-profesionales/${perfilProfesionalId}`);
            const claves: string[] = Object.keys(((await ficha.json())?.data?.checklist) ?? {});
            expect(claves.length, "checklist con al menos 1 requisito").toBeGreaterThanOrEqual(1);
            const checklist: Record<string, { estado: "CUMPLE" }> = {};
            for (const k of claves) checklist[k] = { estado: "CUMPLE" };
            const decidir = await admReq.post(`/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`, { data: { checklist } });
            expect(decidir.status(), `decidir APROBADO body=${await decidir.text().catch(() => "")}`).toBe(200);
        } finally {
            await admReq.dispose();
        }

        const estadoFinal = await prisma.perfilProfesional.findUnique({ where: { id: perfilProfesionalId }, select: { estado: true } });
        expect(estadoFinal?.estado, "el perfil debe quedar ACTIVO tras la aprobación").toBe("ACTIVO");
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) REPS CADUCADO (VENCIDA) → el profesional RECIBE el aviso en su panel", async () => {
        // Estado 4: la inscripción venció de verdad → el aviso SÍ es suyo.
        await plantarReps({ resultado: "VENCIDA", verificadoEn: hace(30), vigenteHasta: hace(5) });
        expect(await avisoDelPanel(), "el panel del profesional clasifica el aviso como CADUCADO").toBe("CADUCADO");
    });

    test("(B) control positivo · REPS al día → el aviso NO se dispara", async () => {
        // Estado 3: los dos relojes OK → al día. Sin esta mitad, (A) pasaría por vacío.
        await plantarReps({ resultado: "VIGENTE", verificadoEn: new Date(), vigenteHasta: enDias(120) });
        expect(await avisoDelPanel(), "con REPS al día el panel NO marca el aviso caducado").toBe("AL_DIA");
    });

    test("(C) estado 7 (nuestro re-chequeo venció) → NO culpa al profesional, pero el admin SÍ lo ve", async () => {
        // La autoridad SIGUE vigente (vigenteHasta futuro), pero NUESTRO re-chequeo pasó la ventana →
        // la acción es del admin (re-verificar), no del profesional. No se le dice «caducado».
        await plantarReps({ resultado: "VIGENTE", verificadoEn: hace(500), vigenteHasta: enDias(200) });
        expect(
            await avisoDelPanel(),
            "estado 7: al profesional NO se le dice «caducado» — la acción es nuestra (REVISION_ADMIN, no CADUCADO)",
        ).toBe("REVISION_ADMIN");
        const item = await itemEnCargaReps();
        expect(item.avisoReps, "estado 7: la alarma de admin lo recibe").toBe("REVISION_ADMIN");
        expect(item.zonaAdmin, "estado 7: cae en la zona RE_VERIFICAR (rutina nuestra)").toBe("RE_VERIFICAR");
    });

    test("(D) estado 5 (NO_ENCONTRADA) → el admin lo ve en la zona grave REVISAR; el profesional tampoco es culpado", async () => {
        // Lo buscamos y no está: no es un trámite vencido, es revisión NUESTRA. El 5 grave NO comparte
        // zona con el 7 rutinario, para que el goteo del 7 no lo sepulte.
        await plantarReps({ resultado: "NO_ENCONTRADA", verificadoEn: hace(10), vigenteHasta: null });
        const item = await itemEnCargaReps();
        expect(item.avisoReps, "estado 5: la alarma de admin lo recibe").toBe("REVISION_ADMIN");
        expect(item.zonaAdmin, "estado 5 (grave): cae en la zona REVISAR, no sepultado por la rutina").toBe("REVISAR");
        expect(
            await avisoDelPanel(),
            "estado 5: al profesional NO se le dice «caducado» (es revisión nuestra, no un trámite suyo)",
        ).toBe("REVISION_ADMIN");
    });
});
