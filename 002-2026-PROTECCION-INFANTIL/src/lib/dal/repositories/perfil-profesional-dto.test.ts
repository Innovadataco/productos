/**
 * SPEC-392 (L3) · H-2 · veredicto CEO 13:30 — la allowlist protege, pero es
 * convención; el DTO protege por TIPO.
 *
 * Este test es sintético: no toca BD, no llama al repo. Solo firma un contrato
 * a nivel de tipo — si alguien mañana amplía `PerfilPublicoDTO` con un campo
 * prohibido (email, teléfono, tarjeta profesional, datos de facturación,
 * resultado de verificación, checklist, autorización, nota interna), el
 * compilador rechaza este archivo. TS no compila → CI rojo → cambio bloqueado.
 *
 * Cambia solo si el brief legal cambia. Cualquier renombre a los `never` de
 * abajo requiere una decisión explícita.
 */
import { describe, it, expect } from "vitest";
import type { PerfilPublicoDTO } from "./perfil-profesional";

// Assert de tipo por intersección: si `PerfilPublicoDTO` gana un campo con este
// nombre, el `keyof` deja de ser subset del `EsperadoKeys` y `AssertNever` explota.
type Prohibido =
    | "email"
    | "telefono"
    | "documentoTipo"
    | "documentoNumero"
    | "fechaNacimiento"
    | "apellidos"
    | "nombre"
    | "numeroTarjetaProfesional"
    | "datosFacturacion"
    | "resultado"
    | "checklist"
    | "autorizacionArchivoUrl"
    | "notaInterna"
    | "avisoVencimientoEnviadoEn";

type CamposDTO = keyof PerfilPublicoDTO;
type Interseccion = Extract<CamposDTO, Prohibido>;

// La intersección de las claves del DTO con la lista de prohibidos DEBE ser `never`.
// Si algún día no lo es, este archivo no compila.
type AssertNever<T extends never> = T;
type _prueba = AssertNever<Interseccion>;

describe("PerfilPublicoDTO · H-2 · tipo blindado por Ley 2375/2024", () => {
    it("la intersección con campos prohibidos es never (verificado por el compilador)", () => {
        // El verdadero test corre en `tsc`: si _prueba no compila, este archivo no llega.
        // Este assert de runtime existe solo para que Vitest tenga un test que contar.
        const _tipoOk: _prueba = undefined as never;
        expect(_tipoOk).toBeUndefined();
    });
});
