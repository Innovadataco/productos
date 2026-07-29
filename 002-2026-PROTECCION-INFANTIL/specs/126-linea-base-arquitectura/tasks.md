# TASKS — SPEC-126 · Línea base de arquitectura generada desde el código

Generado con speckit-tasks desde `spec.md` (US1/US2/US3) y `plan.md`. Condiciones
vinculantes de ZEUS (002-PI-042): sesión canónica en la aserción A (el rojo es SOLO
desalineo real puerta ≠ predicado sobre esa base; divergencias por estado extra se
documentan como nota) y fallo ruidoso en la aserción B si un href del header no se
resuelve estáticamente. **Si la primera corrida de A o B sale ROJA sobre el código
actual: NO tocar las fuentes, documentar completo (rol/ruta/veredictos), PARAR y
reportar a ZEUS.**

## Fase 1 — Setup

- [ ] T001 Crear `scripts/arch/` y `docs/architecture/`; `scripts/arch/excepciones.json` con los huérfanos declarados (Plan, Subscription, BillingCycle)
- [ ] T002 [P] Crear `scripts/arch/artefactos.ts` (lista declarativa artefacto → fuentes → comando; única fuente del índice)

## Fase 2 — Foundational (bloquea a US1 y US2)

- [ ] T003 Parser textual del schema en `scripts/arch/lib/schema-prisma.ts` (modelos, campos, `@relation`, huérfanos; sin BD)
- [ ] T004 [P] Inventario de rutas del árbol `src/app/**` en `scripts/arch/lib/rutas-app.ts` (page.tsx/route.ts → ruta; segmentos `[x]` → valor muestra determinista)
- [ ] T005 Sesión canónica + veredictos en `scripts/arch/lib/veredictos.ts` (JWT de prueba patrón `src/lib/e2e/helpers.ts`; ejecuta `proxy()` y `esDestinoPermitidoPorRol` importados de `src/lib/proxy.ts`)
- [ ] T006 Fuentes del menú en `scripts/arch/lib/nav-fuentes.ts` (hrefs literales y dinámicos de `NavHeader.tsx`; arrays de `nav-items.ts`; grants por defecto de `prisma/seed.ts` `clavesPorRol`)
- [ ] T007 Aserción A en `scripts/arch/asercion-puerta-predicado.ts` (inventario rol × ruta; rojo solo por desalineo real con sesión canónica; anónimo/estado extra = nota documentada) y **primera corrida real**
- [ ] T008 Aserción B en `scripts/arch/asercion-menu-no-miente.ts` (href no resoluble estáticamente = fallo ruidoso listándolo; muerto = rojo con rol/href/veredicto) y **primera corrida real**
- [ ] T009 [P] Tests de parsers y aserciones en `scripts/arch/*.test.ts` (oráculo 47 modelos, huérfanos, determinismo; sin tocar BD)

## Fase 3 — US1 · Documentación de arquitectura que no puede mentir (P1)

**Test independiente**: generar dos veces produce los 5 artefactos idénticos byte a byte.

- [ ] T010 [US1] `scripts/arch/generar-indice.ts` → `docs/architecture/00-INDICE.md` (desde `artefactos.ts`)
- [ ] T011 [US1] `scripts/arch/generar-modelo-datos.ts` → `docs/architecture/01-modelo-datos.md` (47 modelos por dominio, ER Mermaid, huérfanos, rótulo I-29 en IdentificadorReportado.{score,scoreAnonimo,scoreAutenticado,scoreAjustado,nivelRiesgo})
- [ ] T012 [US1] `scripts/arch/generar-roles-capacidades.ts` → `docs/architecture/02-roles-capacidades.md` (matriz rol × ruta ejecutando `proxy()` con sesión canónica + `esDestinoPermitidoPorRol`; tabla módulo → ruta → rol; ejes documentados por separado, sin reconciliar)
- [ ] T013 [US1] `scripts/arch/generar-pantallas.ts` → `docs/architecture/03-pantallas.md` (pantallas por rol, grafo de transiciones Mermaid, home-por-rol)
- [ ] T014 [P] [US1] `scripts/arch/generar-stack.ts` → `docs/architecture/06-stack.md` (dependencias, contenedores, puertos leídos de package.json/Dockerfile/docker-compose.prod.yml)
- [ ] T015 [US1] Encabezado "GENERADO — no editar a mano" + determinismo (sin timestamps ni rutas absolutas; orden estable) en los 5; test de doble corrida idéntica
- [ ] T016 [US1] Primera generación REAL: ejecutar los 5 generadores y dejar los artefactos en `docs/architecture/`
- [ ] T017 [US1] Commit US1 (generadores + artefactos) + push

## Fase 4 — US2 · Compuerta CI que mantiene la línea base viva (P1)

**Test independiente**: añadir un modelo ficticio al schema pone el gate en ROJO; revertirlo lo deja VERDE.

- [ ] T018 [US2] `scripts/arch/arch-check.ts`: (a) regenera y diff contra `docs/architecture/` (rojo si difiere), (b) huérfano nuevo fuera de `excepciones.json` (rojo), (c) aserción A con sesión canónica, (d) aserción B; exit ≠ 0 si algo falla
- [ ] T019 [US2] Script `arch:check` en `package.json`
- [ ] T020 [US2] Paso `arch:check` en `../.github/workflows/ci.yml` (raíz del monorepo; respeta filtro de paths y `working-directory`)
- [ ] T021 [US2] Commit US2 (compuerta + CI) + push

## Fase 5 — US3 · Disciplina de impacto arquitectónico en specs (P2)

**Test independiente**: una spec nueva sin "Impacto en arquitectura:" hace fallar el test de disciplina; AGENTS.md contiene la regla de lectura.

- [ ] T022 [US3] `src/lib/specs-discipline.test.ts`: exigir "Impacto en arquitectura:" en specs NUEVAS (desde 126) con lista de excepciones históricas que solo encoge (mismo patrón que DEUDA_HEREDADA)
- [ ] T023 [P] [US3] Regla "antes de tocar `src/`, leer `docs/architecture/`" en `AGENTS.md`
- [ ] T024 [US3] Commit US3 (disciplina) + push

## Fase 6 — Polish & cierre

- [ ] T025 Gate de calidad: `npx tsc --noEmit` + `npm run lint` + tests tocados + `npm run build`; suite completa `npm run test`
- [ ] T026 Verificar AC-1..AC-5 de `quickstart.md` (AC-2 con drift real: modelo ficticio → ROJO → revertir → VERDE) y pegar evidencia en el cierre
- [ ] T027 `specs/126-linea-base-arquitectura/cierre.md` + sección Implementación y Status IMPLEMENTADO en `spec.md` + `specs/README.md` (126 → Implementada) + tasks.md marcado
- [ ] T028 Commit de docs de cierre + push final

## Dependencias

- Fase 2 bloquea todo (parsers y aserciones son la base de generadores 02/03 y de arch:check).
- US1 y US2 son P1; US2 depende de los artefactos de US1 (el diff necesita lo commiteado). US3 (P2) es independiente.
- **Compuerta ZEUS tras T007/T008**: primera corrida de A/B; ROJA = PARAR y reportar (no silenciar).

## Estrategia

MVP = Fases 1–3 (línea base generada). Las aserciones se construyen y corren ANTES que
los generadores (T007/T008 en Fase 2) porque su veredicto sobre el código actual decide
si se sigue o se para (condición vinculante de ZEUS).
