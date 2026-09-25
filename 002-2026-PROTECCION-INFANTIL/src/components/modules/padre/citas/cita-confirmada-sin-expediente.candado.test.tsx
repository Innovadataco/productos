/**
 * CANDADO · SPEC-731 (FORMA §Candado · Jelkin probando 24-09) · la cita confirmada
 * del padre VALE SOLA; compartir un caso es OPCIONAL y nunca un callejón.
 *
 * El defecto medido: sin `expedienteCompartidoId`, la pantalla mandaba a «elige
 * desde cuál caso compartir» — un callejón para el padre que NO tiene ningún
 * expediente (lista vacía). Conductas que no se pueden fingir (render real +
 * control positivo por remoción del discriminador):
 *  1. Padre SIN ningún caso → «poder seguir» (agregar al calendario) + el mensaje
 *     «no hace falta» con enlace opcional a reportar; NO el selector, NO el pase, y
 *     NUNCA el texto viejo «Genera el pase desde el expediente que quieras compartir».
 *  2. Control positivo · padre CON casos → aparece el selector y NO el mensaje «no
 *     hace falta» (el verde no se logra por ausencia doble).
 *  3. Con caso ligado, ese caso viene preseleccionado (el pase se monta); sin ligar,
 *     arranca en «No compartir» (sin pase hasta que el padre elija) — nunca obligatorio.
 *  4. El pie dice «Volver a mis citas» → /dashboard/padre/citas, nunca «mi expediente».
 *  5. Agendar NUNCA crea un expediente (el caso nace al reportar): el servicio de
 *     alta CONECTA un expediente existente, jamás lo crea.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import type { ExpedienteParaCompartirDto } from "@/lib/dal/services/expediente-detalle/types";

// El pase se prueba en su propio candado; acá se aísla para verificar que el panel lo MONTA.
vi.mock("@/components/modules/padre/GenerarPase", () => ({
    GenerarPase: ({ expedienteId }: { expedienteId: string }) => (
        <div data-testid="generar-pase">{expedienteId}</div>
    ),
}));

import { EsperaCitaPanel } from "./EsperaCitaPanel";

function cita(over: Partial<CitaParaPadreDto> = {}): CitaParaPadreDto {
    return {
        id: "c1",
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: new Date().toISOString(),
        venceEn: new Date(Date.now() + 48 * 3600_000).toISOString(),
        pagoAprobadoEn: new Date().toISOString(),
        montoTotal: 80_000,
        profesional: { id: "p1", nombreVisible: "Dra. Ramírez", tituloProfesional: "Psicología", ciudad: { id: "co", nombre: "Bogotá" } },
        franja: { inicio: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(), fin: new Date(Date.now() + 3 * 24 * 3600_000 + 3600_000).toISOString(), modalidad: "VIRTUAL" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: null,
        ...over,
    };
}

const UNO: ExpedienteParaCompartirDto[] = [{ expedienteId: "exp1", etiqueta: "EXP-1 · Ana" }];
const CALLEJON_VIEJO = "Genera el pase desde el expediente que quieras compartir";

afterEach(() => cleanup());

describe("SPEC-731 · la cita confirmada vale sola; compartir es opcional", () => {
    it("SIN ningún caso: «poder seguir» + «no hace falta» + reportar; NUNCA el callejón viejo", () => {
        render(<EsperaCitaPanel citaInicial={cita()} expedientes={[]} />);
        // «poder seguir» sigue estando (la cita vale sola).
        expect(screen.getByRole("button", { name: /Agregar a mi calendario/ })).toBeTruthy();
        // Caso (b): mensaje que cierra bien + enlace OPCIONAL a reportar.
        expect(screen.getByText(/No tienes un caso para compartir/)).toBeTruthy();
        expect(screen.getByRole("link", { name: /reportar un caso/i }).getAttribute("href")).toBe(
            "/dashboard/padre/reportar",
        );
        // NUNCA el callejón, ni el selector, ni un pase inventado.
        expect(document.body.textContent ?? "").not.toContain(CALLEJON_VIEJO);
        expect(screen.queryByRole("option", { name: /No compartir/ })).toBeNull();
        expect(screen.queryByTestId("generar-pase")).toBeNull();
    });

    it("CONTROL POSITIVO · CON casos: aparece el selector y NO el mensaje «no hace falta»", () => {
        render(<EsperaCitaPanel citaInicial={cita()} expedientes={UNO} />);
        expect(screen.getByText(/Quieres que el profesional vea un caso tuyo/)).toBeTruthy();
        expect(screen.getByRole("option", { name: "No compartir ningún caso" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "EXP-1 · Ana" })).toBeTruthy();
        expect(screen.queryByText(/No tienes un caso para compartir/)).toBeNull();
    });

    it("con caso ligado: viene preseleccionado → el pase se monta para ese caso", () => {
        render(<EsperaCitaPanel citaInicial={cita({ expedienteCompartidoId: "exp1" })} expedientes={UNO} />);
        expect(screen.getByTestId("generar-pase").textContent).toBe("exp1");
    });

    it("con casos pero sin ligar: arranca en «No compartir» → sin pase hasta elegir", () => {
        render(<EsperaCitaPanel citaInicial={cita({ expedienteCompartidoId: null })} expedientes={UNO} />);
        expect(screen.queryByTestId("generar-pase")).toBeNull();
    });

    it("el pie vuelve a «mis citas», nunca a «mi expediente»", () => {
        render(<EsperaCitaPanel citaInicial={cita()} expedientes={[]} />);
        expect(screen.getByRole("link", { name: /Volver a mis citas/ }).getAttribute("href")).toBe(
            "/dashboard/padre/citas",
        );
        expect(screen.queryByText(/Volver a mi expediente/)).toBeNull();
    });

    it("agendar NUNCA crea un expediente: el servicio de alta lo CONECTA, no lo crea", () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, "../../../../lib/profesional/cita/cita.service.ts"),
            "utf-8",
        );
        // Conecta un expediente existente…
        expect(/expedienteCompartido:\s*\{\s*connect/.test(src)).toBe(true);
        // …y jamás lo crea (ni Expediente.create ni un helper crearExpediente/upsert).
        expect(/expediente\s*\.\s*create|crearExpediente|\.expediente\.upsert/i.test(src)).toBe(false);
        // CONTRAPRUEBA · el detector reconoce la forma prohibida.
        expect(/expediente\s*\.\s*create/i.test("prisma.expediente.create({")).toBe(true);
    });
});
