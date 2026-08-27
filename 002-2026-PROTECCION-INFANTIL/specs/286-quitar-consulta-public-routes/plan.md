# Implementation Plan: Quitar `/consulta` de PUBLIC_ROUTES (cierra I-136)

**Branch**: `work/002-PI-186` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-186-QUITAR-CONSULTA-PUBLIC-ROUTES · DIRECTRIZ-002-2026-08-26-2000 §3.2

---

## Summary

Quitar la línea `"/consulta",` de `PUBLIC_ROUTES` en `src/lib/proxy.ts:13` y agregar en `src/lib/proxy.test.ts` un test de regresión que verifique el comportamiento real post-fix: `GET /consulta` sin sesión → `307 → /login`. Nada más. El comentario existente en `proxy.ts:77-78` que documenta la razón se conserva. Las entradas `/api/consulta` en `PUBLIC_ROUTES:25` y `APIS_LECTURA_SCHOOL_ADMIN:88` **no se tocan** (API en uso por el formulario del home). El barrido D-37 confirmó cero usos vivos de `/consulta` como página.

**Discrepancia documentada:** el INSTRUCTIVO §Criterios de auditoría dice `404`; el proxy responde `307 → /login`. Se refleja en SC-002 y §Verificación en vivo del spec — el objetivo real de I-136 (cerrar puerta declarada muerta) se cumple; el status HTTP cambia de `404` a `307`. La verificación en vivo se ajusta acorde.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 15 · TypeScript 5 · jose (JWT) — sin dependencias nuevas |
| **Runtime del fix** | Middleware de Next (`proxy.ts` es consumido por `middleware.ts`) — cambio de 1 línea |
| **Testing** | Vitest unit sobre `src/lib/proxy.test.ts` — patrón existente con `requestAnonima()` (línea 186) y `proxy(NextRequest)` |
| **Rendimiento** | Sin impacto (una entrada menos en una lista de <20 items evaluada por `matchesRoute`) |
| **Constraints** | Alcance mínimo · cero cambios al motor · cero migraciones · no tocar otras entradas de `PUBLIC_ROUTES` |
| **Autonomía** | Régimen D-51: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo |

---

## Constitution Check

- ✅ **Solo texto** — irrelevante (no toca reportes).
- ✅ **IA local** — irrelevante; no toca motor.
- ✅ **Migraciones aditivas y no destructivas** — cero migraciones.
- ✅ **Frontera DAL (Q-3)** — irrelevante; solo se modifica una constante y su test unitario.
- ✅ **Sin `any` ni stack traces al cliente** — el fix no introduce código nuevo, solo elimina una entrada.
- ✅ **Un solo commit por User Story + uno de docs** — plan §Fases documenta el mapa (2 commits: fix+test y docs spec-kit).

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/286-quitar-consulta-public-routes/
├── plan.md              # Este archivo
├── spec.md              # ya creado
└── tasks.md             # Fase 2 (a producir con /speckit.tasks)
```

### Código a tocar (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/
│   ├── proxy.ts               # QUITAR la línea 13: `"/consulta",` en PUBLIC_ROUTES
│   └── proxy.test.ts          # AGREGAR describe "PUBLIC_ROUTES — I-136 quitar /consulta"
└── specs/286-quitar-consulta-public-routes/   # spec-kit del frente
```

**Structure Decision**: cambio mínimo. Sin nuevos archivos de código productivo. Solo:
- 1 línea eliminada en `proxy.ts`
- 1 bloque `describe` nuevo (con 1 `it`) al final de `proxy.test.ts`
- 3 archivos nuevos en `specs/286-.../` (spec.md, plan.md, tasks.md)

---

## Implementation Steps

### Phase 1 — Aplicar el fix + test de regresión

1. **`src/lib/proxy.ts:13`**: eliminar la línea `    "/consulta",` (con su indentación). El comentario en `proxy.ts:77-78` se conserva sin cambios.
2. **`src/lib/proxy.test.ts`**: agregar al final del archivo un nuevo `describe("PUBLIC_ROUTES — I-136 quitar /consulta")` con un `it` que use el helper `requestAnonima()` (patrón idéntico al de `SPEC-249` en la línea 185, ya presente en el archivo) para verificar:
   ```ts
   const res = await proxy(requestAnonima("/consulta"));
   expect(res.status).toBe(307);
   expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
   ```
3. Verificar que `LandingHero.test.tsx:90-94` y `url-privacy.test.ts:48` siguen en verde sin modificarlos.

### Phase 2 — Gate LOCAL

4. `npx tsc --noEmit`
5. `npm run lint` (esperado 0 errores; los warnings existentes son pre-existentes, no míos).
6. `npm run tokens:check` (verde — no toca UI).
7. `npm run arch:check` (verde — no toca layout de scripts ni pantallas).
8. `npm run locks:check` (verde — no toca `scripts/`).
9. `npm run test:unit` (verde — incluye el nuevo test).

### Phase 3 — Gate pre-push OBLIGATORIO (I-101/I-104)

10. `git fetch origin && git rebase origin/feature/001-scaffolding`
11. `git diff --name-status origin/feature/001-scaffolding..HEAD` — esperado exactamente 5 archivos: `002-2026-PROTECCION-INFANTIL/.specify/feature.json`, `002-2026-PROTECCION-INFANTIL/src/lib/proxy.ts`, `002-2026-PROTECCION-INFANTIL/src/lib/proxy.test.ts`, `002-2026-PROTECCION-INFANTIL/specs/286-.../{spec,plan,tasks}.md`. Si aparece un archivo ajeno → HALLAZGO · PARA.

### Phase 4 — Push + CI + merge

12. `git push origin work/002-PI-186`
13. Fábrica abre PR y mergea cuando CI cierre verde 11/11.

### Phase 5 — Verificación en vivo post-deploy

14. `curl -s -o /dev/null -w "%{http_code}\n" https://pi.innovadataco.com/consulta` → esperado `307` (redirect a login sin sesión). **No** 404. Documentado como cambio de contrato en spec §Success Criteria.
15. `curl -sIL https://pi.innovadataco.com/consulta | head -20` → cadena termina en `200` sobre `/login`.
16. Confirmar que `curl -s -o /dev/null -w "%{http_code}" -X POST -d 'identificador=+57300111111' -H "Content-Type: application/x-www-form-urlencoded" https://pi.innovadataco.com/api/consulta` sigue devolviendo algo distinto a `307/404` (la API pública funciona; el status exacto depende del identificador y no importa aquí, solo importa que no rompió).

### Commit map

- `docs(spec-kit): SPEC-286 · spec + plan · quitar /consulta de PUBLIC_ROUTES (I-136) [002-PI-186]` — commit inicial (spec + plan)
- `fix(proxy): quitar /consulta de PUBLIC_ROUTES + test regresión [SPEC-286]` — código productivo + test + tasks.md marcado

---

## Test Strategy

- **Unit**: 1 test nuevo en `proxy.test.ts` que usa `requestAnonima("/consulta")`. Verifica `status === 307` y `location.pathname === "/login"`.
- **Guards existentes** (no se modifican, verifican el fix desde otros ángulos):
  - `LandingHero.test.tsx:90-94`: la landing no linkea a `/consulta`.
  - `url-privacy.test.ts:48`: la página no existe.
- **API `/api/consulta`**: sus tests unitarios (`route.test.ts`, `route-f3.test.ts`, `detalle/route.test.ts`, `evento/route.test.ts`) NO se tocan; deben seguir en verde.
- **Verificación en vivo**: `curl` desde fuera contra `pi.innovadataco.com` post-deploy (paso 14). No requiere túnel ni credenciales.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Al quitar `/consulta` de `PUBLIC_ROUTES`, algún rol autenticado pierde acceso a algo que sí necesitaba. | El barrido D-37 confirmó cero usos vivos de `/consulta` como página; los guards existentes (`LandingHero.test`, `url-privacy.test`) confirman que la landing no la linkea y que la página no existe. No hay flujo real que la use. |
| El CEO esperaba `404` como criterio y post-fix es `307`. | Documentado explícitamente en spec §Hallazgo previo y §SC-002; Fábrica aprueba con conocimiento del cambio de contrato en compuerta §4. |
| Se toca por accidente `/api/consulta` en `PUBLIC_ROUTES:25` o `APIS_LECTURA_SCHOOL_ADMIN:88`. | El diff pre-push (paso 11) muestra exactamente qué se modifica; se revisa con `git diff src/lib/proxy.ts` antes de commitear. Los tests de `/api/consulta*` no se tocan y deben seguir en verde. |
| Alguien añade en el futuro una página `/consulta` sin volver a incluirla en `PUBLIC_ROUTES` y no sabe por qué el proxy la bloquea. | El comentario en `proxy.ts:77-78` documenta la decisión; el test nuevo tiene el nombre del incidente (I-136) para que grep lo encuentre. |

---

## Out of Scope

- Reintroducir la ruta `/consulta` como página real. La consulta pública vive en el home `/`; no hay página que agregar.
- Modificar otras entradas de `PUBLIC_ROUTES` (candado explícito en INSTRUCTIVO).
- Refactor de la lista de rutas del proxy (fuera de alcance de este frente).
- Cambios al motor `src/lib/ai/**`. Prohibido en este frente.
- Migraciones. Cero.
- Renombrar o mover archivos.
