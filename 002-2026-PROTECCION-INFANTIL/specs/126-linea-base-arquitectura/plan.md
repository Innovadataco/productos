# Implementation Plan: SPEC-126 — Línea base de arquitectura generada desde el código

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/126-linea-base-arquitectura/spec.md` (instructivo 002-PI-042, radica ZEUS)

## Summary

Materializar la línea base de arquitectura: 5 generadores deterministas (sin IA) que LEEN el
código y escriben `docs/architecture/{00-INDICE,01-modelo-datos,02-roles-capacidades,03-pantallas,06-stack}.md`,
más `npm run arch:check` cableado al CI con 4 aserciones (drift de artefactos, huérfano nuevo,
puerta ≡ predicado, menú que no miente) y la disciplina "Impacto en arquitectura" en specs.
Las fuentes (`proxy.ts`, `nav-items.ts`, `NavHeader.tsx`, `permisos-catalogo.ts`) se LEEN, no se tocan.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22 (`~/.local/bin` en la Mac de dev; CI usa Node 22)

**Primary Dependencies**: las ya instaladas — Prisma (parseo del schema como texto, NO introspección
de BD), `next/server` (importar `proxy.ts` para ejecutar las aserciones con el código REAL, no reimplementarlo),
Mermaid (solo sintaxis en el markdown generado, sin dependencia nueva). Ninguna dependencia nueva de npm.

**Storage**: N/A (artefactos markdown versionados en git)

**Testing**: Vitest (tests junto a los generadores: oráculos, determinismo, aserciones A/B en local)

**Target Platform**: macOS dev + GitHub Actions (ubuntu, workflow `productos/.github/workflows/ci.yml`,
job del producto `002-2026-PROTECCION-INFANTIL` con `working-directory` ya acotado)

**Project Type**: tooling de repo (generadores + gate CI)

**Performance Goals**: generación completa < 60 s en CI; arch:check < 90 s

**Constraints**: determinismo byte a byte (sin timestamps ni rutas absolutas de máquina en la salida);
cero dependencias npm nuevas; cero cambios en `src/` de producto salvo `AGENTS.md` y el test de disciplina

**Scale/Scope**: 47 modelos Prisma (oráculo verificado hoy: `grep -c "^model "` = 47), 47 `page.tsx`,
5 roles + anónimo, ~117 rutas API, 22 módulos permisibles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Solo texto / sin multimedia**: OK — genera markdown.
- **Presunción de inocencia**: OK — documenta la prohibición I-29 (score vivo en datos, prohibido
  de cara al usuario) en vez de ocultarla; no crea ninguna superficie pública nueva.
- **IA local**: OK — los generadores NO usan IA (deterministas por diseño, exigencia del brief).
- **ADR_004 (parametrizable)**: OK — la lista de excepciones de huérfanos y los oráculos viven en un
  archivo de configuración del generador (`scripts/arch/excepciones.json`), no quemados en la lógica.
- **Sin secretos en repo**: OK — los artefactos documentan puertos y nombres de variables, nunca valores.
- **Migraciones aditivas / no destructivo**: OK — no toca schema ni datos.
- **Metodología Spec-Kit**: OK — spec.md + plan.md + research.md + quickstart.md; compuerta §4 respetada
  (PARA antes de tasks/implement).
- **Regla de tests del repo**: los tests nuevos van junto a los generadores y NO tocan la BD
  (los generadores leen archivos; las aserciones A/B importan `proxy.ts` con `NextRequest` en memoria).

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/126-linea-base-arquitectura/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output (validación end-to-end)
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── scripts/arch/
│   ├── generar-indice.ts          # 00-INDICE.md
│   ├── generar-modelo-datos.ts    # 01-modelo-datos.md (parsea prisma/schema.prisma)
│   ├── generar-roles-capacidades.ts # 02-roles-capacidades.md (importa proxy.ts, nav-items, catálogo)
│   ├── generar-pantallas.ts       # 03-pantallas.md (árbol src/app + homeForRole)
│   ├── generar-stack.ts           # 06-stack.md (package.json, Dockerfile, compose, puertos)
│   ├── lib/                       # parsers compartidos (schema, proxy, árbol de rutas)
│   ├── arch-check.ts              # orquesta (a)(b)(c)(d) y devuelve exit != 0 si algo difiere
│   ├── asercion-puerta-predicado.ts # A: proxyCore ≡ esDestinoPermitidoPorRol sobre inventario
│   ├── asercion-menu-no-miente.ts   # B: href del menú alcanzable según proxy
│   ├── excepciones.json           # huérfanos permitidos (Plan, Subscription, BillingCycle)
│   └── *.test.ts                  # oráculos, determinismo, A/B en local
├── docs/architecture/             # SALIDA GENERADA (nunca editada a mano; rotulada así)
├── .github/workflows/ (raíz del monorepo productos/)
│   └── ci.yml                     # + job arch-check (o paso en el gate existente)
└── AGENTS.md                      # + regla "antes de tocar src/, leer docs/architecture/"
```

**Structure Decision**: generadores como scripts `tsx` bajo `scripts/arch/` (mismo patrón que
`scripts/importar-geonames.ts` de SPEC-115); el comando `arch:check` se añade a `package.json`;
el cableado CI va en el workflow de la raíz del monorepo filtrado por paths del producto.

## Diseño por artefacto (Phase 1)

### 00-INDICE.md
Tabla: artefacto → fuente(s) de código → comando que lo regenera. Se genera de una lista
declarativa en `scripts/arch/artefactos.ts` (única fuente: añadir un artefacto = añadir una fila).

### 01-modelo-datos.md (fuente: `prisma/schema.prisma`)
- Parseo textual del schema (regex de bloques `model X { ... }`, campos, `@relation`): sin BD,
  sin introspección. 47 modelos → agrupados por dominio (convención: por prefijo/comentario de
  sección del schema; el agrupador se documenta en research.md).
- Diagrama ER Mermaid: nodos = modelos, aristas = `@relation` (con cardinalidad 1:N / 1:1 por
  opcionalidad y arrays). Mermaid `erDiagram`.
- Huérfanos: modelos sin `@relation` saliente y sin ser referenciados por ningún otro modelo.
  Oráculo hoy: `Plan`, `Subscription`, `BillingCycle` (los únicos 3). `Tenant` NO es huérfano
  (lo referencian `Usuario`, `Reporte`, `Colegio`). Lista viva en `excepciones.json`.
- Rótulo I-29: en la ficha de `IdentificadorReportado`, los campos `score, scoreAnonimo,
  scoreAutenticado, scoreAjustado, nivelRiesgo` llevan la marca "vivo en datos, prohibido de
  cara al usuario (I-29)". La marca se deriva de una lista declarativa en el generador
  (documentada), no de heurística.

### 02-roles-capacidades.md (fuentes: proxy.ts, nav-items.ts, permisos-catalogo.ts, NavHeader.tsx, src/app/**)
- El generador IMPORTA `src/lib/proxy.ts` y ejecuta `proxyCore` (vía `proxy()`) y
  `esDestinoPermitidoPorRol` sobre el inventario (5 roles + anónimo) × (rutas del árbol
  `src/app/**` + listas del proxy): matriz rol × ruta → veredicto (permitir/bloquear/redirigir).
- Tabla módulo → ruta → rol: de `nav-items.ts` (ítems ↔ módulos) + `permisos-catalogo.ts`
  (jerarquía padre/hijo, esCritico) + mapeo de rutas a módulo según el nav.
- NOTA (no reconciliar): el eje `PermisoModulo` (BD) y el eje rutas (proxy) se documentan por
  separado, uno tras otro; su reconciliación es decisión de ZEUS.

### 03-pantallas.md (fuentes: src/app/**, proxy.ts, nav-items.ts)
- Pantallas por rol: cada `page.tsx` clasificada por quién puede alcanzarla según el proxy.
- Grafo de transiciones: home-por-rol (`homeForRole`) + redirects del proxy (`redirectToHome`,
  `redirectToLogin`) en Mermaid `flowchart`.
- Home por rol: tabla rol → home (de `homeForRole`, importada, no copiada).

### 06-stack.md (fuentes: package.json, Dockerfile, docker-compose*.yml, config de puertos)
- Dependencias runtime/dev (de package.json), scripts npm relevantes.
- Contenedores (docker-compose.prod.yml: app/worker/db, imágenes, restart policy).
- Puertos: app 5005, db (interno), y los documentados del entorno; leídos de los archivos,
  no quemados (donde estén en config; si un puerto solo existe en AGENTS.md, se cita como fuente).

### arch:check (compuerta)
1. Regenera los 5 en un directorio temporal y `diff` contra `docs/architecture/` → distinto = ROJO (a).
2. Huérfanos del schema fuera de `excepciones.json` → ROJO (b).
3. Aserción A: inventario real → veredicto de `proxy()` vs `esDestinoPermitidoPorRol` →
   desalineo = ROJO con la lista (c). Alineación de veredictos: permitir (`next()`) ≡ `true`;
   bloquear (401/403/redirect) ≡ `false`. Las redirecciones a home/login cuentan como "no permitir".
4. Aserción B: hrefs que `NavHeader.tsx` + `nav-items.ts` pintan por rol (se parsean los arrays
   y el JSX del header) → cada href evaluado con el proxy para ese rol → muerto = ROJO (d).
   Se reutiliza la lógica `esEnlaceNavegable` del header importándola, no reimplementándola.
5. Cableado: script `arch:check` en `package.json` + paso/job en
   `productos/.github/workflows/ci.yml` (tras tests; corre siempre que cambien `src/`, `prisma/`,
   `scripts/arch/` o `docs/architecture/` del producto).
6. Disciplina: `src/lib/specs-discipline.test.ts` gana la regla "toda spec.md NUEVA (desde 126)
   contiene 'Impacto en arquitectura:'" con lista de excepciones históricas que solo encoge.

## Research resumido (Phase 0 → research.md)

Decisiones: generadores por parseo textual + importación directa del código (vs introspección
BD, vs duplicar lógica del proxy); salida sin timestamps (vs excluir marcas en el diff);
aserciones ejecutando el código real (vs reimplementar veredictos). Detalle y alternativas en
[research.md](research.md).

## Quickstart (validación) → [quickstart.md](quickstart.md)

Los 5 criterios de aceptación del instructivo se verifican ahí paso a paso (verde, rojo por
drift, A y B sobre inventario real, línea de impacto + regla AGENTS.md).

## Contracts

N/A — tooling interno del repo (no expone interfaces externas). Justificado: la "interfaz" es
el comando `arch:check` y los artefactos markdown, ambos cubiertos por quickstart.md y los
tests de oráculo.

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación. Los generadores son locales y
deterministas; la única escritura es en `docs/architecture/` y archivos propios de la spec.

## Complexity Tracking

Sin violaciones de constitución que justificar.
