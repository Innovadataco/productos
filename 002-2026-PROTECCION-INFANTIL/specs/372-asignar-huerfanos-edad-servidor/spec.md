# SPEC-372 · A-74 · P3 y P4 · Asignar huérfanos ahora + edad del menor en el servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: brief `A-74 pulido pendientes` + I-262 (Calidad, tanda 2)

## Para qué

Dos huecos que quedaron abiertos del brief A-74. Son distintos, pero pequeños
los dos, así que van en la misma cola.

**P3 (nuevo botón).** Cuando la asignación automática se queda atrás — el
worker cayó unos minutos, se activó un operador nuevo, o simplemente el admin
quiere destrabar la cola sin esperar los 15 min del cron — hoy no hay cómo
disparar la reconciliación desde la pantalla. Solo la mueve el cron
`operadores-reconciliacion-huerfanos` cada 15 min o un script legacy por
consola. El admin ve "5 sin asignar" y no puede hacer nada.

**P4 (I-262).** El servidor de `POST /api/padre/hijos` aceptaba
`anioNacimiento` entre 1900 y 2100. La pantalla F8 sí valida la edad (5-17),
pero llamando al API directo se podía registrar un "menor" de 300 años. El
servidor tiene que mandar sobre la pantalla, no fiarse de ella.

## Qué cambia

### P3 · Botón "Asignar huérfanos ahora"

- **Nuevo endpoint `POST /api/admin/operadores/reconciliacion`**: dispara ya
  la misma función que corre el cron (`reconciliarHuerfanos`). Solo ADMIN con
  módulo `operadores` (mismo candado que `reasignar`). Rate-limit
  `admin_write` (30 req/min). Auditoría `RECONCILIACION_HUERFANOS` — la misma
  del cron, así el rastro es uno solo corra por acá o por el worker.
- **Botón nuevo** junto a "Actualizar" en `/dashboard/admin/operadores/asignar`.
  Deshabilitado cuando la cola está en 0 (no hay nada que asignar). Al terminar
  muestra un aviso con los tres números — encontrados, asignados, sin cupo —
  y refresca la tabla para que se vea cómo bajó "sin asignar".

### P4 · Edad del menor en el schema del servidor

- El campo `anioNacimiento` en `POST /api/padre/hijos` ya no acepta
  `min(1900).max(2100)`. Ahora se valida contra `EDAD_MENOR_MIN=5` y
  `EDAD_MENOR_MAX=17` derivadas por `validarEdadMenor(edadDesdeAnio(anio))` —
  el mismo módulo puro que usa la pantalla. Una sola definición para las dos
  capas: la ventana se mueve sola cuando cambia el año en curso.
- El mensaje nombra el rango: "El año de nacimiento del menor debe corresponder
  a una edad entre 5 y 17 años." — el patrón de mensajes por campo que instauró
  SPEC-361.

## Candados

- **P3 no borra ni mueve nada nuevo**: llama a `reconciliarHuerfanos` sin
  modificarla. Es el mismo comportamiento que el cron; el disparo manual solo
  ahorra la espera.
- **P3 no duplica auditoría**: `logAudit` vive dentro de la función, no en la
  ruta. Un intento manual que no encuentra huérfanos no ensucia el log
  (`asignados > 0` es la condición del audit).
- **P3 respeta el parámetro `operadores.reconciliacion_enabled`**: si el
  parámetro dice `false`, el botón devuelve `deshabilitado: true` y muestra el
  aviso — la ruta manual no puentea la decisión de sistema.
- **P4 usa la misma constante que la pantalla** (`EDAD_MENOR_MIN/MAX` en
  `documento-menor.ts`). Cambiar el rango en un solo archivo cambia las dos
  capas a la vez.
- **P4 no rompe el camino feliz**: un `anioNacimiento` que dé edad 12 sigue
  entrando (test lo afirma). El campo sigue siendo opcional.

## Impacto en arquitectura: no

Un endpoint nuevo (mismo patrón de `reasignar`), un botón en una página que ya
existía, y un refinamiento de schema con constante compartida. Sin migración,
sin nuevos modelos, sin cambios en pg-boss.

## Cómo se probó

- **Unit** (`page.test.tsx`, 3): el botón se deshabilita cuando la cola está
  en 0; el click dispara `POST /reconciliacion`, muestra el resumen con los
  tres números y refresca la tabla; un 403 del servidor se muestra sin romper
  la lista de operadores.
- **Integration** (`reconciliacion/route.test.ts`, 5): asigna y audita; 200
  con resumen en 0 si no hay huérfanos; respeta el flag `false`; 429 con
  rate-limit; 403 para no-admin.
- **Integration** (`hijos/route.test.ts`, 3 nuevos): año 1900 → 400 con
  "entre 5 y 17"; año futuro → 400; año que da edad 12 → 201 (camino feliz).
- **Local**: `tsc --noEmit` limpio. Unit del componente + `documento-menor`:
  11/11. Integration de las dos rutas: 29/29.

## Pendiente

- Desplegar y verificar en vivo con la cuenta de admin: apretar el botón,
  ver el aviso, y confirmar que un `curl` a `POST /api/padre/hijos` con año
  fuera de rango rebota con 400.
