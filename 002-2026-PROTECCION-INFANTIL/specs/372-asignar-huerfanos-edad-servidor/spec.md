# SPEC-372 · A-74 · P3 y P4 · Asignar huérfanos ahora + edad del menor en el servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 (docs, test UI) sobre trabajo previo del mismo día · **Origen**: brief `A-74 pulido pendientes` + I-262 (Calidad, tanda 2)

## Nota de historia

Este SPEC salió por **dos ramas en paralelo** el mismo día por mala coordinación
entre sesiones del CEO. La base final es la rama `work/pi-SPEC-372-A74-P3-P4`
(PR #266), que cubre POST y PATCH de `hijos`. Este texto la documenta y este
follow-up agrega **docs Spec Kit** (falta en #266, Regla de Oro de la casa) y
un **test de UI** del botón.

## Para qué

Dos huecos del brief A-74. Distintos, pero pequeños los dos, así que van en la
misma cola.

**P3 (nuevo botón).** Cuando la asignación automática se queda atrás — el
worker cayó unos minutos, se activó un operador nuevo, o el admin quiere
destrabar la cola sin esperar los 15 min del cron — hoy no hay cómo disparar
la reconciliación desde la pantalla. Solo la mueve el cron
`operadores-reconciliacion-huerfanos` cada 15 min o un script legacy por
consola. El admin ve "5 sin asignar" y no puede hacer nada.

**P4 (I-262).** `POST /api/padre/hijos` y `PATCH /api/padre/hijos/[id]`
aceptaban `anioNacimiento` entre 1900 y 2100. La pantalla F8 sí valida la
edad (5-17), pero llamando al API directo se podía registrar (o editar) un
"menor" de 300 años. El servidor tiene que mandar sobre la pantalla, no
fiarse de ella.

## Qué cambia

### P3 · Botón "Asignar huérfanos ahora"

- **Nuevo endpoint `POST /api/admin/operadores/reconciliar-huerfanos`**:
  dispara ya la misma función que corre el cron (`reconciliarHuerfanos`).
  Solo ADMIN con módulo `operadores` (mismo candado que `reasignar`).
  Rate-limit `admin_write` (30 req/min). Además del audit interno de la
  función, el endpoint escribe un audit propio del **disparo manual** con el
  `usuarioId` del admin — así queda rastro de quién apretó el botón, además
  del audit agregado del resultado.
- **Botón nuevo** junto a "Actualizar" en
  `/dashboard/admin/operadores/asignar`. Al terminar muestra un aviso de
  texto con los tres números (encontrados / asignados / fallidos) y refresca
  la tabla para que se vea cómo bajó "sin asignar". Si el parámetro está
  deshabilitado, el aviso lo dice y menciona la clave del parámetro.

### P4 · Edad del menor en el schema del servidor

- Nuevo helper `validarAnioNacimientoMenor(anio)` en `documento-menor.ts` —
  el mismo módulo puro que ya usa la UI (F8). Devuelve `null` si está bien,
  o el mensaje "La edad del menor debe estar entre 5 y 17 años." Se aplica
  después del `safeParse` en el `POST` y en el `PATCH` de `/api/padre/hijos`
  (dos usos), con el mismo patrón que `validarDocumentoMenor`.
- El schema Zod sigue con `min(1900).max(2100)` — un guardarraíl anti-basura
  amplio —, pero el rango real (5-17) lo impone el helper que sabe qué año
  es hoy. La ventana se mueve sola cuando cambia el año en curso.

## Candados

- **P3 no borra ni mueve nada nuevo**: llama a `reconciliarHuerfanos` sin
  modificarla. El disparo manual solo ahorra la espera del cron.
- **P3 no duplica de más el audit**: la función interna audita el resultado
  agregado cuando hay asignados; el endpoint audita el disparo manual
  (`disparo: "manual"`, `usuarioId: admin.id`, `tipoRecurso: "Operador"`).
  Son dos filas con propósitos distintos, no la misma dos veces.
- **P3 respeta `operadores.reconciliacion_enabled`**: si el parámetro dice
  `false`, el endpoint devuelve `deshabilitado: true` y el aviso lo dice.
- **P4 usa la misma constante que la pantalla** (`EDAD_MENOR_MIN/MAX` en
  `documento-menor.ts`). Cambiar el rango en un solo archivo cambia las dos
  capas a la vez.
- **P4 cubre POST y PATCH**: el hueco de I-262 no queda abierto por
  edición. `PATCH` sin `anioNacimiento` pasa (opcional); con año fuera de
  rango rebota con 400 igual que POST.

## Impacto en arquitectura: no

Un endpoint nuevo (mismo patrón de `reasignar`), un botón en una página que
ya existía, y un helper puro nuevo en un módulo que ya existía. Sin
migración, sin nuevos modelos, sin cambios en pg-boss.

## Cómo se probó

- **Integration** (`reconciliar-huerfanos/route.test.ts`, 4): dispara +
  asigna + audita el manual; sin huérfanos → 0; sin sesión → 401;
  no-admin → 401/403.
- **Integration** (`hijos/route.test.ts` + `[id]/route.test.ts`, tests
  nuevos): POST con año fuera de rango → 400; PATCH con año fuera de rango
  → 400; año que da edad válida → 200/201.
- **Unit** (`documento-menor.test.ts`): el helper nuevo
  `validarAnioNacimientoMenor` (rango, opcional, mensaje).
- **Unit** (`page.test.tsx`, follow-up): el botón dispara `POST
  /reconciliar-huerfanos`, muestra el resumen y refresca la tabla; un 403
  del servidor muestra el mensaje sin romper la lista.
- **Local**: `tsc --noEmit` limpio. `arch:check` verde tras regenerar
  `02-roles-capacidades.md`. `tokens/locks/ratchets` verdes.

## Pendiente

- Verificación en vivo del CEO en dev/prod: apretar el botón, ver el aviso,
  y hacer un `curl` a `POST` y `PATCH` con año fuera de rango para
  confirmar el 400.
