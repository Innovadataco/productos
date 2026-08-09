# Cierre: SPEC-148 — Profesores + buscador global ⌘K

**Fecha**: 2026-08-08 · **Radicado**: 002-PI-058 (continuación D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `9923fddb` búsqueda+endpoint · `e65e8ca5`
  CommandPalette+buscador · `91321dd0` página+nav · `99ca4442` tokens puros.
- Checks de día (exit 0): `tsc` · `lint` · `tokens:check` (1122 ≤ piso) ·
  `arch:check` VERDE (oráculo 55, 89 hrefs).
- Tests nuevos (43): repo búsqueda 6 (A/B, timing 500 < 200 ms) · endpoint 6 ·
  palette a11y 11 · buscador 7 · página profesores 10. Área: 18 archivos / 115
  verdes (CRUD SPEC-145 intacto).

## Qué se entregó (FR → evidencia)

- FR-001: `/dashboard/colegio/profesores/` sobre el CRUD existente sin tocarlo:
  tabla, filtro activos/inactivos, buscador debounce, formulario con mensajes
  humanos, baja suave + reactivar (COND-2: titular histórico intacto).
- FR-002/003/004: `CommandPalette` (portal, focus trap, combobox/listbox aria, ↑↓
  Enter Esc, restauración de foco) + `BuscadorGlobal` montado en el layout del
  colegio (⌘K/Ctrl+K, debounce 280 ms) + `GET /api/colegio/buscar` tenant-first
  (solo activos, ≥2 caracteres, top 5 + restantes, prefijo primero, A/B).
- FR-005: nav "Profesores" + placeholder de la home reemplazado (excepción
  sancionada en su test, solo href).

## Desviaciones y hallazgos

- El piso del ratchet quedó en 1122 (las clases iniciales del buscador lo subían a
  1139 → migradas a tokens en `99ca4442`; regla: el código nuevo nunca sube el
  número).
- Cada apertura de ⌘K reinicia consulta/resultados (arranque limpio y
  determinista).

## Deuda técnica

- El destino de estudiante del buscador es la ficha vieja `alumnos/[id]` (su
  renovación es otra spec).
- Búsqueda solo personas/cursos (no identificadores/nicks) — ampliable.
