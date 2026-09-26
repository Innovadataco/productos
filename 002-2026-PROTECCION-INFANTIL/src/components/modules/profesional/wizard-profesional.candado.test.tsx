/**
 * CANDADO · SPEC-740 (FORMA-SPEC740 · Jelkin en vivo) · el registro del profesional es un
 * asistente de 3 pasos, ESPEJO visual del `/camino` del padre, con guardar-por-paso.
 *
 * Conductas (render real + control positivo):
 *  1. `pasos-profesional`: 3 pasos EN ORDEN (Ficha → Documentos → Autorización), «de 3».
 *  2. El shell pinta «Paso N de 3» + barra de progreso segmentada + salida sin encierro; «Atrás»
 *     aparece en pasos 2 y 3 y NO en el 1 (como el /camino del padre).
 *  3. La TARIFA no aparece en NINGÚN paso del registro (control positivo: SÍ está en el editor del
 *     habilitado `MiPerfilProfesionalClient`, así el detector no da un falso verde).
 *  4. El bug-killer (guardar-por-paso al avanzar) lo cubre `cierre-ficha-spec706`; acá se fija el
 *     contrato de pasos y el espejo visual.
 * Voz: usted (el shell del profesional no copia el «tú» del padre).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import {
    PASOS_PROFESIONAL,
    TOTAL_PASOS_PROFESIONAL,
    pasoAnteriorProfesional,
    pasoSiguienteProfesional,
} from "@/lib/camino/pasos-profesional";

// El shell usa usePathname (para el paso), useRouter (Atrás/salir) y useAuth (logout).
let rutaActual = "/perfil-profesional/completar";
vi.mock("next/navigation", () => ({
    usePathname: () => rutaActual,
    useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { WizardProfesionalShell } from "./WizardProfesionalShell";

const RAIZ = path.resolve(__dirname, "../../../.."); // .../profesional → modules → components → src → raíz
// Sin comentarios: un comentario que MENCIONA la tarifa (para decir que NO va acá) no es un campo.
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const leer = (rel: string) => sinComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf-8"));

afterEach(() => cleanup());

describe("SPEC-740 · asistente de registro del profesional (espejo del /camino)", () => {
    it("pasos-profesional: 3 pasos EN ORDEN (Ficha → Documentos → Autorización)", () => {
        expect(TOTAL_PASOS_PROFESIONAL).toBe(3);
        expect([...PASOS_PROFESIONAL]).toEqual(["ficha", "documentos", "autorizacion"]);
        expect(pasoAnteriorProfesional("ficha")).toBeNull();
        expect(pasoAnteriorProfesional("documentos")).toBe("ficha");
        expect(pasoSiguienteProfesional("documentos")).toBe("autorizacion");
        expect(pasoSiguienteProfesional("autorizacion")).toBeNull();
    });

    it("paso 1 (Ficha): «Paso 1 de 3», salida sin encierro, y SIN «Atrás»", () => {
        rutaActual = "/perfil-profesional/completar";
        render(<WizardProfesionalShell><div>contenido</div></WizardProfesionalShell>);
        expect(screen.getByText(/Paso 1 de 3 · Su ficha/)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Salir y seguir después/ })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Atrás/ })).toBeNull();
    });

    it("paso 2 (Documentos): «Paso 2 de 3» + «Atrás» (como el /camino en pasos 2-4)", () => {
        rutaActual = "/perfil-profesional/documentos";
        render(<WizardProfesionalShell><div>contenido</div></WizardProfesionalShell>);
        expect(screen.getByText(/Paso 2 de 3 · Sus documentos/)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Atrás/ })).toBeTruthy();
    });

    it("paso 3 (Autorización): «Paso 3 de 3» + «Atrás»", () => {
        rutaActual = "/perfil-profesional/autorizacion";
        render(<WizardProfesionalShell><div>contenido</div></WizardProfesionalShell>);
        expect(screen.getByText(/Paso 3 de 3 · Autorización/)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Atrás/ })).toBeTruthy();
    });

    it("la TARIFA no aparece en ningún paso del registro (control positivo con el editor del habilitado)", () => {
        const pasos = [
            "src/app/perfil-profesional/completar/page.tsx",
            "src/app/perfil-profesional/documentos/page.tsx",
            "src/components/modules/profesional/AutorizacionPasoFinal.tsx",
        ];
        for (const rel of pasos) {
            expect(/tarifa/i.test(leer(rel)), `«tarifa» no debe estar en ${rel}`).toBe(false);
        }
        // CONTROL POSITIVO: donde SÍ vive la tarifa (editor del habilitado) el detector la encuentra
        // — así el barrido de arriba no es un falso verde por un patrón que nunca pega.
        expect(/tarifa/i.test(leer("src/components/modules/profesional/MiPerfilProfesionalClient.tsx"))).toBe(true);
    });
});
