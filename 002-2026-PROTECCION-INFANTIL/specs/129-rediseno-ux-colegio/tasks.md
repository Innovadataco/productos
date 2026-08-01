# Tasks: SPEC-129 — Rediseño de UX del panel del colegio

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-051 PARTE B). Este archivo existe
como marcador para la disciplina de specs; no contiene tareas aún.

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. C1: test de aterrizaje (TDD) + logo del SCHOOL_ADMIN a su panel en `NavHeader.tsx`.
2. C3: `ColegioSideNav` (patrón AdminNav, filtro D-41) montado en `layout.tsx`.
3. C2/C3: home del colegio = consulta pública + estadísticas (componentes reusados).
4. C4: listas de cursos/alumnos con acciones en línea (modales SPEC-124).
5. C5: alertas — encabezado, empty state con CTA y badges de estado.
6. C6: auditoría en lenguaje natural (mapa acción→frase, sin JSON crudo).
7. Gates: suite + tsc + lint + build + arch:check; validación con `quickstart.md`.
8. Cierre: sección Implementación en spec.md + índice specs/README.md.
