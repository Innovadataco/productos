# Quickstart: Kanban de Oportunidades — cómo verificarlo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

Cómo comprobar que esta spec hace lo que dice. Pensado para que **ZEUS o el CEO** lo repitan
sin conocer el código.

> **Regla de Oro 4.** Todo lo de la sección §2 se verifica contra la app **desplegada**
> (`http://localhost:5001`), no contra el árbol de fuentes. Si la imagen del contenedor es
> anterior a los commits, se está probando otra cosa. Comprobar primero:
> ```bash
> docker images --format '{{.Repository}}  {{.CreatedAt}}' | grep innovadataco-app
> ```

---

## §0 · Gates automáticos

```bash
npx vitest run          # suite completa, sin BD ni Ollama
npx tsc --noEmit        # tipado
npm run build           # compila
npx eslint src/lib src/app/api   # 0 no-explicit-any (contrato spec 002)
```

## §1 · La condición de diseño de ZEUS (RZ-1 / SC-008 / SC-013)

El tablero es genérico o no lo es. Se comprueba leyendo sus imports:

```bash
grep -n "^import" src/components/kanban/KanbanBoard.tsx
```

**Esperado**: solo `react` y `@/lib/kanban`. Ni `Licitacion`, ni estados, ni `/api/`.

La prueba de verdad es que **SPEC-008 lo reutilizó sin tocarlo**:

```bash
git log --oneline -- src/components/kanban/KanbanBoard.tsx
```

**Esperado**: no aparece ningún commit de la spec 008.

## §2 · El tablero, en la app desplegada

Entrar en `http://localhost:5001`, sesión `admin` / `admin123`.

| # | Qué hacer | Qué debe pasar | Requisito |
|---|---|---|---|
| 1 | Oportunidades › **Tablero** | Una columna **por cada estado del catálogo**, en su orden | SC-001 |
| 2 | Contar las columnas | Las **5** visibles enteras, **sin barra horizontal** | **SC-012 (I-014)** |
| 3 | Mirar arriba a la derecha | Botón *Cerrar* y pestañas **completos**, nada recortado | **SC-013 (I-014)** |
| 4 | Cada oportunidad | Aparece como tarjeta en la columna de su estado | SC-002 |
| 5 | Arrastrar una tarjeta a otra columna | Se mueve; al **recargar (F5)** sigue en la nueva | SC-003 |
| 6 | Configuración › Auditoría | Registro `oportunidad.estado.cambio` con origen y destino | SC-004 |
| 7 | Soltar una tarjeta en **su misma** columna | **No** pasa nada: ni llamada ni registro nuevo | SC-007 |
| 8 | Oportunidades › **Estados**, crear un estado nuevo | Al volver al Tablero, **columna nueva**, sin tocar código | SC-001 |
| 9 | Proyectos › **Fases PM²** | Las **4** fases, mismo comportamiento | SPEC-008 |

### Verificación automática de I-014 (SC-012)

En vez de contar columnas a ojo:

```bash
node scripts/verify-tableros.mjs                     # contra localhost:5001
node scripts/verify-tableros.mjs http://otra-url     # contra otro despliegue
```

Abre un navegador real, entra, y mide **ambos** tableros a **1280, 1440 y 1920 px**:

- `scrollWidth` vs `clientWidth` del contenedor → **sin desplazamiento horizontal**;
- columnas **enteras** dentro del contenedor → **todas**;
- que la página no desborde → nada del marco recortado.

Deja capturas en `screenshots/i014-*.png` y sale con código ≠ 0 si algo falla.

## §3 · Sesión y errores

| # | Qué hacer | Qué debe pasar | Requisito |
|---|---|---|---|
| 1 | Cerrar sesión y `PATCH /api/licitaciones/<id>` a mano | **401**, y el estado **no** cambia | SC-005 |
| 2 | Parar el contenedor `db` y mover una tarjeta | La tarjeta **vuelve** a su columna y sale un aviso legible, sin jerga técnica | SC-006 |

> El caso 2 es el que más se olvida: lo que se comprueba es que la interfaz **no miente**. Si
> la tarjeta se queda en la columna nueva tras un fallo, el defecto es grave aunque "se vea
> bien".

## §4 · Lo que esta spec **no** hace

- No impone reglas de transición entre estados: cualquier columna a cualquier columna.
- No reordena tarjetas dentro de una columna.
- No cambia la administración del catálogo de estados.
- **No es un rediseño visual**: eso es SPEC-012. Aquí solo se arregla que el tablero **quepa**.
