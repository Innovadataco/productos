/**
 * SPEC-787 · CANDADO de la bandeja del verificador (integración, BD de test).
 *
 * Los DOS focos del CEO:
 *  1. `esIncumplimiento` es FUENTE ÚNICA — el resumen (conteo) y el detalle (bandera por incidente)
 *     la leen IGUAL. Control positivo: mover `now` sobre un vencimiento hace saltar el conteo Y la
 *     bandera JUNTOS (no puede haber resumen «al día» sobre detalle «vencido»).
 *  2. Orden por el VENCIMIENTO real (`venceEn`), no por creación: un incidente creado DESPUÉS pero
 *     que vence ANTES va primero.
 * Más: CERO contenido de sesión (la presentación del caso del padre nunca aparece en el DTO).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { listarBandejaIncidentes } from "@/lib/profesional/cita/bandeja-incidentes.service";
import { esIncumplimiento } from "@/lib/profesional/cita/estado-efectivo-incidente";

const SERVICIO_OK = { operador: "SI", inicio: "A_TIEMPO", enlace: "SI", duracion: "ENTRE_30_45" } as const;
const SIN_SESION = { operador: "NO_HUBO_OPERADOR", inicio: "NO_COMENZO", enlace: "NO_FUNCIONO", duracion: null } as const;

const NOW = new Date("2026-06-15T12:00:00.000Z");
const LATER = new Date("2026-07-15T12:00:00.000Z");

/** Crea una solicitud con sus dos encuestas y UN incidente con vencimiento explícito. Devuelve el id. */
async function seedIncidente(opts: {
    padreSeRealizo: boolean;
    reclamadoEn: Date;
    venceEn: Date;
    presentacion: string;
}): Promise<string> {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profUsuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profUsuario.id,
            nombreVisible: "Prof. Bandeja",
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
    const sol = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: perfil.id,
            franjaId: franja.id,
            presentacion: opts.presentacion, // contenido de sesión: NO debe filtrarse al verificador
            urgencia: "SIN_APURO",
            estado: "CUMPLIDA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
        },
    });
    // Las dos encuestas: el padre difiere del profesional en SE_REALIZO.
    await prisma.encuestaCita.create({
        data: { solicitudId: sol.id, origen: "PADRE", seRealizo: opts.padreSeRealizo, razonNoRealizo: opts.padreSeRealizo ? null : "OTRA_PARTE_NO_CONECTO", ...(opts.padreSeRealizo ? SERVICIO_OK : SIN_SESION) },
    });
    await prisma.encuestaCita.create({
        data: { solicitudId: sol.id, origen: "PROFESIONAL", seRealizo: true, ...SERVICIO_OK },
    });
    const inc = await prisma.incidenteContradiccionEncuesta.create({
        data: {
            solicitudId: sol.id,
            pregunta: "SE_REALIZO",
            padreValor: String(opts.padreSeRealizo),
            profesionalValor: "true",
            reclamadoEn: opts.reclamadoEn,
            venceEn: opts.venceEn,
        },
    });
    return inc.id;
}

describe("SPEC-787 · listarBandejaIncidentes (integración)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("ordena por venceEn real: un incidente creado DESPUÉS pero que vence ANTES va primero", async () => {
        // Creado 1º, vence DESPUÉS (2026-06-20).
        const tarde = await seedIncidente({ padreSeRealizo: true, reclamadoEn: new Date("2026-06-10T00:00:00Z"), venceEn: new Date("2026-06-20T00:00:00Z"), presentacion: "caso A" });
        // Creado 2º, vence ANTES (2026-06-05). Por creación iría 2º; por vencimiento va 1º.
        const pronto = await seedIncidente({ padreSeRealizo: false, reclamadoEn: new Date("2026-06-01T00:00:00Z"), venceEn: new Date("2026-06-05T00:00:00Z"), presentacion: "caso B" });
        const bandeja = await listarBandejaIncidentes(NOW);
        expect(bandeja.incidentes.map((i) => i.id)).toEqual([pronto, tarde]);
    });

    it("esIncumplimiento es FUENTE ÚNICA: resumen === detalle === recomputar desde el estado", async () => {
        await seedIncidente({ padreSeRealizo: true, reclamadoEn: new Date("2026-06-10T00:00:00Z"), venceEn: new Date("2026-06-20T00:00:00Z"), presentacion: "abierto al día" });
        await seedIncidente({ padreSeRealizo: false, reclamadoEn: new Date("2026-06-01T00:00:00Z"), venceEn: new Date("2026-06-05T00:00:00Z"), presentacion: "vencido" });
        const b = await listarBandejaIncidentes(NOW);
        // el resumen se cuenta con la MISMA bandera del detalle...
        expect(b.resumen.incumplidos).toBe(b.incidentes.filter((i) => i.incumplida).length);
        // ...y esa bandera ES esIncumplimiento(estado): recomputarla no la cambia.
        expect(b.resumen.incumplidos).toBe(b.incidentes.filter((i) => esIncumplimiento(i.estado)).length);
        expect(b.resumen.total).toBe(2);
        expect(b.resumen.incumplidos).toBe(1); // solo el vencido al 2026-06-15
    });

    it("control positivo: mover `now` sobre el vencimiento sube el conteo Y la bandera JUNTOS", async () => {
        await seedIncidente({ padreSeRealizo: true, reclamadoEn: new Date("2026-06-10T00:00:00Z"), venceEn: new Date("2026-06-20T00:00:00Z"), presentacion: "vence 06-20" });
        await seedIncidente({ padreSeRealizo: false, reclamadoEn: new Date("2026-06-01T00:00:00Z"), venceEn: new Date("2026-06-05T00:00:00Z"), presentacion: "vence 06-05" });
        const antes = await listarBandejaIncidentes(NOW); // 06-15: uno vencido
        expect(antes.resumen.incumplidos).toBe(1);
        expect(antes.incidentes.filter((i) => i.incumplida).length).toBe(1);
        const despues = await listarBandejaIncidentes(LATER); // 07-15: los dos vencidos
        expect(despues.resumen.incumplidos).toBe(2);
        expect(despues.incidentes.filter((i) => i.incumplida).length).toBe(2);
        expect(despues.incidentes.every((i) => i.incumplida)).toBe(true);
    });

    it("CERO contenido de sesión: la presentación del caso nunca sale en el DTO", async () => {
        const marcador = "SECRETO-DEL-CASO-no-debe-filtrarse-al-verificador";
        await seedIncidente({ padreSeRealizo: false, reclamadoEn: new Date("2026-06-01T00:00:00Z"), venceEn: new Date("2026-06-20T00:00:00Z"), presentacion: marcador });
        const b = await listarBandejaIncidentes(NOW);
        const json = JSON.stringify(b);
        expect(json).not.toContain(marcador);
        expect(json).not.toContain("razonNoRealizo"); // la razón de no-sesión tampoco viaja
    });

    it("simétrico: los dos lados salen con el MISMO shape (mismas claves)", async () => {
        await seedIncidente({ padreSeRealizo: false, reclamadoEn: new Date("2026-06-01T00:00:00Z"), venceEn: new Date("2026-06-20T00:00:00Z"), presentacion: "caso" });
        const b = await listarBandejaIncidentes(NOW);
        const [padre, profesional] = b.incidentes[0].lados;
        expect(padre.rol).toBe("PADRE");
        expect(profesional.rol).toBe("PROFESIONAL");
        expect(Object.keys(padre).sort()).toEqual(Object.keys(profesional).sort());
    });
});
