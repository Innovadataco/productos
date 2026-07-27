# Feature Specification: Sello de versión (dev y prod)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: FINALIZADO (pendiente ACTA)

## Contexto

Cola nocturna 002-PI-014, Fase 3. Sello de versión visible y trazabilidad del build.

## Requisitos

- **FR-001**: Pie PÚBLICO: `© 2026 Innovadataco. Todos los derechos reservados. · Versión 1.0.0`
  + enlaces Privacidad · Términos. SIN SHA ni fecha en el pie público.
- **FR-002**: Panel ADMIN (autenticado): Versión 1.0.0 + SHA corto del build. El SHA NO viaja
  al cliente público: se expone solo por servidor en el área admin (NUNCA `NEXT_PUBLIC_`).
- **FR-003**: `{X}=1.0.0` desde `package.json` (subir `version` a 1.0.0); `{SHA}=git rev-parse
  --short HEAD` inyectado en build por `dev-restart.sh` y `deploy-prod.sh`/`Dockerfile`
  (variable de build NO pública, p.ej. `APP_BUILD_SHA`). Si falta el SHA, no romper (ocultar
  el SHA, mostrar solo la versión).

## Success Criteria

- **SC-001**: Pie público con versión y enlaces, sin SHA (verificar en el HTML servido que el
  SHA no aparece en páginas públicas).
- **SC-002**: Área admin muestra versión + SHA del build.
- **SC-003**: Build sin la variable de SHA no falla.
- **SC-004**: Gate verde (lint + test + tsc + build).
