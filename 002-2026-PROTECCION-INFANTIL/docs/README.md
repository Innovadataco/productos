# Documentación del proyecto

Carpeta central de documentación técnica y operativa.

## Documentación operativa

- [`despliegue-v2-checklist.md`](despliegue-v2-checklist.md) — Checklist de despliegue de la v2: migraciones, parámetros, env vars, colas pg-boss y pasos de verificación.
- [`runbook.md`](runbook.md) — Procedimientos operativos: laboratorio de IA, colas de mantenimiento, cambio de modelo y rollback de cifrado.
- [`operacion/runbook-drift-modulos-permisos.md`](operacion/runbook-drift-modulos-permisos.md) — Corrección segura del drift del catálogo de módulos/permisos (guardianes `modulos_huerfanos`/`grants_modulos_muertos` de pi-monitor): comandos gated, guardas y verificación.

## Configuración

- [`configuracion/parametros-sistema.md`](configuracion/parametros-sistema.md) — Referencia completa de los parámetros de sistema: qué hace cada uno, dónde se usa y cómo probarlo.

## Notas

- Para modificar la documentación, edita los archivos `.md` directamente.
- Para subir cambios al repositorio remoto, haz `git add`, `git commit` y `git push` de forma manual (no se ejecutan mutaciones de git de forma automática).
