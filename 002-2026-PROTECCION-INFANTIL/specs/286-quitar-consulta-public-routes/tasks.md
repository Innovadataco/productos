# Tasks — SPEC-286 · Quitar `/consulta` de PUBLIC_ROUTES (I-136)

**Branch**: `work/002-PI-186`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 0 — Barrido D-37 (preventivo)

- **T000** [✓] Barrido triangulado (3 caminos): `"/consulta"` literal + href + patrón amplio. **Cero usos vivos** como página. Todo lo demás es `/api/consulta*` (API viva) o guards de tests (`LandingHero.test`, `url-privacy.test`) que refuerzan el fix.

## Fase 1 — Fix + test regresión

- **T001** [✓] `src/lib/proxy.ts:13`: eliminar la línea `    "/consulta",` de `PUBLIC_ROUTES`.
- **T002** [✓] `src/lib/proxy.test.ts`: agregar `describe("PUBLIC_ROUTES — I-136 quitar /consulta")` con 1 `it` usando `requestAnonima("/consulta")` → verifica `status === 307` y `location.pathname === "/login"`.

## Fase 2 — Gate LOCAL

- **T003** [✓] `tsc --noEmit`
- **T004** [✓] `lint` (0 errores)
- **T005** [✓] `tokens:check`
- **T006** [✓] `arch:check`
- **T007** [✓] `locks:check`
- **T008** [✓] `test:unit` (incluye test nuevo + guards existentes intactos)

## Fase 3 — Pre-push (I-101/I-104)

- **T009** [✓] `git fetch && git rebase origin/feature/001-scaffolding && git diff --name-status` — esperados 5 archivos: `.specify/feature.json`, `src/lib/proxy.ts`, `src/lib/proxy.test.ts`, `specs/286-.../{spec,plan,tasks}.md`. Si aparece uno ajeno → HALLAZGO · PARA.

## Fase 4 — Push

- **T010** [✓] `git push origin work/002-PI-186`. Fábrica abre PR y mergea cuando CI cierre verde.

## Fase 5 — Verificación en vivo (post-deploy)

- **T011** [✓] `curl -s -o /dev/null -w "%{http_code}" https://pi.innovadataco.com/consulta` → **307** (no 404). `curl -sIL` termina en `200` sobre `/login`.

---

## Restricciones activas

- 🔒 Alcance mínimo: 1 línea eliminada + 1 test agregado.
- 🔒 NO tocar otras entradas de `PUBLIC_ROUTES` ni `APIS_LECTURA_SCHOOL_ADMIN`.
- 🔒 CERO cambios en `src/lib/ai/**`, CERO migraciones.
- 🔒 Conservar comentario `proxy.ts:77-78` (documenta el porqué).
- 🔒 Conservar guards `LandingHero.test.tsx:94` y `url-privacy.test.ts:48`.
