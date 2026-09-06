/**
 * SPEC-562 (I-345) · CANDADO: en el modal del reporte, «Confirmar clasificación»
 * NO es el primer control tabable del contenido.
 *
 * Confirmar puede volver PÚBLICO el reporte de un menor. Si es el primer tabable,
 * queda a un Tab + Enter de abrir el modal — un disparo accidental sin gesto
 * deliberado. Diseño (FORMA-MODAL-REPORTE-OPERADOR) ordenó «Corregir» ANTES que
 * «Confirmar», en el DOM y en pantalla a la vez (el foco no se divorcia del ojo):
 * el primer tabable pasa a ser el <select> de corregir —benigno, recibir foco no
 * dispara nada—, y Confirmar queda segundo, deliberado.
 *
 * Conducta: un Enter reflejo tras abrir el detalle cae en el <select>, NO en
 * Confirmar. Mutación en las dos direcciones: si Confirmar vuelve al primer
 * puesto, rojo. NO hay doble confirmación (la red es el deshacer de 8 s, SPEC-557).
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccionesReporte } from "./AccionesReporte";
import type { DetalleReporte } from "./types";

// Reporte en REVISION_MANUAL con clasificación sin corregir → puedeConfirmar &&
// puedeCorregir ambos true (los dos bloques presentes, que es el caso a vigilar).
function reporteRevision(): DetalleReporte {
    return {
        id: "r1", identificador: "+57300", plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
        texto: "…", estado: "REVISION_MANUAL", ciudad: "Bogotá", pais: "Colombia",
        fechaIncidente: "2026-07-10T10:00:00Z", esAnonimo: false, numeroSeguimiento: "RPT-562",
        creadoEn: "2026-07-10T12:00:00Z", prioridadAlta: false, keywordsDetectadas: [],
        esRafaga: false, eliminado: false, motivoBaja: null, notaBaja: null, eliminadoEn: null,
        clasificacion: {
            categoria: "OFRECIMIENTO_REGALOS", confianza: 0.8, contienePii: false, piiDetectada: [],
            modeloUsado: "ornith:9b", latenciaMs: 1000, categoriasSecundarias: [],
            posibleAgresorPar: false, correccion: null,
        },
    };
}

const noop = () => {};
const asyncNoop = async () => {};

function props() {
    return {
        reporte: reporteRevision(),
        puedeEscalarProp: false,
        textoAnonimizado: "", setTextoAnonimizado: noop,
        categoriaCorreccion: "", setCategoriaCorreccion: noop,
        motivoCorreccion: "", setMotivoCorreccion: noop,
        actionLoading: false, confirmando: false,
        mostrarBaja: false, setMostrarBaja: noop, motivoBaja: "", setMotivoBaja: noop,
        notaBaja: "", setNotaBaja: noop,
        mostrarReactivar: false, setMostrarReactivar: noop, notaReactivar: "", setNotaReactivar: noop,
        mostrarEscalar: false, setMostrarEscalar: noop, motivoEscalar: "", setMotivoEscalar: noop,
        observacionesValidacion: "", setObservacionesValidacion: noop, validando: false,
        handleAnonimizar: asyncNoop, handleConfirmar: asyncNoop, handleCorregir: asyncNoop,
        handleBaja: asyncNoop, handleReactivar: asyncNoop, handleValidarAnonimizacion: asyncNoop,
        handleEscalar: asyncNoop,
    };
}

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

describe("SPEC-562 · orden de foco: Confirmar no es el primer tabable", () => {
    it("el PRIMER control tabable del contenido es el <select> de corregir, no Confirmar", () => {
        const { container } = render(<AccionesReporte {...props()} />);
        const focusables = [...container.querySelectorAll(FOCUSABLE)];
        const select = container.querySelector('[data-testid="select-correccion-categoria"]');
        expect(select, "el select de corrección debe existir").toBeTruthy();
        // Un Enter reflejo tras abrir cae acá (benigno), no en Confirmar.
        expect(focusables[0]).toBe(select);
    });

    it("«Confirmar clasificación» existe pero va DESPUÉS del select (deliberado)", () => {
        const { container } = render(<AccionesReporte {...props()} />);
        const focusables = [...container.querySelectorAll(FOCUSABLE)];
        const select = container.querySelector('[data-testid="select-correccion-categoria"]');
        const confirmar = screen.getByRole("button", { name: "Confirmar clasificación" });
        expect(focusables.indexOf(select as Element)).toBeLessThan(focusables.indexOf(confirmar));
    });
});
