# SPEC-452 · Dos módulos que producción niega y el arnés juraba conceder — cierra I-317 e I-318

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: inventario de SPEC-443, verificado por el CEO en la BD de prod. Radicado del CEO (04-09). Va **antes** de SPEC-443 (para que 443 aterrice con los tests afirmando la conducta real).

## Lo medido (prod)

- `revision_spam`: solo ADMIN en prod. OPERADOR sin fila → 403 (8 operadores activos). 4 tests decían que el operador entra.
- `ia_rubrica`: solo ADMIN. COMITE_VALIDACION sin fila → 403 (1 integrante). 1 test decía «solo lectura, entra».
- Los 5 pasaban por el arnés de I-309 (`otorgarTodosLosPermisos`: todos los módulos a todos). Caso 2 de I-278, cazado antes del usuario.

## Decisión (modelo de Jelkin: el operador clasifica; el comité valida)

1. **OPERADOR recibe `revision_spam`** (revisar spam es un resultado de clasificación). Los endpoints de spam usan `verifyAuth()` (cualquier rol) + `assertModulo("revision_spam")` → el módulo es la puerta.
2. **COMITE_VALIDACION recibe `ia_rubrica` para LEER.** Las 3 escrituras (`PUT /preguntas`, `PATCH /config`, `GET /` raíz) siguen cerradas por `verifyAuth(ADMIN)` en código (D-102). Solo `GET /definiciones` acepta `[ADMIN, COMITE_VALIDACION]`.

## Hallazgo de fuente (candado 15 v5) — jerarquía AND

`ia_rubrica` es HIJO de `centro_control_ia` (`esCritico`). `puedeAccederAModulo` aplica **jerarquía AND**: un submódulo exige PADRE activo + hijo activo. Conceder solo `ia_rubrica` deja al comité en **403** (verificado en integración). El radicado decía «abre únicamente esa lectura» — incompleto. **Ruling del CEO (A):** conceder también `centro_control_ia`. Alcance verificado y acotado: el único gate directo del padre es el link de nav + la página `/dashboard/admin/ia`; ningún endpoint API gatea el padre. Por la jerarquía AND, el comité solo ve la pestaña Rúbrica (los otros 3 hijos — playground/simulaciones/configuración — no se conceden), y las escrituras siguen cerradas por rol.

## Alcance

- `prisma/seed-modulos-grants.ts` (fuente única, aditivo e idempotente):
  - `OPERADOR`: + `revision_spam`.
  - `COMITE_VALIDACION`: + `centro_control_ia` (padre) + `ia_rubrica` (hijo).
- **5 tests reescritos** al mapa REAL (sin arnés permisivo): tras `resetDatabase`, `permisoModulo.deleteMany()` + `syncModulosYGrants(prisma)` en el `beforeEach` de `spam/pendientes`, `reportes/[id]/resolver-spam` y `ia/rubrica/definiciones`. Así el acceso depende del seed, no del arnés.
- **NO se toca el arnés** (`test-utils.ts` / `otorgarTodosLosPermisos`): eso es SPEC-443.
- **Post-deploy:** el deploy corre `sync-modulos-grants` (aditivo); el CEO verifica en prod las filas nuevas.

## Candados (conducta real, integración)

- OPERADOR entra a spam (200) · PARENT no (403) — `spam/pendientes` + `resolver-spam` con mapa real.
- COMITE lee la rúbrica (200) · **no escribe** (403 por rol en `preguntas`/`config`) · no entra a la raíz (403) · ADMIN escribe — `comite-rubrica-lectura-no-escritura.candado.test.ts` (TOKEN REAL, no mockea `verifyAuth`).
- **Contraprueba (verificada por mutación):** quitar `revision_spam` / `centro_control_ia`+`ia_rubrica` del seed → los 200 de operador/comité caen a 403.

## Impacto en arquitectura: no

Solo grants por rol (fuente única) + tests. No toca schema, endpoints ni `tokens:check`.

## Referencias
- I-317 (operador/spam) · I-318 (comité/rúbrica) · I-278 (arnés permisivo) · D-102 (escritura por rol) · SPEC-443 (arnés, detrás).
