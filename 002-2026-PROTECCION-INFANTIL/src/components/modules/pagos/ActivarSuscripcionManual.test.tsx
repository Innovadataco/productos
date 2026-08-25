/**
 * SPEC-245 (002-PI-148): tests unitarios del modal de activación / autorización
 * manual de suscripciones.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivarSuscripcionManual } from "./ActivarSuscripcionManual";
import type { TargetSinSuscripcion, PlanManualDTO } from "@/lib/pagos/admin-activacion-manual.types";

const targetPadre: TargetSinSuscripcion = {
    id: "usr_padre_1",
    tipo: "PADRE",
    nombre: "Ana Pérez",
    email: "ana@example.com",
};

const targetColegio: TargetSinSuscripcion = {
    id: "col_1",
    tipo: "COLEGIO",
    nombre: "Colegio Andes",
    identificacion: "900.123.456-7",
};

const planPadre: PlanManualDTO = {
    id: "plan_padre_1",
    nombre: "Plan Padre Trimestral",
    tipoTitular: "PADRE",
    duracion: "MES_3",
    anio: new Date().getFullYear(),
    precioBaseCOP: 89000,
    precioBaseUSD: 22,
    esFreemium: false,
    activo: true,
    descripcion: null,
};

const planColegio: PlanManualDTO = {
    id: "plan_colegio_1",
    nombre: "Plan Colegio Anual",
    tipoTitular: "COLEGIO",
    duracion: "MES_12",
    anio: new Date().getFullYear(),
    precioBaseCOP: 1200000,
    precioBaseUSD: 300,
    esFreemium: false,
    activo: true,
    descripcion: null,
};

const planFreemium: PlanManualDTO = {
    id: "plan_freemium_1",
    nombre: "Prueba gratis",
    tipoTitular: "PADRE",
    duracion: "MES_1",
    anio: new Date().getFullYear(),
    precioBaseCOP: 0,
    precioBaseUSD: 0,
    esFreemium: true,
    activo: true,
    descripcion: null,
};

function mockFetch(ok: boolean, body: Record<string, unknown> = {}) {
    return vi.fn(() =>
        Promise.resolve({
            ok,
            json: () => Promise.resolve(body),
        })
    ) as unknown as typeof globalThis.fetch;
}

function obtenerLlamadaFetch() {
    const llamadas = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, RequestInit]
    >;
    return llamadas[0];
}

describe("ActivarSuscripcionManual", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetch(true, {}));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza botón Activar y abre modal con selector de plan", async () => {
        render(<ActivarSuscripcionManual modo="activar" target={targetPadre} planes={[planPadre]} />);

        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        expect(screen.getByText("Activar suscripción manualmente")).toBeTruthy();
        expect(screen.getByLabelText("Plan")).toBeTruthy();
        expect(screen.getByLabelText("Método de pago")).toBeTruthy();
        expect(screen.getByLabelText("Referencia de pago")).toBeTruthy();
        expect(screen.getByLabelText("Monto real pagado (COP)")).toBeTruthy();
    });

    it("renderiza botón Autorizar y abre modal sin selector de plan", async () => {
        render(
            <ActivarSuscripcionManual
                modo="autorizar"
                suscripcionId="sub_1"
                planNombre="Plan Trimestral"
                titularNombre="Ana Pérez"
                titularTipo="PADRE"
            />
        );

        fireEvent.click(screen.getByText("Autorizar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        expect(screen.getByText("Autorizar solicitud de suscripción")).toBeTruthy();
        expect(screen.queryByLabelText("Plan")).toBeNull();
    });

    it("envía activación manual con plan, target y datos de pago", async () => {
        render(<ActivarSuscripcionManual modo="activar" target={targetPadre} planes={[planPadre]} />);

        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Método de pago"), { target: { value: "EFECTIVO" } });
        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "Recibo 001" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "89000" } });

        fireEvent.click(screen.getByText("Confirmar"));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
        const [url, init] = obtenerLlamadaFetch();
        expect(url).toBe("/api/admin/pagos/activar-manual");
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body as string);
        expect(body).toMatchObject({
            planId: planPadre.id,
            usuarioObjetivoId: targetPadre.id,
            metodoPagoManual: "EFECTIVO",
            referenciaPagoManual: "Recibo 001",
            montoRealPagado: 89000,
        });
    });

    it("envía autorización de solicitud al endpoint correcto", async () => {
        render(
            <ActivarSuscripcionManual
                modo="autorizar"
                suscripcionId="sub_1"
                planNombre="Plan Trimestral"
                titularNombre="Ana Pérez"
                titularTipo="PADRE"
            />
        );

        fireEvent.click(screen.getByText("Autorizar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "TR-789" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "100000" } });

        fireEvent.click(screen.getByText("Confirmar"));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
        const [url, init] = obtenerLlamadaFetch();
        expect(url).toBe("/api/admin/pagos/pendientes/sub_1/autorizar");
        const body = JSON.parse(init.body as string);
        expect(body).toMatchObject({
            metodoPagoManual: "TRANSFERENCIA_BANCARIA",
            referenciaPagoManual: "TR-789",
            montoRealPagado: 100000,
        });
    });

    it("filtra planes por tipo de titular, año actual y activos; excluye freemium", async () => {
        render(
            <ActivarSuscripcionManual
                modo="activar"
                target={targetPadre}
                planes={[planPadre, planColegio, planFreemium]}
            />
        );

        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        const select = screen.getByLabelText("Plan") as HTMLSelectElement;
        const opciones = Array.from(select.options).map((o) => o.value);
        expect(opciones).toContain(planPadre.id);
        expect(opciones).not.toContain(planColegio.id);
        expect(opciones).not.toContain(planFreemium.id);
    });

    it("muestra error cuando el servidor responde con fallo", async () => {
        vi.stubGlobal("fetch", mockFetch(false, { error: { message: "Plan no válido" } }));

        render(<ActivarSuscripcionManual modo="activar" target={targetPadre} planes={[planPadre]} />);
        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "X" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "1" } });
        fireEvent.click(screen.getByText("Confirmar"));

        await waitFor(() => expect(screen.getByText("Plan no válido")).toBeTruthy());
    });

    it("impide doble envío mientras carga", async () => {
        let resolveFetch: (value: Response) => void;
        const fetchPromise = new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        });
        vi.stubGlobal(
            "fetch",
            vi.fn(() => fetchPromise)
        );

        render(<ActivarSuscripcionManual modo="activar" target={targetPadre} planes={[planPadre]} />);
        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "X" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "1" } });

        fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);
        await waitFor(() =>
            expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true)
        );

        resolveFetch!({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    it("deshabilita confirmar hasta que el formulario esté completo", async () => {
        render(<ActivarSuscripcionManual modo="activar" target={targetColegio} planes={[planColegio]} />);
        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        const confirmar = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(confirmar.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "REF" } });
        expect(confirmar.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "50000" } });
        expect(confirmar.disabled).toBe(false);
    });

    it("envía fecha de pago cuando se captura", async () => {
        render(<ActivarSuscripcionManual modo="activar" target={targetPadre} planes={[planPadre]} />);
        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "R" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("Fecha de pago (opcional)"), { target: { value: "2026-08-25" } });

        fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

        const [, init] = obtenerLlamadaFetch();
        const body = JSON.parse(init.body as string);
        expect(body.fechaPagoReal).toMatch(/^2026-08-25T/);
    });

    it("incluye colegioObjetivoId cuando el target es COLEGIO", async () => {
        render(<ActivarSuscripcionManual modo="activar" target={targetColegio} planes={[planColegio]} />);
        fireEvent.click(screen.getByText("Activar"));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Referencia de pago"), { target: { value: "R" } });
        fireEvent.change(screen.getByLabelText("Monto real pagado (COP)"), { target: { value: "1" } });
        fireEvent.click(screen.getByText("Confirmar"));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
        const [, init] = obtenerLlamadaFetch();
        const body = JSON.parse(init.body as string);
        expect(body.colegioObjetivoId).toBe(targetColegio.id);
        expect(body.usuarioObjetivoId).toBeUndefined();
    });
});
