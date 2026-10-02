# Research · SPEC-857

## Fuente única de navegación (SPEC-744)
Toda superficie de nav (lateral, barra móvil, header anónimo) sale de `navParaRol`. El candado `nav-superficie-unica` rompe CI si una superficie quema destinos de rol. Decisión: el árbol de 2 niveles vive en `ADMIN_NAV_ITEMS` y fluye por el resolver; nada a mano en los componentes.

## Patrón de grupo de 2 niveles (precedente)
El colegio ya tenía un grupo colapsable «Usuarios» (`href:"#"` + `iconKey` semántica + `children`). SPEC-857 generaliza ese patrón a los 9 módulos del admin. Novedad respecto al colegio: los ENCABEZADOS de sección (separadores no navegables) — se modelan como `NavItem` con `encabezado: true` y sin `modulo`.

## Menú honesto (SPEC-086 / I-299)
Cada hoja debe colgar del módulo que su página gatea en servidor. Se verificó página por página (48 rutas, todas existen) el gate real: p. ej. Operadores→Auditoría usa `audit_logs` (no `operadores`), Estadísticas→Dinero vs valor usa `pagos_admin`. Consecuencia: 3 módulos salen de `SIN_PANTALLA_PROPIA` al volverse hojas de menú.

## Íconos sin crecer (SPEC-744 cláusula 2)
El candado de íconos exige grupos all-or-none en hijos y encabezado ≠ ícono de hijo. Con 9 módulos (uno de 9 hijos) no hay íconos para todas las hojas sin inventar. Decisión: **hojas admin sin ícono**; la clave semántica (el ícono de la ex-raíz) sube al grupo. Reusa componentes existentes; se borran 5 que quedaron sin uso.

## Barra móvil de roles internos
El default «primeras ≤4 hojas» chocaba con la cláusula 1 (sin íconos duplicados) porque hojas hermanas comparten el ícono del grupo. Decisión: tomar la primera hoja de cada ícono distinto (una pestaña por sección). Adaptación de FORMA §3 al agrupamiento; confesada al CEO.

## Activo por ruta con hojas anidadas
`/comite` es prefijo de `/comite/gestion`. `startsWith` marcaba ambas. Decisión: el activo es el href más largo (más específico) que sea el pathname o su prefijo — un solo ganador.
