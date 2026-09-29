/**
 * CANDADO · SPEC-753 (dictamen D-121 de Datos) — la BD, no la app, garantiza el
 * contrato de `EncuestaCita` y `IncidenteContradiccionEncuesta`.
 *
 * Prisma es CIEGO al CHECK: no lo declara en el modelo ni lo borra en un
 * `migrate dev` futuro. Estos candados prueban la CONDUCTA contra Postgres
 * mediante INSERCIÓN real (`$executeRaw`, que evita la capa de tipos de Prisma),
 * no que el CHECK esté escrito. Si alguien dropea un CHECK o afloja una FK, el
 * test que lo custodia se pone rojo.
 *
 *   (1) EncuestaCita · razón↔seRealizo en forma IFF (HUECO 2 del dictamen): la
 *       razón de no-sesión existe si y SÓLO si la sesión NO se realizó. Los dos
 *       incoherentes (realizó=true CON razón, realizó=false SIN razón) → 23514;
 *       los dos coherentes → pasan (control positivo: el CHECK no rechaza todo).
 *   (2) EncuestaCita · onDelete Cascade: dar de baja la cita arrastra la encuesta
 *       sin 23503. Control positivo: se afirma que la encuesta EXISTÍA antes.
 *   (3) IncidenteContradiccionEncuesta · venceEn > reclamadoEn: un plazo que venza
 *       antes o EN el mismo instante del reclamo → 23514 (dejaría el incidente
 *       VENCIDO_A_FAVOR_PADRE desde su nacimiento); +15 días hábiles → pasa.
 *   (4) IncidenteContradiccionEncuesta · onDelete Cascade: igual que (2).
 *
 * Integración (BD de test, truncada por resetDatabase). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { sumarDiasHabiles } from "@/lib/apelaciones";

let contador = 0;

/** Cadena mínima para una `SolicitudCita` real (padre + profesional + franja). */
async function seedSolicitud() {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profUsuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profUsuario.id,
            nombreVisible: "Prof. Encuesta Cruce",
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
            presentacion: "Solicitud de prueba SPEC-753.",
            urgencia: "SIN_APURO",
            estado: "CUMPLIDA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
        },
    });
}

function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

/** INSERT crudo de EncuestaCita — casteos explícitos a los enums (columnas case-sensitive). */
function insertarEncuestaCita(
    solicitudId: string,
    opts: { origen?: string; seRealizo: boolean; razonNoRealizo: string | null },
) {
    const id = `encc-test-${Date.now()}-${contador++}`;
    const { origen = "PADRE", seRealizo, razonNoRealizo } = opts;
    return prisma.$executeRaw`
        INSERT INTO "EncuestaCita"
            (id, "solicitudId", origen, "seRealizo", "razonNoRealizo", operador, inicio, enlace, duracion, "respondidaEn")
        VALUES (
            ${id}, ${solicitudId}, ${origen}::"OrigenEncuestaCita", ${seRealizo},
            ${razonNoRealizo}::"RazonNoSesion", ${"SI"}::"OperadorConvoco", ${"A_TIEMPO"}::"InicioSesion",
            ${"SI"}::"EnlaceFunciono", ${"ENTRE_30_45"}::"DuracionSesion", now()
        )
    `;
}

/** INSERT crudo de IncidenteContradiccionEncuesta con un reloj legal dado. */
function insertarIncidente(solicitudId: string, reclamadoEn: Date, venceEn: Date) {
    const id = `inc-test-${Date.now()}-${contador++}`;
    return prisma.$executeRaw`
        INSERT INTO "IncidenteContradiccionEncuesta"
            (id, "solicitudId", pregunta, "padreValor", "profesionalValor", "detectadoEn", "reclamadoEn", "venceEn")
        VALUES (
            ${id}, ${solicitudId}, ${"INICIO"}::"PreguntaEncuesta", ${"A_TIEMPO"}, ${"CON_RETRASO"},
            now(), ${reclamadoEn}, ${venceEn}
        )
    `;
}

describe("SPEC-753 · EncuestaCita · CHECK razón↔seRealizo (IFF; Prisma es ciego al CHECK)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    // Los dos INCOHERENTES: deben rebotar con 23514.
    it.each([
        { seRealizo: true, razon: "OTRA", nota: "realizó=true CON razón" },
        { seRealizo: false, razon: null, nota: "realizó=false SIN razón" },
    ])("$nota → rechazo del CHECK (SQLSTATE 23514)", async ({ seRealizo, razon }) => {
        const sol = await seedSolicitud();
        let err: unknown;
        try {
            await insertarEncuestaCita(sol.id, { seRealizo, razonNoRealizo: razon });
        } catch (e) {
            err = e;
        }
        expect(err, "una fila incoherente DEBE fallar: si pasa, el CHECK ya no está en la BD").toBeDefined();
        expect(
            detalleError(err),
            "el rechazo debe ser ESTE check (23514 / EncuestaCita_razon_sii_no_realizo_check), no otro error de casualidad",
        ).toMatch(/23514|EncuestaCita_razon_sii_no_realizo_check/);
    });

    // Los dos COHERENTES: control positivo (el CHECK no rechaza todo).
    it.each([
        { seRealizo: true, razon: null, nota: "realizó=true SIN razón (sesión normal)" },
        { seRealizo: false, razon: "PROBLEMA_TECNICO", nota: "realizó=false CON razón" },
    ])("$nota → pasa", async ({ seRealizo, razon }) => {
        const sol = await seedSolicitud();
        await insertarEncuestaCita(sol.id, { seRealizo, razonNoRealizo: razon });
        expect(await prisma.encuestaCita.count({ where: { solicitudId: sol.id } })).toBe(1);
    });
});

describe("SPEC-753 · EncuestaCita · onDelete Cascade en solicitudId", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("dar de baja la cita arrastra la encuesta y NO traba con 23503", async () => {
        const sol = await seedSolicitud();
        await insertarEncuestaCita(sol.id, { seRealizo: true, razonNoRealizo: null });
        // Control positivo: la encuesta EXISTE antes de la baja.
        expect(await prisma.encuestaCita.count({ where: { solicitudId: sol.id } })).toBe(1);

        // Con RESTRICT lanzaría 23503; con Cascade se lleva la encuesta.
        await prisma.solicitudCita.delete({ where: { id: sol.id } });

        expect(await prisma.encuestaCita.count({ where: { solicitudId: sol.id } })).toBe(0);
    });
});

describe("SPEC-753 · IncidenteContradiccionEncuesta · CHECK venceEn > reclamadoEn", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("venceEn ANTES de reclamadoEn → rechazo del CHECK (23514)", async () => {
        const sol = await seedSolicitud();
        const reclamadoEn = new Date();
        const venceEn = new Date(reclamadoEn.getTime() - 24 * 60 * 60 * 1000);
        let err: unknown;
        try {
            await insertarIncidente(sol.id, reclamadoEn, venceEn);
        } catch (e) {
            err = e;
        }
        expect(err, "un plazo que vence antes del reclamo DEBE fallar").toBeDefined();
        expect(detalleError(err)).toMatch(/23514|IncidenteContradiccionEncuesta_vence_gt_reclamado_check/);
    });

    it("venceEn IGUAL a reclamadoEn → rechazo (el CHECK es estricto: >, no >=)", async () => {
        const sol = await seedSolicitud();
        const instante = new Date();
        let err: unknown;
        try {
            await insertarIncidente(sol.id, instante, instante);
        } catch (e) {
            err = e;
        }
        expect(err, "vence == reclamo DEBE fallar (el plazo no puede ser cero)").toBeDefined();
        expect(detalleError(err)).toMatch(/23514|IncidenteContradiccionEncuesta_vence_gt_reclamado_check/);
    });

    it("venceEn = reclamadoEn + 15 días hábiles → pasa (control positivo)", async () => {
        const sol = await seedSolicitud();
        const reclamadoEn = new Date();
        const venceEn = sumarDiasHabiles(reclamadoEn, 15);
        await insertarIncidente(sol.id, reclamadoEn, venceEn);
        expect(await prisma.incidenteContradiccionEncuesta.count({ where: { solicitudId: sol.id } })).toBe(1);
    });
});

describe("SPEC-753 · IncidenteContradiccionEncuesta · onDelete Cascade en solicitudId", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("dar de baja la cita arrastra el incidente y NO traba con 23503", async () => {
        const sol = await seedSolicitud();
        await insertarIncidente(sol.id, new Date(), sumarDiasHabiles(new Date(), 15));
        // Control positivo: el incidente EXISTE antes de la baja.
        expect(await prisma.incidenteContradiccionEncuesta.count({ where: { solicitudId: sol.id } })).toBe(1);

        await prisma.solicitudCita.delete({ where: { id: sol.id } });

        expect(await prisma.incidenteContradiccionEncuesta.count({ where: { solicitudId: sol.id } })).toBe(0);
    });
});
