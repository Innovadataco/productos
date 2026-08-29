# Implementation Plan: Panel de spam · confianza real + motivo — SPEC-262

**Branch**: `work/002-PI-ciclo-operador` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0 §4.2 §5.2

---

## Summary

Sustituir la fórmula `confianzaSpam: r.clasificacion?.categoria === "SPAM" ? r.clasificacion.confianza : 0` (línea 82 de `api/admin/spam/pendientes/route.ts`) por una derivación honesta del motivo de ingreso, reutilizando `detectarSpamPublicitarioDeterministico` y `ClasificacionIA.categoriasSecundarias`. Añadir `motivoIngreso` a la respuesta y a la UI. Sin migraciones. Sin cambios en `src/lib/ai/**`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| Language/Version | TypeScript 5.x / Node.js >=22 |
| Primary Dependencies | Prisma 5.22.0, Zod (schema), Vitest, jsdom + Testing Library |
| Testing | Vitest de la ruta (Request nativo) + componente `SpamPendientesTable` (o el existente) |
| Constraints | Cero migraciones · cero cambios en `src/lib/ai/**` · panel sigue solo ADMIN · candado I-100 (usar upsert donde aplique) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.3 Presunción de inocencia | ✅ Pass | Muestra motivo del motor, no juicio sobre personas |
| §2.1 Stack heredado | ✅ Pass | Reutiliza rutas/Prisma existentes |
| §3.1 TypeScript strict | ✅ Pass | Enum literal + tipos derivados |
| §3.4 HTTP codes | ✅ Pass | 200/400/403 igual que hoy |
| §5 Testing | ✅ Pass | Tests que abren el componente además de la ruta |

---

## Implementation Steps

### Phase 1 — Helper derivador
1. Crear `src/lib/spam/motivo-ingreso.ts` con:
   ```ts
   export type MotivoIngresoSpam = "spam_confianza_alta" | "spam_dominancia" | "spam_publicitario_deterministico" | "desconocido";

   export function derivarMotivoIngreso(input: {
     categoria?: CategoriaConducta | null;
     confianza?: number | null;
     categoriasSecundarias?: { categoria: string; score: number }[] | null;
     texto: string;
     umbralSpam: number;
     umbralDominancia: number;
     dominiosAcortadores: string[];
   }): { motivo: MotivoIngresoSpam; confianzaSpam: number | null };
   ```
   Orden de evaluación: `spam_confianza_alta` → determinística → dominancia → desconocido. Emula el orden real del motor (`guardas-decision.ts:124..156`).
2. Tests puros del helper (≥7 casos): SPAM ganador, dominancia, determinística, sin clasificación, secundarias vacías, mixto (ganó SPAM Y determinística — gana `spam_confianza_alta`).

### Phase 2 — Endpoint
3. Editar `src/app/api/admin/spam/pendientes/route.ts`:
   - Cargar en paralelo `spam.confianza_minima`, `spam.dominancia_umbral` y `spam.dominios_acortadores` con `getParametroSistema`.
   - Reemplazar la fórmula literal por `derivarMotivoIngreso(...)`.
   - Añadir `motivoIngreso` al objeto de respuesta.
   - Extender `spamPendientesQuerySchema` con `motivo?: MotivoIngresoSpam` y aplicar filtro **en memoria** (el motivo no vive en la BD; filtrar en SQL requeriría migración, fuera de alcance).
4. Extender `SELECT_BANDEJA_SPAM` con `categoriasSecundarias`.
5. Test de ruta (`route.test.ts`) con seed de las 4 variantes (US1 escenarios 1–4).

### Phase 3 — UI
6. Localizar el componente que consume `/api/admin/spam/pendientes` (subcarpeta `src/components/modules/spam/`) y añadir la columna "Motivo" con etiqueta legible en español:
   - `spam_confianza_alta` → "por confianza alta"
   - `spam_dominancia` → "por dominancia SPAM"
   - `spam_publicitario_deterministico` → "regla determinística"
   - `desconocido` → "sin datos"
7. Cuando `confianzaSpam === null`, la celda de confianza muestra "—" en lugar de "0.0 %".
8. Test de componente que abre la tabla con las 4 variantes.

### Phase 4 — Gate local
9. `npx tsc --noEmit`
10. `npm run lint`
11. `npm run test`
12. `npm run arch:check`
13. `npm run build`

---

## Risk & Rollback

- Riesgo bajo: el cambio es local al endpoint y a un componente. Rollback revirtiendo `fix(SPEC-262)`.
- Riesgo tocable: si el filtro `motivo` en memoria acaba paginando mal cuando hay muchos resultados, se documenta como limitación y se contempla índice en spec futura (fuera de alcance).

---

## Out of Scope

- Persistir `motivoIngreso` en `ClasificacionIA` (requeriría migración; el brief lo prohíbe).
- Mover el panel de spam o abrirlo al OPERADOR (candado del INSTRUCTIVO — solo ADMIN).
- Tocar `src/lib/ai/**`.
