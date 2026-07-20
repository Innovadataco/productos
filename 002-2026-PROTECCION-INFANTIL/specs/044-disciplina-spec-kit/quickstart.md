# Quickstart: Validación de Disciplina y reconciliación Spec-Kit

**Prerequisites**: Git, acceso al repositorio, editor de Markdown.

---

## 1. Verificar que el spec 044 existe

```bash
ls specs/044-disciplina-spec-kit/
```

**Esperado**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md` y `checklists/requirements.md`.

---

## 2. Revisar el Status del spec 044

Abrir `specs/044-disciplina-spec-kit/spec.md` y verificar que el encabezado contiene:

```markdown
**Status**: PLANEADO
```

**Esperado**: El estado es `PLANEADO` hasta que se complete el cierre.

---

## 3. Verificar el snapshot histórico

Abrir `specs/044-disciplina-spec-kit/research.md` y buscar la sección `D1: Snapshot histórico basado en el commit a449bbe`.

**Esperado**: Aparece el hash `a449bbe4a04afc08cb5ef621269d84d9dfb71834`, la fecha `2026-07-19`, el autor y el asunto.

---

## 4. Revisar el índice de specs 022-043

Abrir `specs/044-disciplina-spec-kit/research.md` y localizar la tabla `Audit Findings`.

**Esperado**:
- La tabla incluye los specs 022-031 y 033-043.
- Cada fila tiene: spec, status actual, status real/corregido, `cierre.md`, `tasks.md`, `requirements.md` y notas.
- Se indica que el spec 032 no existe.

---

## 5. Verificar la deuda documentada

En `specs/044-disciplina-spec-kit/research.md`, revisar las tablas de `Deuda en specs 022-031` y `Deuda en specs 033-043`.

**Esperado**:
- Los specs 022-031 aparecen con falta de `tasks.md` y `requirements.md`.
- Los specs cerrados entre 022-031 están marcados como "no se retrofita".
- Los specs 033-043 cerrados o finalizados sin `cierre.md` aparecen como deuda.

---

## 6. Revisar la convención de cierre

Abrir `AGENTS.md` (o `specs/044-disciplina-spec-kit/research.md` si aún no se actualiza `AGENTS.md`) y verificar que contiene:

1. Valores canónicos de `Status`: `PLANEADO`, `DESARROLLO`, `IMPLEMENTADO`, `PENDIENTE DE PRUEBA`, `FINALIZADO`, `CERRADA`.
2. Convención de cierre única: artefactos obligatorios, `cierre.md`, sección Implementación, commit por US, deploy limpio, quickstart.
3. Flujo Spec-Kit con `clarify` y `analyze`.

---

## 7. Validar que no se tocó código fuente

```bash
git status --short
```

**Esperado**: Solo aparecen archivos bajo `specs/044-disciplina-spec-kit/` y, opcionalmente, `AGENTS.md`. No se modifican archivos en `src/`, `prisma/`, `public/`, `scripts/` ni `tests/` como parte del spec 044.

---

## 8. Ejecutar validación final

Una vez completados los pasos anteriores, el spec 044 queda listo para avanzar a `IMPLEMENTADO` y, tras la revisión de cierre, a `CERRADA`.
