# Implementation Plan: Tests de rol + documentación de arquitectura

**Branch**: `[047-tests-rol-arquitectura]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-tests-rol-arquitectura/spec.md`

---

## Summary

Ejecutar la Fase 2 del PROGRAMA DE SANEAMIENTO: cerrar la deuda de tests de visibilidad por rol, documentar la arquitectura técnica del sistema y añadir JSDoc a módulos clave, sin modificar funcionalidad. Todo se hará bajo el directorio `specs/047-tests-rol-arquitectura` y con commits separados por User Story.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Next.js 16.2.10 / React 19.2.4 |
| **Primary Dependencies** | Vitest, jsdom, `@testing-library/react`, Next.js App Router |
| **Storage** | No cambios de datos (solo tests y documentación) |
| **Testing** | Vitest + jsdom para componentes y proxy; tests unitarios para permisos |
| **Target Platform** | Desarrollo local / Docker Compose |
| **Performance Goals** | Tests < 5s en su conjunto |
| **Constraints** | Sin cambios funcionales; sin migraciones; sin tocar SPEC-050/SPEC-060 |
| **Scale/Scope** | ~1 archivo de tests, ~1 doc de arquitectura, JSDoc en 5 módulos |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Se añaden tests de texto y documentación Markdown |
| §1.3 Presunción de inocencia | ✅ Pass | No se modifica la consulta pública ni reportes |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica el modelo de datos |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | Tests reutilizan el stack existente |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT, Anónimo) | ✅ Pass | Se refuerza con tests de visibilidad |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Tests se escriben con tipos correctos; JSDoc no introduce `any` |
| §3.4 Códigos HTTP correctos | ✅ Pass | Tests de proxy verifican 200/307/401/403 |
| §3.5 Logs y auditoría | ✅ Pass | No se modifica la lógica de auditoría |
| §3.6 Límites de tamaño | ✅ Pass | No se añaden endpoints |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se tocan singletons |
| §5.1 Testing | ✅ Pass | Se añaden tests de Vitest |
| §6.1 JWT en cookie httpOnly | ✅ Pass | No se modifica autenticación |
| §6.3 Datos sensibles encriptados | ✅ Pass | JSDoc documenta `param-encryption` sin cambiar cifrado |

**Re-check post-design**: All gates still pass. No violations.

**Additional checks post-spec-update**:
- ✅ Sin cambios funcionales: alcance limitado a tests, JSDoc y documentación.
- ✅ No tocar SPEC-050 ni SPEC-060: se respeta la restricción del PROGRAMA DE SANEAMIENTO.
- ✅ Migraciones: ninguna; no se toca Prisma schema.

---

## Project Structure

### Documentation (this feature)

```text
specs/047-tests-rol-arquitectura/
├── spec.md                    # Feature specification
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # No aplica
├── quickstart.md              # Phase 1 output
├── tasks.md                   # Phase 2 output
└── checklists/
    └── requirements.md        # Phase 0 checklist
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── lib/
│   │   ├── role-visibility.test.ts      # Tests de visibilidad por rol (US1)
│   │   ├── reporte-lifecycle.ts         # JSDoc (US3)
│   │   ├── circulo-confianza.ts         # JSDoc (US3)
│   │   ├── proxy.ts                     # JSDoc (US3)
│   │   ├── ai/classifier.ts             # JSDoc (US3)
│   │   └── param-encryption.ts          # JSDoc (US3)
├── docs/
│   └── ARCHITECTURE.md                  # Documento de arquitectura (US2)
```

**Structure Decision**: Tests centralizados en `src/lib/` junto a otros utilitarios; ARCHITECTURE.md en `docs/` junto a la documentación operativa de AGENTS.md.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
