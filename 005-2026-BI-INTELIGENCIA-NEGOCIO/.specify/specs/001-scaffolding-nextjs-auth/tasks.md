# SPEC-001 · tasks.md

> Estado real: todas las tareas completadas en commit `23c5100e`.
> Paso 15 corregido de `[ ]` a `[x]` · cierra I-07 (inconsistencia documental).

- [x] Paso 1 · package.json + tsconfig + postcss + tailwind + vitest + next.config
- [x] Paso 2 · globals.css copiado de PI
- [x] Paso 3 · api/health + login + jwt.ts
- [x] Paso 4 · motor.ts stub
- [x] Paso 5 · layout.tsx + page.tsx + ThemeProvider
- [x] Paso 6 · UI copiado de PI (11 componentes)
- [x] Paso 7 · Tests unitarios (jwt · motor · health) — 6/6 verdes
- [x] Paso 8 · 4 ratchets + run-all + verificar-indices
- [x] Paso 9 · .env.bi.example + .env.test
- [x] Paso 10 · bi.yml (4 jobs · raíz del monorepo)
- [x] Paso 11 · Simulación daño ratchet 1 · exit 1 confirmado · revertido
- [x] Paso 12 · Gate local: typecheck OK · tests 6/6 · build OK · ratchets OK
- [x] Paso 13 · Verificación en vivo: /api/health 200 · / 200 · /login 307 a PI
- [x] Paso 14 · cierre.md + tasks.md + .gitignore
- [x] Paso 15 · Push único a origin feature/bi-scaffolding (`23c5100e`)

---

## Nota I-07 (corregida aquí)

El `tasks.md` original tenía el Paso 15 sin marcar `[ ]` aunque el código estaba commiteado y pusheado en `23c5100e`. Era inconsistencia documental. Corregido en SPEC-005 (reescritura post-mortem). Ver `research.md` de esta SPEC para el detalle.
