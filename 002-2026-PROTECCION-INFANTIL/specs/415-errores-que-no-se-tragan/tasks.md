# Tareas · SPEC-415 — Los errores que se tragaban a alguien

- [x] T001 Barrido de `src/`: 140 coincidencias brutas → 34 reales, clasificadas en A/B/C/D/E y entregadas al CEO **sin arreglar nada**.
- [x] T002 Grupo B (5): `logger.error` con prefijo `[Seguridad]` en el fallo del aviso de cambio de clave. Sigue sin bloquear.
- [x] T003 A-1 `comite/integrantes/page.tsx`: `.catch(() => [])` → `null` distinguible, registrado y explicado en pantalla («no dupliques personas»).
- [x] T004 A-2 `InformesCasoPanel.tsx`: estado de error propio; cubre también el `if (!res.ok) return` mudo.
- [x] T005 A-3 `NotificacionesInbox.tsx`: contador `number | null`; `null` = no se pudo preguntar, con marca visible y `aria-label`.
- [x] T006 `src/lib/errores-no-mudos.test.ts` (13) — candado estático de los ocho, ignorando comentarios.
- [x] T007 `NotificacionesInbox.test.tsx` (4) — comportamiento del badge.
- [x] T008 **Contraprueba**: reintroducir el `catch {}` mudo en `auth/cambiar-password` → 2 tests en rojo; restaurado → 13 en verde.
- [x] T009 Gate (`tsc`, `lint`, `tokens:check`, unit) + fila en `specs/README.md` + PR.

## Fuera de esta spec, por decisión del CEO

- **A restante (13)**: listas de simulaciones, apelaciones, KPI, documentos, catálogos.
- **C (5)**: cookie de estado muda → se junta con **I-236**.
- **D (8)**: parámetro malformado cae al default sin avisar → después.
- **E (7)**: benignos, no se tocan.
