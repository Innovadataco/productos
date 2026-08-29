# Implementation Plan: SPEC-129 — Rediseño de UX del panel del colegio

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/129-rediseno-ux-colegio/spec.md` (instructivo 002-PI-051 PARTE B)

## Summary

Rediseño de UX del área del colegio SIN tocar funcionalidad: aterrizaje y logo en su área
(C1), home con consulta + estadísticas (C2/C3), navegación lateral patrón AdminNav (C3),
listas con acciones en línea (C4), alertas entendibles (C5) y auditoría legible (C6).
Todo con las primitivas de SPEC-124 y el patrón AdminNav; la lógica de negocio
(SPEC-077, SPEC-119, permisos, proxy) queda intacta.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: las ya instaladas — Next.js 16 App Router, React 19, Tailwind 3.4,
primitivas `src/components/ui/` (SPEC-124), Leaflet para el mapa de estadísticas. Ninguna
dependencia nueva.

**Storage**: N/A (solo presentación; ningún cambio de schema ni de endpoints)

**Testing**: Vitest + Testing Library (componentes) + tests de regresión del logo/aterrizaje
(patrones de `src/lib/proxy.test.ts` y `ConsultaEnriquecidaClient.test.tsx`)

**Target Platform**: Next.js (dev Mac + prod VPS standalone)

**Project Type**: rediseño de frontend (UX) sobre rutas existentes

**Performance Goals**: sin regresión; la home del colegio reusa los mismos fetchs que
`/dashboard-publico` (sin queries nuevas)

**Constraints**: NO cambiar lógica de negocio ni endpoints; NO debilitar tests; reutilizar
primitivas SPEC-124 y AdminNav; el proxy solo se toca si el test del logo lo exige (C1
apunta a `NavHeader.tsx`, no al proxy)

**Scale/Scope**: 1 componente de navegación nuevo + 6 páginas del área colegio reordenadas
+ integración de consulta/estadísticas en la home

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Solo texto / sin multimedia**: OK — no toca superficie de contenido.
- **Presunción de inocencia**: OK — las estadísticas integradas son las ya públicas y
  agregadas (mismo contenido de `/dashboard-publico`).
- **IA local**: OK — sin IA.
- **Canales oficiales**: OK — no toca pantallas de reporte.
- **Multi-tenant**: OK — todo sigue filtrado por `colegioId`; cero cambios de consulta.
- **TypeScript estricto / primitivas**: OK — FR-008 explícito.
- **Metodología Spec-Kit**: OK — spec+plan; compuerta §4 (PARA antes de tasks/implement).

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/129-rediseno-ux-colegio/
├── plan.md              # This file
├── research.md          # Phase 0 (estado actual por pantalla + decisiones)
├── quickstart.md        # Phase 1 (verificación de C1-C6)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── components/
│   │   ├── modules/
│   │   │   ├── NavHeader.tsx          # C1: destino del logo para SCHOOL_ADMIN (acotado)
│   │   │   ├── AdminNav.tsx           # referencia de patrón (no se toca)
│   │   │   └── colegio/
│   │   │       ├── ColegioNav.tsx     # REEMPLAZADA por ColegioSideNav
│   │   │       └── ColegioSideNav.tsx # NUEVO: menú lateral patrón AdminNav
│   │   └── ui/                        # primitivas SPEC-124 (se REUSAN, no se tocan)
│   └── app/dashboard/colegio/
│       ├── layout.tsx                 # monta ColegioSideNav (única nav del área)
│       ├── page.tsx                   # C2/C3: home = consulta pública + estadísticas
│       ├── cursos/                    # C4: listas con acciones en línea
│       ├── alumnos/                   # C4
│       ├── alertas/                   # C5: header + empty state + lista con estado
│       ├── auditoria/                 # C6: filas en lenguaje natural
│       └── estadisticas/              # se integra en home (o queda como subsección)
```

**Structure Decision**: un solo componente nuevo (`ColegioSideNav`) que replica el patrón
de `AdminNav` con los `COLEGIO_NAV_ITEMS` (mismo filtro D-41: módulo ∧ predicado). Las
páginas conservan sus guards (`verificarAccesoPagina`) y sus client components actuales;
el rediseño reordena layout y listas, no reescribe lógica.

## Diseño por frente (Phase 1)

### C1 — Aterrizaje y logo en su área
- `login/page.tsx:35` ya redirige SCHOOL_ADMIN → `/dashboard/colegio`: se cubre con test
  de regresión (patrón SPEC-127) para que no recaiga.
- `NavHeader.tsx`: el logo en zona pública hoy va a `/` para todos (SPEC-106, I-38).
  Cambio acotado: si `user.rol === "SCHOOL_ADMIN"`, el logo apunta SIEMPRE a
  `/dashboard/colegio` (el colegio no tiene flujo de reporte propio que proteger;
  SPEC-106 protegía a los roles internos). La regla I-38 (logo nunca muerto) se mantiene.
- Tests: casos del logo por rol (SCHOOL_ADMIN en pública → su panel; otros roles intactos).

### C2/C3 — Home del colegio con consulta + estadísticas
- `page.tsx`: integra el formulario de consulta pública y las estadísticas de
  `/dashboard-publico` reusando sus componentes (misma fuente `GET /api/estadisticas-publicas`
  y `/api/consulta`). Primero consulta, luego estadísticas; la ficha del colegio queda
  compacta arriba (no un muro de tarjetas).
- Evaluar en implementación si `/dashboard/colegio/estadisticas` queda como subsección
  del menú lateral (mismo contenido ampliado) o se absorbe: decidir con el mockup, sin
  duplicar código (componente compartido).

### C3 — ColegioSideNav (patrón AdminNav)
- Menú vertical: Inicio (consulta+stats), Cursos, Alumnos, Alertas, Auditoría.
- Ítems de `COLEGIO_NAV_ITEMS` filtrados por módulo ∧ `esDestinoPermitidoPorRol` (D-41).
- Sin iconos sueltos abajo, sin tabs; "Cambiar contraseña"/"Cerrar sesión" solo en el
  menú de sesión del header (C7, PARTE A).

### C4 — Listas con acciones en línea
- Cursos: fila con editar (modal, primitiva `Modal`) y activar/desactivar inline; "Nuevo
  curso" y "Carga masiva" como acciones de encabezado.
- Alumnos: fila con ver/editar y gestión de identificadores inline (expandible o modal),
  sin saltar de pantalla para lo frecuente.
- Mismos endpoints y validaciones; si una acción necesita página propia (carga Excel),
  queda enlazada, no escondida.

### C5 — Alertas entendibles
- Encabezado: "Alertas son avisos cuando un identificador registrado para un alumno
  aparece en un reporte de la comunidad" (lenguaje neutral, sin voseo).
- Vacío: `EmptyState` con ese texto + CTA a Alumnos.
- Con datos: lista anonimizada (SPEC-077 intacto) con badge de estado
  (nueva / vista / gestionada) usando `Badge` (SPEC-124).

### C6 — Auditoría legible
- Mapa acción → frase en lenguaje natural (tabla declarativa en el client component):
  actor (nombre/email), fecha/hora formateada `es-CO`, detalle como pares etiqueta-valor.
- Cero JSON crudo; los metadatos técnicos se traducen (los que no tengan traducción se
  muestran como "Detalle técnico" colapsado, nunca inline).

## Research resumido (Phase 0 → research.md)

Estado actual por pantalla, qué se reusa de `/dashboard-publico` y de AdminNav, y las
decisiones abiertas para la compuerta (absorber o no la subpágina de estadísticas; logo
del colegio en zona pública vs. intención original de SPEC-106).

## Quickstart (validación) → [quickstart.md](quickstart.md)

Verificación guiada de C1-C6 con una cuenta SCHOOL_ADMIN (criterios SC-001..SC-005).

## Contracts

N/A — no expone endpoints nuevos ni cambia contratos existentes (rediseño de presentación).

## Data Model

N/A — sin cambios de schema ni de consultas de datos (las mismas lecturas de hoy).

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación.

## Complexity Tracking

Sin violaciones de constitución que justificar.
