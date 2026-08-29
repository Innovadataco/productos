# Quickstart: Gestión — cartera, detalle y Riesgos

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

> **Regla 4.** Todo lo de §2 se verifica contra la app **desplegada** (`http://localhost:5001`),
> no contra el árbol. Comprobar que la imagen es posterior a los commits:
> `docker images --format '{{.Repository}} {{.CreatedAt}}' | grep innovadataco-app`.

## §0 · Gates

```bash
npx vitest run · npx tsc --noEmit · npm run build · npx eslint src
```

## §1 · La migración no perdió nada (SC-001)

```bash
docker exec 001-2026-innovadataco-db-1 psql -U idc_admin -d innovadataco_001 -c \
  "SELECT count(*) FROM proyectos; SELECT count(*) FROM riesgos_proyecto;"
```
La tabla `riesgos_proyecto` existe; los proyectos siguen todos.

## §2 · En la app desplegada

Sesión `admin` / `admin123`, módulo **Proyectos**.

| # | Qué hacer | Qué debe pasar | FR |
|---|---|---|---|
| 1 | Ver los submódulos | Aparece **Gestión** junto a Listado y Fases PM² | FR-001 |
| 2 | Abrir **Gestión** | Cartera: cada proyecto con presupuesto, avance, riesgos abiertos y fase | FR-002 |
| 3 | Un proyecto sin entregables | Avance 0 / "—", no `NaN` | SC-002 |
| 4 | Elegir un proyecto | Detalle con las 6 pestañas (5 de SPEC-008 + **Riesgos**) | FR-003 |
| 5 | Pestaña **Riesgos**, añadir uno | Descripción + probabilidad + impacto + mitigación + estado; aparece listado | FR-004 |
| 6 | Crear un riesgo `abierto` | El contador "riesgos abiertos" de la cartera sube | FR-005 |
| 7 | Cambiar/crear uno `cerrado` | **No** cuenta como abierto | FR-005 |
| 8 | Volver a la cartera | Vuelta clara desde el detalle | US2-3 |
| 9 | Editar un proyecto (modal) | **Ya no** muestra la gestión: solo código/nombre/cliente/fase | FR-007 |

## §3 · Aislamiento entre proyectos

```bash
# riesgo <R> del proyecto <A>, pedido por la ruta del proyecto <B> → 404, no 200
curl -X PATCH http://localhost:5001/api/projects/<B>/riesgos/<R> \
  -H "Content-Type: application/json" -d '{"estado":"cerrado"}'
```

## §4 · Fuera de alcance aquí

El Gantt es SPEC-015 (lectura) y SPEC-016 (arrastre).
