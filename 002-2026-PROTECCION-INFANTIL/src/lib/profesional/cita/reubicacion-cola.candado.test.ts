/**
 * SPEC-814 · CANDADO de la COLA de reubicación. Afirma el TRIGGER y su motivo.
 *
 * SPEC-852 (eliminación de REPS) · el trigger COLAPSÓ a UN solo término:
 *
 *   huérfana(cita) ⟺ ¬habilitado(A)
 *
 * `habilitado` = ACTIVO ∧ verificación INTERNA vigente (Ley 2375, documentos). Antes había un segundo
 * término REPS (`esRepsElegibleParaModalidad`) con su propio motivo; al eliminarse REPS queda SOLO la
 * verificación interna y, por tanto, UN solo motivo: `PANEL_BLOQUEADO` (el profesional no puede entrar a
 * su panel → reubicar es la única salida).
 *
 * Control positivo PAREADO sobre el único término: un pro ¬habilitado ENTRA (PANEL_BLOQUEADO); un pro
 * habilitado NO entra (sigue pudiendo atender). Más la minimización (el relato de la familia no sale) y
 * el orden por urgencia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { EstadoPerfilProfesional, EstadoSolicitudCita, ModalidadCita } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { citasPorReubicar } from "./reubicacion-cola";

const DIA = 24 * 60 * 60 * 1000;
let bogotaId: string;

async function seedPro(opts: {
    estado?: EstadoPerfilProfesional;
    internaVigente?: boolean; // verificación INTERNA (Ley 2375) — define `habilitado`. default true
    especialidades?: string[];
    nombre?: string;
}) {
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: opts.nombre ?? "Prof. Saliente",
            tituloProfesional: "Psicólogo clínico",
            especialidades: opts.especialidades ?? ["TRAUMA"],
            ciudadId: bogotaId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Acompaña procesos con niñas, niños y adolescentes.",
            tarifaConsultaCOP: 100_000,
            duracionMinutos: 50,
            estado: opts.estado ?? "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 2 * DIA),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `a-${perfil.id}`,
            venceEn: opts.internaVigente === false ? new Date(Date.now() - DIA) : new Date(Date.now() + 90 * DIA),
        },
    });
    return perfil;
}

async function seedCita(
    profesionalId: string,
    opts: {
        estado?: EstadoSolicitudCita;
        modalidad?: ModalidadCita;
        inicio?: Date;
        presentacion?: string;
        padreEmail?: string;
    } = {},
) {
    const inicio = opts.inicio ?? new Date(Date.now() + 3 * DIA);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    const padre = await crearUsuario("PARENT", opts.padreEmail);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin, modalidad: opts.modalidad ?? "VIRTUAL", tomada: true },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId,
            franjaId: franja.id,
            presentacion: opts.presentacion ?? "Contexto mínimo para el schema.",
            urgencia: "SIN_APURO",
            estado: opts.estado ?? "CONFIRMADA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            montoConsulta: 100_000,
            montoServicio: 15_000,
            montoTotal: 115_000,
            porcentajeServicio: 15,
        },
    });
}

const refs = (cola: { citaRef: string }[]) => cola.map((c) => c.citaRef);

describe("SPEC-814/852 · cola de reubicación · trigger de un término (verificación interna) + PANEL_BLOQUEADO", { timeout: 40_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        bogotaId = (await crearPaisCiudad()).ciudad.id;
    });

    it("PANEL: ¬habilitado (SUSPENDIDO) entra, con motivo PANEL_BLOQUEADO", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO" });
        const cita = await seedCita(pro.id);
        const [fila] = await citasPorReubicar();
        expect(fila.citaRef).toBe(cita.id.slice(0, 8));
        expect(fila.deQuienSale.motivoCodigo).toBe("PANEL_BLOQUEADO");
    });

    it("PANEL: ACTIVO con verificación interna VENCIDA entra (¬habilitado por la fuente, no por el estado)", async () => {
        const pro = await seedPro({ estado: "ACTIVO", internaVigente: false });
        const cita = await seedCita(pro.id);
        const [fila] = await citasPorReubicar();
        expect(fila.citaRef).toBe(cita.id.slice(0, 8));
        expect(fila.deQuienSale.motivoCodigo).toBe("PANEL_BLOQUEADO");
    });

    it("CONTROL POSITIVO: habilitado (ACTIVO + verificación interna vigente) → NO entra", async () => {
        const ok = await seedPro({ estado: "ACTIVO", internaVigente: true, nombre: "Al día" });
        const citaOk = await seedCita(ok.id, { modalidad: "VIRTUAL" });
        expect(refs(await citasPorReubicar())).not.toContain(citaOk.id.slice(0, 8));
    });

    it("solo CONFIRMADA: una cita en otro estado de un no habilitado NO entra", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO" });
        const cumplida = await seedCita(pro.id, { estado: "CUMPLIDA" });
        const confirmada = await seedCita(pro.id, { estado: "CONFIRMADA" });
        const r = refs(await citasPorReubicar());
        expect(r).not.toContain(cumplida.id.slice(0, 8));
        expect(r).toContain(confirmada.id.slice(0, 8));
    });

    it("MINIMIZACIÓN: el DTO no trae el relato de la familia ni su PII", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO" });
        await seedCita(pro.id, {
            presentacion: "RELATO-SECRETO-DE-LA-FAMILIA que jamás debe salir",
            padreEmail: "padre-secreto-pii@example.com",
        });
        const blob = JSON.stringify(await citasPorReubicar());
        expect(blob).not.toContain("RELATO-SECRETO-DE-LA-FAMILIA");
        expect(blob).not.toContain("padre-secreto-pii@example.com");
    });

    it("de quién sale: nombre + especialidades de A (base del calce); el motivo es un código, no «inhabilitado»", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO", especialidades: ["TRAUMA", "DUELO"], nombre: "Dra. Ejemplo" });
        await seedCita(pro.id);
        const [fila] = await citasPorReubicar();
        expect(fila.deQuienSale.nombre).toBe("Dra. Ejemplo");
        expect(fila.deQuienSale.especialidades).toEqual(["TRAUMA", "DUELO"]);
        expect(fila.deQuienSale.motivoCodigo).not.toMatch(/inhabilitad|sancionad/i);
    });

    it("ciudad: PRESENCIAL muestra la ciudad de A; VIRTUAL la deja en null", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO" });
        await seedCita(pro.id, { modalidad: "PRESENCIAL", inicio: new Date(Date.now() + 2 * DIA) });
        await seedCita(pro.id, { modalidad: "VIRTUAL", inicio: new Date(Date.now() + 9 * DIA) });
        const cola = await citasPorReubicar();
        expect(cola.find((c) => c.cita.modalidad === "PRESENCIAL")!.cita.ciudad).toBe("Bogotá");
        expect(cola.find((c) => c.cita.modalidad === "VIRTUAL")!.cita.ciudad).toBeNull();
    });

    it("orden por URGENCIA: la franja más próxima primero", async () => {
        const pro = await seedPro({ estado: "SUSPENDIDO" });
        await seedCita(pro.id, { inicio: new Date(Date.now() + 10 * DIA) });
        await seedCita(pro.id, { inicio: new Date(Date.now() + 1 * DIA) });
        const cola = await citasPorReubicar();
        expect(cola).toHaveLength(2);
        expect(cola[0].cita.inicio.getTime()).toBeLessThan(cola[1].cita.inicio.getTime());
    });
});
