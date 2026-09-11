import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReporteWizard } from "./ReporteWizard";
import { REPORTAR_STORAGE_KEY, dejarHandoffReportar } from "@/lib/reportar-handoff";

// SPEC-314 (002-PI-214): el card de bloqueo (ReporteBloqueoRol) usa useRouter de
// next/navigation para el CTA "Registrarme como padre". Se mockea aquí para que el
// render en jsdom no falle al montar el componente de bloqueo.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

describe("ReporteWizard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra bloqueo para sesión interna (ADMIN)", async () => {
        mockFetch({ id: "u1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(screen.getByRole("button", { name: /Cerrar sesión y reportar/i })).toBeDefined();
    });

    it("muestra bloqueo para sesión interna (OPERADOR)", async () => {
        mockFetch({ id: "u2", email: "op@test.com", nombre: "Operador", rol: "OPERADOR" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
    });

    it("muestra bloqueo para sesión interna (SCHOOL_ADMIN)", async () => {
        mockFetch({ id: "u3", email: "school@test.com", nombre: "School", rol: "SCHOOL_ADMIN" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
    });

    it("no muestra bloqueo para usuario PARENT", async () => {
        mockFetch({ id: "u4", email: "parent@test.com", nombre: "Padre", rol: "PARENT" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(document.body.textContent).toContain("¿Qué cuenta está asociada a la situación?");
    });

    it("no muestra bloqueo cuando no hay sesión (anónimo puro)", async () => {
        mockFetch({ error: { message: "No autenticado" } }, false);
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(document.body.textContent).toContain("¿Qué cuenta está asociada a la situación?");
    });

    // Test de EFECTO (I-14): el botón "Siguiente" del paso 2 obedece el parámetro
    // reportes.spam.min_text_length, no un literal. Con el parámetro en 30, un texto
    // de 29 caracteres bloquea el avance y uno de 31 lo habilita.
    it("el botón Siguiente del paso 2 obedece reportes.spam.min_text_length (test de efecto)", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async (input) => {
            const url = String(input);
            const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
            if (url.includes("/api/me")) return json({ error: { message: "No autenticado" } }, false);
            if (url.includes("/api/config/parametros/publicos")) {
                return json({ "reportes.spam.min_text_length": { valor: "30" } });
            }
            if (url.includes("/api/plataformas")) {
                return json({ plataformas: [{ id: "p1", clave: "whatsapp", nombre: "WhatsApp" }] });
            }
            if (url.includes("/api/paises")) return json({ paises: [{ id: "co", nombre: "Colombia" }] });
            // SPEC-115: la ciudad se elige con buscador en servidor
            if (url.includes("/api/ciudades/buscar")) {
                return json({ ciudades: [{ id: "bog", nombre: "Bogotá", paisId: "co", departamentoId: null, departamento: null }] });
            }
            return json({});
        });
        render(<ReporteWizard />);

        // Paso 1: identificador + plataforma
        fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
        await screen.findByRole("option", { name: "WhatsApp" });
        fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

        // Paso 2: país + ciudad (buscador con debounce en servidor)
        await screen.findByText("Detalles del incidente");
        await screen.findByRole("option", { name: "Colombia" });
        fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
        fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
        fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));

        const area = screen.getByPlaceholderText(/Describe la conducta observada/i);
        const botonSiguiente = () => screen.getByRole("button", { name: /Siguiente/i });

        // SPEC-438 (I-305): desde esta spec la fecha del hecho es OBLIGATORIA
        // para avanzar. Este test mide el largo del texto, así que se le da una
        // fecha válida para que siga probando LO SUYO y no choque con la guardia
        // nueva. (Que sin fecha no se avanza tiene su propio candado.)
        fireEvent.change(screen.getByLabelText(/Día del incidente/i), {
            target: { value: "2026-07-10" },
        });
        fireEvent.change(screen.getByLabelText(/^Hora del incidente$/i), { target: { value: "10" } });

        // N-1 = 29 caracteres → avance bloqueado
        fireEvent.change(area, { target: { value: "a".repeat(29) } });
        await waitFor(() => expect(botonSiguiente()).toHaveProperty("disabled", true));

        // N+1 = 31 caracteres → avance habilitado
        fireEvent.change(area, { target: { value: "a".repeat(31) } });
        await waitFor(() => expect(botonSiguiente()).toHaveProperty("disabled", false));
    });

    // ─────────────────────────────────────────────────────────────────────
    // SPEC-295 (002-PI-196 · I-146): modo autenticado del panel padre.
    // ─────────────────────────────────────────────────────────────────────
    describe("SPEC-295 · modoAutenticado", () => {
        // SPEC-340 (A-68 §2.1): el banner se retiró — Jelkin: no es necesario.
        it("NO muestra el banner de identidad aunque el padre esté autenticado (SPEC-340)", async () => {
            mockFetch({ id: "u4", email: "parent@test.com", nombre: "Juan Padre", rol: "PARENT" });
            render(<ReporteWizard modoAutenticado />);

            await waitFor(() => {
                // El banner entero se fue: ni el rótulo ni el nombre/correo del
                // padre aparecen en el formulario (SPEC-340 — no es necesario).
                expect(document.body.textContent).not.toContain("Reportando como");
                expect(document.body.textContent).not.toContain("Juan Padre");
                expect(document.body.textContent).not.toContain("parent@test.com");
            });
        });

        // SPEC-324: el checkbox "Reportar de forma anónima" se retiró — el padre
        // autenticado SIEMPRE reporta con su identidad (el backend ya derivaba
        // esAnonimo de la sesión, así que el checkbox era muerto · candado 26).
        it("NO muestra checkbox 'Reportar de forma anónima' en modo autenticado (SPEC-324)", async () => {
            mockFetch({ id: "u4", email: "parent@test.com", nombre: "Juan Padre", rol: "PARENT" });
            render(<ReporteWizard modoAutenticado />);

            await waitFor(() => {
                // el banner de identidad sigue presente...
                expect(document.body.textContent).not.toContain("Reportando como");
            });
            // ...pero ya no hay checkbox ni la etiqueta de anonimato.
            expect(document.body.textContent).not.toContain("Reportar de forma anónima");
            expect(screen.queryByRole("checkbox")).toBeNull();
        });

        it("NO muestra banner en modo público anónimo (sin modoAutenticado)", async () => {
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard />);

            await waitFor(() => {
                expect(document.body.textContent).not.toContain("Reportando como");
            });
        });

        it("NO muestra banner cuando modoAutenticado pero sin sesión (edge case)", async () => {
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard modoAutenticado />);

            await waitFor(() => {
                expect(document.body.textContent).not.toContain("Reportando como");
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // El identificador prellenado llega SIEMPRE por sessionStorage y NUNCA por
    // la URL (spec 091-US2 / 093-US4, vigilado por url-privacy.test.ts): el CTA
    // de /seguimiento lo manda fijo (SPEC-324) y el de la consulta vacía
    // editable (F3 N-5). El wizard no acepta prop de prellenado — si volviera,
    // volvería con ella el `?identificador=` en la URL de la página.
    // ─────────────────────────────────────────────────────────────────────
    describe("identificador prellenado por el handoff", () => {
        const campoIdentificador = () =>
            screen.getByLabelText(/La cuenta/i) as HTMLInputElement;

        afterEach(() => {
            sessionStorage.clear();
        });

        it("prellena y bloquea el identificador que dejó /seguimiento (fijar)", async () => {
            dejarHandoffReportar("+573001234567", { fijar: true });
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard />);

            await waitFor(() => expect(campoIdentificador()).toBeDefined());
            const campo = campoIdentificador();
            expect(campo.value).toBe("+573001234567");
            expect(campo.readOnly).toBe(true);
            // `readOnly` es lo que bloquea al usuario en el navegador; no se
            // verifica con `fireEvent.change` porque ese helper no simula tecleo
            // (dispara el evento directo y jsdom lo deja pasar aunque sea readOnly).
        });

        it("prellena SIN bloquear el de la consulta vacía (sin fijar)", async () => {
            dejarHandoffReportar("+573001234567", { fijar: false });
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard />);

            await waitFor(() => expect(campoIdentificador()).toBeDefined());
            const campo = campoIdentificador();
            expect(campo.value).toBe("+573001234567");
            expect(campo.readOnly).toBe(false);
            fireEvent.change(campo, { target: { value: "+573009999999" } });
            expect(campoIdentificador().value).toBe("+573009999999");
        });

        it("la llave es de un solo uso: se borra al montar", async () => {
            dejarHandoffReportar("+573001234567", { fijar: true });
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard />);

            await waitFor(() => expect(campoIdentificador()).toBeDefined());
            expect(sessionStorage.getItem(REPORTAR_STORAGE_KEY)).toBeNull();
        });

        it("sin handoff arranca vacío y editable", async () => {
            mockFetch({ error: { message: "No autenticado" } }, false);
            render(<ReporteWizard />);

            await waitFor(() => expect(campoIdentificador()).toBeDefined());
            expect(campoIdentificador().value).toBe("");
            expect(campoIdentificador().readOnly).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // SPEC-604 (modelo EXPEDIENTE · cimientos): paso 0 con edad derivada y alta
    // «solo nombre»; la edad se oculta en el paso 2 del modo autenticado.
    // ─────────────────────────────────────────────────────────────────────
    describe("SPEC-604 · paso 0 y edad automática", () => {
        type Llamada = { url: string; method: string; body?: unknown };
        // El envío en modo autenticado redirige con `window.location.href`;
        // jsdom no navega — se reemplaza el objeto location (patrón de
        // ModalConsentimiento.test.tsx, SPEC-362 I-256).
        beforeAll(() => {
            Object.defineProperty(window, "location", {
                configurable: true,
                value: { ...window.location, href: "" },
            });
        });

        beforeEach(() => {
            // El borrador del wizard vive en sessionStorage: sin limpiarlo, un
            // test hereda el hijoId/relato del anterior.
            sessionStorage.clear();
        });

        afterEach(() => {
            sessionStorage.clear();
        });

        const HIJO_LAURA = { id: "h1", nombre: "Laura", apellidos: "Gómez", estado: "activo", anioNacimiento: 2015 };

        function mockFetchPadre(hijosLista: unknown[]): Llamada[] {
            const llamadas: Llamada[] = [];
            vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
                const url = String(input);
                const method = init?.method ?? "GET";
                const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
                llamadas.push({ url, method, body });
                const json = (payload: unknown, ok = true, status = 200) =>
                    ({ ok, status, json: async () => payload }) as Response;
                if (url.includes("/api/me")) {
                    return json({ id: "u-padre", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
                }
                if (url.includes("/api/padre/hijos") && method === "POST") return json({ hijoId: "hijo-nuevo-1" }, true, 201);
                if (url.includes("/api/padre/hijos")) return json(hijosLista);
                if (url.includes("/api/config/parametros/publicos")) {
                    return json({ "reportes.spam.min_text_length": { valor: "20" } });
                }
                if (url.includes("/api/plataformas")) {
                    return json({ plataformas: [{ id: "p1", clave: "whatsapp", nombre: "WhatsApp" }] });
                }
                if (url.includes("/api/paises")) return json({ paises: [{ id: "co", nombre: "Colombia" }] });
                if (url.includes("/api/departamentos")) return json({ departamentos: [] });
                if (url.includes("/api/ciudades/buscar")) {
                    return json({ ciudades: [{ id: "bog", nombre: "Bogotá", paisId: "co", departamentoId: null, departamento: null }] });
                }
                if (url.includes("/api/reportes") && method === "POST") {
                    return json(
                        { reporte: { id: "rep-1", numeroSeguimiento: "RPT-ABC123", estado: "PENDIENTE" }, expedienteId: "exp-1" },
                        true,
                        201
                    );
                }
                return json({});
            });
            return llamadas;
        }

        /** Del paso 1 (plataforma) al paso 3 (confirmar), con los datos mínimos válidos. */
        async function caminarHastaConfirmar() {
            fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
            await screen.findByRole("option", { name: "WhatsApp" });
            fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            await screen.findByText("Detalles del incidente");
            await screen.findByRole("option", { name: "Colombia" });
            fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
            fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
            fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));
            fireEvent.change(screen.getByLabelText(/Día del incidente/i), { target: { value: "2026-07-10" } });
            fireEvent.change(screen.getByLabelText(/^Hora del incidente$/i), { target: { value: "10" } });
            fireEvent.change(screen.getByPlaceholderText(/Describe la conducta observada/i), {
                target: { value: "Le escribió de madrugada insistiendo en fotos." },
            });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
            await screen.findByText("Revisa y confirma");
        }

        it("paso 0 lista SOLO fichas activas, con la edad registrada y la opción «solo nombre»", async () => {
            mockFetchPadre([
                HIJO_LAURA,
                { id: "h2", nombre: "Nicolás", apellidos: "Gómez", estado: "inactivo", anioNacimiento: 2018 },
            ]);
            render(<ReporteWizard modoAutenticado />);

            await screen.findByRole("option", { name: /Laura Gómez · 11 años/ });
            expect(screen.queryByRole("option", { name: /Nicolás/ }), "la ficha inactiva no se ofrece").toBeNull();
            expect(screen.getByRole("button", { name: /Nuevo hijo \(solo nombre\)/i })).toBeDefined();
        });

        it("con ficha elegida el paso 2 OCULTA la edad y el envío lleva la edad derivada del año de nacimiento", async () => {
            const llamadas = mockFetchPadre([HIJO_LAURA]);
            render(<ReporteWizard modoAutenticado />);

            fireEvent.click(await screen.findByRole("option", { name: /Laura/ }));
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            // Paso 1 → paso 2: el campo «Edad aproximada del menor» no existe.
            fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
            await screen.findByRole("option", { name: "WhatsApp" });
            fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
            await screen.findByText("Detalles del incidente");
            expect(screen.queryByLabelText(/Edad aproximada del menor/i), "la edad se deriva de la ficha").toBeNull();

            // Completar y enviar.
            await screen.findByRole("option", { name: "Colombia" });
            fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
            fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
            fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));
            fireEvent.change(screen.getByLabelText(/Día del incidente/i), { target: { value: "2026-07-10" } });
            fireEvent.change(screen.getByLabelText(/^Hora del incidente$/i), { target: { value: "10" } });
            fireEvent.change(screen.getByPlaceholderText(/Describe la conducta observada/i), {
                target: { value: "Le escribió de madrugada insistiendo en fotos." },
            });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
            await screen.findByText("Revisa y confirma");
            fireEvent.click(screen.getByRole("checkbox"));
            fireEvent.click(screen.getByRole("button", { name: /Enviar reporte/i }));

            await waitFor(() => {
                const alta = llamadas.find((l) => l.url.includes("/api/reportes") && l.method === "POST");
                expect(alta, "se envió el reporte").toBeTruthy();
                const cuerpo = alta!.body as { hijoId?: string; edadVictima?: number };
                expect(cuerpo.hijoId).toBe("h1");
                expect(cuerpo.edadVictima, "edad derivada: año en curso − año de nacimiento").toBe(
                    new Date().getFullYear() - 2015
                );
            });
            // La ficha ya existía: el alta «solo nombre» NO se llamó.
            expect(llamadas.some((l) => l.url.includes("/api/padre/hijos") && l.method === "POST")).toBe(false);
        });

        it("«Nuevo hijo (solo nombre)»: crea la ficha AL ENVIAR y ata el reporte a ella", async () => {
            const llamadas = mockFetchPadre([]); // sin fichas → alta inline forzada
            render(<ReporteWizard modoAutenticado />);

            // Sin fichas, el paso 0 muestra el alta inline directamente.
            const input = await screen.findByLabelText(/Nombre del menor/i);
            fireEvent.change(input, { target: { value: "Valentina" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            await caminarHastaConfirmar();
            fireEvent.click(screen.getByRole("checkbox"));
            fireEvent.click(screen.getByRole("button", { name: /Enviar reporte/i }));

            await waitFor(() => {
                const altaHijo = llamadas.find((l) => l.url.includes("/api/padre/hijos") && l.method === "POST");
                const altaReporte = llamadas.find((l) => l.url.includes("/api/reportes") && l.method === "POST");
                expect(altaHijo, "la ficha se crea con solo el nombre").toBeTruthy();
                expect(altaHijo!.body).toEqual({ nombre: "Valentina" });
                expect(altaReporte, "el reporte sale después").toBeTruthy();
                expect(
                    llamadas.indexOf(altaHijo!) < llamadas.indexOf(altaReporte!),
                    "primero la ficha, después el reporte"
                ).toBe(true);
                const cuerpo = altaReporte!.body as { hijoId?: string; edadVictima?: number };
                expect(cuerpo.hijoId, "el reporte queda atado a la ficha recién creada").toBe("hijo-nuevo-1");
                expect(cuerpo.edadVictima, "ficha «solo nombre»: sin año → sin edad").toBeUndefined();
            });
        });

        it("sin elegir ficha ni escribir nombre, el paso 0 no deja avanzar", async () => {
            mockFetchPadre([HIJO_LAURA]);
            render(<ReporteWizard modoAutenticado />);

            await screen.findByRole("option", { name: /Laura/ });
            const boton = screen.getByRole("button", { name: /Siguiente/i });
            expect(boton).toHaveProperty("disabled", true);
        });

        // ─────────────────────────────────────────────────────────────────────
        // SPEC-644 (I-379) · CANDADO del contrato de entrada: cuando el padre NO
        // recuerda la hora, el envío DEBE llevar la franja declarada. La ruta
        // convirtió `franja ⟺ horaAproximada` en un contrato duro (400 + CHECK de
        // BD); si el formulario mandara `horaAproximada:true` sin `franja`, el
        // reporte de un padre no entraría el día del deploy (la trampa de I-391).
        // Se vigila la CONDUCTA en las dos direcciones: que la franja viaje, y que
        // sin franja NO se pueda siquiera avanzar a enviar.
        // ─────────────────────────────────────────────────────────────────────
        it("SPEC-644: «No recuerdo la hora» + franja → el envío lleva horaAproximada:true Y la franja declarada", async () => {
            const llamadas = mockFetchPadre([HIJO_LAURA]);
            render(<ReporteWizard modoAutenticado />);

            fireEvent.click(await screen.findByRole("option", { name: /Laura/ }));
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
            await screen.findByRole("option", { name: "WhatsApp" });
            fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            await screen.findByText("Detalles del incidente");
            await screen.findByRole("option", { name: "Colombia" });
            fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
            fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
            fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));
            fireEvent.change(screen.getByLabelText(/Día del incidente/i), { target: { value: "2026-07-10" } });
            // El camino aproximado: se enciende el modo y se elige la franja (el día
            // se recuerda aunque el modo limpie la hora, SPEC-438).
            fireEvent.click(screen.getByLabelText(/No recuerdo la hora/i));
            fireEvent.change(screen.getByLabelText(/Franja aproximada del incidente/i), { target: { value: "manana" } });
            fireEvent.change(screen.getByPlaceholderText(/Describe la conducta observada/i), {
                target: { value: "Le escribió por la mañana insistiendo en fotos." },
            });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
            await screen.findByText("Revisa y confirma");
            fireEvent.click(screen.getByRole("checkbox"));
            fireEvent.click(screen.getByRole("button", { name: /Enviar reporte/i }));

            await waitFor(() => {
                const alta = llamadas.find((l) => l.url.includes("/api/reportes") && l.method === "POST");
                expect(alta, "se envió el reporte").toBeTruthy();
                const cuerpo = alta!.body as { horaAproximada?: boolean; franja?: string };
                expect(cuerpo.horaAproximada, "la hora estimada viaja marcada").toBe(true);
                // Sin ESTA franja en el body, el guard de la ruta responde 400 y el
                // reporte del padre NO entra. El envío tiene que llevarla.
                expect(cuerpo.franja, "SPEC-644: la franja declarada viaja en el body").toBe("manana");
            });
        });

        it("SPEC-644 (contraprueba): «No recuerdo la hora» SIN franja elegida BLOQUEA el avance — imposible enviar aproximada sin franja", async () => {
            mockFetchPadre([HIJO_LAURA]);
            render(<ReporteWizard modoAutenticado />);

            fireEvent.click(await screen.findByRole("option", { name: /Laura/ }));
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
            await screen.findByRole("option", { name: "WhatsApp" });
            fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            await screen.findByText("Detalles del incidente");
            await screen.findByRole("option", { name: "Colombia" });
            fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
            fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
            fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));
            fireEvent.change(screen.getByLabelText(/Día del incidente/i), { target: { value: "2026-07-10" } });
            fireEvent.change(screen.getByPlaceholderText(/Describe la conducta observada/i), {
                target: { value: "Le escribió insistiendo en fotos; no recuerdo la hora." },
            });
            // Modo franja encendido pero SIN elegir franja: el control emite valor
            // vacío. País/ciudad/texto ya están completos, así que el ÚNICO faltante
            // es la franja → «Siguiente» bloqueado. No hay forma de llegar a enviar.
            fireEvent.click(screen.getByLabelText(/No recuerdo la hora/i));
            expect(
                screen.getByRole("button", { name: /Siguiente/i }),
                "sin franja el valor del hecho queda vacío y el paso no avanza"
            ).toHaveProperty("disabled", true);
            // Elegir la franja es EXACTAMENTE lo que lo desbloquea.
            fireEvent.change(screen.getByLabelText(/Franja aproximada del incidente/i), { target: { value: "noche" } });
            expect(
                screen.getByRole("button", { name: /Siguiente/i }),
                "con la franja elegida, el paso ya avanza"
            ).toHaveProperty("disabled", false);
        });

        it("el anónimo NO tiene paso 0 y el paso 2 SÍ muestra «Edad aproximada del menor» (regresión)", async () => {
            vi.spyOn(global, "fetch").mockImplementation(async (input) => {
                const url = String(input);
                const json = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response;
                if (url.includes("/api/me")) return json({ error: { message: "No autenticado" } }, false);
                if (url.includes("/api/config/parametros/publicos")) {
                    return json({ "reportes.spam.min_text_length": { valor: "20" } });
                }
                if (url.includes("/api/plataformas")) {
                    return json({ plataformas: [{ id: "p1", clave: "whatsapp", nombre: "WhatsApp" }] });
                }
                if (url.includes("/api/paises")) return json({ paises: [{ id: "co", nombre: "Colombia" }] });
                if (url.includes("/api/ciudades/buscar")) return json({ ciudades: [] });
                return json({});
            });
            render(<ReporteWizard />);

            // Arranca en el paso de plataforma (no hay «¿Para quién reportas?»).
            await waitFor(() => {
                expect(document.body.textContent).toContain("¿Qué cuenta está asociada a la situación?");
            });
            expect(document.body.textContent).not.toContain("¿Para quién reportas?");

            fireEvent.change(await screen.findByLabelText(/La cuenta/i), { target: { value: "+573001234567" } });
            await screen.findByRole("option", { name: "WhatsApp" });
            fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
            fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

            await screen.findByText("Detalles del incidente");
            expect(screen.getByLabelText(/Edad aproximada del menor/i), "el anónimo conserva el campo").toBeDefined();
        });
    });
});
