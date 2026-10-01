/**
 * CANDADO · SPEC-816 (NO-PROMESA · el candado del radicado) · el directorio MUESTRA el rango etario
 * declarado, pero el copy NUNCA afirma que el sistema FILTRA por edad. Es el defecto que 816 cierra: el
 * sistema NO puede filtrar (la cita no se liga al menor — minimización SPEC-750, [NORMA] Ley 1581), así que
 * decir «solo verás profesionales que atienden la edad de tu hijo» sería FALSO. Con dato real: «Edades que
 * atiende: {bandas}» + (detalle) la ayuda «tú revisas»; en el vacío, «sin indicar»/«no indicó», NUNCA mudo
 * (se leería «atiende a todos») ni «todas las edades».
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ProfesionalTarjeta } from "./ProfesionalTarjeta";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

/** Frases que AFIRMARÍAN filtrado por edad — prohibidas en el copy del directorio (FORMA §Candado). */
const FRASES_PROHIBIDAS = [
    /solo verás/i,
    /según la edad de tu hijo/i,
    /filtrad[oa]s? por edad/i,
    /filtrar por edad/i,
    /todas las edades/i,
    /atiende a todos/i,
];

function dto(over: Partial<PerfilPublicoDTO> = {}): PerfilPublicoDTO {
    return {
        id: "p1",
        nombreVisible: "Dra. Prueba",
        fotoUrl: null,
        tituloProfesional: "Psicología",
        especialidades: ["Ansiedad"],
        rangoEtario: ["Niñez (6-11)", "Adolescencia (12-17)"],
        ciudadId: "c1",
        atiendeVirtual: true,
        atiendePresencial: false,
        aniosExperiencia: 5,
        presentacion: "",
        tarifaConsultaCOP: 120000,
        duracionMinutos: 45,
        emiteFactura: false,
        ciudad: { id: "c1", nombre: "Bogotá", pais: "Colombia" },
        ...over,
    };
}

/** Quita comentarios para escanear SOLO el copy visible (no la prosa que explica la decisión). */
function copyVisible(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");
}

const DIR = path.resolve(__dirname);
const FUENTES_DIRECTORIO = ["ProfesionalTarjeta.tsx", "ProfesionalPerfil.tsx", "DirectorioProfesionales.tsx"];

afterEach(() => cleanup());

describe("SPEC-816 · no-promesa · el directorio MUESTRA el rango, nunca afirma que filtra", () => {
    it("card con rango real: «Edades que atiende: {bandas}» descriptivo, sin frase de filtrado", () => {
        const { container } = render(
            <ProfesionalTarjeta p={dto()} hrefBase="/x" queryString="" precioPrimeraCitaCOP={100000} />,
        );
        expect(screen.getByText(/Edades que atiende:/i)).toBeTruthy();
        expect(screen.getByText(/Niñez \(6-11\)/)).toBeTruthy();
        const txt = container.textContent ?? "";
        for (const f of FRASES_PROHIBIDAS) expect(txt, `la card no puede afirmar filtrado (${f})`).not.toMatch(f);
    });

    it("card VACÍA: «sin indicar»; nunca muda ni «todas las edades»/«atiende a todos»", () => {
        const { container } = render(
            <ProfesionalTarjeta p={dto({ rangoEtario: [] })} hrefBase="/x" queryString="" precioPrimeraCitaCOP={100000} />,
        );
        expect(screen.getByText(/Edades que atiende:\s*sin indicar/i)).toBeTruthy();
        const txt = container.textContent ?? "";
        expect(txt, "el vacío no puede leerse «atiende a todos»").not.toMatch(/todas las edades/i);
        expect(txt).not.toMatch(/atiende a todos/i);
    });

    it("el COPY VISIBLE de los componentes del directorio NO contiene ninguna frase de filtrado", () => {
        for (const f of FUENTES_DIRECTORIO) {
            const copy = copyVisible(readFileSync(path.join(DIR, f), "utf8"));
            for (const frase of FRASES_PROHIBIDAS) {
                expect(copy, `${f}: el copy no puede afirmar filtrado (${frase})`).not.toMatch(frase);
            }
        }
    });

    it("el detalle pone la elección en el padre (voz tú), sin una palabra de filtrado", () => {
        const copy = copyVisible(readFileSync(path.join(DIR, "ProfesionalPerfil.tsx"), "utf8"));
        expect(copy).toMatch(/Tú conoces la edad de tu hijo/);
        expect(copy).toMatch(/Edades que atiende/);
    });

    it("control positivo: una frase de filtrado inyectada en el copy se CAZA", () => {
        const copy = copyVisible(readFileSync(path.join(DIR, "ProfesionalPerfil.tsx"), "utf8"));
        const mutado = copy.replace("Edades que atiende", "Solo verás profesionales filtrados por edad según la edad de tu hijo");
        expect(mutado, "la mutación debía aplicar sobre el copy real").not.toBe(copy);
        expect(FRASES_PROHIBIDAS.some((f) => f.test(mutado)), "el escáner debe cazar la frase de filtrado inyectada").toBe(true);
    });
});
