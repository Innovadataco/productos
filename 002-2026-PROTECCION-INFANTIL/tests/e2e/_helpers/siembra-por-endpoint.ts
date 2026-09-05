/**
 * SPEC-459 (Calidad) · Arnés de SIEMBRA POR ENDPOINT — base reutilizable de los recorridos.
 *
 * POR QUÉ EXISTE. El arnés viejo (`.recorrido-psicologo.mjs` de SPEC-430)
 * sembraba Usuario / PerfilProfesional / FranjaDisponible / Suscripcion con
 * SQL crudo por ssh. Falló con 404 no por infraestructura sino por el propio
 * arnés: ids malformados y filas incoherentes que ningún `findUnique` del
 * dominio encontraba. La lección del CEO (04-09) es la misma de SPEC-448:
 *
 *   «Caminá la pantalla real, no siembres alrededor.»
 *
 * Este módulo reemplaza aquel arnés. Registra los tres actores que los
 * barridos necesitan — un PROFESIONAL en estado ACTIVO, un PADRE con el camino
 * completo (consentimiento + datos + hijo + suscripción activa) y un ADMIN
 * efímero — recorriendo los MISMOS endpoints que camina un humano. Cero SQL
 * crudo, cero `create` directo de entidades de dominio.
 *
 * ── EL CANDADO DEL PROPIO ARNÉS (encargo del CEO) ──────────────────────────
 * Todo el acceso a BD del arnés pasa por `prismaVigilado`, un Proxy que MUERE
 * si alguien reintroduce siembra cruda:
 *
 *   · `$executeRaw*` / `$queryRaw*`  → THROW siempre (eso es «SQL crudo»).
 *   · `.create` / `.createMany` / `.update` / `.upsert` sobre entidades de
 *     dominio (Usuario, PerfilProfesional, Suscripcion, Hijo, FranjaDisponible,
 *     Reporte, Documento/Verificación) → THROW: esas filas SOLO nacen por
 *     endpoint.
 *   · `auditConsentimiento.create` → THROW (nunca forjar consentimiento —
 *     memoria `calidad-audit-consentimientos-nunca-forjar`).
 *
 * Es un candado de CONDUCTA, no de palabras (memoria
 * `ceo-candado-vigila-conducta-no-palabras`): si un futuro editor cambia un
 * registrador por `prismaVigilado.usuario.create(...)`, el barrido que lo use
 * se pone ROJO en el acto. El candado se prueba MUTANDO en
 * `siembra-por-endpoint.spec.ts` (llamar la op prohibida debe lanzar).
 *
 * DOS EXCEPCIONES EXPRESAS, las mismas que ya viven en SPEC-435/437/448:
 *   1. `tokenRegistro.create` — fabricar el enlace de registro cuando Resend
 *      está caído (I-283/I-289). El correo es cortesía; el enlace se simula.
 *   2. `usuario.upsert` — el ADMIN efímero (no hay endpoint público que cree
 *      un admin; es el patrón «operadores/admin por Prisma» de SPEC-435).
 * La LECTURA y la LIMPIEZA (deleteMany) están siempre permitidas: limpiar no
 * es sembrar.
 *
 * AISLAMIENTO. Cada arnés nace con un `scope` efímero (`e2e-459-<uuid>`);
 * todo email lleva ese prefijo y `limpiarTodo()` borra FK-safe SOLO lo suyo.
 */
import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma as prismaReal } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// EL CANDADO · prismaVigilado
// ────────────────────────────────────────────────────────────────────────────

/** Mensaje único del candado — los barridos y el spec lo buscan por prefijo. */
export const CANDADO_SIEMBRA_CRUDA =
    "SPEC-459 · siembra por endpoint: prohibido sembrar por SQL crudo / create directo. " +
    "Registrá el actor caminando su pantalla (registro → perfil → decisión), no insertando su fila.";

/** Métodos de sólo lectura — siempre permitidos. */
const LECTURA = new Set([
    "findFirst", "findUnique", "findUniqueOrThrow", "findFirstOrThrow",
    "findMany", "count", "aggregate", "groupBy",
]);

/** Métodos de limpieza — siempre permitidos (limpiar no es sembrar). */
const LIMPIEZA = new Set(["delete", "deleteMany"]);

/**
 * Excepciones expresas por modelo: las dos únicas escrituras directas que el
 * arnés tiene permitido, documentadas arriba. Cualquier otra escritura de
 * dominio muere.
 */
const EXCEPCIONES: Record<string, Set<string>> = {
    // Enlace fabricado con Resend caído (patrón SPEC-448 `fabricarEnlace`).
    tokenRegistro: new Set(["create"]),
    // ADMIN efímero — no hay endpoint público que cree un admin (SPEC-435).
    usuario: new Set(["upsert"]),
};

/** Métodos de escritura que, sin excepción expresa, disparan el candado. */
const ESCRITURA_PROHIBIDA = new Set([
    "create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert",
]);

/** Operaciones crudas de Prisma — «SQL crudo», prohibidas de raíz. */
const RAW_PROHIBIDO = new Set([
    "$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe",
]);

function proxyDelegado(modelo: string, delegado: Record<string, unknown>): Record<string, unknown> {
    return new Proxy(delegado, {
        get(target, prop: string) {
            const permitidoExtra = EXCEPCIONES[modelo]?.has(prop) ?? false;
            if (ESCRITURA_PROHIBIDA.has(prop) && !permitidoExtra) {
                return () => {
                    throw new Error(`${CANDADO_SIEMBRA_CRUDA} [${modelo}.${prop}]`);
                };
            }
            const valor = target[prop];
            return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(target) : valor;
        },
    });
}

/**
 * Cliente Prisma vigilado. El arnés lo usa para TODO su acceso a BD; los
 * registradores nunca tocan `prismaReal`. Exportado para que el spec del
 * candado pueda comprobar, mutando, que la barrera está cableada.
 */
export const prismaVigilado: typeof prismaReal = new Proxy(prismaReal, {
    get(target, prop: string) {
        if (RAW_PROHIBIDO.has(prop)) {
            return () => {
                throw new Error(`${CANDADO_SIEMBRA_CRUDA} [${prop}]`);
            };
        }
        const valor = (target as unknown as Record<string, unknown>)[prop];
        // Delegados de modelo: objetos con métodos de dominio → se vigilan.
        // Los ignoramos si son símbolos internos o funciones núcleo ($connect…).
        if (valor && typeof valor === "object" && typeof prop === "string" && !prop.startsWith("$") && !prop.startsWith("_")) {
            return proxyDelegado(prop, valor as Record<string, unknown>);
        }
        return typeof valor === "function"
            ? (valor as (...a: unknown[]) => unknown).bind(target)
            : valor;
    },
}) as typeof prismaReal;

// ────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────────

export interface HandleAdmin {
    email: string;
    password: string;
    usuarioId: string;
}

export interface HandleProfesional {
    email: string;
    password: string;
    usuarioId: string;
    perfilProfesionalId: string;
    /** Estado del perfil al terminar el registro — debe ser "ACTIVO". */
    estado: string;
    /** Ids de las franjas publicadas (si se pidió `franjas`). */
    franjaIds: string[];
}

export interface HandlePadre {
    email: string;
    password: string;
    usuarioId: string;
    hijoIds: string[];
    suscripcionId: string;
}

export interface OpcionesProfesional {
    /** Publica una franja VIRTUAL válida tras la aprobación. Default: false. */
    conFranja?: boolean;
    /** Etiqueta legible que se mete en el nombre visible. */
    etiqueta?: string;
}

export interface OpcionesPadre {
    /** Cuántos hijos cargar por el endpoint. Default: 1. */
    hijos?: number;
    /** Etiqueta legible para el nombre. */
    etiqueta?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Utilidades internas
// ────────────────────────────────────────────────────────────────────────────

/** PDF mínimo válido — pasa el número mágico `%PDF-` del validador. */
function pdfMinimo(etiqueta: string): Buffer {
    return Buffer.from(`%PDF-1.4\n% E2E ${etiqueta}\n%%EOF\n`, "utf8");
}

async function nuevoContexto(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

function afirmar(condicion: boolean, mensaje: string): asserts condicion {
    if (!condicion) throw new Error(`[arnés SPEC-459] ${mensaje}`);
}

// ────────────────────────────────────────────────────────────────────────────
// El arnés
// ────────────────────────────────────────────────────────────────────────────

export interface Arnes {
    readonly scope: string;
    /** Registra (o reutiliza) el ADMIN efímero del arnés. */
    asegurarAdmin(): Promise<HandleAdmin>;
    /** Registra un PROFESIONAL y lo deja en estado ACTIVO por decisión real. */
    registrarProfesionalActivo(opciones?: OpcionesProfesional): Promise<HandleProfesional>;
    /** Registra un PADRE con consentimiento + datos + hijo + suscripción activa. */
    registrarPadreCaminoCompleto(opciones?: OpcionesPadre): Promise<HandlePadre>;
    /** Borra FK-safe TODO lo sembrado por este arnés. Idempotente. */
    limpiarTodo(): Promise<void>;
}

export function crearArnes(): Arnes {
    const scope = `e2e-459-${randomUUID().slice(0, 8)}`;
    const PASSWORD = `Arnes459!${scope.slice(-4)}`;

    const emails = new Set<string>();
    const tokenIds = new Set<string>();
    let admin: HandleAdmin | null = null;

    function correo(sufijo: string): string {
        const email = `${scope}-${sufijo}@proteccion.local`;
        emails.add(email);
        return email;
    }

    /** Simula el enlace del correo (Resend caído) — excepción expresa del candado. */
    async function fabricarEnlace(email: string, rol: RolUsuario): Promise<string> {
        const token = randomBytes(24).toString("hex");
        const tokenHash = await bcrypt.hash(token, 12);
        const registro = await prismaVigilado.tokenRegistro.create({
            data: { email, tokenHash, rol, expiraEn: new Date(Date.now() + 3_600_000) },
        });
        tokenIds.add(registro.id);
        return token;
    }

    async function login(request: APIRequestContext, email: string, password = PASSWORD): Promise<void> {
        const res = await request.post("/api/auth/login", { data: { email, password } });
        afirmar(res.status() === 200, `login ${email} devolvió ${res.status()}`);
    }

    async function aceptarConsentimiento(request: APIRequestContext): Promise<void> {
        // Consentimiento por el flujo real — NUNCA por INSERT en audit_consentimientos.
        const res = await request.post("/api/consentimiento/aceptar", {
            data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
        });
        afirmar(res.status() < 300, `aceptar consentimiento devolvió ${res.status()}`);
    }

    async function asegurarAdmin(): Promise<HandleAdmin> {
        if (admin) return admin;
        const email = correo("admin");
        // Excepción expresa: el admin efímero se siembra por upsert (patrón SPEC-435).
        const u = await prismaVigilado.usuario.upsert({
            where: { email },
            update: { rol: "ADMIN" as RolUsuario, estado: "activo", debeCambiarPassword: false },
            create: {
                email,
                nombre: `Admin arnés ${scope}`,
                passwordHash: await hashPassword(PASSWORD),
                rol: "ADMIN" as RolUsuario,
                estado: "activo",
            },
        });
        admin = { email, password: PASSWORD, usuarioId: u.id };
        return admin;
    }

    async function registrarProfesionalActivo(opciones: OpcionesProfesional = {}): Promise<HandleProfesional> {
        const email = correo("prof");
        const etiqueta = opciones.etiqueta ?? scope;
        const request = await nuevoContexto();
        try {
            // (1) Registro por la pantalla del profesional.
            const solicitar = await request.post("/api/auth/registro-profesional/solicitar", { data: { email } });
            afirmar(solicitar.status() === 202, `solicitar profesional devolvió ${solicitar.status()}`);
            const token = await fabricarEnlace(email, "PROFESIONAL" as RolUsuario);
            const completar = await request.post("/api/auth/registro-profesional/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            afirmar(completar.status() === 200, `completar profesional devolvió ${completar.status()}: ${await completar.text().catch(() => "")}`);
            await aceptarConsentimiento(request);
            await login(request, email);

            // (2) Ficha por el PUT que dispara la pantalla (crea BORRADOR).
            const ciudad = await prismaVigilado.ciudad.findFirst({ select: { id: true } });
            afirmar(ciudad !== null, "prod debe tener al menos una Ciudad sembrada");
            const putPerfil = await request.put("/api/profesional/perfil", {
                data: {
                    nombreVisible: `Psi ${etiqueta}`,
                    tituloProfesional: "Psicóloga clínica",
                    especialidades: ["Familia"],
                    ciudadId: ciudad!.id,
                    atiendeVirtual: true,
                    atiendePresencial: false,
                    aniosExperiencia: 5,
                    presentacion: `Presentación efímera del arnés ${scope}.`,
                    tarifaConsultaCOP: 120_000,
                    duracionMinutos: 60,
                    emiteFactura: false,
                },
            });
            afirmar(putPerfil.status() < 300, `PUT perfil devolvió ${putPerfil.status()}: ${await putPerfil.text().catch(() => "")}`);

            const perfil = await prismaVigilado.perfilProfesional.findFirst({
                where: { usuario: { email } },
                select: { id: true },
            });
            afirmar(perfil !== null, "el PUT perfil debe haber creado el PerfilProfesional");
            const perfilProfesionalId = perfil!.id;

            // (3) Documentos: uno por cada requisito parametrizable (SPEC-436 los
            //     exige para poder marcar CUMPLE).
            const estadoDocs = await request.get("/api/profesional/documentos");
            afirmar(estadoDocs.status() === 200, `GET documentos devolvió ${estadoDocs.status()}`);
            const requisitos: Array<{ clave: string }> = (await estadoDocs.json())?.data ?? [];
            afirmar(requisitos.length >= 1, "el parámetro `verificacion.requisitos` debe traer al menos 1 requisito");
            for (const { clave } of requisitos) {
                const subir = await request.post("/api/profesional/documentos", {
                    multipart: {
                        requisito: clave,
                        archivo: { name: `${clave}.pdf`, mimeType: "application/pdf", buffer: pdfMinimo(`${etiqueta}-${clave}`) },
                    },
                });
                afirmar(subir.status() < 300, `subir documento ${clave} devolvió ${subir.status()}: ${await subir.text().catch(() => "")}`);
            }

            // (4) Autorización firmada — la subida que empuja BORRADOR → EN_REVISION.
            const autorizacion = await request.post("/api/profesional/autorizacion", {
                multipart: {
                    archivo: { name: "autorizacion.pdf", mimeType: "application/pdf", buffer: pdfMinimo(`${etiqueta}-autorizacion`) },
                },
            });
            afirmar(autorizacion.status() < 300, `POST autorización devolvió ${autorizacion.status()}: ${await autorizacion.text().catch(() => "")}`);

            // (5) El ADMIN decide con TODOS los requisitos en CUMPLE → APROBADO → ACTIVO.
            const adminHandle = await asegurarAdmin();
            const reqAdmin = await nuevoContexto();
            let estadoFinal = "";
            try {
                await login(reqAdmin, adminHandle.email, adminHandle.password);
                await aceptarConsentimiento(reqAdmin);
                await login(reqAdmin, adminHandle.email, adminHandle.password);

                const checklist: Record<string, { estado: "CUMPLE" }> = {};
                for (const { clave } of requisitos) checklist[clave] = { estado: "CUMPLE" };
                const decidir = await reqAdmin.post(
                    `/api/admin/verificacion-profesionales/${perfilProfesionalId}/decidir`,
                    { data: { checklist } },
                );
                afirmar(decidir.status() === 200, `decidir devolvió ${decidir.status()}: ${await decidir.text().catch(() => "")}`);
                estadoFinal = (await decidir.json())?.data?.estadoPerfil ?? "";
                afirmar(estadoFinal === "ACTIVO", `tras aprobar, el perfil debe quedar ACTIVO; quedó '${estadoFinal}'`);
            } finally {
                await reqAdmin.dispose();
            }

            // (6) Franja opcional — publicar disponibilidad (ya hay verificación vigente).
            const franjaIds: string[] = [];
            if (opciones.conFranja) {
                const inicio = new Date(Date.now() + 3 * 24 * 3_600_000);
                const fin = new Date(inicio.getTime() + 60 * 60_000);
                const franja = await request.post("/api/profesional/franjas", {
                    data: { inicio: inicio.toISOString(), fin: fin.toISOString(), modalidad: "VIRTUAL" },
                });
                afirmar(franja.status() < 300, `POST franja devolvió ${franja.status()}: ${await franja.text().catch(() => "")}`);
                const creada = (await franja.json());
                const id = creada?.franja?.id ?? creada?.data?.id ?? creada?.id;
                if (typeof id === "string") franjaIds.push(id);
            }

            const usuario = await prismaVigilado.usuario.findUniqueOrThrow({ where: { email }, select: { id: true } });
            return { email, password: PASSWORD, usuarioId: usuario.id, perfilProfesionalId, estado: estadoFinal, franjaIds };
        } finally {
            await request.dispose();
        }
    }

    async function registrarPadreCaminoCompleto(opciones: OpcionesPadre = {}): Promise<HandlePadre> {
        const email = correo("padre");
        const cuantosHijos = Math.max(1, opciones.hijos ?? 1);
        const request = await nuevoContexto();
        try {
            // (1) Registro por enlace del padre (SPEC-339).
            const solicitar = await request.post("/api/auth/registro/solicitar", { data: { email } });
            afirmar(solicitar.status() < 500, `solicitar padre devolvió ${solicitar.status()}`);
            const token = await fabricarEnlace(email, "PARENT" as RolUsuario);
            const completar = await request.post("/api/auth/registro/completar", {
                data: { token, password: PASSWORD, passwordConfirmacion: PASSWORD },
            });
            afirmar(completar.status() === 201, `completar padre devolvió ${completar.status()}: ${await completar.text().catch(() => "")}`);
            await login(request, email);

            // (2) Paso 1 — consentimiento por el flujo real.
            await aceptarConsentimiento(request);

            // (3) Paso 2 — datos del padre (PATCH que dispara el camino).
            const pais = await prismaVigilado.pais.findFirst({ select: { id: true } });
            const ciudad = await prismaVigilado.ciudad.findFirst({ select: { id: true } });
            afirmar(pais !== null && ciudad !== null, "prod debe tener País y Ciudad sembrados");
            const datos = await request.patch("/api/padre/perfil", {
                data: {
                    nombre: "Padre",
                    apellidos: `Arnés ${opciones.etiqueta ?? scope}`,
                    documentoTipo: "CC",
                    documentoNumero: `79${(Date.now() % 100000000).toString().padStart(8, "0")}`,
                    telefono: "+57 300 111 2233",
                    paisId: pais!.id,
                    ciudadId: ciudad!.id,
                },
            });
            afirmar(datos.status() === 200, `PATCH datos padre devolvió ${datos.status()}: ${await datos.text().catch(() => "")}`);

            // (4) Paso 3 — cargar hijo(s) por el endpoint.
            const hijoIds: string[] = [];
            for (let n = 1; n <= cuantosHijos; n++) {
                const hijo = await request.post("/api/padre/hijos", {
                    data: {
                        nombre: `Menor ${n}`,
                        apellidos: `Arnés ${scope}`,
                        documentoTipo: "TI",
                        documentoNumero: `10${(Date.now() % 10000000).toString().padStart(7, "0")}${n}`,
                    },
                });
                afirmar(hijo.status() === 201, `POST hijo ${n} devolvió ${hijo.status()}: ${await hijo.text().catch(() => "")}`);
                const hijoId = (await hijo.json())?.hijoId;
                if (typeof hijoId === "string") hijoIds.push(hijoId);
            }

            // (5) Paso 4 — suscripción ACTIVA por el endpoint de prueba gratis.
            const freemium = await request.post("/api/padre/suscripcion/activar-freemium", {
                data: { aceptaTerminos: true },
            });
            afirmar(freemium.status() === 201, `activar-freemium devolvió ${freemium.status()}: ${await freemium.text().catch(() => "")}`);
            const cuerpoFreemium = await freemium.json();
            const suscripcionId: string = cuerpoFreemium?.suscripcionId ?? "";
            afirmar(
                cuerpoFreemium?.estado === "ACTIVA" || cuerpoFreemium?.estado === "activa",
                `la suscripción debe quedar ACTIVA; quedó '${cuerpoFreemium?.estado}'`,
            );

            const usuario = await prismaVigilado.usuario.findUniqueOrThrow({ where: { email }, select: { id: true } });
            return { email, password: PASSWORD, usuarioId: usuario.id, hijoIds, suscripcionId };
        } finally {
            await request.dispose();
        }
    }

    async function limpiarTodo(): Promise<void> {
        const listaEmails = [...emails];
        if (listaEmails.length === 0 && tokenIds.size === 0) return;

        const usuarios = await prismaVigilado.usuario.findMany({
            where: { email: { in: listaEmails } },
            select: { id: true },
        });
        const ids = usuarios.map((u) => u.id);

        if (ids.length > 0) {
            const perfiles = await prismaVigilado.perfilProfesional.findMany({
                where: { usuarioId: { in: ids } },
                select: { id: true },
            });
            const perfilIds = perfiles.map((p) => p.id);
            if (perfilIds.length > 0) {
                await prismaVigilado.franjaDisponible.deleteMany({ where: { profesionalId: { in: perfilIds } } });
                await prismaVigilado.documentoProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
                await prismaVigilado.verificacionProfesional.deleteMany({ where: { perfilProfesionalId: { in: perfilIds } } });
                await prismaVigilado.perfilProfesional.deleteMany({ where: { id: { in: perfilIds } } });
            }
            await prismaVigilado.suscripcion.deleteMany({ where: { usuarioId: { in: ids } } });
            await prismaVigilado.hijo.deleteMany({ where: { usuarioId: { in: ids } } });
        }

        await prismaVigilado.notificacion.deleteMany({
            where: {
                OR: [
                    ...(ids.length > 0 ? [{ destinatarioUsuarioId: { in: ids } }] : []),
                    { destinatarioEmail: { in: listaEmails } },
                ],
            },
        });

        if (tokenIds.size > 0) {
            await prismaVigilado.tokenRegistro.deleteMany({ where: { id: { in: [...tokenIds] } } });
        }
        await prismaVigilado.tokenRegistro.deleteMany({ where: { email: { in: listaEmails } } });

        if (ids.length > 0) {
            await prismaVigilado.auditConsentimiento.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
            await prismaVigilado.auditLog.deleteMany({ where: { usuarioId: { in: ids } } });
            await prismaVigilado.usuario.deleteMany({ where: { id: { in: ids } } });
        }

        emails.clear();
        tokenIds.clear();
        admin = null;
    }

    return {
        scope,
        asegurarAdmin,
        registrarProfesionalActivo,
        registrarPadreCaminoCompleto,
        limpiarTodo,
    };
}
