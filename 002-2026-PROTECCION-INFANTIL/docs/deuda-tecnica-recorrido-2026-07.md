# Recorrido de deuda técnica — post-ACTA_ARQ_03 (2026-07)

> Cola nocturna 002-PI-025, B6 · 2026-07-28 · **Solo reporte, nada corregido** (ZEUS decide).
> R2, R4, R5, R6, R7 ya estaban inventariados en el ACTA: aquí solo se marca si empeoraron
> (§ final). Hallazgos verificados contra el código actual; ninguno genérico.

## Alta

- **D-01 · `.github/workflows/ci.yml:50`** — El gate de CI no puede dar verde desde el
  primer run: `npm run test` = `node --env-file=.env.test …` (package.json:13) y `.env.test`
  no está en git; con `--env-file`, Node 22 aborta si el archivo no existe. Importa: la
  "compuerta real" entregada por la SPEC-107 está roja por diseño. Opciones: committear un
  `.env.test` de solo-dummies en CI (crearlo en un paso), o cambiar el script de test.
- **D-02 · `.github/workflows/ci.yml:51`** — `npm run build` sin los placeholders de env:
  `src/lib/email.ts:7` exige `RESEND_API_KEY`/`EMAIL_FROM` al importarse y Prisma pide
  `DATABASE_URL` en page-data (documentado en commit 41bc88cc); el Dockerfile los define,
  el CI no. Build de CI falla siempre.
- **D-03 · `.github/workflows/ci.yml:41-45`** — Falta `npx prisma generate` antes de
  `npx tsc --noEmit` (hoy depende del postinstall implícito de `@prisma/client`; si no
  corre en CI, tsc falla con tipos no generados). Frágil aunque funcione.

## Media

- **D-04 · `scripts/barrido-credenciales.ts:16-17` vs `src/lib/credenciales-literal.test.ts:37-38`** —
  la guarda I-22 quedó duplicada y ya divergente: el CLI cubre `.env`/`.html` y el test no;
  los placeholders difieren; y el test salta TODOS los dotfiles (`:42`), así que su
  exclusión de `.env*.example` (:31) es código muerto. Dos fuentes de verdad para la misma
  regla dura → falsos negativos divergentes. Importa: I-22 es la regla que cerró la fuga
  de claves; debe haber UNA implementación compartida.
- **D-05 · `src/lib/specs-discipline.test.ts:27`** — la regla "DEUDA_HEREDADA nunca crece"
  no está enforceada: el test solo falla si una carpeta listada deja de existir; agregar
  una spec nueva a la lista pasa verde. Agujero auto-declarado del gate antirrecaídas.
- **D-06 · `src/app/api/departamentos/route.ts`** — endpoint nuevo (SPEC-100) sin
  `route.test.ts` (viola la convención del AGENTS: todo endpoint CRUD nuevo trae test) y
  además es público (`src/lib/proxy.ts:21`) sin rate-limit.
- **D-07 · `src/app/api/estadisticas-publicas/route.ts:41-47`** — agregación en memoria:
  trae TODAS las `ClasificacionIA` aprobadas con `findMany` para contar por categoría en JS
  (debería ser `groupBy`), y el endpoint público más pesado de la app no tiene rate-limit.
  Pre-existente (la SPEC-108 solo quitó `scorePromedio`); no estaba en el ACTA.
- **D-08 · `src/lib/ai/rubrica.ts:264-282` vs `292-314`** — `evaluarEmbudo` duplica el
  embudo de `clasificarConRubrica` sin la red de seguridad (`plausibles < 2 → evaluar
  todo`): mide un comportamiento distinto del de producción. Duplicación nueva del 104
  dentro del motor.
- **D-09 · `src/app/api/admin/colegios/route.ts:67`** — GET lista sin paginación
  (`findMany` con includes, sin `take`/`skip`) contra la convención `page`/`pageSize`
  (default 25, máx 100). Pre-existente; la SPEC-100 tocó el archivo sin corregirla.

## Baja

- **D-10 · `src/lib/version.ts:14` / `.env.example`** — `APP_BUILD_SHA` (SPEC-102) no está
  documentada en la plantilla de entorno.
- **D-11 · `prisma/seed-security.test.ts:28-30`** — aserción convoluta
  (`valor.startsWith(...) || valor === "" ? true : !literal`) y anclas frágiles (depende de
  las cadenas "const adminEmail" y "Admin inicial creado" del seed: un refactor cosmético
  rompe el test en falso).
- **D-12 · `src/lib/ai/rubrica.ts:168`** — rama muerta: si `decisivas.length === 0` retorna
  `votoModelo`, que ya se sabe `true` por el guard de la línea 166.
- **D-13 · `scripts/actualizar-rubrica-098.ts`** — script one-off sin ciclo de vida (sin
  marca de "ya ejecutado/desechable"; dead-code operativo).
- **D-14 · `src/app/api/ciudades/route.ts:30`** — el ítem sintético `{ id: "otra", … }` no
  lleva `departamentoId` mientras el `select` de los reales sí (:25); un cliente recibe
  `undefined` solo en ese ítem.
- **D-15 · `src/app/api/auth/logout/route.ts`** — POST de auth sin rate-limit (riesgo
  bajo: solo borra cookies; rompe la uniformidad de los endpoints de auth).

## ¿Empeoraron R2/R4/R5/R6/R7 con lo reciente?

- **R2 (wrapper de errores): SÍ (leve)** — dos endpoints nuevos/tocados repiten try/catch
  manual con `NextResponse.json`: `departamentos/route.ts:24-32`, `ciudades/route.ts:34-42`.
- **R4 (capa de datos 053): NO** — Colegios POST ganó lógica pero sigue el patrón
  Prisma-en-ruta existente.
- **R5 (motor: contrato/guardas/dead-code): SÍ (leve)** — duplicación del embudo (D-08) y
  rama muerta (D-12) dentro de `rubrica.ts`. Timeout Ollama y assertWorkerSecret sin cambios.
- **R6 (withValidation/logger/assertWorkerSecret): NO** — lo nuevo usa `withValidation` y
  `assertModulo`; logs con formato `[Módulo]` conforme al AGENTS.
- **R7 (hooks/apiFetch/primitivas UI): SÍ (leve)** — `apiFetch` sigue sin existir y la
  SPEC-100 sumó `fetch` crudos en `NuevoColegioPageClient.tsx` (`/api/departamentos`,
  `/api/ciudades`).

## Nota para ZEUS

D-01/D-02/D-03 salen de mi propio commit de la SPEC-107 (B3): el CI tal como quedó no puede
dar verde. No lo corregí por la regla de este bloque (reportar, no corregir). Recomendación:
reproducir con un run en GitHub y decidir el fix (crear `.env.test` dummy en paso de CI +
placeholders de build + `prisma generate`).
