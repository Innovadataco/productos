# Quickstart: Gantt del cronograma

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

> **Regla 4.** §2 se verifica contra la app **desplegada**, no el árbol. Imagen posterior a los
> commits: `docker images --format '{{.Repository}} {{.CreatedAt}}' | grep innovadataco-app`.

## §0 · Gates
```bash
npx vitest run · npx tsc --noEmit · npm run build · npx eslint src
```

## §1 · Migración (SC-005)
```bash
docker exec 001-2026-innovadataco-db-1 psql -U idc_admin -d innovadataco_001 -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='entregables' AND column_name='fechaInicio';"
```
Devuelve 1; los entregables previos quedan con `fechaInicio` NULL (usan createdAt).

## §2 · En la app desplegada

Proyectos › **Gestión** › elegir proyecto › pestaña **Gantt**.

| # | Qué hacer | Qué debe pasar | FR |
|---|---|---|---|
| 1 | Añadir a un entregable fecha de inicio y compromiso | Barra de inicio a compromiso, con su avance pintado dentro | FR-001, FR-006 |
| 2 | Añadir un hito con fecha | Rombo en su fecha; con fechaFin, un rango | FR-001 |
| 3 | Conmutar Día / Semana / Mes | La cabecera y las barras se reposicionan; caen en las fechas reales | FR-002 |
| 4 | Mirar la línea de HOY | Vertical, etiquetada, en su sitio | FR-003 |
| 5 | Un proyecto sin fechas | "Sin cronograma que dibujar", no un lienzo roto | SC-002 |
| 6 | Entregable sin compromiso | Aviso "N sin fecha, fuera del Gantt"; sigue en el cronograma | Edge |

## §3 · Cero dependencias
```bash
git diff --stat -- package.json package-lock.json   # vacío
```

## §4 · Fuera de alcance
El arrastre es SPEC-016, sobre la misma función pura `src/lib/gantt.ts`.
