# Implementation Plan: SPEC-339 · El camino guiado del padre (A-67 · Fase 1)

**Branch**: `work/pi-SPEC-339-camino-guiado-padre` | **Date**: 31-08-2026 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/339-camino-guiado-padre/spec.md`

## Summary

El padre entra por un **enlace** en su correo (no un código que transcribe) y el sistema lo lleva por **cuatro pasos obligatorios** —consentimiento, sus datos, al menos un hijo, su plan— antes de abrir un solo módulo. El camino se sostiene con un **quinto guardián en `middleware.ts`** alimentado por la cookie firmada `sesion_estado`, que es el único mecanismo del sistema que resiste una URL escrita a mano. De paso, los menores dejan de ser fichas compartidas y pasan a tener **padre propio**, lo que arregla tres defectos vivos de SPEC-325.

**Enfoque técnico en una línea**: no se inventa nada nuevo — se extiende el mecanismo de guardianes que ya gobierna consentimiento, cambio de contraseña y vigencia, y se cierra su única grieta (falla-abierta) con un rebote acotado.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node.js ≥ 22

**Primary Dependencies**: Next.js 16.2.10 (App Router, API Routes), React 19, Prisma 5.22.0, `jose` + `bcryptjs`, Resend, Tailwind CSS 3.4

**Storage**: PostgreSQL 16 (+ pgvector). Migraciones aditivas.

**Testing**: Vitest + jsdom + Testing Library (unitario e integración); Playwright (E2E, `tests/e2e/`)

**Target Platform**: Web · **móvil primero, 390 px** · el escritorio no puede romperse

**Project Type**: Aplicación web con API Routes en el mismo repositorio

**Performance Goals**: El guardián corre en Edge en cada petición del padre. **Cero consultas a la base de datos desde `middleware.ts`** — la decisión sale de la cookie firmada, como hoy.

**Constraints**:
- Ratchet vigente: prohibido `redirect(...)` en layouts de `dashboard`.
- Ratchet vigente: por cada `destino` de guardián, ese destino debe estar en sus `exentas` (evita bucles; I-25 → I-111 → I-141).
- Ratchet vigente: evento de correo nuevo ⇒ regla + plantilla sembradas (`email.migracion.test.ts`).
- La cookie `sesion_estado` vive **5 minutos**.
- Prohibido `any`. Filtros Prisma tipados.

**Scale/Scope**: Un rol (padre). ~10 pantallas nuevas o rehechas, 6 rutas de datos nuevas, 3 migraciones, 2 correos nuevos.

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio de la constitución | Cómo aplica aquí | Estado |
|---|---|---|
| §1.2 Solo texto — prohibición de multimedia | El camino no sube ni pide archivos. El único documento admitido del sistema (apelación) no se toca. | ✅ |
| §1.3 Presunción de inocencia en el lenguaje | El camino es registro, no consulta; aun así los textos van sin veredictos y **sin rojo** (FR-026). | ✅ |
| §1.5 Clasificación de conductas, no puntaje de personas | Fuera de alcance: el camino no calcula ni muestra puntajes (A-7). | ✅ |
| §1.6 Disputas (Ley 1581) | Sin cambios en el mecanismo de disputa. | ✅ |
| §2.1 Stack heredado | API Routes, Prisma, JWT manual, Vitest. Cero dependencias nuevas. | ✅ |
| §2.2 Roles | El guardián del camino aplica **solo a `PARENT`**; los demás roles no lo evalúan (FR-013). | ✅ |
| §3.1 TypeScript estricto | Sin `any`. El valor de la cookie gana un campo tipado. | ✅ |
| §3.4 Manejo de errores en APIs | Códigos canónicos; el guardián responde `403` en `/api/**` con destino, nunca redirección. | ✅ |
| §3.5 Logs y auditoría | Toda mutación del camino registra `AuditLog` **sin PII en claro** (patrón ya vigente en el servicio de menores). | ✅ |
| §4.1 Singletons | Sin clientes nuevos. | ✅ |

**Resultado del gate: PASA.** Sin violaciones que justificar → la sección «Complexity Tracking» queda vacía a propósito.

**Un punto de tensión, resuelto y anotado**: el documento del padre y el del menor son datos personales sensibles. Se guardan porque el brief §2.3/§2.4 y la validez del expediente lo exigen, se auditan **sin escribir el documento en claro** (patrón ya existente) y no salen nunca en respuestas públicas.

## Project Structure

### Documentation (this feature)

```text
specs/339-camino-guiado-padre/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — las cinco decisiones técnicas
├── data-model.md        # Fase 1 — modelo y migraciones
├── quickstart.md        # Fase 1 — cómo se prueba de punta a punta
├── contracts/           # Fase 1 — contratos de las rutas nuevas
├── checklists/
│   └── requirements.md  # Validación de la especificación
└── tasks.md             # Fase 2 — lo produce /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                      # Usuario (+documento) · Hijo (dueño) · TokenRegistro
├── migrations/                        # 3 migraciones aditivas
└── seed.ts                            # padre.hijos.maximo · 2 eventos+plantillas de correo

src/
├── middleware.ts (raíz del repo)      # 5º guardián: camino incompleto
├── lib/routing/
│   ├── guardias.ts                    # destino + exentas del camino (invariante)
│   ├── vigencia-cookie.ts             # payload de la cookie gana `pasoCamino`
│   ├── sesion-estado-emitter.ts       # calcula el paso pendiente
│   └── sellar-sesion-estado.ts        # re-sellado (ya existe, se reutiliza)
├── lib/camino/
│   ├── pasos.ts                       # única fuente del orden y los destinos
│   └── estado.ts                      # deriva el paso pendiente desde la BD
├── lib/dal/services/hijos/hijos.ts    # dueño propio · tope · corregir datos
├── lib/dal/services/registro-enlace.ts# token de un solo uso
├── app/api/auth/registro/             # solicitar · completar
├── app/api/sesion/al-dia/             # rebote que re-sella (cierra la falla-abierta)
├── app/api/padre/hijos/[id]/route.ts  # PATCH gana corrección de datos
├── app/registro/                      # correo → aviso → crear clave
├── app/camino/                        # las 4 pantallas + cierre
└── components/modules/padre/
    ├── PadreSideNav.tsx               # se mantiene (escritorio)
    └── PadreNavMovil.tsx              # nuevo — el padre hoy no tiene menú en móvil

tests/e2e/camino-padre.spec.ts         # el recorrido completo a 390 px
```

**Structure Decision**: se conserva la estructura vigente del repositorio (App Router + servicios en `src/lib` + DAL). Lo único nuevo es la carpeta `src/lib/camino/`, que existe para que **el orden de los pasos viva en un solo lugar**: el guardián en Edge, las pantallas y el emisor de la cookie tienen que coincidir, y tres listas paralelas son exactamente el defecto que SPEC-287 vino a matar.

## Orden de implementación (por dependencia, no por comodidad)

1. **Fundaciones de datos** — documento del padre · dueño del menor · token de registro · parámetro del tope · eventos de correo. Nada de lo demás compila sin esto.
2. **El paso pendiente** (`src/lib/camino/`) — la función que dice en qué paso está un padre, con sus pruebas. Es el corazón; se hace antes que cualquier pantalla.
3. **El guardián** — la cookie gana el campo, `middleware.ts` gana el paso, y el rebote `sesion/al-dia` cierra la falla-abierta. Con pruebas de que los otros roles no se tocan.
4. **La puerta** — registro por enlace, con el código de 6 dígitos del colegio intacto.
5. **Las cuatro pantallas + cierre**, en tuteo neutro.
6. **Menores**: tope parametrizado, corrección de datos, dueño propio de punta a punta.
7. **Móvil**: menú del padre y repaso a 390 px.
8. **Cierre**: regenerar arquitectura, `arch:check` verde, `cierre.md`.

Cada bloque termina compilando, con sus pruebas propias y las de todo lo que toca (candado 24).

## Complexity Tracking

Sin violaciones de la constitución que justificar.
