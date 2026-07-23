# AGENTS.md — productos

## Proposito

Reglas especificas para operar el repo `Innovadataco/productos`.

## Estructura del repo

- `fabrica-de-software/`: codigo fuente de productos.
- `documentacion-tecnica/`: arquitectura, ADRs, guias.

## Reglas

1. Cada producto tiene su propia carpeta.
2. Todo PR requiere revision de codigo.
3. Los secrets se manejan via variables de entorno, nunca en el codigo.
4. Preferir modelos locales para revision de codigo sensible.

## Lider

- ZEUS — Lider de Fabrica de Software

## Uso por ODIN

- ODIN puede consultar y revisar PRs siguiendo `innovadataco-zeus-software-factory`.
- No mergear sin ACTA-VALIDACION.

## Ramas (INQUEBRANTABLE)

Este repo tiene **dos ramas y solo dos**:

- **`feature/001-scaffolding` — PRUEBAS.** Aquí va todo el trabajo diario. Es la rama en la que commitea ODIN, siempre.
- **`main` — PRODUCCIÓN.** Solo recibe **merges de liberación**, previa auditoría de ZEUS. **Prohibido commitear directo a `main`** y prohibido abrir ramas nuevas por feature.

Si un comando te deja en `main`, vuelve a la rama de pruebas antes de commitear. Ante la duda: **detente y reporta**.

## Staging (INQUEBRANTABLE, todos los frentes)

Prohibido `git add -A` y `git add .`. Cada frente stagea SOLO rutas de su producto:
`git add 001-2026-INNOVADATACO/...`. Varios frentes trabajan en la misma rama: un staging
global se lleva el trabajo de otro y arruina la trazabilidad del commit.

## Metodología y estándares (fábrica IDC)

- **Metodología oficial:** PM2 (gestión) + Spec Kit (desarrollo). Documento canónico en el repo `Metodologias` → `Desarrollo de software/METODOLOGIA-OPERATIVA-FABRICA-SOFTWARE-v1.0.md`.
- **Modelo de dos agentes:** ZEUS diseña/revisa (constitución, brief, compuerta); ODIN redacta spec/plan e implementa/prueba/despliega.
- **5 reglas de oro:** aplicar Spec Kit · subir a GitHub · pruebas · validar despliegue · documentar.
- **Índice de specs:** mantener `002-2026-PROTECCION-INFANTIL/specs/README.md` actualizado con cada spec nueva o cerrada.

## Reporte a ZEUS (handoff post-commit)

Al terminar, ODIN NO pega reportes largos. Reporta compacto (ZEUS lee el diff del repo):

```
commit <hash> — <qué hizo, 1 línea>
hallazgos/pendientes: <lista corta, o "ninguno">
push: sí/no
```

Solo se cuenta lo que NO se ve en el código: hallazgos, decisiones, deuda técnica.
