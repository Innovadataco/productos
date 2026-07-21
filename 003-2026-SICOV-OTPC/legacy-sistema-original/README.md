# legacy-sistema-original — Código del sistema Gesmovil/SICOV actual (solo referencia)

Código fuente del sistema **en producción** que el proyecto 003 rediseña. Se incluye **solo como
referencia** para replicar lógica, entidades y flujos. **No se compila ni despliega desde aquí.**

## Contenido
- `back_gestion_despachos/` — Backend **AdonisJS 5** (arquitectura por capas/DDD: `app/Dominio`,
  `app/Infraestructura`, `app/Presentacion`; colas como workers).
- `frontend-gestion-despachos/` — Frontend **Angular 20** (código activo en `src/app/features/*`).

## ⚠️ Seguridad — secretos redactados
Esta copia **NO contiene los secretos reales** del sistema. Antes de subirla se:
- Excluyeron **todos** los archivos `.env*`, `node_modules/`, `build/`, `dist/`, `.angular/`, `.git/`
  y `uploads/` (datos de usuarios).
- Redactaron los **tokens hardcodeados** en el fuente (aparecen como `REDACTED-TOKEN-*`,
  `REDACTED-CAPTCHA-SITEKEY`, `REDACTED-BCRYPT-HASH`).

**Los secretos originales deben considerarse comprometidos y ROTARSE** (pudieron estar en el
historial de los repos originales `ingnovaott-maker/back_gestion_despachos` y `frontend-gestion-despachos`).

## Cómo usarlo
Referencia de lectura. El análisis destilado (doble token, esquema, roles, flujos) está en
`../HANDOFF-SICOV.md`. Para el detalle exacto de columnas, ver `back_gestion_despachos/database/migrations/`.
