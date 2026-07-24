# Quickstart: Gantt interactivo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

> **Regla 4.** §2 se verifica contra la app **desplegada**. Imagen posterior a los commits:
> `docker images --format '{{.Repository}} {{.CreatedAt}}' | grep innovadataco-app`.
> ⚠️ El arrastre solo funciona de verdad contra la imagen redesplegada de este turno; el
> contenedor del turno anterior no conoce `fechaInicio` ni `dependeDe`.

## §0 · Gates
```bash
npx vitest run · npx tsc --noEmit · npm run build · npx eslint src
```

## §1 · Migración (SC-005)
```bash
docker exec 001-2026-innovadataco-db-1 psql -U idc_admin -d innovadataco_001 -c \
  "SELECT count(*) FROM information_schema.columns WHERE column_name='dependeDe';"
```
Devuelve 2 (entregables + hitos).

## §2 · En la app desplegada

Proyectos › Gestión › proyecto › **Gantt**.

| # | Qué hacer | Qué debe pasar | FR |
|---|---|---|---|
| 1 | Arrastrar el cuerpo de una barra | Inicio y fin se mueven juntos; al soltar, persiste | FR-001, FR-002 |
| 2 | Arrastrar el borde derecho | Cambia solo el fin; persiste | FR-001 |
| 3 | Recargar (F5) | La barra sigue en su fecha nueva | SC-001 |
| 4 | Escala Semana, arrastrar | Al soltar, la fecha salta al lunes | FR-004 |
| 5 | Configuración › Auditoría | `proyecto.entregable.editado` / `proyecto.hito.editado` | FR-002 |
| 6 | Parar el contenedor `db` y arrastrar | La barra **vuelve** y avisa (rollback) | SC-002 |
| 7 | En una barra, elegir "dep." → otra tarea | Si la precedente termina tras el inicio, se marca **conflicto** rojo | FR-003 |
| 8 | Corregir moviendo una de las dos | La marca de conflicto desaparece | FR-003 |

## §3 · Cero dependencias
```bash
git diff --stat -- package.json package-lock.json   # vacío
```

## §4 · Prueba de persistencia con dato desechable (D-039)

La verificación de que el PATCH persiste se hace con un entregable **sembrado y borrado**,
nunca sobre datos que el CEO deba conservar.

## §5 · Fuera de alcance
Reprogramación en cascada, arrastre táctil, dependencias que no sean fin→inicio.
