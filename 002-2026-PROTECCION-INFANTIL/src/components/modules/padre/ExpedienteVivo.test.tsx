/**
 * I-261 · candado de presentación del expediente vivo: fecha y HORA (candado
 * SPEC-349 conserva la hora para el modelo), MINUTOS NO (regla dura de Jelkin).
 * El helper compartido `fechaHoraSinMinutos` genera "3 sept 2026 · 9 p. m.".
 * Este test blinda a `ExpedienteVivo` contra volver a un `Intl.DateTimeFormat`
 * artesanal con `timeStyle:"short"` (que reintroduce los minutos).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpedienteVivo, type HechoVivoDto, type InformeDto } from "./ExpedienteVivo";

vi.mock("./TextoSensible", () => ({
    TextoSensible: () => <div data-testid="texto-sensible" />,
}));
vi.mock("./AnalisisExpediente", () => ({
    AnalisisExpediente: () => <div data-testid="analisis" />,
}));
vi.mock("@/components/modules/MapaUbicaciones", () => ({
    MapaUbicaciones: () => <div data-testid="mapa" />,
}));

afterEach(() => {
    vi.restoreAllMocks();
});

const hechos: HechoVivoDto[] = [
    {
        reporteId: "r1",
        // 21:15 en Bogotá (America/Bogota = UTC-5): "3 sept 2026 · 9 p. m."
        fecha: "2026-09-04T02:15:00.000Z",
        ciudad: "Bogotá",
        pais: "CO",
        lat: 4.6,
        lng: -74.08,
        categoriaLabel: null,
        origen: "mio",
    },
];

const informes: InformeDto[] = [
    { numeroSecuencial: 1, generadoEn: "2026-09-04T02:15:00.000Z", codigoVerificacion: "XYZ123" },
];

describe("ExpedienteVivo · fechas sin minutos (I-261)", () => {
    // `useEffect` con `fetch` de lectura: mock que no aporta datos, silencioso.
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => null } as Response);

    it("no muestra minutos en las fechas de los hechos ni de los informes", () => {
        render(<ExpedienteVivo expedienteId="e1" identificador="alias@x" hechos={hechos} informes={informes} />);
        const html = document.body.textContent ?? "";
        // Presencia: la hora vive (SPEC-349 sigue en pie para el modelo; en la UI
        // el helper la conserva sin minutos en formato "9 p. m.").
        expect(html).toMatch(/9\s?p\.?\s?m\.?/i);
        // Ausencia dura: cualquier "HH:MM" (dos dígitos, dos puntos, dos dígitos) es un minuto pintado.
        expect(html).not.toMatch(/\b\d{1,2}:\d{2}\b/);
    });
});
