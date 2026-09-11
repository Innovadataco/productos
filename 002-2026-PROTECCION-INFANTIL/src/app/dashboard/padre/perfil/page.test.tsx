/**
 * SPEC-607 · «Mi perfil» unificado: UNA página con tres acordeones nativos
 * (Información general · Notificaciones · Suscripción) y el acordeón de Suscripción
 * abierto por defecto cuando el padre no tiene cobertura (destino del guardián de vigencia).
 *
 * SPEC-609 (reparo 3, revierte SPEC-598): ya NO hay botón «Crear contraseña». En su lugar, la fila
 * «Cómo entras» muestra el estado real de la cuenta (Con Google / Con correo y contraseña).
 *
 * Candado de conducta: mockea auth + servicios de pagos + componentes hijos (sin BD). Muere por
 * mutación: cerrar un acordeón que debe nacer abierto, cambiar un id (rompe los redirects con ancla),
 * o re-ofrecer «Crear contraseña» → rojo (ver también una-cuenta-una-puerta.candado.test.ts).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const verifyAuthMock = vi.fn();
const suscripcionTitularMock = vi.fn();
const vistaSuscripcionMock = vi.fn();
const cuponesMock = vi.fn();
const listarPlanesMock = vi.fn();
const tasaIvaMock = vi.fn();
const aplicaIvaMock = vi.fn();

vi.mock("@/lib/auth", () => ({ verifyAuth: (...a: unknown[]) => verifyAuthMock(...a) }));
vi.mock("@/lib/pagos/suscripcion-vista.service", () => ({
    obtenerSuscripcionTitular: (...a: unknown[]) => suscripcionTitularMock(...a),
    obtenerVistaSuscripcion: (...a: unknown[]) => vistaSuscripcionMock(...a),
}));
vi.mock("@/lib/pagos/entregar-cupones-recompensa.service", () => ({
    obtenerCuponesRecompensaDelUsuario: (...a: unknown[]) => cuponesMock(...a),
}));
vi.mock("@/lib/dal/repositories/pagos-cliente-repository", () => ({
    PagosClienteRepository: class {
        listarPlanesActivosPorTitular = (...a: unknown[]) => listarPlanesMock(...a);
    },
}));
vi.mock("@/lib/pagos/parametros-pagos", () => ({
    obtenerTasaIva: (...a: unknown[]) => tasaIvaMock(...a),
    ivaAplicaA: (...a: unknown[]) => aplicaIvaMock(...a),
}));
vi.mock("@/lib/pagos/renovacion-calculos", () => ({ anioBogota: () => 2026 }));
vi.mock("@/lib/pagos/suscripcion-solicitud.service", () => ({ solicitarPlan: vi.fn() }));
vi.mock("@/lib/pagos/freemium-activacion.service", () => ({ activarFreemiumConRateLimit: vi.fn() }));
vi.mock("@/lib/routing/sellar-sesion-estado", () => ({ sellarCookieSesionEstadoEnAccion: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>{children}</a>
    ),
}));

vi.mock("@/components/modules/padre/PerfilPadreForm", () => ({
    PerfilPadreForm: () => <div data-testid="perfil-form" />,
}));
vi.mock("@/components/modules/padre/HistorialCambiosPerfil", () => ({
    HistorialCambiosPerfil: () => <div data-testid="historial-cambios" />,
}));
vi.mock("@/components/modules/perfil/PreferenciasNotificaciones", () => ({
    PreferenciasNotificaciones: () => <div data-testid="preferencias-notificaciones" />,
}));
vi.mock("@/components/modules/cliente/suscripcion/SuscripcionVista", () => ({
    SuscripcionVista: () => <div data-testid="suscripcion-vista" />,
}));
vi.mock("@/components/modules/pagos/PlanesSelector", () => ({
    PlanesSelector: () => <div data-testid="planes-selector" />,
}));
vi.mock("@/components/modules/pagos/EsperandoAutorizacion", () => ({
    EsperandoAutorizacion: () => <div data-testid="esperando-autorizacion" />,
}));

import PadrePerfilPage from "./page";

const SIN_PARAMS = Promise.resolve({});

function usuario(override: Record<string, unknown> = {}) {
    return {
        id: "padre-1",
        rol: "PARENT",
        colegioId: null,
        email: "padre@ejemplo.co",
        nombre: "Andrés",
        googleSub: null,
        passwordCreadaEn: "2026-09-01T00:00:00.000Z",
        ...override,
    };
}

const SUSCRIPCION_ACTIVA = {
    id: "sub-1",
    estado: "ACTIVA",
    fechaInicio: new Date("2026-09-01"),
    fechaFin: new Date("2026-10-01"),
    planActual: { nombre: "Familiar" },
};

describe("SPEC-607 · /dashboard/padre/perfil — una ventana, tres acordeones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        verifyAuthMock.mockResolvedValue(usuario());
        suscripcionTitularMock.mockResolvedValue(SUSCRIPCION_ACTIVA);
        vistaSuscripcionMock.mockResolvedValue({ plan: "Familiar" });
        cuponesMock.mockResolvedValue([]);
        listarPlanesMock.mockResolvedValue([]);
        tasaIvaMock.mockResolvedValue(0.19);
        aplicaIvaMock.mockResolvedValue(true);
    });

    it("renderiza los 3 acordeones con sus ids de ancla y el contenido de cada uno", async () => {
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        // Los ids son el contrato de los redirects con ancla (#general es cortesía).
        expect(screen.getByTestId("acordeon-general").id).toBe("general");
        expect(screen.getByTestId("acordeon-notificaciones").id).toBe("notificaciones");
        expect(screen.getByTestId("acordeon-suscripcion").id).toBe("suscripcion");

        expect(screen.getByText("Información general")).toBeTruthy();
        expect(screen.getByText("Notificaciones")).toBeTruthy();
        expect(screen.getByText("Suscripción")).toBeTruthy();

        // Cada acordeón lleva el contenido de su antigua pantalla.
        expect(screen.getByTestId("perfil-form")).toBeTruthy();
        expect(screen.getByTestId("historial-cambios")).toBeTruthy();
        expect(screen.getByTestId("preferencias-notificaciones")).toBeTruthy();
        // SPEC-628 #4: Suscripción muestra la NOTA «en pausa», no la vista viva.
        expect(screen.getByTestId("suscripcion-en-pausa")).toBeTruthy();
        expect(screen.queryByTestId("suscripcion-vista")).toBeNull();
    });

    it("con cobertura ACTIVA: «Información general» nace abierta y «Suscripción» cerrada", async () => {
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        expect(screen.getByTestId("acordeon-general").hasAttribute("open")).toBe(true);
        expect(screen.getByTestId("acordeon-suscripcion").hasAttribute("open")).toBe(false);
        expect(screen.getByTestId("acordeon-notificaciones").hasAttribute("open")).toBe(false);
    });

    it("SIN suscripción (SPEC-628 #4): «Suscripción» muestra la nota de pausa, SIN selector de planes", async () => {
        suscripcionTitularMock.mockResolvedValue(null);
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        // «Quieto = apagado»: ni siquiera sin cobertura se ofrece el selector vivo
        // (sus precios son placeholders declarados). Solo la nota honesta.
        expect(screen.getByTestId("suscripcion-en-pausa")).toBeTruthy();
        expect(screen.queryByTestId("planes-selector")).toBeNull();
    });

    it("PENDIENTE_AUTORIZACION (SPEC-628 #4): «Suscripción» también muestra la nota, sin la pantalla de espera", async () => {
        suscripcionTitularMock.mockResolvedValue({ ...SUSCRIPCION_ACTIVA, estado: "PENDIENTE_AUTORIZACION" });
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        expect(screen.getByTestId("suscripcion-en-pausa")).toBeTruthy();
        expect(screen.queryByTestId("esperando-autorizacion")).toBeNull();
    });

    it("SPEC-628 #4: con la pausa NINGÚN control vivo de suscripción se renderiza, en los tres estados", async () => {
        // El test que de verdad cierra la pausa: no basta con que la nota aparezca;
        // hay que afirmar la AUSENCIA de los controles vivos (selector/vista/espera).
        for (const sus of [SUSCRIPCION_ACTIVA, null, { ...SUSCRIPCION_ACTIVA, estado: "PENDIENTE_AUTORIZACION" }]) {
            suscripcionTitularMock.mockResolvedValue(sus);
            const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
            const { unmount } = render(jsx as React.ReactElement);
            expect(screen.getByTestId("suscripcion-en-pausa")).toBeTruthy();
            expect(screen.queryByTestId("planes-selector")).toBeNull();
            expect(screen.queryByTestId("suscripcion-vista")).toBeNull();
            expect(screen.queryByTestId("esperando-autorizacion")).toBeNull();
            unmount();
        }
    });

    it("SPEC-609: cuenta de Google sin clave → «Cómo entras: Con Google» y NINGÚN «Crear contraseña»", async () => {
        verifyAuthMock.mockResolvedValue(usuario({ googleSub: "g-123", passwordCreadaEn: null }));
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        expect(screen.getByTestId("como-entras").textContent).toContain("Con Google");
        // SPEC-609 revierte SPEC-598: el botón «Crear contraseña» ya no se ofrece.
        expect(screen.queryByText("Crear contraseña")).toBeNull();
    });

    it("SPEC-609: cuenta con contraseña local → «Cómo entras: Con correo y contraseña», sin «Crear contraseña»", async () => {
        const jsx = await PadrePerfilPage({ searchParams: SIN_PARAMS });
        render(jsx as React.ReactElement);

        expect(screen.getByTestId("como-entras").textContent).toContain("Con correo y contraseña");
        expect(screen.queryByText("Crear contraseña")).toBeNull();
    });

    it("?bienvenida=1 sigue llegando al acordeón de suscripción (el redirect de la ruta vieja no se rompe aunque esté en pausa)", async () => {
        const jsx = await PadrePerfilPage({ searchParams: Promise.resolve({ bienvenida: "1" }) });
        render(jsx as React.ReactElement);

        // El ancla/acordeón sigue existiendo (no dejamos un enlace muerto en el
        // producto); hoy muestra la nota en pausa, no la vista viva.
        expect(screen.getByTestId("acordeon-suscripcion").id).toBe("suscripcion");
        expect(screen.getByTestId("suscripcion-en-pausa")).toBeTruthy();
    });
});
