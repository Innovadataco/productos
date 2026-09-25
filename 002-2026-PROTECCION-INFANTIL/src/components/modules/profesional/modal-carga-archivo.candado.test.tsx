/**
 * CANDADO · SPEC-726 (FORMA-SPEC726) · el modal de carga «nivel Dios».
 *
 * Conductas que no se pueden fingir (render real + XHR falso):
 *  1. La barra muestra el % REAL de `upload.onprogress` (`loaded/total`) — no una
 *     animación que avanza sola. (Se inyecta 40 % y la pantalla dice «40 %».)
 *  2. Al terminar bien (2xx) → estado ÉXITO «en revisión» y se entrega la respuesta.
 *  3. Un error del servidor (4xx) se muestra DENTRO del modal, con su mensaje, y con
 *     Reintentar/Cerrar — no un cierre mudo.
 *  4. «Cancelar» aborta la subida (`xhr.abort()`) y cierra — sin estado a medias.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// XHR falso: captura la instancia y deja disparar los handlers a mano.
class FakeXHR {
    static ultima: FakeXHR | null = null;
    upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void; onload?: () => void } = {};
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    responseText = "";
    withCredentials = false;
    abortado = false;
    open() {}
    send() {
        FakeXHR.ultima = this;
    }
    abort() {
        this.abortado = true;
        this.onabort?.();
    }
}

import { ModalCargaArchivo } from "./ModalCargaArchivo";

// Re-stub en cada test: el setup por defecto hace `unstubAllGlobals` en su afterEach,
// que borraría un stub puesto una sola vez a nivel de módulo.
beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
    FakeXHR.ultima = null;
});

function montar(over: Partial<Parameters<typeof ModalCargaArchivo>[0]> = {}) {
    const onExito = vi.fn();
    const onCerrar = vi.fn();
    const archivo = new File([new Uint8Array(1024)], "tarjeta.pdf", { type: "application/pdf" });
    render(
        <ModalCargaArchivo
            url="/api/profesional/documentos"
            campos={{ requisito: "tarjeta" }}
            archivo={archivo}
            requisitoNombre="tarjeta profesional"
            onExito={onExito}
            onCerrar={onCerrar}
            {...over}
        />,
    );
    return { onExito, onCerrar };
}

afterEach(() => {
    cleanup();
    FakeXHR.ultima = null;
});

describe("SPEC-726 · ModalCargaArchivo", () => {
    it("muestra el % REAL de upload.onprogress (no una barra decorativa)", () => {
        montar();
        const xhr = FakeXHR.ultima!;
        expect(xhr, "arrancó la subida por XHR").toBeTruthy();
        act(() => xhr.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 }));
        expect(screen.getByText("40 %")).toBeTruthy();
        act(() => xhr.upload.onprogress?.({ lengthComputable: true, loaded: 90, total: 100 }));
        expect(screen.getByText("90 %")).toBeTruthy();
    });

    it("2xx → estado ÉXITO «en revisión» y entrega la respuesta tras el latido", async () => {
        vi.useFakeTimers();
        try {
            const { onExito } = montar();
            const xhr = FakeXHR.ultima!;
            act(() => {
                xhr.status = 201;
                xhr.responseText = JSON.stringify({ data: [{ clave: "tarjeta" }] });
                xhr.onload?.();
            });
            expect(screen.getByText(/en revisión/)).toBeTruthy();
            act(() => vi.advanceTimersByTime(1300)); // el auto-cierre (~1.2 s)
            expect(onExito).toHaveBeenCalledWith({ data: [{ clave: "tarjeta" }] });
        } finally {
            vi.useRealTimers();
        }
    });

    it("4xx → el mensaje del servidor DENTRO del modal, con Reintentar/Cerrar", () => {
        montar();
        const xhr = FakeXHR.ultima!;
        act(() => {
            xhr.status = 400;
            xhr.responseText = JSON.stringify({ error: { message: "Su tarjeta profesional pesa más del máximo permitido (10 MB)." } });
            xhr.onload?.();
        });
        expect(screen.getByText(/pesa más del máximo permitido/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
    });

    it("«Cancelar» aborta la subida y cierra", () => {
        const { onCerrar } = montar();
        const xhr = FakeXHR.ultima!;
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(xhr.abortado).toBe(true);
        expect(onCerrar).toHaveBeenCalled();
    });
});
