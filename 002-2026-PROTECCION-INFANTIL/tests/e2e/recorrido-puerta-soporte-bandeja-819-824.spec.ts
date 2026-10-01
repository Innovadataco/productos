/**
 * SPEC-819 + SPEC-824 (recorrido de Calidad) · La Puerta de Soporte del padre y la bandeja del operador —
 * las DOS caras de una obligación legal con término, que entraron juntas (#819) y NADIE caminó.
 *
 * POR QUÉ IMPORTA. 819 cableó la puerta (el padre pide ayuda) y 824 la bandeja (alguien ve lo que entra) en
 * el MISMO deploy, por una invariante dura: «la puerta no puede ser alcanzable por un padre antes de que
 * alguien pueda ver lo que entra por ella» — si no, un padre arranca un término de ley y nadie se entera.
 *
 * QUÉ CAMINA (roles titulares, endpoints + pantallas reales):
 *   (A) ALCANZABILIDAD, CAMINADA: el padre llega a la puerta Y el operador llega a la bandeja. Es el candado
 *       de conducta de 824 —si la puerta es alcanzable, la bandeja EXISTE— caminado, no afirmado en unidad.
 *       Se lee la bandeja en su rama VACÍA (entorno nuevo) sin inferirla del lleno.
 *   (B) El padre pide «Mis datos personales» con los DOS ejes —QUÉ (supresión) + SOBRE QUIÉN (un hijo)—; eso
 *       deja la constancia LEGAL (`SolicitudHabeasData`, tipo SUPRESION, techo 15 d) y aparece en la bandeja
 *       como ACCIÓN, pero 🔒 el `hijoId` NO viaja a la bandeja (ni al DTO ni a la pantalla). Dato REAL plantado.
 *   (C) `PAGO_O_COBRO` TAMBIÉN es legal (Decreto 1074/2015 art. 51, 15 d) → cae en el grupo LEGAL, no en
 *       «sin plazo». Si cayera en «otras», sería hallazgo de producto.
 *   (D) Control del split: un motivo NO-legal (`SERVICIO_PLATAFORMA`) cae en «otras», no en «legales» — sin
 *       esta mitad, (C) pasaría por vacío (un split que mete TODO en legales también «pone el pago en legal»).
 *
 * El contenido del titular NO se afirma como visible (la bandeja está despojada a propósito para sobrevivir
 * a una supresión); se afirma su AUSENCIA. El copy y el cálculo del plazo ([NORMA]) NO se tocan.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-824-`. Limpieza FK-safe en afterAll.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { listarBandejaPeticiones } from "@/lib/soporte/bandeja-peticiones.service";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const CORRIDA = `e2e-824-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Soporte824!Secure";
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const OPERADOR_EMAIL = `${CORRIDA}-operador@proteccion.local`;

let padre: PadreOnboarded | undefined;
let hijoId = "";
// ids de las peticiones creadas (= `PeticionServicio.id`, el numeroSeguimiento que devuelve la puerta).
let peticionDatosId = "";
let peticionPagoId = "";
let peticionPlataformaId = "";

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", { data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false } });
}

/** OPERADOR efímero por Prisma (clave LOCAL de la corrida). Tiene `soporte_peticiones` por el seed de roles (SPEC-824). */
async function asegurarOperador() {
    await prisma.usuario.upsert({
        where: { email: OPERADOR_EMAIL },
        update: { rol: "OPERADOR" as RolUsuario, estado: "activo" },
        create: { email: OPERADOR_EMAIL, nombre: `Operador E2E ${CORRIDA}`, passwordHash: await hashPassword(PASSWORD), rol: "OPERADOR" as RolUsuario, estado: "activo" },
    });
}

/** El padre pide ayuda por la Puerta de Soporte (endpoint real). Devuelve el numeroSeguimiento (= PeticionServicio.id). */
async function pedirAyuda(request: APIRequestContext, body: Record<string, unknown>): Promise<string> {
    const res = await request.post("/api/padre/soporte/peticiones", { data: body });
    expect(res.status(), `pedir ayuda (${JSON.stringify(body)}) body=${(await res.text().catch(() => "")).slice(0, 220)}`).toBe(201);
    const ns = (await res.json())?.numeroSeguimiento ?? "";
    expect(ns, "la puerta devuelve numeroSeguimiento").toBeTruthy();
    return ns;
}

test.describe.serial("SPEC-819/824 · la Puerta de Soporte y su bandeja — las dos caras de la obligación legal", () => {
    test.beforeAll(async () => {
        await asegurarOperador();
        // El operador acepta el consentimiento una vez (persiste server-side) por si la pantalla lo exige;
        // es no-titular (no firma datos propios), así que esto es defensa, no un requisito del rol.
        const reqOpConsent = await ctx();
        try {
            await login(reqOpConsent, OPERADOR_EMAIL);
            await aceptarConsentimiento(reqOpConsent);
        } finally {
            await reqOpConsent.dispose();
        }
        const reqPadre = await ctx();
        try {
            padre = await crearPadreOnboarded({ request: reqPadre, email: PADRE_EMAIL, password: PASSWORD });
        } finally {
            await reqPadre.dispose();
        }
        const hijo = await prisma.hijo.findFirst({ where: { usuarioId: padre.usuarioId }, select: { id: true } });
        expect(hijo, "el onboarding dejó una ficha de menor").not.toBeNull();
        hijoId = hijo!.id;
    });

    test.afterAll(async () => {
        // FK-safe: las PQR del padre y la constancia legal (sujetoDelDato = hijoId) ANTES de borrar el hijo.
        if (padre) await prisma.peticionServicio.deleteMany({ where: { usuarioId: padre.usuarioId } }).catch((e) => console.warn("[SPEC-824] limpieza PQR falló:", e));
        if (hijoId) await prisma.solicitudHabeasData.deleteMany({ where: { sujetoDelDato: hijoId } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { email: OPERADOR_EMAIL } }).catch(() => undefined);
        if (padre) await limpiarPadreOnboarded(padre);
    });

    test("(A) alcanzabilidad CAMINADA: el padre llega a la puerta y el operador llega a la bandeja (rama vacía)", async () => {
        // La puerta del padre es alcanzable.
        const reqPadre = await ctx();
        try {
            await login(reqPadre, PADRE_EMAIL);
            const puerta = await reqPadre.get("/dashboard/padre/soporte");
            expect(puerta.status(), "la Puerta de Soporte del padre carga").toBe(200);
            expect((await puerta.text()).includes("Sin acceso a este módulo"), "el padre llega a la puerta, no al fallback").toBe(false);
        } finally {
            await reqPadre.dispose();
        }

        // Y la bandeja del operador EXISTE (candado de alcanzabilidad de 824, caminado). En entorno nuevo
        // está VACÍA: se certifica la rama vacía por sí misma (la pantalla carga sin peticiones), sin
        // inferirla del lleno — el lleno llega en (B)/(C)/(D) sembrando.
        const reqOp = await ctx();
        try {
            await login(reqOp, OPERADOR_EMAIL);
            const bandeja = await reqOp.get("/dashboard/admin/soporte/peticiones");
            expect(bandeja.status(), "la bandeja del operador EXISTE y carga").toBe(200);
            expect((await bandeja.text()).includes("Sin acceso a este módulo"), "el operador llega a la bandeja, no al fallback").toBe(false);
        } finally {
            await reqOp.dispose();
        }
    });

    test("(B) «Mis datos personales» · supresión SOBRE UN HIJO → constancia legal + acción en la bandeja, SIN filtrar el hijo", async () => {
        const reqPadre = await ctx();
        try {
            await login(reqPadre, PADRE_EMAIL);
            // Los dos ejes, nada pre-seleccionado: QUÉ = SUPRESION, SOBRE QUIÉN = un hijo (representante legal).
            peticionDatosId = await pedirAyuda(reqPadre, {
                motivo: "DATOS_PERSONALES",
                tipo: "SUPRESION",
                sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId },
            });
        } finally {
            await reqPadre.dispose();
        }

        // Criterio legal (819-b): la puerta deja la constancia CANÓNICA, no solo la PQR.
        const peticion = await prisma.peticionServicio.findUnique({
            where: { id: peticionDatosId },
            select: { motivo: true, solicitudHabeasDataId: true },
        });
        expect(peticion?.motivo, "la PQR es de datos personales").toBe("DATOS_PERSONALES");
        expect(peticion?.solicitudHabeasDataId, "la PQR enlaza la constancia legal").toBeTruthy();
        const legal = await prisma.solicitudHabeasData.findUnique({
            where: { id: peticion!.solicitudHabeasDataId! },
            select: { tipo: true, plazoDias: true, sujetoDelDato: true, calidad: true },
        });
        expect(legal?.tipo, "la constancia conserva el tipo elegido (SUPRESION)").toBe("SUPRESION");
        expect(legal?.plazoDias, "SUPRESION lleva el techo legal de reclamo (15 d hábiles)").toBe(15);
        expect(legal?.sujetoDelDato, "la constancia guarda el hijo como sujeto del dato").toBe(hijoId);

        // La bandeja la ve como ACCIÓN legal, y 🔒 SIN el hijo.
        const bandeja = await listarBandejaPeticiones();
        const fila = bandeja.legales.find((p) => p.id === peticionDatosId);
        expect(fila, "la petición de datos aparece en el grupo LEGAL de la bandeja").toBeTruthy();
        expect(fila!.esLegal, "es una obligación con término legal").toBe(true);
        expect(fila!.tipoHabeas, "la bandeja muestra la ACCIÓN pedida (supresión), no el contenido").toBe("SUPRESION");
        expect(
            JSON.stringify(bandeja).includes(hijoId),
            "🔒 el hijoId NO viaja al DTO de la bandeja (despojada para sobrevivir a una supresión)",
        ).toBe(false);

        // Y tampoco a la PANTALLA renderizada del operador.
        const reqOp = await ctx();
        try {
            await login(reqOp, OPERADOR_EMAIL);
            const page = await reqOp.get("/dashboard/admin/soporte/peticiones");
            expect(page.status(), "la bandeja (llena) carga").toBe(200);
            expect((await page.text()).includes(hijoId), "🔒 el hijoId NO aparece en la pantalla de la bandeja").toBe(false);
        } finally {
            await reqOp.dispose();
        }
    });

    test("(C) un pago/cobro TAMBIÉN es legal (Decreto 1074/2015) → grupo LEGAL, no «otras»", async () => {
        const reqPadre = await ctx();
        try {
            await login(reqPadre, PADRE_EMAIL);
            peticionPagoId = await pedirAyuda(reqPadre, { motivo: "PAGO_O_COBRO" });
        } finally {
            await reqPadre.dispose();
        }
        const bandeja = await listarBandejaPeticiones();
        const enLegales = bandeja.legales.find((p) => p.id === peticionPagoId);
        const enOtras = bandeja.otras.find((p) => p.id === peticionPagoId);
        expect(enLegales, "PAGO_O_COBRO cae en el grupo LEGAL (Dec. 1074, 15 d)").toBeTruthy();
        expect(enLegales?.esLegal, "esLegal = true para el pago").toBe(true);
        expect(enOtras, "PAGO_O_COBRO NO puede caer en «otras» (sin plazo) — sería incumplimiento con cara de acierto").toBeFalsy();
    });

    test("(D) control del split: un motivo NO-legal cae en «otras», no en «legales»", async () => {
        const reqPadre = await ctx();
        try {
            await login(reqPadre, PADRE_EMAIL);
            peticionPlataformaId = await pedirAyuda(reqPadre, { motivo: "SERVICIO_PLATAFORMA" });
        } finally {
            await reqPadre.dispose();
        }
        const bandeja = await listarBandejaPeticiones();
        const enOtras = bandeja.otras.find((p) => p.id === peticionPlataformaId);
        const enLegales = bandeja.legales.find((p) => p.id === peticionPlataformaId);
        expect(enOtras, "SERVICIO_PLATAFORMA cae en «otras»").toBeTruthy();
        expect(enOtras?.esLegal, "esLegal = false para la queja de plataforma").toBe(false);
        expect(enLegales, "una queja de plataforma NO puede colarse en el grupo legal").toBeFalsy();
    });
});
