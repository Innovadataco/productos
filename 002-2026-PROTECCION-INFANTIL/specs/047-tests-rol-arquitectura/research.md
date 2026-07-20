# Research: Tests de rol + documentación de arquitectura

**Date**: 2026-07-20
**Feature**: specs/047-tests-rol-arquitectura/spec.md

---

## Contexto

Este spec forma parte del PROGRAMA DE SANEAMIENTO. Las Fases 0 y 1 ya cerraron:

- Fase 0 (Spec 044): higiene documental de Spec-Kit, convención de Status y cierre.
- Fase 1 (Specs 041, 045, 046): blindaje de migraciones, seguridad de autenticación, endurecimiento de seguridad (PII, CSP, paginación, saneamiento de errores).

La Fase 2 se enfoca en cerrar la deuda de **tests de visibilidad por rol** y en **documentar la arquitectura** del sistema, preparando el terreno para specs futuros sin riesgo de regresión en permisos.

---

## Bugs conocidos de rol que motivan los tests

### 1. Navegación del comité (tabs)

- **Spec 040**: se aisló al rol `COMITE_VALIDACION` a su Bandeja. Antes de ese fix, el comité veía las pestañas "Gestión" y "Auditoría".
- **ComiteSubNav** (`src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`) filtra tabs con `puedeVerTab`. El test debe certificar que `ADMIN`/`SCHOOL_ADMIN` ven todo y `COMITE_VALIDACION` solo ve "Bandeja".

### 2. Aislamiento del área admin

- **AdminNav** (`src/components/modules/AdminNav.tsx`) define los roles permitidos por cada link. Un error de rol haría que `OPERADOR` o `COMITE_VALIDACION` vean secciones que no les corresponden.
- `OPERADOR` debe ver solo "Bandeja de reportes" y "Revisión de spam".
- `COMITE_VALIDACION` debe ver solo "Comité".

### 3. Protección perimetral del proxy

- **Proxy** (`src/lib/proxy.ts`) redirige a usuarios internos desde rutas de usuario final (`/dashboard`, `/mis-reportes`) y protege rutas admin-only del comité (`/dashboard/admin/comite/gestion`, `/dashboard/admin/comite/auditoria`).
- Un error aquí podría permitir a un `PARENT` acceder a `/dashboard/admin` o a un `COMITE_VALIDACION` acceder a `/dashboard/admin/comite/gestion`.

### 4. Permisos de gestión de reportes

- **`puedeGestionarReporte`** en `src/lib/operadores/permisos.ts` debe respetar:
  - `ADMIN` ve todo.
  - `SCHOOL_ADMIN` ve solo recursos de su tenant (o sin tenant).
  - `OPERADOR` ve solo recursos asignados a él.
  - Otros roles no gestionan reportes.

---

## Módulos a documentar con JSDoc

| Módulo | Razón |
|--------|-------|
| `src/lib/reporte-lifecycle.ts` | Flujo de baja y reactivación de reportes; impacta datos, embeddings y auditoría. |
| `src/lib/circulo-confianza.ts` | Lógica de contactos de confianza, agregación y notificaciones; privacidad importante. |
| `src/lib/proxy.ts` | Middleware de autorización por ruta; punto crítico de seguridad. |
| `src/lib/ai/classifier.ts` | Clasificación IA con votos y cascada; modelo de riesgo central. |
| `src/lib/param-encryption.ts` | Cifrado AES-256-GCM de parámetros sensibles; seguridad de datos en reposo. |

Se excluyen componentes de UI pequeños y páginas porque su superficie es menor y su comportamiento se valida con tests.

---

## Decisiones de investigación

### D1: Ubicación de los tests de rol

**Opción A**: tests en cada archivo junto al componente (`ComiteSubNav.test.tsx`, `AdminNav.test.tsx`, `permisos.test.ts`, `proxy.test.ts`).
**Opción B**: un archivo centralizado `src/lib/role-visibility.test.ts` que cubra todos los escenarios de visibilidad por rol.

**Decisión**: Opción B. Agrupa la intención del spec (tests de visibilidad por rol) en un solo lugar legible y facilita auditorías del PROGRAMA DE SANEAMIENTO. El archivo de tests puede importar componentes y funciones desde sus ubicaciones reales.

### D2: Cómo testear el proxy

`src/lib/proxy.ts` exporta `proxy(request)` que usa `NextRequest` y `NextResponse`. En tests unitarios se pueden crear instancias de `NextRequest` con `new Request(...)` y evaluar el `NextResponse` retornado. Vitest con jsdom soporta `Request` nativo. Para `NextResponse.redirect`, se puede inspeccionar `.status` y headers `location`.

### D3: Alcance de ARCHITECTURE.md

El documento debe complementar `AGENTS.md`. `AGENTS.md` es operativo: ramas, puertos, comandos, reglas de cierre. `ARCHITECTURE.md` será técnico: capas, flujo de datos, convenciones de código y seguridad. No debe repetir `AGENTS.md` ni la constitución; sí enlazarlos.

### D4: Formato del JSDoc

Se usa JSDoc estándar (`@param`, `@returns`, `@throws`) en funciones exportadas principales. No se añaden tipos redundantes si TypeScript ya los infiere; el JSDoc describe semántica y efectos secundarios. Se evita modificar el cuerpo de las funciones.

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Los tests de UI dependen de implementación de `usePathname` | Mockear `next/navigation` en el test. |
| Los tests de proxy dependen de `next/server` | Mockear `NextResponse` si es necesario; o usar instancias reales con `Request`. |
| JSDoc introduce líneas largas que el linter rechaza | Revisar con `npm run lint` antes de commitear. |
| ARCHITECTURE.md queda desactualizado | Señalar explícitamente que complementa `AGENTS.md` y que cambios de arquitectura deben actualizarlo. |

---

## Notas de investigación

- Se revisó `specs/040-aislamiento-comite-bandeja/cierre.md` para extraer los escenarios de aislamiento del comité.
- Se revisó `specs/044-disciplina-spec-kit/research.md` para alinear la convención de Status y cierre.
- Se confirmó que el spec no altera datos ni schema, por lo que no requiere migración.
