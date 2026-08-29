# Quickstart — SPEC-111: encendido de la rúbrica (D-28)

## 1. Test de efecto (verifica, no la existencia del parámetro)

```bash
export PATH="$HOME/.local/bin:$PATH"
npx vitest run src/app/api/reportes/procesar
# Esperado: con enabled=true el reporte procesado tiene filas en ClasificacionRubricaVoto;
# con enabled=false no las tiene (legacy). Suite completa verde en el gate.
```

## 2. Seed en base nueva (FR-001)

```bash
# En una BD limpia: npx prisma db seed
# Verificar: SELECT valor FROM "ParametroSistema" WHERE clave='ia.rubrica.enabled' → 'true'
```

## 3. Aplicación en BD operada (FR-002) — EN EL LOTE DE DESPLIEGUE, no ahora

```bash
# Local/dev:
node --env-file=.env --import tsx scripts/aplicar-rubrica-default-111.ts
# Prod (cuando el CEO autorice el lote):
ssh pi-vps 'cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL && \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app \
  npx tsx scripts/aplicar-rubrica-default-111.ts'
# Esperado: "[111] ia.rubrica.enabled = true" (o "ya estaba en true", idempotente).
```

## 4. Reversión en caliente (FR-004)

Ver `docs/runbook.md` §reversión-rúbrica: `valor='false'` en el parámetro (panel o SQL) →
el siguiente reporte se clasifica por legacy, sin reinicio ni despliegue. Verificación:
procesar un reporte y confirmar ausencia de votos en `ClasificacionRubricaVoto`.

## 5. Capacidad (ya medida, no repetir)

`scripts/medicion-capacidad-111.ts` (2026-07-28): legacy 37.7 s · rúbrica 52.0 s ·
~69 reportes/hora (~138/h a concurrencia 2).

## 6. Restricciones

```bash
git diff -- src/lib/ai/rubrica-semilla.ts   # vacío: textos intactos
# ia.rubrica.modelos y umbral_presencia: sin tocar. Sin despliegue (CEO por lote).
```
