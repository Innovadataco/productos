# Implementation Plan: Rediseño visual del tablero Kanban

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `012-rediseno-tablero`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/012-rediseno-tablero/spec.md` (Status: **Aprobada con gate provisional
D-069**; ratificación del CEO pendiente).

## Summary

Rediseñar la piel del tablero: jerarquía en la tarjeta, transiciones al arrastrar y soltar,
estado vacío compuesto, densidad coherente y el color del estado como acento. **Un solo
archivo de componente**, cero dependencias, cero cambios de comportamiento.

## Decisión que gobierna el plan: el diff es la prueba

La spec dice "es piel, no huesos". Eso no se acredita con una declaración, se acredita con el
`git diff`: si esta spec toca `package.json`, `src/app/api/`, `prisma/` o un adaptador, ha
fallado, aunque la pantalla haya quedado preciosa.

Por eso el plan se limita **a propósito** a:

| Archivo | Qué cambia |
|---|---|
| `src/components/kanban/KanbanBoard.tsx` | Todo el rediseño |
| `src/app/globals.css` *(si hiciera falta)* | Solo si una animación no se puede expresar con Tailwind |

Y **nada más**. En particular, `tableroOportunidades.ts` y `tableroProyectos.ts` —los
adaptadores— no se tocan: que los dos tableros hereden el rediseño sin cambiar es la prueba de
que SPEC-007 separó bien (SC-005).

## Decisión: solo Tailwind, sin CSS nuevo si se puede evitar

Tailwind 3.4 trae `transition`, `duration`, `scale`, `rotate`, `shadow` y `motion-reduce:`.
Con eso se cubre todo lo que pide la spec, incluido FR-006 (`prefers-reduced-motion`) sin
escribir una media query a mano.

**Alternativa descartada**: `framer-motion`. Es la herramienta natural para animar listas y
haría el "entra con transición" trivial. Pero **RZ-1 prohíbe dependencias nuevas**, y con
razón: son ~40 kB para animar cinco columnas, en un producto que hoy no tiene ninguna librería
de animación. Si algún día hay más pantallas animadas, se revisa entonces.

## Decisión: qué significa "más moderno", traducido a decisiones concretas

El CEO dijo *"está horrible, más transiciones, más moderno"*. Eso no es implementable tal
cual, así que se traduce —y se deja escrito para que ZEUS pueda discutir la traducción, no el
resultado—:

| Lo que se pidió | Cómo se traduce |
|---|---|
| "más transiciones" | Respuesta al arrastrar (la tarjeta se eleva y se inclina levemente), a sobrevolar (la columna destino se marca) y al soltar (la tarjeta entra con una animación breve) |
| "más moderno" | Menos bloques planos y más jerarquía: acento de color en vez de rellenos sólidos, tipografía con pesos distintos, sombras suaves en lugar de bordes duros, esquinas coherentes |
| "está horrible" | El síntoma concreto: los tres textos de la tarjeta pesan igual, la cabecera es un bloque de color y el vacío es un texto suelto |

**Lo que NO se toca del vocabulario existente**: `glass-panel`, `neonCyan`, mayúsculas con
seguimiento amplio. El rediseño se apoya en la identidad del producto; no la sustituye (RZ-4).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2.4, Tailwind 3.4.19

**Primary Dependencies**: **ninguna nueva** (RZ-1)

**Storage**: no aplica — esta spec no toca datos

**Testing**: la suite (506) no debe bajar; el verificador de tableros en el contenedor debe
seguir verde (SC-006). Un rediseño no se prueba con aserciones de unidad: se prueba con la
suite **no bajando**, el maquetado **no rompiéndose** y el ojo del CEO.

**Constraints**: cero dependencias; `eslint src` en 0; `tsc` limpio; I-014 no se reabre.

**Scale/Scope**: **1 archivo** de componente.

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec con gate provisional (D-069) antes de implementar. |
| §0.2 Pruebas | ✅ La suite no baja; SC-006 se verifica **en el contenedor**. |
| §0.5 Aislamiento | ✅ Un componente de `001-`. Sin trabajo pesado. |
| §0.7 Configurabilidad | ✅ El acento sigue saliendo del catálogo con fallback neutro: un estado nuevo se ve acabado. |
| §6.2 Reglas de React | ✅ No se añaden efectos: el rediseño es de presentación. |
| §6.3 Estilos | ✅ **Tailwind es la única fuente de estilos**; no se añaden CSS modules ni librerías. |

**Sin violaciones.** Complexity Tracking vacío.

## Cambios exactos

### 1 · Tarjeta — jerarquía (FR-001)

- **Título**: el elemento dominante. Tamaño y peso por encima del resto, dos líneas máximo con
  corte limpio (`line-clamp`) para que un título largo no empuje la columna (US1-2).
- **Referencia**: pierde el color de acento y baja a apoyo — es un dato de identificación, no
  el protagonista.
- **Tipo**: al pie, como etiqueta discreta.
- Sin número o sin tipo, la tarjeta no deja hueco: los bloques son condicionales (US1-3).

### 2 · Movimiento (FR-002, FR-006)

| Momento | Respuesta |
|---|---|
| Arrastrando | La tarjeta se **eleva**: sombra, escala levemente mayor y una inclinación mínima |
| Sobrevolando una columna | La columna destino se marca con acento y borde; el resto no cambia |
| Soltada | Entra con una animación breve de aparición |
| Persistiendo | Atenuada y con el cursor de "espera": no invita a arrastrarla otra vez (US2-4) |

Todas con `motion-reduce:transition-none` y sin transformaciones bajo movimiento reducido
(FR-006): quien pidió no animarse, no se anima.

### 3 · Columna vacía (FR-003)

Icono tenue + texto corto, dentro de un área con borde discontinuo que **se lee como zona de
destino**. Sigue aceptando el arrastre (US3-2): el cambio es de aspecto, no de comportamiento.

### 4 · Densidad y cabecera (FR-004, FR-005, FR-007)

- Cabecera: el color pasa a **acento** —un punto de color y el borde superior— con el nombre
  del estado en texto legible; la cuenta, discreta a la derecha.
- Lista de tarjetas con altura máxima y desplazamiento **por dentro** de la columna (FR-007).
- Sin franja muerta: el contenedor no reserva sitio para una barra que ya no existe.

## Verificación por requisito

| Requisito | Cómo se verifica |
|---|---|
| FR-001, FR-003, FR-005 | A la vista, en el contenedor, con captura |
| FR-002 | Arrastrando de verdad en el navegador |
| FR-006 | Emulando `prefers-reduced-motion: reduce` |
| FR-007 | Columna con muchas tarjetas: se desplaza por dentro |
| FR-008 / SC-001 | `git diff --stat` no incluye `package*.json` |
| FR-009 / SC-002 | `git diff --stat` no incluye `src/app/api/`, `prisma/` ni adaptadores |
| SC-004 | Imports de `KanbanBoard.tsx` |
| SC-005 | Los dos tableros cambian; sus adaptadores, no |
| SC-006 | `node scripts/verify-tableros.mjs` en verde |

## Riesgos

- **R-01 · El rediseño reabre I-014.** Es el riesgo real: tocar el maquetado del tablero es
  tocar justo lo que se acaba de arreglar. Mitigación: `verify-tableros.mjs` se ejecuta
  **después** del rediseño, contra el contenedor, y es criterio de cierre (SC-006).
- **R-02 · Se cuela comportamiento.** Mitigación: SC-002 es un `git diff`, no una opinión.
- **R-03 · Animar de más.** Transiciones breves y `motion-reduce` desde el primer momento; el
  tablero es una herramienta de trabajo, no una demo.
- **R-04 · El gusto del CEO no coincide.** Mitigación: es un componente y es reversible; la
  traducción de "moderno" queda escrita arriba para discutirla en concreto.

## Complexity Tracking

Sin violaciones. Un archivo, cero dependencias.
