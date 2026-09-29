/**
 * SPEC-753 · CANDADO del service del cruce (integración, BD de test).
 *
 * Ejercita la decisión del CEO sobre el incidente SIMÉTRICO:
 *  - acuerdo total → CERO incidentes (control positivo);
 *  - discrepancia de servicio (ambos realizaron) → incidente INTERNO anclado en la detección;
 *  - el PADRE dice que no se realizó → incidente LEGAL anclado en la RESPUESTA DEL PADRE, y
 *    UN solo incidente (SE_REALIZO), no las sub-preguntas;
 *  - el PROFESIONAL dice que no → incidente INTERNO anclado en la detección;
 *  - ambos dicen que no se realizó → CERO incidentes (nada que contradecir en el detalle);
 *  - idempotente: re-cruzar no duplica ni resetea el reloj;
 *  - falta un lado → no-op.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { OperadorConvoco, InicioSesion, EnlaceFunciono, DuracionSesion, RazonNoSesion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { cruzarEncuestasCita } from "@/lib/profesional/cita/encuestas-cita-cruce.service";
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";

const SERVICIO_OK = { operador: "SI", inicio: "A_TIEMPO", enlace: "SI", duracion: "ENTRE_30_45" } as const;
const SIN_SESION = { operador: "NO_HUBO_OPERADOR", inicio: "NO_COMENZO", enlace: "NO_FUNCIONO", duracion: null } as const;

async function seedSolicitud(): Promise<string> {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profUsuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profUsuario.id,
            nombreVisible: "Prof. Cruce Service",
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
            presentacion: "Solicitud SPEC-753 cruce service.",
            urgencia: "SIN_APURO",
            estado: "CUMPLIDA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
        },
    });
    return sol.id;
}

type DatosEncuesta = {
    seRealizo: boolean;
    razonNoRealizo?: RazonNoSesion | null;
    operador: OperadorConvoco;
    inicio: InicioSesion;
    enlace: EnlaceFunciono;
    duracion: DuracionSesion | null;
};

function crearEncuesta(solicitudId: string, origen: "PADRE" | "PROFESIONAL", d: DatosEncuesta) {
    return prisma.encuestaCita.create({
        data: {
            solicitudId,
            origen,
            seRealizo: d.seRealizo,
            razonNoRealizo: d.razonNoRealizo ?? null,
            operador: d.operador,
            inicio: d.inicio,
            enlace: d.enlace,
            duracion: d.duracion,
        },
    });
}

const incidentesDe = (solicitudId: string) =>
    prisma.incidenteContradiccionEncuesta.findMany({ where: { solicitudId }, orderBy: { pregunta: "asc" } });

describe("SPEC-753 · cruzarEncuestasCita (integración)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("acuerdo total → CERO incidentes (control positivo)", async () => {
        const sol = await seedSolicitud();
        await crearEncuesta(sol, "PADRE", { seRealizo: true, ...SERVICIO_OK });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: true, ...SERVICIO_OK });
        const { contradicciones } = await cruzarEncuestasCita(sol, prisma);
        expect(contradicciones).toHaveLength(0);
        expect(await incidentesDe(sol)).toHaveLength(0);
    });

    it("discrepancia de servicio (duración) → 1 incidente INTERNO anclado en la detección", async () => {
        const sol = await seedSolicitud();
        await crearEncuesta(sol, "PADRE", { seRealizo: true, ...SERVICIO_OK });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: true, ...SERVICIO_OK, duracion: "MAS_45" });
        const deteccion = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        await cruzarEncuestasCita(sol, prisma, { ahora: deteccion });
        const inc = await incidentesDe(sol);
        expect(inc).toHaveLength(1);
        expect(inc[0].pregunta).toBe("DURACION");
        expect(inc[0].padreValor).toBe("ENTRE_30_45");
        expect(inc[0].profesionalValor).toBe("MAS_45");
        // interno → ancla en la detección; venceEn = detección + 10 hábiles (NO 15, que es el legal)
        expect(inc[0].reclamadoEn.getTime()).toBe(deteccion.getTime());
        expect(inc[0].venceEn.getTime()).toBe(sumarDiasHabilesColombia(deteccion, 10).getTime());
    });

    it("el PADRE dice que NO se realizó → 1 incidente LEGAL anclado en la RESPUESTA del padre, solo SE_REALIZO", async () => {
        const sol = await seedSolicitud();
        const encPadre = await crearEncuesta(sol, "PADRE", { seRealizo: false, razonNoRealizo: "OTRA_PARTE_NO_CONECTO", ...SIN_SESION });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: true, ...SERVICIO_OK });
        const deteccion = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        await cruzarEncuestasCita(sol, prisma, { ahora: deteccion });
        const inc = await incidentesDe(sol);
        // UN solo incidente: SE_REALIZO. NO operador/inicio/enlace, aunque difieran.
        expect(inc).toHaveLength(1);
        expect(inc[0].pregunta).toBe("SE_REALIZO");
        expect(inc[0].padreValor).toBe("false");
        expect(inc[0].profesionalValor).toBe("true");
        // LEGAL → ancla en la respuesta del padre (su reclamo), NO en la detección.
        expect(inc[0].reclamadoEn.getTime()).toBe(encPadre.respondidaEn.getTime());
        expect(inc[0].reclamadoEn.getTime()).not.toBe(deteccion.getTime());
        expect(inc[0].venceEn.getTime()).toBe(sumarDiasHabilesColombia(encPadre.respondidaEn, 15).getTime());
    });

    it("el PROFESIONAL dice que NO se realizó → 1 incidente INTERNO anclado en la detección", async () => {
        const sol = await seedSolicitud();
        const encPadre = await crearEncuesta(sol, "PADRE", { seRealizo: true, ...SERVICIO_OK });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: false, razonNoRealizo: "OTRA_PARTE_NO_CONECTO", ...SIN_SESION });
        const deteccion = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        await cruzarEncuestasCita(sol, prisma, { ahora: deteccion });
        const inc = await incidentesDe(sol);
        expect(inc).toHaveLength(1);
        expect(inc[0].pregunta).toBe("SE_REALIZO");
        expect(inc[0].reclamadoEn.getTime()).toBe(deteccion.getTime());
        expect(inc[0].reclamadoEn.getTime()).not.toBe(encPadre.respondidaEn.getTime());
    });

    it("ambos dicen que NO se realizó → CERO incidentes (detalle moot)", async () => {
        const sol = await seedSolicitud();
        // difieren en los sub-valores de no-sesión, pero coinciden en que no se realizó.
        await crearEncuesta(sol, "PADRE", { seRealizo: false, razonNoRealizo: "NO_ME_CONECTE", operador: "NO_HUBO_OPERADOR", inicio: "NO_COMENZO", enlace: "NO_FUNCIONO", duracion: null });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: false, razonNoRealizo: "PROBLEMA_TECNICO", operador: "NO", inicio: "NO_COMENZO", enlace: "CON_PROBLEMAS", duracion: null });
        const { contradicciones } = await cruzarEncuestasCita(sol, prisma);
        expect(contradicciones).toHaveLength(0);
        expect(await incidentesDe(sol)).toHaveLength(0);
    });

    it("idempotente: re-cruzar NO duplica ni resetea el reloj", async () => {
        const sol = await seedSolicitud();
        await crearEncuesta(sol, "PADRE", { seRealizo: true, ...SERVICIO_OK });
        await crearEncuesta(sol, "PROFESIONAL", { seRealizo: true, ...SERVICIO_OK, inicio: "CON_RETRASO" });
        await cruzarEncuestasCita(sol, prisma, { ahora: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
        const primero = await incidentesDe(sol);
        expect(primero).toHaveLength(1);
        // segundo cruce con OTRA detección: no debe duplicar ni mover reclamadoEn/venceEn.
        await cruzarEncuestasCita(sol, prisma, { ahora: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000) });
        const segundo = await incidentesDe(sol);
        expect(segundo).toHaveLength(1);
        expect(segundo[0].reclamadoEn.getTime()).toBe(primero[0].reclamadoEn.getTime());
        expect(segundo[0].venceEn.getTime()).toBe(primero[0].venceEn.getTime());
    });

    it("falta un lado → no-op (el cruce necesita ambas encuestas)", async () => {
        const sol = await seedSolicitud();
        await crearEncuesta(sol, "PADRE", { seRealizo: true, ...SERVICIO_OK });
        const { contradicciones } = await cruzarEncuestasCita(sol, prisma);
        expect(contradicciones).toHaveLength(0);
        expect(await incidentesDe(sol)).toHaveLength(0);
    });
});
