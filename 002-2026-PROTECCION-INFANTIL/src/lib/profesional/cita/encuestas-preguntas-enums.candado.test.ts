/**
 * SPEC-753 · CANDADO de PARIDAD: las `key` cerradas de la encuesta (copy, sin @prisma)
 * son EXACTAMENTE los miembros de los enums de Prisma que persiste el service. Si alguien
 * agrega una opción sin su miembro de enum (o al revés), o renombra un valor, ROJO — el
 * service guardaría/ compararía un valor que la BD no reconoce. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    OperadorConvoco,
    InicioSesion,
    EnlaceFunciono,
    DuracionSesion,
    RazonNoSesion,
    PreguntaEncuesta,
} from "@prisma/client";
import {
    PREGUNTAS_SERVICIO,
    RAZONES_NO_REALIZO,
    opcionesValidas,
    type ClavePregunta,
} from "@/lib/profesional/cita/encuestas-preguntas";

const mismoConjunto = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && new Set([...a, ...b]).size === new Set(a).size && new Set(a).size === a.length;

describe("SPEC-753 · paridad claves de la encuesta ↔ enums de Prisma", () => {
    it("las 5 ClavePregunta = los miembros de PreguntaEncuesta", () => {
        const claves = PREGUNTAS_SERVICIO.map((p) => p.pregunta);
        expect(mismoConjunto(claves, Object.values(PreguntaEncuesta)), `${claves} vs ${Object.values(PreguntaEncuesta)}`).toBe(true);
    });

    it.each([
        ["OPERADOR", Object.values(OperadorConvoco)],
        ["INICIO", Object.values(InicioSesion)],
        ["ENLACE", Object.values(EnlaceFunciono)],
        ["DURACION", Object.values(DuracionSesion)],
    ] as const)("las opciones de %s = los miembros de su enum", (pregunta, miembros) => {
        const keys = opcionesValidas(pregunta as ClavePregunta);
        expect(mismoConjunto(keys, miembros), `${pregunta}: ${keys} vs ${miembros}`).toBe(true);
    });

    it("SE_REALIZO es booleano: sus opciones son exactamente SI/NO (no un enum)", () => {
        expect(mismoConjunto(opcionesValidas("SE_REALIZO"), ["SI", "NO"])).toBe(true);
    });

    it("las razones del «no se realizó» = los miembros de RazonNoSesion", () => {
        const keys = RAZONES_NO_REALIZO.map((o) => o.key);
        expect(mismoConjunto(keys, Object.values(RazonNoSesion)), `${keys} vs ${Object.values(RazonNoSesion)}`).toBe(true);
    });
});
