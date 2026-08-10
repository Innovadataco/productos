# Quickstart: SPEC-160 — Dataset demo de producción

> ⚠️ **SOLO producción bajo supervisión y con GO de ZEUS.** No correr en local ni en staging sin ajustar variables.

## Pre-requisitos

- Acceso a `pi.innovadataco.com` por Tailscale.
- Credenciales de admin de producción o token ADMIN.
- `DATABASE_URL` apuntando a la BD de producción.
- `WORKER_SECRET` válido.
- Ollama accesible (por Tailscale) para clasificación real.
- Backup de la BD realizado manualmente antes de cualquier seed.

## Variables de entorno (`.env` local para el script)

```bash
DATABASE_URL="postgresql://proteccion:...@...:5433/proteccion_infantil"
API_BASE="https://pi.innovadataco.com"
ADMIN_EMAIL="soporte@innovadataco.com"
ADMIN_PASSWORD="..."           # o usar ADMIN_API_TOKEN si se implementa
WORKER_SECRET="..."
DEMO_EMAIL_DOMAIN="innovadataco.com"
DEMO_PASSWORD="change-me"        # contraseña común; definirla en .env, nunca en el repo
```

## Seed demo

```bash
export PATH="$HOME/.hermes/node/bin:$PATH"
node --env-file=.env --import tsx scripts/demo-prod/sembrar-demo.ts
```

El script es idempotente y resumible. Si falla, re-correrlo continúa desde donde quedó.

### Notas sobre la ventana temporal

- Los reportes se distribuyen en los **últimos 6 meses** terminando hoy.
- Los reportes históricos (> 7 días) se siembran en estado final con `creadoEn` histórico y **no** envían avisos.
- Los reportes frescos (≤ 7 días) se procesan con el motor real y sí pueden enviar avisos a `soporte+…`.
- Las entidades derivadas (`AlertaColegio`, `TransicionReporte`, `ClasificacionIA`, `PasoProcesamiento`) se backdatean a la fecha del caso.

## Procesar reportes con motor real

```bash
node --env-file=.env --import tsx scripts/demo-prod/procesar-reportes-demo.ts --delay 1000 --timeout 60000
```

Reanudar si se interrumpe:

```bash
node --env-file=.env --import tsx scripts/demo-prod/procesar-reportes-demo.ts --resumir
```

## Hoja de credenciales

```bash
node --env-file=.env --import tsx scripts/demo-prod/hoja-credenciales.ts > docs/demo-prod/credenciales-002-PI-059.md
```

La hoja contiene emails `soporte+...` y la contraseña común.

## Purga quirúrgica

### Antes de purgar: verificar

```bash
node --env-file=.env --import tsx scripts/demo-prod/verificar-purga.ts --antes
```

### Ejecutar purga

```bash
node --env-file=.env --import tsx scripts/demo-prod/purgar-demo.ts --dry-run   # primero simular
node --env-file=.env --import tsx scripts/demo-prod/purgar-demo.ts             # luego borrar
```

### Después de purgar: verificar

```bash
node --env-file=.env --import tsx scripts/demo-prod/verificar-purga.ts --despues
```

## Rollback de emergencia

Si la purga falla o borra datos indebidos, restaurar desde el backup manual de BD tomado antes del seed.
