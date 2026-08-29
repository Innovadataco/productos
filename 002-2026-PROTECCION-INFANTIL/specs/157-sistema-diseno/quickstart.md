# Quickstart: SPEC-157 — Verificación manual del sistema de diseño

**Spec**: [../spec.md](../spec.md) · Ejecutar tras implementar, antes del PR.

## 1. Tokens y compatibilidad (SC-001)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd 002-2026-PROTECCION-INFANTIL
for c in glass text-body text-muted text-subtle; do
  printf "%s: " "$c"; grep -roh "$c" src/ --include="*.tsx" --include="*.ts" | wc -l
done
# → glass ≥ 109 · text-body ≥ 457 · text-muted ≥ 375 · text-subtle ≥ 165
git diff --stat origin/feature/001-scaffolding -- src/app/ | tail -3
# → solo layout.tsx tocado en src/app/ (pantallas intactas)
```

## 2. Tipografía (SC-002)

```bash
grep -ri "inter" src/ tailwind.config.ts | grep -vi "instrument\|internacional" 
# → 0 referencias a la fuente Inter
npm run build && npm run start &
curl -s localhost:5005 | grep -o "fonts.googleapis.com\|fonts.gstatic.com" | wc -l
# → 0 (todo auto-alojado)
curl -s localhost:5005 | grep -o "/_next/static/media/[^\"']*" | head -3
# → fuentes servidas desde la propia app
```

## 3. Dos temas, mismo HTML (FR-008)

Alternar el tema con el toggle y verificar en DevTools que solo cambian los valores
de las variables en `:root`/`.dark` — el DOM es idéntico.

## 4. Primitivos (SC-004)

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/components/ui/
# → tests de Anillo, PanelVidrio, LuzAmbiental, Declaracion verdes
```

Demo manual: montar `<Anillo vigilancia={0.89} reaccion={0.72} … />` en una página de
prueba temporal (o Storybook-like mínimo), verificar dibujo al entrar, leyenda en
personas y silencio total con `prefers-reduced-motion: reduce` (DevTools → Rendering
→ Emulate CSS media feature).

## 5. Contraste (SC-003)

```bash
npm run a11y:contrast   # o el script del ratchet con los pares de tokens
# → todos los pares ≥ 4.5:1 en ambos temas
```

## 6. Ratchet y gate (SC-005, SC-006)

```bash
npm run tokens:check    # si D2=a — conteo ≤ referencia
npx tsc --noEmit && npm run lint && npm run test:coverage && npm run build && npm run arch:check
./scripts/dev-restart.sh
```
