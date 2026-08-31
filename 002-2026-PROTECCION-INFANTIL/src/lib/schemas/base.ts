import { z } from "zod";

/**
 * Primitivas de validación compartidas. Extraídas de `index.ts` (SPEC-320) para
 * mantenerlo bajo el límite de líneas y permitir que módulos de esquemas por
 * dominio (p. ej. `identidad.ts`) las reutilicen sin ciclo de imports.
 */

// Identificadores y claves
export const cuidIdSchema = z.string().cuid();

// SPEC-173 (H02): Materia tiene ids mixtos en prod (uuid heredado + cuid nuevo).
export const materiaIdSchema = z.union([cuidIdSchema, z.string().uuid()]);

export const emailSchema = z.string().email().max(255);

export const parametroClaveSchema = z.string().min(1).max(100);

export const estadoActivoSchema = z.enum(["activo", "inactivo"]);
