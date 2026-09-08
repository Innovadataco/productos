/**
 * SPEC-599 · Tipos del wizard de registro de hijo (aprobado sobre el mockup
 * `design/padre-hijos-registro-mockup.html`, que el dueño validó).
 *
 * SPEC-589: la ficha del menor NO pide documento (decisión CEO 06-09-2026) —
 * nombre y apellidos obligatorios; edad (5-17), sexo e identificadores opcionales.
 */

/** Datos del paso 2. `edad: null` = «sin especificar» (como el select real). */
export type DatosHijoForm = {
    nombre: string;
    apellidos: string;
    edad: number | null;
    sexo: string;
};

/** Identificador aún no guardado: se acumula en el formulario de alta. */
export type IdentificadorNuevo = { valor: string; plataformaId: string };

/** Errores amables del paso 2 (se nombran los campos, como pide SPEC-361/F7). */
export type ErroresPasoDatos = { nombre?: string; apellidos?: string };

export const FORM_VACIO: DatosHijoForm = { nombre: "", apellidos: "", edad: null, sexo: "" };

export const IDENTIFICADOR_VACIO: IdentificadorNuevo = { valor: "", plataformaId: "" };
