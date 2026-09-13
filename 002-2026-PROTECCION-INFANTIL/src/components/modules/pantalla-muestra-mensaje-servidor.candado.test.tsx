/**
 * CANDADO · SPEC-689 (I-410) · Cuando el servidor manda un mensaje de error, la
 * pantalla lo muestra —ESE MISMO—, no «HTTP NNN» ni un genérico.
 *
 * Origen (walk de Jelkin): `DocumentosRequisitos` mostraba «HTTP 400» en vez del
 * mensaje del servidor («Complete su perfil antes de cargar documentos.»). El
 * barrido destapó la CLASE: 7 loaders GET que hacían `throw new Error(\`HTTP
 * ${status}\`)` y descartaban el cuerpo. El fix lee el cuerpo y usa
 * `cuerpo?.error?.message ?? "<frase> (HTTP ${status})."`.
 *
 * CONDUCTA CON DATO REAL —lo único que no se puede fingir ([[dev-candado-conducta-no-palabras]])—:
 * se moquea el fetch para que la ruta responda !ok con {error:{message: CENTINELA}},
 * se RENDERIZA el componente y se exige que la CENTINELA aparezca en pantalla Y que
 * «HTTP 400» NO. Un candado que solo verifique «no dice HTTP 400» lo pasa cualquier
 * frase bonita ([[ceo-el-texto-que-miente-sostiene-el-hueco]]); exigir la CENTINELA
 * exacta prueba que el mensaje del servidor LLEGA al usuario. Si un componente vuelve
 * a `throw new Error(\`HTTP ${status}\`)`, la pantalla mostraría «HTTP 400» y NO la
 * centinela → rojo por las dos aserciones (mutación-verificado).
 *
 * El octavo del barrido (ProfesorDetallePageClient · /api/plataformas) NO está aquí:
 * se traga el cuerpo hacia un botón de reintento (radicado I-415, aparte) — otro
 * estado, otra decisión de Diseño.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { VerificadoresGestionClient } from "@/components/modules/verificadores-admin/VerificadoresGestionClient";
import { VerificacionColaClient } from "@/components/modules/verificacion/VerificacionColaClient";
import { IncidentesColaClient } from "@/components/modules/verificacion/IncidentesColaClient";
import { ProfesionalesGestionClient } from "@/components/modules/profesionales-admin/ProfesionalesGestionClient";
import { SolicitarCitaPanel } from "@/components/modules/padre/profesionales/SolicitarCitaPanel";

// SolicitarCitaPanel usa useRouter; el resto no toca next/navigation.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const CENTINELA = "MENSAJE_DEL_SERVIDOR_CENTINELA_689";

/** Cualquier fetch → !ok 400 con el mensaje del servidor en el cuerpo. */
function stubFetchConMensaje() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: CENTINELA } }),
            text: async () => JSON.stringify({ error: { message: CENTINELA } }),
        })),
    );
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

type Caso = { nombre: string; montar: () => void };
const CASOS: Caso[] = [
    { nombre: "DocumentosRequisitos", montar: () => render(<DocumentosRequisitos />) },
    { nombre: "VerificadoresGestionClient", montar: () => render(<VerificadoresGestionClient />) },
    { nombre: "VerificacionColaClient", montar: () => render(<VerificacionColaClient />) },
    { nombre: "IncidentesColaClient", montar: () => render(<IncidentesColaClient />) },
    { nombre: "ProfesionalesGestionClient · Cuentas", montar: () => render(<ProfesionalesGestionClient />) },
    {
        nombre: "ProfesionalesGestionClient · Solicitudes",
        montar: () => {
            render(<ProfesionalesGestionClient />);
            fireEvent.click(screen.getByText("Solicitudes pendientes"));
        },
    },
    {
        nombre: "SolicitarCitaPanel · franjas",
        montar: () =>
            render(
                <SolicitarCitaPanel
                    profesionalId="p1"
                    tarifaProfesionalCOP={100000}
                    precioEstandarPrimeraCitaCOP={120000}
                    duracionMinutos={50}
                />,
            ),
    },
];

describe("SPEC-689 (I-410) · la pantalla muestra el mensaje del servidor, no «HTTP NNN»", () => {
    for (const c of CASOS) {
        it(`${c.nombre}: renderiza el mensaje del servidor y NO «HTTP 400»`, async () => {
            stubFetchConMensaje();
            c.montar();
            await waitFor(() => {
                expect(
                    document.body.textContent ?? "",
                    `«${c.nombre}» no mostró el mensaje del servidor (${CENTINELA})`,
                ).toContain(CENTINELA);
            });
            // El mensaje va EN LUGAR del código crudo: si aparece «HTTP 400», el
            // componente volvió a descartar el cuerpo (el defecto de I-410).
            expect(
                document.body.textContent ?? "",
                `«${c.nombre}» filtró «HTTP 400» crudo en vez del mensaje del servidor`,
            ).not.toContain("HTTP 400");
        });
    }
});
