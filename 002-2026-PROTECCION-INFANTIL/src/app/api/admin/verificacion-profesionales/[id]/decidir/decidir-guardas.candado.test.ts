/**
 * SPEC-524 · Guardas del Verificador — migradas de `tests/e2e/admin-verificador-recorrido.spec.ts`.
 *
 * POR QUÉ ESTÁ ACÁ Y NO EN tests/e2e/**:
 *  - El e2e no corre en CI (ci.yml no tiene job de Playwright) → los cinco
 *    candados de SPEC-410 no se disparaban solos. La conducta de estas dos
 *    guardas es PURA de API (llamar al handler `/decidir`), así que un test de
 *    integración las ejerce de verdad y en CI. «Un candado vive donde corre.»
 *
 * QUÉ CUBRE ESTE ARCHIVO (y qué NO, para no duplicar):
 *  - `decidir/route.test.ts` (SPEC-418) ya neta los caminos felices: devolución
 *    → MAS_INFORMACION + fila de aviso, aprobación → ACTIVO, transacción atómica.
 *  - `service.candado.test.ts` (SPEC-408) ya fija estáticamente que decidir()
 *    solo emite APROBADO o MAS_INFORMACION (no RECHAZADO terminal).
 *  - Lo que NINGÚN test de CI ejercía son las dos GUARDAS de entrada del §5-bis:
 *      (A) un ítem NO_CUMPLE sin observación → 400 (el profesional tiene que
 *          saber QUÉ corregir; `service.ts` líneas ~256-265).
 *      (B) un NO_CUMPLE nunca deja el perfil ACTIVO — la aprobación exige TODOS
 *          en CUMPLE (`service.ts:273` deriva el resultado; no hay input
 *          `resultado` que forzar). El e2e mandaba `{resultado:"APROBADO"}`, pero
 *          el schema no acepta ese campo: se expresa el invariante por su efecto
 *          real (queda en BORRADOR, no ACTIVO), que es lo que muere si alguien
 *          rompe la derivación.
 *
 * TOKEN REAL (no mockea verifyAuth); solo se inyecta la cookie, patrón SPEC-418.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

// pg-boss no corre en la suite: el despacho al worker es un adelanto, no una
// condición (igual que SPEC-418).
vi.mock("@/lib/queue", () => ({
    sendNotificacionEnvio: vi.fn(async () => undefined),
}));

const REQUISITOS = [
    { clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "" },
    { clave: "autorizacion", nombre: "Autorización firmada", descripcion: "" },
];

const CHECK_MODALIDAD = "PerfilProfesional_modalidad_estado_check";
/**
 * SPEC-717 (I-428): corre `fn` con el CHECK de modalidad bajado y lo re-agrega TAL CUAL
 * (`pg_get_constraintdef`, NOT VALID incluido). Sirve para sembrar la fila que el CHECK
 * INDULTÓ en prod —EN_REVISION sin modalidad—, irrepresentable con el CHECK puesto. Si el
 * CHECK no está en la BD de test, corre `fn` directo.
 */
async function sinCheckModalidad<T>(fn: () => Promise<T>): Promise<T> {
    const filas = await prisma.$queryRawUnsafe<{ def: string }[]>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${CHECK_MODALIDAD}'`,
    );
    const def = filas[0]?.def;
    if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" DROP CONSTRAINT "${CHECK_MODALIDAD}"`);
    try {
        return await fn();
    } finally {
        if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" ADD CONSTRAINT "${CHECK_MODALIDAD}" ${def}`);
    }
}

async function sembrarCatalogoMotor() {
    for (const evento of ["profesional.verificacion.aprobada", "profesional.verificacion.devuelta"]) {
        const clave = `${evento}.email`;
        await prisma.notificacionPlantilla.create({
            data: {
                clave,
                canal: "EMAIL",
                asunto: "Resultado de tu verificación",
                cuerpoMarkdown: "Hola {{nombreProfesional}}.\n{{detalleObservaciones}}",
                activa: true,
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento,
                rol: "PROFESIONAL",
                canal: "EMAIL",
                plantillaClave: clave,
                offset: "+0m",
                obligatoria: true,
                activa: true,
            },
        });
    }
}

/** Perfil EN_REVISION con autorización firmada y un documento por requisito
 *  (para que la guardia SPEC-436 «CUMPLE sin documento» no se cruce con lo que
 *  probamos acá). Igual que SPEC-418. */
async function sembrarPerfilEnRevision(
    modalidad: { atiendeVirtual?: boolean; atiendePresencial?: boolean } = { atiendeVirtual: true },
) {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const profesional = await crearUsuario("PROFESIONAL", `profe.${Date.now()}.${Math.random()}@ejemplo.local`);
    const atiendeVirtual = modalidad.atiendeVirtual ?? false;
    const atiendePresencial = modalidad.atiendePresencial ?? false;
    const crearPerfil = () =>
        prisma.perfilProfesional.create({
            data: {
                usuarioId: profesional.id,
                nombreVisible: "Profesional de Prueba",
                tituloProfesional: "Psicología",
                especialidades: ["infantil"],
                ciudadId: ciudad.id,
                aniosExperiencia: 5,
                presentacion: "Presentación de prueba.",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 45,
                // SPEC-673 (I-398): un perfil ≠ BORRADOR exige ≥1 modalidad (CHECK en BD).
                atiendeVirtual,
                atiendePresencial,
                estado: "EN_REVISION",
                autorizacionArchivoId: "/archivos/autorizacion-prueba.pdf",
                autorizacionSubidaEn: new Date(),
            },
        });
    // SPEC-717 (I-428): un EN_REVISION sin modalidad es la fila INDULTADA de prod — el CHECK la
    // hace irrepresentable, así que se siembra bajándolo (como si se hubiera creado antes del CHECK).
    const sinModalidad = !atiendeVirtual && !atiendePresencial;
    const perfil = sinModalidad ? await sinCheckModalidad(crearPerfil) : await crearPerfil();
    for (const r of REQUISITOS) {
        await prisma.documentoProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                requisitoClave: r.clave,
                archivoId: `archivo-${r.clave}`,
                extension: "pdf",
                sha256: "sha-de-prueba",
            },
        });
    }
    // SPEC-686: decidir exige aceptación previa de la autorización (cutover); se siembra para
    // que este candado pruebe LO SUYO (las guardas del §5-bis), no la guarda de autorización.
    await prisma.aceptacionAutorizacionProfesional.create({
        data: {
            usuarioId: profesional.id,
            version: "v0.1",
            documentoHash: "h",
            ip: "1.1.1.1",
            aceptadoEn: new Date(Date.now() - 3_600_000),
        },
    });
    return { perfil, profesional };
}

async function autenticarVerificador() {
    const admin = await crearUsuario("ADMIN", `verificador.${Date.now()}@ejemplo.local`);
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

function pedir(id: string, checklist: Record<string, { estado: string; observacion?: string }>) {
    return POST(
        new Request(`http://localhost:5005/api/admin/verificacion-profesionales/${id}/decidir`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({ checklist }),
        }),
        { params: Promise.resolve({ id }) },
    );
}

describe("POST /decidir · SPEC-524 — guardas del §5-bis (migradas del e2e SPEC-410)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await prisma.parametroSistema.create({
            data: {
                clave: "verificacion.requisitos",
                valor: JSON.stringify(REQUISITOS),
                tipo: "JSON",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "Requisitos que revisa el Verificador (test)",
            },
        });
        await sembrarCatalogoMotor();
    });

    afterAll(async () => prisma.$disconnect());

    it("(A) un ítem NO_CUMPLE SIN observación → 400 y nada se persiste", async () => {
        await autenticarVerificador();
        const { perfil } = await sembrarPerfilEnRevision();

        // Ambos NO_CUMPLE, ninguno con observación: la guardia del §5-bis corta
        // ANTES de tocar BD. (Sin CUMPLE no interviene la guardia SPEC-436.)
        const res = await pedir(perfil.id, {
            tarjeta: { estado: "NO_CUMPLE" },
            autorizacion: { estado: "NO_CUMPLE" },
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message ?? "").toMatch(/observaci/i);

        // La decisión no ocurrió: sin fila de verificación y el perfil intacto.
        expect(await prisma.verificacionProfesional.count()).toBe(0);
        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado, "el perfil sigue EN_REVISION, no devuelto a ciegas").toBe("EN_REVISION");
    });

    it("(B) con un requisito NO_CUMPLE, el perfil NUNCA queda ACTIVO — devuelve a BORRADOR", async () => {
        await autenticarVerificador();
        const { perfil } = await sembrarPerfilEnRevision();

        // Un NO_CUMPLE (con observación, para pasar la guardia A): la aprobación
        // está bloqueada por construcción — el resultado se DERIVA del checklist,
        // no se puede forzar `APROBADO`. Efecto observable: MAS_INFORMACION y el
        // perfil a BORRADOR, jamás ACTIVO.
        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "NO_CUMPLE", observacion: "La firma no coincide con el documento." },
        });
        expect(res.status).toBe(200);
        expect((await res.json()).data.resultado).toBe("MAS_INFORMACION");

        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado, "un NO_CUMPLE no puede dejar el perfil ACTIVO").toBe("BORRADOR");
        expect(despues.estado).not.toBe("ACTIVO");
    });

    // ── SPEC-717 (I-428) · la PUERTA de aprobación que le faltaba al candado de modalidad ──
    it("(C) aprobar un perfil SIN modalidad → 400 MODALIDAD_REQUERIDA legible, no un 23514 crudo, y NO queda ACTIVO", async () => {
        await autenticarVerificador();
        // La fila INDULTADA: EN_REVISION sin modalidad (como la cuenta E2E en prod).
        const { perfil } = await sembrarPerfilEnRevision({ atiendeVirtual: false, atiendePresencial: false });

        // Checklist TODO CUMPLE → la decisión sería APROBAR → intentaría estado=ACTIVO. Sin la
        // compuerta, el UPDATE choca con el CHECK y devuelve un 23514 crudo. Con ella, 400 legible.
        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "CUMPLE" },
        });
        expect(res.status, "el admin recibe un 400 legible, no un 500/23514").toBe(400);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body?.error?.code, "código para que el cliente señale el campo modalidad").toBe("MODALIDAD_REQUERIDA");

        // No se aprobó: sin fila de verificación y el perfil sigue EN_REVISION (jamás ACTIVO).
        expect(await prisma.verificacionProfesional.count()).toBe(0);
        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado, "un perfil sin modalidad no puede quedar ACTIVO por la puerta del verificador").toBe(
            "EN_REVISION",
        );
    });

    it("(C-control positivo) el MISMO checklist TODO CUMPLE, pero CON modalidad, SÍ aprueba → ACTIVO", async () => {
        await autenticarVerificador();
        // Control por remoción del discriminador: idéntico a (C) salvo que hay modalidad.
        const { perfil } = await sembrarPerfilEnRevision({ atiendeVirtual: true });

        const res = await pedir(perfil.id, {
            tarjeta: { estado: "CUMPLE" },
            autorizacion: { estado: "CUMPLE" },
        });
        expect(res.status, "con modalidad, la aprobación pasa (la compuerta no sobre-bloquea)").toBe(200);
        expect((await res.json()).data.resultado).toBe("APROBADO");
        const despues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(despues.estado).toBe("ACTIVO");
    });
});
