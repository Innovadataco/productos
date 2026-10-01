/**
 * SPEC-545 · CANDADO del listado «Mis citas» del padre. Tres garantías:
 *  (1) la RUTA /dashboard/padre/citas existe (que muera si alguien la borra y deja
 *      el item del menú vivo → enlace a 404, justo lo que 545 vino a evitar);
 *  (2) el nav del padre tiene 6 entradas (SPEC-607) y «Mis citas» va tras
 *      «Encontrar psicólogo» dentro del grupo «Ayuda profesional»;
 *  (3) el mapeo estado→token: cada EstadoSolicitudCita tiene badge y NINGÚN estado
 *      cae en rubí (una cita es proceso, no criticidad) — mutación en las dos
 *      direcciones (pintar un estado de rubí → rojo; quitar un estado → rojo).
 *
 * No usa BD: cae en el shard de integración por el glob src/** (no toca
 * vitest.unit.includes.ts, así no choca con otros PRs — patrón que evita el cuello).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { EstadoSolicitudCita } from "@prisma/client";
import { PADRE_NAV_ITEMS } from "@/lib/nav-items";
import { badgeDeCita, badgeDeCitaEfectivo } from "@/lib/padre/citas-listado";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

describe("SPEC-545 · «Mis citas» en el menú y su pantalla", () => {
    it("(1) la ruta /dashboard/padre/citas existe (no es un enlace a 404)", () => {
        // SPEC-607: «Mis citas» vive dentro del grupo «Ayuda profesional».
        const item = PADRE_NAV_ITEMS.flatMap((i) => i.children ?? [i]).find((i) => i.label === "Mis citas");
        expect(item, "falta el item «Mis citas» en el nav").toBeTruthy();
        const rel = item!.href.replace(/^\//, "");
        const page = path.join(SRC, "app", rel, "page.tsx");
        expect(fs.existsSync(page), `falta la pantalla ${item!.href}/page.tsx`).toBe(true);
    });

    it("(2) el nav del padre son ESTAS entradas (lista, no conteo) y «Mis citas» va tras «Encontrar psicólogo» (SPEC-607/824)", () => {
        // SPEC-824 (contrato-RETIRADO del conteo pelado): «Pedir ayuda» entró como 7ª entrada. En vez de subir
        // 6→7 —un número que se sube y deja de proteger—, se afirma la LISTA de etiquetas top-level en orden:
        // así una entrada nueva (de más o fuera de lugar) aparece en el diff del candado y hay que justificarla.
        expect(PADRE_NAV_ITEMS.map((i) => i.label)).toEqual([
            "Inicio",
            "A quién protejo",
            "A quién vigilo",
            "Reportar",
            "Ayuda profesional",
            "Mi perfil",
            "Pedir ayuda",
        ]);
        const ayuda = PADRE_NAV_ITEMS.find((i) => i.label === "Ayuda profesional");
        expect(ayuda?.children, "«Ayuda profesional» debe ser un grupo con hijos").toBeTruthy();
        const labels = ayuda!.children!.map((i) => i.label);
        const iPsico = labels.indexOf("Encontrar psicólogo");
        const iCitas = labels.indexOf("Mis citas");
        expect(iPsico).toBeGreaterThanOrEqual(0);
        expect(iCitas).toBe(iPsico + 1);
        expect(ayuda!.children![iCitas]!.href).toBe("/dashboard/padre/citas");
    });

    it("(3) todo estado tiene badge y NINGUNO cae en rubí (cita = proceso)", () => {
        for (const estado of Object.values(EstadoSolicitudCita)) {
            const b = badgeDeCita(estado);
            expect(b.label, `estado sin etiqueta: ${estado}`).toBeTruthy();
            expect(b.clases, `estado sin clases: ${estado}`).toBeTruthy();
            expect(b.clases.includes("rubi"), `${estado} no puede ir en rubí`).toBe(false);
        }
    });

    it("(3b) los tokens de proceso son los que fijó Diseño", () => {
        expect(badgeDeCita("CONFIRMADA").clases).toContain("cielo");
        expect(badgeDeCita("SIN_CONFIRMAR").clases).toContain("ambar");
        expect(badgeDeCita("PAGADA_PENDIENTE").clases).toContain("ambar");
        expect(badgeDeCita("CUMPLIDA").clases).toContain("pino");
        expect(badgeDeCita("REEMBOLSADA").clases).toContain("tinta");
    });
});

describe("SPEC-749 FR-2 · badgeDeCitaEfectivo (la lista deriva la verdad temporal)", () => {
    const HORA = 60 * 60 * 1000;
    const INICIO = Date.parse("2026-09-28T14:00:00.000Z");
    const FIN = INICIO + HORA;
    const AHORA = Date.parse("2026-09-29T18:00:00.000Z"); // > FIN → franja pasada
    const FUT_INI = AHORA + 24 * HORA;

    it("CONFIRMADA con franja pasada NO es «Confirmada» cielo → «Ya pasó» tinta neutro", () => {
        const b = badgeDeCitaEfectivo("CONFIRMADA", INICIO, FIN, AHORA);
        expect(b.label).toBe("Ya pasó");
        expect(b.clases).toContain("tinta"); // neutro, NO cielo (el verde miente en la lista)
        expect(b.clases).not.toContain("cielo");
    });

    it("control positivo (otra dirección): CONFIRMADA FUTURA sigue «Confirmada» cielo", () => {
        const b = badgeDeCitaEfectivo("CONFIRMADA", FUT_INI, FUT_INI + HORA, AHORA);
        expect(b.label).toBe("Confirmada");
        expect(b.clases).toContain("cielo");
    });

    it("otros estados delegan en badgeDeCita (su reloj no es la franja)", () => {
        expect(badgeDeCitaEfectivo("PAGADA_PENDIENTE", INICIO, FIN, AHORA)).toEqual(badgeDeCita("PAGADA_PENDIENTE"));
        expect(badgeDeCitaEfectivo("CUMPLIDA", INICIO, FIN, AHORA)).toEqual(badgeDeCita("CUMPLIDA"));
    });

    it("fallo conservador (FR-4): CONFIRMADA con franja basura → «Ya pasó»", () => {
        expect(badgeDeCitaEfectivo("CONFIRMADA", null, "basura", AHORA).label).toBe("Ya pasó");
    });
});
