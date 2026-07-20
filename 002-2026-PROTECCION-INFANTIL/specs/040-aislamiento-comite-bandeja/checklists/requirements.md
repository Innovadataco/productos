# Requirements Checklist — Spec 040

## User Story 1 — Aislar al comité a su Bandeja

- [x] `ComiteSubNav` recibe el rol del usuario (prop desde server component).
- [x] `ComiteSubNav` filtra pestañas: `COMITE_VALIDACION` ve solo "Bandeja".
- [x] `ADMIN`/`SCHOOL_ADMIN` ven "Bandeja", "Gestión" y "Auditoría".
- [x] El proxy redirige a `COMITE_VALIDACION` desde `/dashboard/admin/comite/gestion` a `/dashboard/admin/comite`.
- [x] El proxy redirige a `COMITE_VALIDACION` desde `/dashboard/admin/comite/auditoria` a `/dashboard/admin/comite`.
- [x] `ADMIN`/`SCHOOL_ADMIN` acceden a `/dashboard/admin/comite/gestion` sin redirección.
- [x] `ADMIN`/`SCHOOL_ADMIN` acceden a `/dashboard/admin/comite/auditoria` sin redirección.
- [x] `verifyAuth` sigue usándose en endpoints y layouts (defensa en profundidad).
- [x] No hay parpadeo de pestañas prohibidas al cargar el SubNav (rol leído en server component).

## User Story 2 — Verificar flujo del comité

- [x] El operador puede escalar un caso al comité.
- [x] El caso aparece en "Pendientes" de la bandeja del comité.
- [x] El comité puede tomar el caso y pasa a "Mías".
- [x] El comité puede finalizar el caso con decisión `CORREGIDO`.
- [x] No se detectaron bugs que requieran documentación como deuda técnica.

## General

- [x] Todos los artefactos Spec-Kit están creados.
- [x] `npm run lint` pasa sin errores.
- [x] `npx tsc --noEmit` pasa sin errores.
- [x] `npm run test` pasa.
- [x] `npm run build` compila exitosamente.
- [x] `./scripts/dev-restart.sh` levanta la app con un solo worker.
- [x] Se completó el `quickstart.md` manualmente.
- [x] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [x] Se registró deuda técnica (ninguna nueva).
- [x] Se hicieron commits: uno por User Story + uno de docs.
- [x] Se hizo push a `feature/001-scaffolding`.
