# SPEC-607 · Checklist de requisitos

## Completitud del contenido

- [x] User Stories con prioridad y escenarios de aceptación (US-1 menú, US-2 perfil, US-3 hijos).
- [x] Functional Requirements «El sistema DEBE…» (FR-001…FR-008; FR-008 = ratchet hijos sin documento).
- [x] `## Impacto en arquitectura:` explícito — navegación y guardias SÍ; schema NO cambia en este PR (SPEC-589 ya eliminó las columnas).
- [x] Criterios de éxito medibles y ligados a tests.
- [x] Supuestos y deuda técnica declarados.

## Calidad

- [x] Sin ambigüedad en los ítems del menú (6 entradas exactas del mockup aprobado).
- [x] Redirects de rutas viejas especificados con ancla y conservación de `?bienvenida=1`.
- [x] Riesgo de bucle del guardián de vigencia identificado y cerrado por diseño (exenciones) y por tests.
- [x] Todos los requisitos cubiertos por tareas (ver `tasks.md`, T001–T013 completas).
