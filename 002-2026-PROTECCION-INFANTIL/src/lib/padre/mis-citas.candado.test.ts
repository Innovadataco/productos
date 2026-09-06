/**
 * SPEC-545 · CANDADO del listado «Mis citas» del padre. Tres garantías:
 *  (1) la RUTA /dashboard/padre/citas existe (que muera si alguien la borra y deja
 *      el item del menú vivo → enlace a 404, justo lo que 545 vino a evitar);
 *  (2) el nav del padre tiene 11 items y «Mis citas» va tras «Encontrar psicólogo»;
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
import { badgeDeCita, grupoDeCita } from "@/lib/padre/citas-listado";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

describe("SPEC-545 · «Mis citas» en el menú y su pantalla", () => {
    it("(1) la ruta /dashboard/padre/citas existe (no es un enlace a 404)", () => {
        const item = PADRE_NAV_ITEMS.find((i) => i.label === "Mis citas");
        expect(item, "falta el item «Mis citas» en el nav").toBeTruthy();
        const rel = item!.href.replace(/^\//, "");
        const page = path.join(SRC, "app", rel, "page.tsx");
        expect(fs.existsSync(page), `falta la pantalla ${item!.href}/page.tsx`).toBe(true);
    });

    it("(2) el nav del padre tiene 11 items y «Mis citas» va tras «Encontrar psicólogo»", () => {
        expect(PADRE_NAV_ITEMS.length).toBe(11);
        const labels = PADRE_NAV_ITEMS.map((i) => i.label);
        const iPsico = labels.indexOf("Encontrar psicólogo");
        const iCitas = labels.indexOf("Mis citas");
        expect(iPsico).toBeGreaterThanOrEqual(0);
        expect(iCitas).toBe(iPsico + 1);
        expect(PADRE_NAV_ITEMS[iCitas]!.href).toBe("/dashboard/padre/citas");
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

    it("(3c) agrupación: confirmada futura→próximas, pasada→pasadas, cumplida→pasadas, reembolsada→canceladas", () => {
        expect(grupoDeCita("CONFIRMADA", true)).toBe("proximas");
        expect(grupoDeCita("CONFIRMADA", false)).toBe("pasadas");
        expect(grupoDeCita("SIN_CONFIRMAR", true)).toBe("proximas");
        expect(grupoDeCita("CUMPLIDA", true)).toBe("pasadas");
        expect(grupoDeCita("REEMBOLSADA", true)).toBe("canceladas");
        expect(grupoDeCita("REPROGRAMADA", true)).toBe("canceladas");
    });
});
