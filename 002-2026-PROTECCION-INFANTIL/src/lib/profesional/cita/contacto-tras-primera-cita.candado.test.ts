/**
 * CANDADO · SPEC-940 (I-452) — reapertura UNIDIRECCIONAL del contacto tras la 1.ª cita consumida.
 *
 * Reversión 🔴 de lo que SPEC-754 cerró (H-2 · Ley 2375/2024). Con la fuente REAL (sin mock), por el DTO:
 *   (1) El padre VE el contacto del profesional SOLO en {CONFIRMADA, CUMPLIDA, NO_ASISTIO_PADRE}; en los OTROS 6
 *       estados NO (sin cita confirmada / no consumida / falla del profesional / reubicada).
 *   (2) UNIDIRECCIONAL: en los 9 estados, el profesional NUNCA recibe el correo del padre (toCitaParaProfesional).
 *   (3) Override legal: perfil VENCIDO o SUSPENDIDO cierra el contacto AUNQUE la cita esté CONFIRMADA.
 *   (4) INVARIANTE «visible ⟺ bloqueado»: el set que revela el contacto ES el que bloquea la 2.ª cita por PI
 *       (misma constante `ESTADOS_PRIMERA_CITA_CONSUMIDA`, usada por el repo y por la fuente de contacto).
 *   (5) Control POSITIVO: el correo REAL del profesional se plantó y SÍ aparece en el estado que abre.
 *
 * Unit puro (DTO + fuente real, sin BD). En `vitest.unit.includes.ts`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { EstadoSolicitudCita, PerfilProfesional } from "@prisma/client";
import { toCitaParaPadre, toCitaParaProfesional } from "./dto";
import { ESTADOS_PRIMERA_CITA_CONSUMIDA } from "./segunda-cita";

const AHORA = new Date("2026-11-19T12:00:00Z");
const CORREO_PROFESIONAL = "pro-real@correo.local";
const CORREO_PADRE = "padre-real@correo.local";

const TODOS_LOS_ESTADOS: EstadoSolicitudCita[] = [
    "PAGADA_PENDIENTE", "CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE", "NO_ASISTIO_PROFESIONAL",
    "VENCIDA_SIN_RESPUESTA", "REEMBOLSADA", "SIN_CONFIRMAR", "REPROGRAMADA",
];

function solPadre(estado: EstadoSolicitudCita, estadoPerfil: PerfilProfesional["estado"] = "ACTIVO") {
    return {
        id: "sol-1", padreUsuarioId: "padre-1", profesionalId: "pro-1", franjaId: "fr-1",
        presentacion: "Necesito ayuda con mi hijo.", urgencia: "SIN_APURO", estado, pagoAprobadoEn: AHORA,
        expedienteCompartidoId: null, solicitudPreviaId: null, pagoHeredadoDeId: null,
        montoConsulta: 50000, montoServicio: 5000, montoTotal: 55000, porcentajeServicio: 10,
        venceEn: AHORA, creadoEn: AHORA, actualizadoEn: AHORA,
        profesional: {
            id: "pro-1", nombreVisible: "Dra. Test", tituloProfesional: "Psicóloga", estado: estadoPerfil,
            ciudad: { id: "c1", nombre: "Bogotá" },
            usuario: { email: CORREO_PROFESIONAL, telefono: "+573000000000" },
        },
        franja: { inicio: AHORA, fin: AHORA, modalidad: "VIRTUAL" },
    } as never;
}
function solProfesional(estado: EstadoSolicitudCita) {
    return {
        id: "sol-1", estado, urgencia: "SIN_APURO", creadoEn: AHORA, pagoAprobadoEn: AHORA,
        presentacion: "Hola.", expedienteCompartidoId: null, montoConsulta: 50000,
        padreUsuario: { id: "padre-1", nombre: "Familia", email: CORREO_PADRE },
        franja: { inicio: AHORA, fin: AHORA, modalidad: "VIRTUAL" },
    } as never;
}

describe("SPEC-940 · contacto tras la 1.ª cita (unidireccional)", () => {
    it("(1)+(5) el padre ve el contacto del profesional SOLO en el set consumido", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            const dto = toCitaParaPadre(solPadre(estado), AHORA);
            if (ESTADOS_PRIMERA_CITA_CONSUMIDA.includes(estado)) {
                expect(dto.contactoProfesional?.email, `${estado}: debería ABRIR`).toBe(CORREO_PROFESIONAL);
            } else {
                expect(dto.contactoProfesional, `${estado}: debería CERRAR`).toBeUndefined();
            }
        }
    });

    it("(2) UNIDIRECCIONAL: el profesional NUNCA recibe el correo del padre, en ningún estado", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            const dto = toCitaParaProfesional(solProfesional(estado), AHORA);
            expect(dto.padre.email, `${estado}: el profesional NO debe ver el correo del padre`).toBeUndefined();
        }
    });

    it("(3) override legal: perfil VENCIDO/SUSPENDIDO cierra aunque la cita esté CONFIRMADA", () => {
        for (const perfil of ["VENCIDO", "SUSPENDIDO"] as const) {
            const dto = toCitaParaPadre(solPadre("CONFIRMADA", perfil), AHORA);
            expect(dto.contactoProfesional, `perfil ${perfil}: sin contacto`).toBeUndefined();
        }
    });

    it("(4) invariante «visible ⟺ bloqueado»: el repo bloquea la 2.ª cita con EL MISMO set", () => {
        const repo = fs.readFileSync(path.resolve(__dirname, "../../dal/repositories/solicitud-cita.ts"), "utf-8");
        expect(repo).toMatch(/estado:\s*\{\s*in:\s*ESTADOS_PRIMERA_CITA_CONSUMIDA\s*\}/);
        // la fuente de contacto usa la MISMA constante (vía primeraCitaConsumida).
        const gate = fs.readFileSync(path.resolve(__dirname, "contacto-visible.ts"), "utf-8");
        expect(gate).toMatch(/return primeraCitaConsumida\(estado\)/);
    });
});
