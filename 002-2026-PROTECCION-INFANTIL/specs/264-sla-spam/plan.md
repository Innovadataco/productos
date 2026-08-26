# Implementation Plan: SLA de spam — SPEC-264

**Branch**: `work/002-PI-ciclo-operador` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0

---

## Summary

Sembrar `spam.sla_horas=48` con `upsert({create,update:{}})` (anti-I-100) para completar la infraestructura de SPEC-195. El job (`revisarSlaSpam`) y la orquestación (`monitor-probes.mjs`) ya existen y son correctos; se conservan y se cubren con tests que confirman aviso al ADMIN.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| Language/Version | TypeScript 5.x / Node.js >=22 |
| Primary Dependencies | Prisma 5.22.0, Vitest, Resend |
| Testing | Vitest de `revisarSlaSpam` con mocks de `enviarAlertaRevision` y `getAdminEmails` |
| Constraints | Cero migraciones · cero cambios en `src/lib/ai/**` · reutilizar worker existente · aviso al ADMIN |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §2.1 Stack heredado | ✅ Pass | Reutiliza `ParametroSistema`, monitor y Resend |
| §3.1 TypeScript strict | ✅ Pass | Tipos existentes |
| §3.5 Logs/auditoría | ✅ Pass | `logger.info` en `revisarSlaSpam` conservado |
| §4.5 Convenciones Prisma | ✅ Pass | Upsert por `clave` |

---

## Implementation Steps

### Phase 1 — Seed del parámetro
1. Localizar la sección de `ParametroSistema` en `prisma/seed.ts` (bloque de spam, cerca de las líneas 1798 y 2429). Añadir:
   ```ts
   await prisma.parametroSistema.upsert({
     where: { clave: "spam.sla_horas" },
     update: {},
     create: {
       clave: "spam.sla_horas",
       valor: "48",
       tipo: TipoParametro.INTEGER,
       categoria: CategoriaParametro.SYSTEM,
       esPublico: false,
       descripcion: "Horas máximas para resolver un POSIBLE_SPAM antes de alertar al admin",
     },
   });
   ```
2. Test `seed.test.ts` (o extender existente) para verificar la presencia y el `update: {}` (regresión anti-I-100).

### Phase 2 — Tests del job
3. `src/lib/spam/sla.test.ts` con 4 tests (US2 escenarios):
   - 49h + parámetro 48 → 1 alerta al ADMIN.
   - 47h + parámetro 48 → 0 alertas.
   - `alerts.admin.enabled=false` → 0 alertas.
   - 49h + parámetro 72 → 0 alertas.
4. Verificar mock: destinatarios = `getAdminEmails()`, `estado="POSIBLE_SPAM"`, `prioridadAlta=true`.

### Phase 3 — Documentación
5. En `quickstart.md`: instrucciones para editar `spam.sla_horas` desde el panel de parámetros ADMIN sin desplegar; nota de que el cambio se aplica al siguiente tick del monitor (≤15 min).
6. Sin cambios en `monitor-probes.mjs` ni en `dev-restart.sh`.

### Phase 4 — Gate local
7. `npx tsc --noEmit`
8. `npm run lint`
9. `npm run test`
10. `npm run arch:check`
11. `npm run build`

---

## Risk & Rollback

- Riesgo bajo: la única nueva escritura de datos es una fila de configuración con default seguro (48h) y aviso opcional (respetando `alerts.admin.enabled`).
- Rollback: eliminar la fila `spam.sla_horas` mantiene el default hard-coded del código (`?? "48"`).

---

## Out of Scope

- Añadir un canal de aviso al operador o al comité (decisión CEO: solo ADMIN).
- Crear una cola nueva o un worker nuevo (el monitor ya cubre).
- Editar `revisarSlaSpam` o `SpamReporteRepository.findSpamVencidos`.
