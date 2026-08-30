# SPEC-028 · Botones link a dashboards Superset (sin iframe)

> **Radicado:** BI · SPEC-028 (INSTRUCTIVO-015 · A-51 §3-E · alcance recortado)
> **F3C:** 2026-08-29 · **Rama:** `work/bi-SPEC-028-botones-superset` · base `main`

## 1. Problema
Admin necesita entrar a los 5 dashboards Superset (Ejecutivo, Motor IA, Comercial, Operativo, Salud) desde la app BI. Iframe + SSO son alcance mayor (diferido). Necesitamos SOLO botones que abran cada dashboard en nueva pestaña.

## 2. Objetivo
Componente `<SupersetLink />` que renderiza 5 botones con emoji + label + link directo `${SUPERSET_PUBLIC_URL}/superset/dashboard/<slug>/`, `target="_blank" rel="noopener noreferrer"`.

## 3. Alcance
**Dentro:**
- `src/components/bi/dashboards/SupersetLink.tsx` (nuevo · Client-agnostic — pura render).
- 5 botones fijos:
  - 📊 Ejecutivo → slug `ejecutivo`
  - 🤖 Motor IA → slug `motor-ia`
  - 💰 Comercial → slug `comercial`
  - ⚙️ Operativo → slug `operativo`
  - 💚 Salud → slug `salud`
- URL base configurable por prop (`baseUrl?: string`, default `process.env.NEXT_PUBLIC_SUPERSET_PUBLIC_URL ?? "http://localhost:8088"`). Como es Client component sin SSR-specific, se evalúa en render y funciona con env var pública.
- Test unit (Vitest + Testing Library): renderiza 5 botones, cada uno con href correcto y `target=_blank`.

**Fuera (regla dura instructivo):**
- `superset/**` NO se toca (solo lectura).
- `scripts/**` NO se toca.
- Iframe / SSO / re-import de bundle Superset diferidos.
- Auth Superset: los botones abren aunque Superset esté pausado (comportamiento aceptable · dashboard no responde hoy).

## 4. Contrato
```tsx
interface Props { baseUrl?: string; className?: string; }
export function SupersetLink(props: Props): JSX.Element;
```

## 5. Criterios de aceptación
- [ ] 5 botones renderizados en orden Ejecutivo · Motor IA · Comercial · Operativo · Salud.
- [ ] Cada botón es `<a href="…" target="_blank" rel="noopener noreferrer">`.
- [ ] Test unit valida los 5 hrefs.
- [ ] Gate LOCAL verde (`build + typecheck + test:unit + ratchets`).

## 📋 Control
| Campo | Valor |
|---|---|
| Radicado | BI · SPEC-028 |
| F3C | 2026-08-29 |
| Autor | dev-bi-1 (idc-5e) |
| Estado | 🟡 spec+plan |
