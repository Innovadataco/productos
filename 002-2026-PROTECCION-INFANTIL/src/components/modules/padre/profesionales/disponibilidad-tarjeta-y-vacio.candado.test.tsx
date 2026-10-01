/**
 * CANDADO · SPEC-818 (FORMA-DISPONIBILIDAD) · el chip de la tarjeta distingue sin clic, SIN atenuar al
 * profesional sin horarios, SIN rubí y SIN prometer cuándo; y el vacío del panel dice la salida, nunca deja
 * «inactivo». Un profesional sin turnos SIGUE en el directorio: esconderlo/atenuarlo se leería «no sirve».
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ProfesionalTarjeta } from "./ProfesionalTarjeta";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

function dto(over: Partial<PerfilPublicoDTO> = {}): PerfilPublicoDTO {
    return {
        id: "p1", nombreVisible: "Dra. Prueba", fotoUrl: null, tituloProfesional: "Psicología",
        especialidades: ["Ansiedad"], rangoEtario: [], ciudadId: "c1", atiendeVirtual: true, atiendePresencial: false,
        aniosExperiencia: 5, presentacion: "", tarifaConsultaCOP: 120000, duracionMinutos: 45, emiteFactura: false,
        ciudad: { id: "c1", nombre: "Bogotá", pais: "Colombia" }, tieneHorariosDisponibles: true, ...over,
    };
}
const card = (p: PerfilPublicoDTO) => <ProfesionalTarjeta p={p} hrefBase="/x" queryString="" precioPrimeraCitaCOP={100000} />;

const RUTA_PANEL = path.resolve(__dirname, "SolicitarCitaPanel.tsx");
/** Aísla el bloque del estado VACÍO para escanear SU copy (y no el resto del panel, que sí tiene fechas). */
function bloqueVacio(): string {
    const src = readFileSync(RUTA_PANEL, "utf8");
    const m = src.match(/franjas\.length === 0 && \(([\s\S]*?)\)\}/);
    if (!m) throw new Error("no se encontró el bloque del estado vacío en SolicitarCitaPanel");
    return m[1];
}

afterEach(() => cleanup());

describe("SPEC-818 · chip de disponibilidad + vacío con salida", () => {
    it("con horarios → chip pino «Con horarios disponibles»", () => {
        render(card(dto({ tieneHorariosDisponibles: true })));
        expect(screen.getByText(/Con horarios disponibles/i)).toBeTruthy();
    });

    it("sin horarios → chip neutro «Sin horarios disponibles ahora», NUNCA rubí, y la tarjeta NO se atenúa", () => {
        // La tarjeta sin horarios es idéntica salvo el chip: el root NO cambia (atenuarla se leería «no sirve»).
        const { container: conH } = render(card(dto({ tieneHorariosDisponibles: true })));
        const rootConHorarios = conH.querySelector("a")!.className;
        cleanup();
        const { container: sinH } = render(card(dto({ tieneHorariosDisponibles: false })));
        expect(screen.getByText(/Sin horarios disponibles ahora/i)).toBeTruthy();
        expect(sinH.querySelector("a")!.className, "la tarjeta sin horarios NO se atenúa: mismo root").toBe(rootConHorarios);
        expect(sinH.innerHTML, "sin horarios NO es criticidad: cero rubí").not.toMatch(/\brubi\b/);
        expect(sinH.innerHTML, "sin horarios NO es alarma: cero ámbar-alarma en el chip").not.toMatch(/estado-ambar/);
        // La tarjeta conserva el resto (no degradada): nombre + «Nuevo en la red».
        expect(screen.getByText("Dra. Prueba")).toBeTruthy();
        expect(screen.getByText(/Nuevo en la red/i)).toBeTruthy();
    });

    it("no-promesa: la tarjeta sin horarios NO promete cuándo (pronto / día / te avisamos / vuelve)", () => {
        const { container } = render(card(dto({ tieneHorariosDisponibles: false })));
        const txt = container.textContent ?? "";
        for (const f of [/pronto/i, /te avisamos/i, /vuelve a (revisar|mirar)/i, /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i]) {
            expect(txt, `la tarjeta no promete cuándo (${f})`).not.toMatch(f);
        }
    });

    it("el VACÍO del panel: dice la SALIDA, sigue en el directorio, y NUNCA «inactivo» ni promesa de cuándo", () => {
        const vacio = bloqueVacio();
        expect(vacio, "salida accionable").toMatch(/elegir otro profesional/i);
        expect(vacio, "válido y presente, no inactivo").toMatch(/Sigue en el directorio/i);
        expect(vacio, "no «inactivo/no atiende/no disponible»").not.toMatch(/inactiv|no atiende|no disponible/i);
        for (const f of [/pronto/i, /te avisamos/i, /vuelve a (revisar|mirar)/i, /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i]) {
            expect(vacio, `el vacío no promete cuándo (${f})`).not.toMatch(f);
        }
    });
});
