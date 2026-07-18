# Lote — Higiene del repo + Diseño 018 + Índice 017

> Fecha: 2026-07-18.
> Rama: `feature/001-scaffolding`.

## Resumen ejecutivo

Se completaron tres tareas independientes:

1. **Higiene del repo (Tarea A):** se eliminó una página de configuración duplicada/huérfana y se renombró la ruta mal escrita `dashboard/admin/apeaciones` a `dashboard/admin/apelaciones`.
2. **Diseño 018 (Tarea B):** se entregó `specs/018-operadores-casos/diseno.md` con el diseño del módulo de operadores de casos (revisión humana), más la actualización del índice maestro.
3. **Esqueleto 017 (Tarea C):** se entregaron `specs/017-documentacion/spec.md` y `specs/017-documentacion/plan.md` con el índice de 3 capas del futuro módulo de documentación navegable.

No se escribió código para las specs 017/018; ambas están en estado **EN DISEÑO** a la espera de revisión del owner.

---

## Tarea A — Higiene del repo

### A1 — Configuración duplicada

**Hallazgo:** existían dos páginas que renderizaban el mismo `ConfigPanel`:
- `/dashboard/configuracion` (huérfana, sin enlaces de navegación, con colores hardcodeados).
- `/dashboard/admin/configuracion` (la oficial, linkeada desde `AdminNav` y `NavHeader`).

**Acción:** se eliminó `src/app/dashboard/configuracion/page.tsx`.

### A2 — Ruta mal escrita

**Hallazgo:** la carpeta del panel de apelaciones estaba escrita como `apeaciones` en lugar de `apelaciones`.

**Acción:**
- Se renombró `src/app/dashboard/admin/apeaciones` → `src/app/dashboard/admin/apelaciones` (con `git mv`).
- Se actualizó el enlace en `src/components/modules/AdminNav.tsx`.
- Se verificó que no queden referencias a `/dashboard/admin/apeaciones`.
- Se verificó que la ruta `/dashboard/admin/apelaciones` responde correctamente.

### Verificaciones de Tarea A

- `npm run lint` ✅ (0 errores, 1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit` ✅.
- `npm run build` ✅ (la ruta compilada es `/dashboard/admin/apelaciones`).
- `npm test -- --run` ✅ 224 tests pasaron.
- `npx tsx scripts/smoke-e2e.ts` ✅.
- `curl -I /dashboard/admin/apelaciones` → `307` (redirige a login sin sesión, comportamiento esperado).

### Commits de Tarea A

```text
25192c5 chore(ui): elimina página de configuración huérfana /dashboard/configuracion (duplicado de /dashboard/admin/configuracion)
a7cd16f chore(ui): renombra dashboard/admin/apeaciones a apelaciones y actualiza enlace de navegación
```

---

## Tarea B — Diseño 018: Operadores de casos

**Entregable:** `specs/018-operadores-casos/diseno.md`.

El documento cubre:

1. **Modelo de roles:** extensión propuesta del enum `RolUsuario` con `OPERADOR` y un modelo `PerfilOperador` ligado a `Usuario`, reutilizando auth, tenant y `AuditLog` existentes.
2. **Gestión de operadores:** CRUD admin con datos mínimos de empleado, alta por email y desactivación lógica.
3. **Motor de asignación:** aleatorio ponderado por carga inversa, asignación instantánea al entrar a `REVISION_MANUAL`, sin auto-rebote de casos.
4. **Trazabilidad:** qué puede ver y hacer un operador, con registro en `AuditLog`.
5. **Integración:** cola `/api/admin/reportes-revision`, apelaciones Fase C y kanban futuro.
6. **Análisis de riesgo:** operador malicioso, colusión, caso sin atender, fuga de datos.
7. **Fases de implementación** en orden de dependencia con esfuerzo estimado.

Relación con el contexto crítico: con `umbral_revision = 1.0`, la mayoría de reportes cae en `REVISION_MANUAL`. Sin operadores, los reportes legítimos nunca se publican. El diseño hace operable esa cautela.

### Commit de Tarea B

```text
604edb3 docs(specs): diseño 018 operadores de casos + índice README
```

---

## Tarea C — Esqueleto 017: Módulo de documentación navegable

**Entregables:**
- `specs/017-documentacion/spec.md` — alcance, audiencias, control de acceso, fuentes y entregables.
- `specs/017-documentacion/plan.md` — índice completo de 3 capas con fuente de cada tema.

El índice propone:

- **Capa 1 — Qué y por qué:** motivación, marco normativo, catálogo de funcionalidades (semi-pública).
- **Capa 2 — Cómo funciona:** flujo de un reporte de punta a punta y guía de operación de cada módulo admin (autenticados).
- **Capa 3 — Por dentro:** arquitectura, modelos de IA, laboratorio, migraciones, tests, seguridad, despliegue y deuda técnica (solo admins).

Todas las fuentes apuntan a documentos y código existentes; no se inventa contenido.

### Commit de Tarea C

```text
7539427 docs(specs): esqueleto spec 017 módulo de documentación (spec.md + plan.md + índice)
```

---

## Evidencia de push

```text
To https://github.com/Innovadataco/productos.git
   05604be..7539427  feature/001-scaffolding -> feature/001-scaffolding
```

## Estado final del repo

```text
On branch feature/001-scaffolding
nothing to commit, working tree clean
```

## Log reciente

```text
7539427 docs(specs): esqueleto spec 017 módulo de documentación (spec.md + plan.md + índice)
604edb3 docs(specs): diseño 018 operadores de casos + índice README
a7cd16f chore(ui): renombra dashboard/admin/apeaciones a apelaciones y actualiza enlace de navegación
25192c5 chore(ui): elimina página de configuración huérfana /dashboard/configuracion (duplicado de /dashboard/admin/configuracion)
05604be test(consulta): documenta que reportes en revisión manual no son visibles públicamente
3b8fc21 test(seguimiento): cobertura de estados procesado, revisión y error
d9f8428 fix(ui): contraste accesible en seguimiento de reporte usando tokens de tema y Badge
a25a3c2 test(consulta): ajusta tests a respuesta sin score/categorías y con ubicaciones
```

---

## Próximos pasos

- **017:** esperar aprobación del esqueleto antes de generar contenido y construir la UI.
- **018:** esperar revisión del diseño antes de crear `tasks.md`, migraciones e implementación.
