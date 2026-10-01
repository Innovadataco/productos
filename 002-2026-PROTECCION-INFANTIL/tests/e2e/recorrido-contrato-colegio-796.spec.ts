/**
 * SPEC-796 (recorrido de cobertura, Calidad) · El contrato firmado del colegio — adjuntar / ver /
 * aislamiento.
 *
 * EL HUECO de la auditoría. Nuestro ADMIN adjunta el contrato (PDF) de un colegio
 * (`POST api/admin/pagos/cliente/[suscripcionId]/contrato` → `adjuntarContratoColegio`): valida PDF,
 * lo cifra y guarda opaco, y registra un HECHO append-only con el SNAPSHOT durable de quién lo adjuntó
 * y cuándo. Después el COLEGIO DUEÑO ve/descarga EL SUYO por `GET api/colegio/contrato/pdf`
 * (`leerContratoColegioVigente`), resuelto desde la SESIÓN (`user.colegioId`), nunca por un id en la URL.
 * Es un documento legal entre la empresa y el colegio y NINGÚN e2e lo camina.
 *
 * QUÉ AFIRMA (camino REAL — se adjunta por el endpoint admin, se lee por el endpoint colegio; nada por
 * atajo al storage):
 *   (1) ADJUNTAR Y REGISTRAR: el admin adjunta un PDF para el colegio A → 201, y el registro durable
 *       guarda QUIÉN (snapshot con el usuarioId del admin) + CUÁNDO (`adjuntadoEn`) + la identidad del
 *       colegio (snapshot id · nombre · NIT), que sobrevive al borrado operativo.
 *   (2) EL COLEGIO VE EL SUYO: el colegio A descarga por su endpoint → 200 `application/pdf` con el PDF
 *       EXACTO que se adjuntó (round-trip real por cifrado/descifrado, byte a byte).
 *   (3) 🔒 AISLAMIENTO: el colegio B pide su contrato → 404 (no tiene; y jamás el de A). La guardia resuelve
 *       el colegio de la SESIÓN, no de la URL: un colegio no puede ni nombrar el de otro.
 *   (4) VALIDACIÓN DEL ARCHIVO: un adjunto que no es PDF (magia de bytes) → 400 con su motivo, y NO se
 *       guarda (el registro de A sigue en uno).
 *
 * Se LEE, no se toca, el service ni el storage de contratos: el recorrido los ejerce por los endpoints.
 *
 * ROLES TITULARES por el camino real: el ADMIN (upsert efímero + módulo `pagos_admin`, clave throwaway de
 * la corrida — nunca un secreto real) y los COLEGIOS A/B (fixture `crearColegioOnboarded`, camino real).
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-796-`. Limpieza FK-safe en afterAll (los registros
 * de contrato se borran por `colegioId` ANTES de borrar el colegio: su FK es SetNull y sobreviviría).
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { crearColegioOnboarded, limpiarColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";

const CORRIDA = `e2e-796-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Contrato796!Secure";
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const COLEGIO_A_EMAIL = `${CORRIDA}-rectorA@proteccion.local`;
const COLEGIO_B_EMAIL = `${CORRIDA}-rectorB@proteccion.local`;
const CORRIDA_A = `${CORRIDA}A`;
const CORRIDA_B = `${CORRIDA}B`;

// PDF válido: al validador solo le importa la magia de bytes `%PDF-`; el contenido viaja íntegro.
const PDF_VALIDO = Buffer.from(`%PDF-1.4\n% contrato firmado e2e 796 ${CORRIDA}\n1 0 obj<<>>endobj\n%%EOF\n`, "utf8");
// No-PDF: texto plano. Dispara el rechazo de validación (no empieza con %PDF-).
const NO_PDF = Buffer.from(`esto no es un pdf, es texto plano de la corrida ${CORRIDA}`, "utf8");

let adminUsuarioId = "";
let colegioA: ColegioOnboarded | undefined;
let colegioB: ColegioOnboarded | undefined;
let suscripcionIdA = "";
const contratoIds: string[] = [];

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

/** Admin efímero por upsert (rol ADMIN → módulo `pagos_admin` por el grant general del seed). */
async function asegurarAdmin(): Promise<void> {
    const row = await prisma.usuario.upsert({
        where: { email: ADMIN_EMAIL },
        update: { rol: "ADMIN" as RolUsuario, estado: "activo" },
        create: { email: ADMIN_EMAIL, nombre: `Admin E2E ${CORRIDA}`, passwordHash: await hashPassword(PASSWORD), rol: "ADMIN" as RolUsuario, estado: "activo" },
    });
    adminUsuarioId = row.id;
}

/** Adjunta un archivo por el endpoint admin real (multipart). Devuelve status + cuerpo parseado. */
async function adjuntarComoAdmin(buffer: Buffer): Promise<{ status: number; body: Record<string, unknown> }> {
    const req = await ctx();
    try {
        await login(req, ADMIN_EMAIL, PASSWORD);
        const res = await req.post(`/api/admin/pagos/cliente/${suscripcionIdA}/contrato`, {
            multipart: { archivo: { name: "contrato.pdf", mimeType: "application/pdf", buffer } },
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return { status: res.status(), body };
    } finally {
        await req.dispose();
    }
}

/** Descarga el contrato del colegio dueño por su endpoint real (resuelto desde la sesión). */
async function descargarContratoColegio(email: string): Promise<{ status: number; contentType: string | null; body: Buffer }> {
    const req = await ctx();
    try {
        await login(req, email, PASSWORD);
        const res = await req.get("/api/colegio/contrato/pdf");
        const body = res.status() === 200 ? await res.body() : Buffer.alloc(0);
        return { status: res.status(), contentType: res.headers()["content-type"] ?? null, body };
    } finally {
        await req.dispose();
    }
}

async function contarContratosDe(colegioId: string): Promise<number> {
    return prisma.contratoColegio.count({ where: { colegioId } });
}

test.describe.serial("SPEC-796 · el contrato del colegio (adjuntar · ver · aislamiento)", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
        const reqAdmin = await ctx();
        try {
            await login(reqAdmin, ADMIN_EMAIL, PASSWORD);
            await aceptarConsentimiento(reqAdmin);
        } finally {
            await reqAdmin.dispose();
        }

        const reqA = await ctx();
        try {
            colegioA = await crearColegioOnboarded({ request: reqA, email: COLEGIO_A_EMAIL, password: PASSWORD, corrida: CORRIDA_A });
        } finally {
            await reqA.dispose();
        }
        const reqB = await ctx();
        try {
            colegioB = await crearColegioOnboarded({ request: reqB, email: COLEGIO_B_EMAIL, password: PASSWORD, corrida: CORRIDA_B });
        } finally {
            await reqB.dispose();
        }

        // La suscripción (freemium) del colegio A es la ficha cliente contra la que el admin adjunta.
        const susc = await prisma.suscripcion.findFirst({ where: { colegioId: colegioA.colegioId }, select: { id: true } });
        expect(susc, "el onboarding de A dejó una suscripción de colegio").not.toBeNull();
        suscripcionIdA = susc!.id;
    });

    test.afterAll(async () => {
        const colegioIds = [colegioA?.colegioId, colegioB?.colegioId].filter(Boolean) as string[];
        // Los registros de contrato se borran ANTES del colegio: su FK es SetNull y sobreviviría huérfano.
        if (contratoIds.length) await prisma.contratoColegio.deleteMany({ where: { id: { in: contratoIds } } }).catch(() => undefined);
        if (colegioIds.length) await prisma.contratoColegio.deleteMany({ where: { colegioId: { in: colegioIds } } }).catch(() => undefined);
        if (colegioA) await limpiarColegioOnboarded(colegioA).catch(() => undefined);
        if (colegioB) await limpiarColegioOnboarded(colegioB).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { email: ADMIN_EMAIL } }).catch(() => undefined);
    });

    test("(1) ADJUNTAR Y REGISTRAR · el admin adjunta el PDF de A; queda QUIÉN + CUÁNDO + identidad del colegio", async () => {
        expect(await contarContratosDe(colegioA!.colegioId), "antes de adjuntar, A no tiene contrato").toBe(0);

        const { status, body } = await adjuntarComoAdmin(PDF_VALIDO);
        expect(status, `adjuntar PDF válido → 201. body=${JSON.stringify(body).slice(0, 200)}`).toBe(201);
        const data = body.data as { contratoId?: string; adjuntadoEn?: string } | undefined;
        expect(data?.contratoId, "la respuesta trae el id del hecho").toBeTruthy();
        expect(data?.adjuntadoEn, "la respuesta trae cuándo se adjuntó").toBeTruthy();
        contratoIds.push(data!.contratoId!);

        // El registro durable: el snapshot de responsabilidad (NO FK) y la identidad del colegio.
        const fila = await prisma.contratoColegio.findUniqueOrThrow({
            where: { id: data!.contratoId! },
            select: { colegioId: true, adjuntadoEn: true, adjuntadoPorSnapshot: true, colegioSnapshot: true, archivoId: true, sha256: true },
        });
        expect(fila.colegioId, "el contrato es del colegio A").toBe(colegioA!.colegioId);
        expect(fila.adjuntadoPorSnapshot.includes(adminUsuarioId), "el snapshot durable guarda el usuarioId del admin que adjuntó").toBe(true);
        expect(fila.colegioSnapshot.includes(colegioA!.colegioId), "el snapshot del colegio congela su identidad (id)").toBe(true);
        expect(fila.colegioSnapshot.includes(`E2E-${CORRIDA_A}`), "el snapshot del colegio congela su NIT").toBe(true);
        expect(fila.adjuntadoEn, "quedó cuándo").toBeTruthy();
        // La respuesta del endpoint NO expone la ruta ni el archivoId (solo el hecho).
        expect(JSON.stringify(body).includes(fila.archivoId), "el archivoId opaco NO viaja en la respuesta").toBe(false);
    });

    test("(2) EL COLEGIO VE EL SUYO · A descarga el PDF EXACTO que se adjuntó", async () => {
        const res = await descargarContratoColegio(COLEGIO_A_EMAIL);
        expect(res.status, "A descarga su contrato").toBe(200);
        expect(res.contentType, "lo sirve como PDF").toContain("application/pdf");
        expect(res.body.equals(PDF_VALIDO), "el contenido es el MISMO PDF que el admin adjuntó (round-trip cifrado→descifrado)").toBe(true);
    });

    test("(3) 🔒 AISLAMIENTO · el colegio B pide su contrato y recibe 404 (jamás el de A)", async () => {
        const res = await descargarContratoColegio(COLEGIO_B_EMAIL);
        expect(res.status, "B no tiene contrato y la guardia resuelve por sesión → 404, nunca el de A").toBe(404);
        expect(await contarContratosDe(colegioB!.colegioId), "B sigue sin ningún contrato").toBe(0);
    });

    test("(4) VALIDACIÓN DEL ARCHIVO · un adjunto que no es PDF → 400 y NO se guarda", async () => {
        const antes = await contarContratosDe(colegioA!.colegioId);
        const { status, body } = await adjuntarComoAdmin(NO_PDF);
        expect(status, "un no-PDF se rechaza con 400").toBe(400);
        const err = body.error as { message?: string } | undefined;
        expect(err?.message, "el motivo nombra que no es un PDF").toContain("PDF");
        expect(await contarContratosDe(colegioA!.colegioId), "el rechazo NO agregó un registro (sigue el válido de (1))").toBe(antes);
    });
});
