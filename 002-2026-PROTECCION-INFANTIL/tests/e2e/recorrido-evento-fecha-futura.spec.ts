/**
 * CANDADO (no-regresión) — POST /api/reportes/[id]/evento rechaza fecha FUTURA.
 * SPEC-513 (PA-21) cerró el hueco; este spec quedó como la no-regresión viva.
 *
 * Contexto (leído en fuente, main, 2026-09-05):
 *  - SPEC-438 endureció el POST PRINCIPAL `/api/reportes`: su `crearReporteSchema`
 *    rechaza fechas futuras (`src/lib/validators.ts:25-28`, refine `<= new Date()`),
 *    y el wizard bloquea la selección con `max={hoy}` (ReporteStepDetalle.tsx:182).
 *  - Pero el endpoint HERMANO «Agregar otro evento» (SPEC-340) tiene su PROPIO
 *    `bodySchema` (`src/app/api/reportes/[id]/evento/route.ts:23-29`) que solo
 *    valida `Date.parse` — SIN cota de futuro — y PERSISTE el evento (201) vía
 *    `ReporteCreationService.crear(...)`. Un padre puede sembrar un hecho fechado
 *    en el FUTURO dentro de su cadena/expediente: dato falso indistinguible del
 *    verdadero. De las 3 superficies que aceptan `fechaIncidente` como input,
 *    esta es la ÚNICA sin el guard (denuncia-formal reusa la fecha ya guardada).
 *  - El POST PRINCIPAL ya tiene su no-regresión: `src/app/api/reportes/route.test.ts:174`
 *    («rechaza reporte con fecha futura») + `src/lib/reportes/fecha-hecho.candado.test.ts`.
 *    Por eso este archivo NO duplica esa cobertura: solo cierra el hueco de /evento.
 *
 * CANDADO (conducta, muere con el defecto):
 *  - Afirma la conducta BUENA: un evento con fecha futura DEBE rechazarse (400
 *    VALIDATION_ERROR), igual que el POST principal.
 *  - SPEC-513 (PA-21) arregló el hueco: el bodySchema del evento ahora reusa el
 *    validador CANÓNICO `fechaIncidenteSchema` (lib/validators). Se RETIRÓ el
 *    `test.fail(true)`: este spec es ya la no-regresión viva (rojo si el guard se
 *    cae). El candado de clase `fecha-incidente-schema-unico` impide además que
 *    otra ruta vuelva a declarar su propio schema sobre `fechaIncidente`.
 *
 * Siembra por `@/lib/prisma` (BD de CI/dev, NO producción) — calca el arnés del
 * spec hermano `mis-reportes-expediente.spec.ts` (SPEC-340).
 */
import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const PASSWORD = "Padre123!Seguro";

let secuencia = 0;
function emailUnico(): string {
    secuencia += 1;
    return `evento-futura-e2e-${Date.now()}-${secuencia}@proteccion.local`;
}

/** Padre con el camino terminado (para poder reportar y agregar eventos). */
async function crearPadreCompleto(email: string) {
    const pais = await prisma.pais.findFirstOrThrow();
    const ciudad = await prisma.ciudad.findFirstOrThrow();
    const version = await prisma.parametroSistema.findUnique({ where: { clave: "consentimiento.version_actual" } });
    const padre = await prisma.usuario.create({
        data: {
            email,
            passwordHash: await hashPassword(PASSWORD),
            rol: "PARENT",
            estado: "activo",
            nombre: "Padre",
            apellidos: "Fecha Futura",
            documentoTipo: "CC",
            documentoNumero: `79${Date.now() % 100000000}`,
            telefono: "+57 300 555 0202",
            paisId: pais.id,
            ciudadId: ciudad.id,
            consentimientoAceptadoEn: new Date(),
            consentimientoVersion: version?.valor ?? "1.0",
        },
    });
    const plan = await prisma.plan.findFirst({ where: { esFreemium: true } });
    if (plan) {
        await prisma.suscripcion.create({
            data: {
                tipoTitular: "PADRE",
                usuarioId: padre.id,
                estado: "ACTIVA",
                planActualId: plan.id,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 30 * 86400000),
                codigoReferidoPropio: `evfut-${Date.now()}-${secuencia}`,
                esFreemium: true,
            },
        });
    }
    return padre;
}

async function login(page: Page, email: string) {
    const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status()).toBe(200);
}

/** Reporte base con fecha PASADA (el POST principal ya cota el futuro, SPEC-438). */
async function reportar(page: Page, identificador: string): Promise<string> {
    const res = await page.request.post("/api/reportes", {
        data: {
            identificador,
            plataforma: "whatsapp",
            texto: "Un adulto contacta a la menor con insistencia pidiendo fotos personales cada noche.",
            fechaIncidente: "2026-08-25T21:30:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
        },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).reporte.id as string;
}

test.describe("Candado · POST /api/reportes/[id]/evento no acepta fecha futura", () => {
    test("un evento con fechaIncidente FUTURA se rechaza 400 VALIDATION_ERROR", async ({ page }) => {
        // SPEC-513 (PA-21): el bodySchema del evento ya reusa `fechaIncidenteSchema`
        // (cota de futuro). Se RETIRÓ el `test.fail`: esto es la no-regresión viva.
        const email = emailUnico();
        await crearPadreCompleto(email);
        await login(page, email);
        const r1 = await reportar(page, `+5730099${Date.now() % 100000}`);

        // Fecha deliberadamente futura (una semana adelante del reloj del runner).
        const fechaFutura = new Date(Date.now() + 7 * 86400000).toISOString();
        const res = await page.request.post(`/api/reportes/${r1}/evento`, {
            data: {
                texto: "Evento con fecha deliberadamente futura: no puede persistirse como hecho.",
                fechaIncidente: fechaFutura,
            },
        });

        // Conducta correcta: la validación rechaza la fecha futura (paridad con el POST principal).
        expect(res.status(), "un hecho no puede estar fechado en el futuro").toBe(400);
        const body = await res.json();
        expect(body?.error?.code, "debe ser un error de validación con causa").toBe("VALIDATION_ERROR");
    });
});
