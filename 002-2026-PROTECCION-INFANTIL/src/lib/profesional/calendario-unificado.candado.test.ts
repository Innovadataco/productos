/**
 * SPEC-732 · CANDADO — «Calendario» y «Citaciones» del profesional son UNA sola
 * entrada y UNA sola pantalla. El profesional publica franjas Y responde solicitudes
 * en el mismo calendario; la ruta vieja `/citaciones` redirige (no 404, SPEC-723).
 *
 * Verificado por conducta (import del menú real + fuente de páginas/APIs):
 *  1. El menú del profesional NO tiene «Citaciones» y lleva al calendario por UNA entrada.
 *  2. `/dashboard/profesional/citaciones` REDIRIGE a `/calendario` (no rinde, no 404).
 *  3. La única pantalla publica (`POST /api/profesional/franjas`) Y responde
 *     (`/api/profesional/solicitudes/…/{confirmar|rechazar}`) — sin cambiar de lugar.
 *  4. Control positivo: responder lo gatea el módulo del calendario
 *     (`profesional_calendario`), no un `profesional_citaciones` aparte.
 *
 * Mutación: devolver el ítem «Citaciones» al menú → cae (1); volver el page.tsx a
 * montar el componente en vez de redirigir → cae (2); mover el guard de responder a
 * otro módulo → cae (4).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROFESIONAL_NAV_ITEMS } from "@/lib/nav-items";

const RAIZ = path.resolve(__dirname, "../../..");
const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf-8");

describe("SPEC-732 · un solo «Calendario» (publicar + responder), sin «Citaciones» aparte", () => {
    it("(1) el menú del profesional no tiene «Citaciones» y lleva al calendario por UNA entrada", () => {
        const aCitaciones = PROFESIONAL_NAV_ITEMS.filter((i) => i.href.includes("/citaciones"));
        expect(aCitaciones, "«Citaciones» debe salir del menú (se unificó en «Calendario»)").toEqual([]);
        const aCalendario = PROFESIONAL_NAV_ITEMS.filter((i) => i.href === "/dashboard/profesional/calendario");
        expect(aCalendario.length, "una sola entrada al calendario").toBe(1);
        expect(PROFESIONAL_NAV_ITEMS.some((i) => i.label === "Citaciones")).toBe(false);
    });

    it("(2) la ruta vieja /citaciones REDIRIGE a /calendario (no 404, no monta pantalla)", () => {
        const src = leer("src/app/dashboard/profesional/citaciones/page.tsx");
        expect(/redirect\(\s*["']\/dashboard\/profesional\/calendario["']\s*\)/.test(src)).toBe(true);
        // No vuelve a montar el calendario en esta ruta (sería dos pantallas otra vez).
        expect(src.includes("<CalendarioProfesional")).toBe(false);
    });

    it("(3) la única pantalla publica franjas Y responde solicitudes, sin cambiar de lugar", () => {
        const cal = leer("src/components/modules/profesional/CalendarioProfesional.tsx");
        expect(cal.includes("/api/profesional/franjas"), "publica franjas").toBe(true);
        expect(/\/api\/profesional\/solicitudes\//.test(cal), "responde solicitudes").toBe(true);
        // Ya no hay un prop `modo` que parta la pantalla en dos experiencias.
        expect(/modo\s*[?:]/.test(cal)).toBe(false);
    });

    it("(4) control positivo: responder lo gatea el módulo del calendario, no uno aparte", () => {
        for (const ruta of [
            "src/app/api/profesional/solicitudes/[id]/confirmar/route.ts",
            "src/app/api/profesional/solicitudes/[id]/rechazar/route.ts",
            "src/app/api/profesional/solicitudes/route.ts",
        ]) {
            const src = leer(ruta);
            expect(src.includes('assertModulo(user, "profesional_calendario")'), `${ruta} gatea por el calendario`).toBe(true);
            expect(src.includes("profesional_citaciones"), `${ruta} ya no gatea por citaciones`).toBe(false);
        }
    });
});
