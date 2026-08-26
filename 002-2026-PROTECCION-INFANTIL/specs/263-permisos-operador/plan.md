# Implementation Plan: Barrido de permisos — SPEC-263

**Branch**: `work/002-PI-ciclo-operador` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0

---

## Summary

Cuatro cambios de permisos coordinados: (1) revelar original a OPERADOR/COMITE, (2) Pagos fuera del OPERADOR con **revocación explícita SQL** (patrón SPEC-128), (3) consentimiento solo al PARENT, (4) "Ver proceso" oculto para OPERADOR/COMITE. Sin migraciones. Cero cambios en `src/lib/ai/**`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| Language/Version | TypeScript 5.x / Node.js >=22 |
| Primary Dependencies | Prisma 5.22.0, Next.js 16.2.10, Vitest, jsdom + Testing Library |
| Testing | Vitest ruta + componente `AdminReportesTable` + tests para scripts |
| Constraints | Cero migraciones · script de revocación NO destructivo · idempotente · frontera DAL intacta |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Revelar texto original ya cifrado por AES-256-GCM |
| §1.6 Ley 1581 | ✅ Pass | Consentimiento solo a titulares |
| §3.1 TypeScript strict | ✅ Pass | Sin `any` |
| §3.4 HTTP codes | ✅ Pass | 200/403 sin cambios |
| §6.3 Datos sensibles | ✅ Pass | Auditoría `TEXTO_ORIGINAL_REVELADO` conservada |
| §8.4 Post-merge | ✅ Pass | Script explícito documentado en quickstart y cierre |

---

## Implementation Steps

### Phase 1 — Grants por rol (fuente única)
1. Editar `prisma/seed-modulos-grants.ts`:
   - `OPERADOR: ["bandeja_reportes", "expediente_revelar_original"]` (quita `pagos_admin`, añade `expediente_revelar_original`).
   - `COMITE_VALIDACION: [..., "expediente_revelar_original"]`.
2. Test `seed-modulos-grants.test.ts` que verifica la lista final por rol (protección contra regresión).

### Phase 2 — Endpoints
3. `src/app/api/admin/reportes-revision/[id]/route.ts:77` → `puedeRevelarOriginal: esAdminRol(user.rol) || user.rol === "OPERADOR" || esComiteRol(user.rol)`. Ampliar `route.test.ts` con los tres roles + PARENT (403 vía endpoint separado).
4. Verificar `POST /api/admin/reportes/[id]/revelar-original`: `assertModulo("expediente_revelar_original")` y `logAudit(TEXTO_ORIGINAL_REVELADO)` intactos (no se toca; se cubre con test si no está).

### Phase 3 — Script de revocación explícita
5. Crear `scripts/revocar-grants-pagos-operador.ts` clonando el shape de `scripts/revocar-grants-comite-muertos.ts`:
   - Constantes: `ROL = "OPERADOR"`, `MODULOS_MUERTOS = ["pagos_admin"]`.
   - `updateMany({ where: { rol, moduloId: { in: ids }, activo: true }, data: { activo: false } })`.
   - Log "antes/después"; exit code 0 en éxito.
6. Documentar en `specs/263-permisos-operador/quickstart.md`:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml \
     exec -T app node --import tsx scripts/revocar-grants-pagos-operador.ts
   ```
   con la nota "correr DESPUÉS de `prisma migrate deploy` y de `sync-modulos-grants.ts`".

### Phase 4 — Consentimiento fuera del panel admin
7. Editar `src/app/dashboard/admin/layout.tsx`:
   - Eliminar las líneas 28–32 (bloque `requiereConsentimientoActual`).
   - Preservar el resto (redirección por rol, `debeCambiarPassword`, permisos).
8. Test de layout: mock `verifyToken` retorna `{ rol: "OPERADOR" }` → NO llama `redirect("/consentimiento")`.

### Phase 5 — Botón "Ver proceso"
9. `src/components/modules/AdminReportesTable.tsx:392–395` → envolver `<Button ... Ver proceso ...>` en `{!esRolConBandejaPropia && (...)}`.
10. Test de componente cubre US4 (OPERADOR/COMITE ocultan el botón, ADMIN lo muestra).

### Phase 6 — Auditoría de firmas indebidas
11. Crear `scripts/depurar-consentimientos-internos.ts`:
   - `--dry-run` (default): imprime `{ dePadres, deRolesInternos }`.
   - `--apply`: si el schema permite, escribe metadata `invalidadoPorBarrido: true`; si no, solo informa.
12. Documentar el conteo en `cierre.md` cuando se cierre la SPEC.

### Phase 7 — Gate local
13. `npx tsc --noEmit`
14. `npm run lint`
15. `npm run test`
16. `npm run arch:check`
17. `npm run build`

---

## Risk & Rollback

- Revelar original: riesgo bajo porque el endpoint ya audita cada revelación; ampliar el grant solo activa más usos legítimos.
- Revocar Pagos: idempotente y con backup natural (los grants quedan como `activo: false`, no borrados). Rollback = flip a `activo: true`.
- Consentimiento: eliminar el bloque no reintroduce loop I-111 (SPEC-250 ya blindó el proxy); el guard del PARENT vive en otro layout.
- "Ver proceso": puramente visual.

---

## Out of Scope

- Modificar el endpoint `revelar-original` o el flujo de auditoría.
- Rediseñar el menú del OPERADOR.
- Tocar `src/lib/ai/**`.
