/**
 * SPEC-775 · Fixture de PROFESIONAL VISIBLE para e2e (Calidad).
 *
 * POR QUÉ POR EL FLUJO REAL (no por Prisma directo): la ficha pública del padre
 * (`obtenerPublicoPorId`) y el directorio filtran por DOS gates autoritativos:
 *   1. `PerfilProfesional.estado = ACTIVO`, y
 *   2. una VERIFICACIÓN vigente (SPEC-690-B `idsConVigenciaAutoritativa`): la
 *      última verificación aprobada del profesional no puede estar vencida.
 * Un `estado = ACTIVO` puesto a mano por Prisma NO produce el (2): el profesional
 * queda invisible (ficha 404, sin poder crear cita contra él). Este builder lleva
 * al profesional por su camino real —registro → perfil → documentos → autorización
 * (aceptar + firmar) → EN_REVISION → un ADMIN efímero aprueba con checklist TODO
 * CUMPLE— así la verificación queda vigente como en producción, y opcionalmente
 * publica una franja +7 días (la ruta de franjas exige verificación vigente).
 *
 * ANDAMIAJE (actores de apoyo): el ADMIN que aprueba es efímero y se crea por
 * Prisma upsert (patrón `asegurarAdmin` de `recorrido-ciclo-cita-padre.spec.ts`);
 * el `telefono` del profesional (lo que el candado H-2 protege) es un campo del
 * usuario efímero, no una mutación de rol/parámetro global. El SUJETO bajo prueba
 * (el padre y su recorrido) nunca se arma a mano — ese usa `padre-onboarded.ts`.
 *
 * Solo para `tests/e2e/**`. La guardia SPEC-770 del globalSetup garantiza BD `*_test`.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, type APIRequestContext, request as playwrightRequest } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

export interface OpcionesProfesionalVisible {
    /** Contexto FRESCO del profesional — su sesión se establece y usa acá. */
    request: APIRequestContext;
    email: string;
    password: string;
    /** Prefijo único de la corrida (para etiquetas y el email del admin efímero). */
    corrida: string;
    /** Contacto del profesional (lo que el candado H-2 oculta/expone). Opcional. */
    telefono?: string;
    /** Tarifa propia a fijar POST-habilitación (un no-habilitado no puede, SPEC-685
     *  PR3). Opcional; sirve de control positivo (el monto de la 1ª cita debe salir
     *  del parámetro del admin, NO de esta tarifa). */
    tarifaConsultaCOP?: number;
    /** Publicar una franja +7 días VIRTUAL (para poder agendar). Por defecto true. */
    conFranja?: boolean;
}

export interface ProfesionalVisible {
    perfilId: string;
    usuarioId: string;
    franjaId: string | null;
    readonly _limpieza: { usuarios: string[]; perfiles: string[]; tokens: string[] };
}

/** PDF mínimo válido — pasa el número mágico `%PDF-` del validador. */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

/**
 * Registra + habilita un PROFESIONAL por su camino real y lo deja VISIBLE al padre
 * (estado ACTIVO + verificación vigente). Devuelve su perfil, usuario y (si aplica)
 * franja publicada, más el rastro para la limpieza FK-safe.
 */
export async function crearProfesionalVisible(opts: OpcionesProfesionalVisible): Promise<ProfesionalVisible> {
    const { request, email, password, corrida, telefono, tarifaConsultaCOP, conFranja = true } = opts;
    const limpieza = { usuarios: [] as string[], perfiles: [] as string[], tokens: [] as string[] };

    // (0) Registro por el endpoint real. El TOKEN simula «llegó el correo» (Resend
    // no corre en test); se crea por Prisma, igual que el resto de fixtures.
    const solicitar = await request.post("/api/auth/registro-profesional/solicitar", { data: { email } });
    expect(solicitar.status(), `solicitar profesional body=${await solicitar.text().catch(() => "")}`).toBe(202);

    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol: "PROFESIONAL" as RolUsuario, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    limpieza.tokens.push(registro.id);

    const completar = await request.post("/api/auth/registro-profesional/completar", {
        data: { token, password, passwordConfirmacion: password },
    });
    expect(completar.status(), `completar profesional body=${await completar.text().catch(() => "")}`).toBe(201);
    // SPEC-756: el profesional NO firma el consentimiento del titular (endpoint
    // titular-only → 403 para un rol prestador). Su onboarding no lo requiere.
    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.status(), `login profesional body=${await login.text().catch(() => "")}`).toBe(200);

    // (1) Perfil por el formulario real (claves NUEVAS del catálogo cerrado SPEC-685;
    // SIN tarifa: un no-habilitado no puede fijarla, route.ts:166).
    const ciudad = await prisma.ciudad.findFirst({ select: { id: true } });
    if (!ciudad) throw new Error("[fixture] la BD de prueba no tiene ninguna Ciudad sembrada");
    const putPerfil = await request.put("/api/profesional/perfil", {
        data: {
            nombreVisible: `Psi E2E ${corrida}`,
            profesion: "psicologo",
            areasAtencion: ["ansiedad"],
            rangoEtario: ["12-17"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 5,
            presentacion: `Presentación pública del profesional (${corrida}).`,
            duracionMinutos: 60,
            emiteFactura: false,
        },
    });
    expect(putPerfil.status(), `PUT perfil body=${await putPerfil.text().catch(() => "")}`).toBeLessThan(300);

    const perfil = await prisma.perfilProfesional.findFirst({
        where: { usuario: { email } },
        select: { id: true, usuarioId: true },
    });
    if (!perfil) throw new Error("[fixture] el PUT perfil no creó el PerfilProfesional");
    limpieza.usuarios.push(perfil.usuarioId);
    limpieza.perfiles.push(perfil.id);

    if (telefono !== undefined) {
        await prisma.usuario.update({ where: { id: perfil.usuarioId }, data: { telefono } });
    }

    // (2) Un documento por cada requisito configurado (sin ellos el admin no puede
    // marcar CUMPLE — candado servidor SPEC-436).
    const estadoDocs = await request.get("/api/profesional/documentos");
    expect(estadoDocs.status(), "GET estado documentos").toBe(200);
    const requisitos: Array<{ clave: string }> = (await estadoDocs.json())?.data ?? [];
    expect(requisitos.length, "el parámetro `verificacion.requisitos` debe traer al menos 1 requisito").toBeGreaterThan(0);
    const clavesRequisitos = requisitos.map((r) => r.clave);
    for (const clave of clavesRequisitos) {
        const subir = await request.post("/api/profesional/documentos", {
            multipart: { requisito: clave, archivo: { name: `${clave}.pdf`, mimeType: "application/pdf", buffer: pdfMinimo(`${corrida} ${clave}`) } },
        });
        expect(subir.status(), `subir documento ${clave} body=${await subir.text().catch(() => "")}`).toBeLessThan(300);
    }

    // (3) Autorización: aceptar en pantalla (SPEC-686/706 `yaAceptoVersionVigente`)
    // y firmar el archivo → con el perfil completo transiciona BORRADOR → EN_REVISION.
    const aceptarAutoriz = await request.post("/api/profesional/autorizacion/aceptar", {});
    expect(aceptarAutoriz.status(), `aceptar autorización body=${await aceptarAutoriz.text().catch(() => "")}`).toBeLessThan(300);
    const autoriz = await request.post("/api/profesional/autorizacion", {
        multipart: { archivo: { name: "autorizacion.pdf", mimeType: "application/pdf", buffer: pdfMinimo(`${corrida} autorizacion`) } },
    });
    expect(autoriz.status(), `subir autorización body=${await autoriz.text().catch(() => "")}`).toBeLessThan(300);

    const enRevision = await prisma.perfilProfesional.findUnique({ where: { id: perfil.id }, select: { estado: true } });
    expect(enRevision?.estado, "el perfil debe quedar EN_REVISION antes de decidir").toBe("EN_REVISION");

    // (4) Un ADMIN efímero (andamiaje) aprueba con checklist TODO CUMPLE → ACTIVO + vigencia.
    const adminEmail = `${corrida}-verificador@proteccion.local`;
    const admin = await prisma.usuario.upsert({
        where: { email: adminEmail },
        update: { rol: "ADMIN" as RolUsuario, estado: "activo" },
        create: { email: adminEmail, nombre: `Admin E2E ${corrida}`, passwordHash: await hashPassword(password), rol: "ADMIN" as RolUsuario, estado: "activo" },
        select: { id: true },
    });
    limpieza.usuarios.push(admin.id);

    const adminCtx = await playwrightRequest.newContext();
    try {
        const loginAdmin = await adminCtx.post("/api/auth/login", { data: { email: adminEmail, password } });
        expect(loginAdmin.status(), `login admin body=${await loginAdmin.text().catch(() => "")}`).toBe(200);
        const checklist: Record<string, { estado: "CUMPLE" }> = {};
        for (const clave of clavesRequisitos) checklist[clave] = { estado: "CUMPLE" };
        const decidir = await adminCtx.post(`/api/admin/verificacion-profesionales/${perfil.id}/decidir`, { data: { checklist } });
        expect(decidir.status(), `admin aprueba body=${await decidir.text().catch(() => "")}`).toBe(200);
    } finally {
        await adminCtx.dispose();
    }

    const activo = await prisma.perfilProfesional.findUnique({ where: { id: perfil.id }, select: { estado: true } });
    expect(activo?.estado, "tras aprobar, el perfil debe quedar ACTIVO").toBe("ACTIVO");

    // (4b) Tarifa POST-habilitación (opcional): ahora que el perfil está habilitado,
    // el propio profesional SÍ puede fijarla por su formulario real (route.ts:166).
    if (tarifaConsultaCOP !== undefined) {
        const putTarifa = await request.put("/api/profesional/perfil", { data: { tarifaConsultaCOP } });
        expect(putTarifa.status(), `PUT tarifa post-hab body=${await putTarifa.text().catch(() => "")}`).toBeLessThan(300);
    }

    // (5) Franja +7 días VIRTUAL (la ruta exige verificación vigente — ya aprobada).
    let franjaId: string | null = null;
    if (conFranja) {
        const inicio = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        const fin = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
        const crearFranja = await request.post("/api/profesional/franjas", { data: { inicio, fin, modalidad: "VIRTUAL" } });
        expect(crearFranja.status(), `POST franja body=${await crearFranja.text().catch(() => "")}`).toBeLessThan(300);
        franjaId = (await crearFranja.json())?.data?.id ?? null;
        expect(franjaId, "la franja creada debe traer id (cuid)").toBeTruthy();
    }

    return { perfilId: perfil.id, usuarioId: perfil.usuarioId, franjaId, _limpieza: limpieza };
}

/** Limpieza FK-safe: solicitudes → franjas → documentos/verificaciones → perfil → usuarios → tokens. */
export async function limpiarProfesionalVisible(prof: ProfesionalVisible): Promise<void> {
    const { usuarios, perfiles, tokens } = prof._limpieza;
    if (perfiles.length > 0) {
        await prisma.solicitudCita.deleteMany({ where: { profesionalId: { in: perfiles } } }).catch(() => undefined);
        await prisma.franjaDisponible.deleteMany({ where: { profesionalId: { in: perfiles } } }).catch(() => undefined);
        await prisma.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfiles } } }).catch(() => undefined);
        await prisma.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfiles } } }).catch(() => undefined);
        await prisma.perfilProfesional.deleteMany({ where: { id: { in: perfiles } } }).catch(() => undefined);
    }
    if (usuarios.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarios } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } }).catch(() => undefined);
    }
    if (tokens.length > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: tokens } } }).catch(() => undefined);
    }
}
