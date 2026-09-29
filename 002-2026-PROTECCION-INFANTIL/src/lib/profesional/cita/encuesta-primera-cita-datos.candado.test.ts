/**
 * CANDADO · SPEC-745 (dictamen D-121 de Datos) — la BD, no la app, garantiza el
 * contrato de `EncuestaPrimeraCita`.
 *
 * El comentario del schema decía «se valida en la capa de aplicación (Zod)» y eso
 * era FALSO: no hay endpoint ni Zod (la pantalla la está formando Diseño). El único
 * escritor real es el poblador demo, con puntaje en {1..5}. Como Prisma es CIEGO al
 * CHECK, este candado prueba la CONDUCTA contra Postgres, no que el CHECK esté escrito:
 *
 *   (1) INSERCIÓN real: puntaje 0 y 6 → rechazo 23514; 1 y 5 (los bordes) → pasan.
 *       Único custodio del CHECK: si alguien lo dropea, este test se pone rojo.
 *   (2) onDelete Cascade: dar de baja la cita arrastra su encuesta y NO traba con
 *       23503. Control positivo: se afirma que la encuesta EXISTÍA antes de la baja,
 *       así el «0 después» prueba el cascade y no una fila que nunca estuvo.
 *
 * Integración (BD de test, truncada por resetDatabase). NO toca prod: las 297 filas
 * demo que hay en producción viven allá, no acá.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";

let contador = 0;

/** Cadena mínima para una `SolicitudCita` real (padre + profesional + franja). */
async function seedSolicitud() {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profUsuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profUsuario.id,
            nombreVisible: "Prof. Encuesta",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: 120_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const inicio = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfil.id, inicio, fin: new Date(inicio.getTime() + 50 * 60 * 1000), modalidad: "VIRTUAL", tomada: true },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: perfil.id,
            franjaId: franja.id,
            presentacion: "Solicitud de prueba SPEC-745.",
            urgencia: "SIN_APURO",
            estado: "CONFIRMADA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
        },
    });
}

/** INSERT crudo — Prisma envuelve el rechazo del CHECK como P2010 con el SQLSTATE
 *  real en `meta.code`; el `$executeRaw` parametriza los valores. */
function insertarEncuesta(solicitudId: string, puntaje: number) {
    const id = `enc-test-${Date.now()}-${contador++}`;
    return prisma.$executeRaw`
        INSERT INTO "EncuestaPrimeraCita" (id, "solicitudId", "seDioLaCita", puntaje, volveria, "respondidaEn")
        VALUES (${id}, ${solicitudId}, ${true}, ${puntaje}, ${true}, now())
    `;
}

function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

describe("SPEC-745 · CHECK puntaje 1..5 (inserción real, Prisma es ciego al CHECK)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it.each([0, 6])("puntaje %i → rechazo del CHECK (SQLSTATE 23514)", async (puntaje) => {
        const sol = await seedSolicitud();
        let err: unknown;
        try {
            await insertarEncuesta(sol.id, puntaje);
        } catch (e) {
            err = e;
        }
        expect(err, `puntaje ${puntaje} DEBE fallar: si pasa, el CHECK ya no está en la BD`).toBeDefined();
        expect(
            detalleError(err),
            "el rechazo debe ser ESTE check (23514 / EncuestaPrimeraCita_puntaje_check), no otro error de casualidad",
        ).toMatch(/23514|EncuestaPrimeraCita_puntaje_check/);
    });

    it.each([1, 5])("puntaje %i (borde) → pasa", async (puntaje) => {
        const sol = await seedSolicitud();
        await insertarEncuesta(sol.id, puntaje);
        expect(await prisma.encuestaPrimeraCita.count({ where: { solicitudId: sol.id } })).toBe(1);
    });
});

describe("SPEC-745 · onDelete Cascade en EncuestaPrimeraCita.solicitudId", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("dar de baja la cita arrastra la encuesta y NO traba con 23503", async () => {
        const sol = await seedSolicitud();
        await insertarEncuesta(sol.id, 4);
        // Control positivo: la encuesta EXISTE antes de la baja.
        expect(await prisma.encuestaPrimeraCita.count({ where: { solicitudId: sol.id } })).toBe(1);

        // Con RESTRICT (el estado viejo) esto lanzaría 23503; con Cascade se lleva la encuesta.
        await prisma.solicitudCita.delete({ where: { id: sol.id } });

        expect(await prisma.encuestaPrimeraCita.count({ where: { solicitudId: sol.id } })).toBe(0);
    });
});
