# Research — SPEC-105

**Date**: 2026-07-27

## Hallazgo verificado (fuente)

`prisma/seed.ts:11-28`: upsert del admin `soporte@innovadataco.com` (rol ADMIN) con
contraseña literal en el archivo versionado, `debeCambiarPassword:false`, y bloque `update:`
que REESCRIBE el hash en cada corrida → rotarla a mano no sirve mientras el literal exista.

## Decisiones

- **Decisión: variable `SEED_ADMIN_PASSWORD` sin default; `SEED_ADMIN_EMAIL` con default
  no secreto.**
  Rationale: el email ya es público (está en el seed y es el contacto de soporte); la
  contraseña es la que no puede vivir en git. Default de email evita configuración extra en
  dev sin abrir superficie.
  Alternativas consideradas: una sola variable `SEED_ADMIN_CREDENTIALS` (menos clara);
  no sembrar admin jamás y crearlo a mano (rompe el flujo de setup dev documentado).

- **Decisión: create puro con chequeo previo de existencia (no upsert, no `update:`).**
  Rationale: FR-002 — el seed nunca pisa una credencial rotada; es la corrección directa
  del defecto reportado. El chequeo `findUnique` previo además permite log informativo.
  Alternativas: `create` con `skipDuplicates` (igual de seguro pero sin log claro de
  "existente, sin cambios").

- **Decisión: `debeCambiarPassword: true` en el create.**
  Rationale: la contraseña sembrada es de arranque; el primer ingreso la rota
  (el enforcement central ya existe desde la SPEC-100: cualquier rol con el flag es
  redirigido a `/cambiar-password`).

- **Decisión: sin la variable, omitir el admin con log y NO fallar el seed.**
  Rationale: el seed se ejecuta en migraciones/CI/dev donde el resto de entidades sigue
  siendo necesario; un seed que aborta rompe más de lo que protege. La ausencia de admin se
  documenta en quickstart.

- **Decisión: barrido como script de repo (`scripts/barrido-credenciales.ts`) con reporte
  sin valores.**
  Rationale: repetible en CI a futuro; cumple FR-005 y la regla I-22 (solo ubicación/tipo).
  Alternativas: grep manual documentado (no repetible, fácil de olvidar).

- **Decisión: otros usuarios sembrados (colegio/operador/comité) entran al barrido, no se
  tocan en esta spec.**
  Rationale: son usuarios reales del CEO/equipo con sus propias credenciales; cambiar su
  siembra puede requerir decisión de negocio (el comité usa clave temporal generada por el
  sistema, distinto al admin). Se reporta a ZEUS.

## Referencias

- Enforcement de cambio de contraseña por rol (SPEC-100): layouts `dashboard/*` +
  `debeCambiarPassword` en proxy.
- Regla dura I-22 (SPEC-099, `AGENTS.md` §Seguridad): puntero al inventario, nunca valores.
- `INVENTARIO-DE-SECRETOS.md` (repo de gestión): custodia y respaldo de secretos.
