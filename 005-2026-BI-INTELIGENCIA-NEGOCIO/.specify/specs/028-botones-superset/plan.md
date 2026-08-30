# SPEC-028 · plan.md · botones link a Superset

## Estrategia
1 componente puro sin deps nuevas. Data hardcoded (5 dashboards). URL base por prop o `NEXT_PUBLIC_SUPERSET_PUBLIC_URL` (public env var, embebida en el bundle · no secreta).

## Archivos
- `src/components/bi/dashboards/SupersetLink.tsx` (nuevo)
- `tests/unit/bi-superset-link.test.tsx` (nuevo)

## Data
```ts
const DASHBOARDS = [
  { slug: "ejecutivo", label: "Ejecutivo", icon: "📊" },
  { slug: "motor-ia", label: "Motor IA", icon: "🤖" },
  { slug: "comercial", label: "Comercial", icon: "💰" },
  { slug: "operativo", label: "Operativo", icon: "⚙️" },
  { slug: "salud", label: "Salud", icon: "💚" },
];
```

## URL final
`${baseUrl}/superset/dashboard/${slug}/` · siempre `target="_blank" rel="noopener noreferrer"`.

## Gate LOCAL
```
rm -rf .next && npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh
```

## Push
```
git add src/components/bi/dashboards tests/ .specify/specs/028-*
git commit -m "feat(bi): SPEC-028 botones link a dashboards Superset (sin iframe)"
git push origin work/bi-SPEC-028-botones-superset
```

## Fuera de scope
superset/** · scripts/** · iframe · SSO · re-import bundle Superset.
