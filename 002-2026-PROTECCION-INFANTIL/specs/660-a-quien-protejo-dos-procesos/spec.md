# SPEC-660 · «A quién protejo» — dos procesos (configurar y enterarse)

**Status:** RADICADA → en implementación (ola-1) · **Rama:** `work/pi-SPEC-660-a-quien-protejo-dos-procesos` · **Autor de la spec:** Dev 1
**Radicado:** `RADICADO-SPEC-660-2026-09-11.md` · **Forma (autoridad Diseño):** `FORMA-SPEC660-REDISENO-HIJOS-DIRECCIONES`, `FORMA-SPEC660-CIRCULO-EN-EL-GRAFICO-PESO-Y-CONTEO`, `FORMA-SPEC666-CONTEO-VERIFICADO-VS-ANONIMO`. **Mockup vigente:** `dos-procesos-configurar-y-alertar-spec660.html` (los otros cuatro, superados).

## Qué es / qué NO es
`/dashboard/padre/hijos` («A quién protejo») debe **sentirse como el Círculo de Confianza** (pedido de Jelkin). **NO** revive el asistente de 4 pasos (D-133 · no resucitar `RegistroHijoWizard`); el alta es **una sola acción mejor presentada**. Esto **refina D-133, no lo revierte**.

## Verificado contra CÓDIGO (no contra el mockup — regla del día: el mockup es intención, no conducta)
1. **`listarHijos` (`hijos.ts:123`) devuelve SOLO** `estado` (activo/inactivo) + `identificadores{ id, valor, tipo, activo, plataforma }`. **Cero cruce de reportes.** ⇒ la atención por HUECO DE COBERTURA sale gratis de estos datos; la atención por REPORTE necesita una computación que hoy NO existe para hijos (sí para contactos del círculo).
2. **El «otro padre»: el mockup dice la verdad; los comentarios del código MIENTEN.** `cambiarEstadoIdentificador` (`hijos.ts:343-371`) hace `exigirDueno` + `update` de UNA fila `IdentificadorHijo` del hijo de ESTE padre, sin propagación cross-padre; por esquema `IdentificadorHijo.hijoId → Hijo.usuarioId` (per-padre desde SPEC-339/D-4). ⇒ pausar y quitar son **LOCALES**. Pero dos docstrings STALE (`MisHijos.tsx:20-21` y `hijos.ts:342`) siguen afirmando «flag GLOBAL compartido §3.1-bis, afecta a ambos» — conducta pre-D-4 que ya no existe. **Corregirlos es parte de ola-1** (trampa cargada; misma clase que el comentario de `AnalisisExpediente`). *(Ojo de coordinación: `hijos.ts:295` y `:23` son SPEC-669 (Dev 3) — NO tocar; solo `:342` y `MisHijos.tsx:20-21`.)*
3. **Cupo:** cuenta solo activos y **reactivar cuenta contra el tope** (`hijos.ts:259`). **Edad por AÑO** (D-127/D-134). Las **cuatro acciones** intactas (activar/inactivar HIJO · agregar identificador · activar/inactivar IDENTIFICADOR · quitar identificador).
4. **Dato de producción (CEO):** el aviso al padre **jamás salió en prod** — no por defecto, sino porque **ninguno de 7 reportes coincidió con una cuenta registrada (0 coincidencias)**. Hay **4 hijos activos y solo 2 cuentas activas**: el hueco de cobertura es causa directa. Esta pantalla ataca esa causa.

## La invariante estructural del gráfico (más fuerte que una regla)
Tres poblaciones que **no se funden**: (1) **hijos** = el sujeto; (2) **círculo** = a quién vigila el padre; (3) **reportantes** = **NUNCA se dibujan**. El gráfico muestra **ESTADO, no cuenta de reportantes** ⇒ **no existe superficie donde un número combinado (verificados + anónimos) pueda aparecer**. **PROHIBIDO** un número de reportantes sobre cualquier nodo o sobre el anillo. Un nodo encendido dice «mirá el detalle», sin número; el conteo (y su separación verificados/anónimos, FORMA-666) vive **solo en el detalle**. *Si nace la tentación de poner un contador sobre un nodo, es la señal de que salí del diseño* → **candado de conducta**.

## PESO (composición del gráfico)
Los **hijos mandan**, el **círculo acompaña**. Un familiar **nunca iguala a un hijo** en tamaño ni saturación: hijo = nodo lleno; familiar = punto chico, apagado, en un **anillo exterior**. En calma: anillo tenue + una línea «Tu círculo: N personas cercanas · todas tranquilas», **sin etiquetar a cada uno**. Familiar con reporte: punto ámbar **más chico** que la alerta de un hijo; si disparan hijo y familiar, **el hijo domina** y el familiar es una línea secundaria que manda a «A quién vigilo» (no abre detalle acá).

## Historias de usuario
- **US1 (P1 · ola-1) — Configurar tranquilo:** como padre, registro/edito menores y sus cuentas en **Mi perfil › «Menores de edad»**. El alta es un botón; cada menor es una línea que se despliega. Las dos acciones sobre una cuenta se **nombran por lo que hacen** («pausar» conserva · «quitar» borra + deshacer) y son **locales** (no tocan al otro padre).
- **US2 (P1 · ola-1) — Enterarse en calma:** como padre, en **«A quién protejo»** veo el **gráfico** de cómo están mis hijos (tranquilo / sin cuentas / en pausa) + el círculo como anillo tenue, **sin formularios**. Un enlace lleva a configurar.
- **US3 (P1 · ola-1) — El hueco de cobertura:** un hijo **activo con 0 cuentas activas** aparece como un **pendiente cielo/neutro** («A *X* no le agregaste ninguna cuenta: agrégale una para poder cuidarlo» + «Agregar una cuenta»). **NUNCA ámbar** (no es alarma, es un por-hacer).
- **US4 (P2 · ola-2) — Enterarse con reporte:** cuando reportan una cuenta de un hijo, el gráfico enciende ese hijo en **ámbar** y su **detalle** trae clasificación · cuándo · dónde + conteo honesto (verificados vs anónimos, nunca sumados) + guía + psicólogo.
  - **Dato (Datos, #573): `tieneReportes: boolean` por hijo** — booleano, NO conteo (Diseño prohibió números sobre nodos; no hay entero con el que componer «N personas»). Criterio IDÉNTICO al del aviso (identificador activo del hijo = identificador de un reporte VISIBLE) → gráfico y correo dicen lo mismo. SPEC-644 (franja) ya en main.
  - **⚠️ I-396 (tercera superficie) — el estado «tranquilo» NO se cierra todavía:** la visibilidad la pone la clasificación; **con el motor caído, un hijo REPORTADO devuelve `tieneReportes:false`** y el gráfico lo pintaría «tranquilo» = calma sobre un niño recién reportado. SPEC-671 (Dev 2) lo cierra al disparar avisos sobre `REVISION_MANUAL` (visible); hasta que despliegue, el hueco existe. **Decisión de forma PENDIENTE de Diseño:** si «tranquilo» puede seguir leyéndose como «no pasó nada», o si el gráfico consume el helper de liveness (SPEC-670) y tiene su propio **estado degradado/sin-confirmar**. El componente ya está **preparado para aceptar ese estado sin reescritura** (unión + mapas exhaustivos; la derivación vive en la pantalla). **No cerrar el copy de «tranquilo» hasta la respuesta de Diseño.**

## Requisitos funcionales (ola-1)
- **FR-001:** «A quién protejo» NO renderiza ningún formulario de alta/edición; el CRUD de menores vive en Mi perfil › «Menores de edad». El alta es un botón que abre el panel **a pedido** (no siempre visible).
- **FR-002:** El estado vacío es **diseñado con su CTA**, no texto pelado.
- **FR-003:** Jerarquía de destino: `<h1>` (no `<h2>`).
- **FR-004:** El gráfico deriva el estado de cada hijo **solo** de `listarHijos`: `tranquilo` (activo, ≥1 identificador activo) · `sin cuentas` (activo, 0 identificadores activos → hueco de cobertura) · `en pausa` (inactivo). **Sin ningún contador de reportantes.**
- **FR-005:** El bloque de atención lista **solo** huecos de cobertura (US3), tono cielo/neutro. Inactivo **nunca** sube a atención.
- **FR-006:** Las cuatro acciones conservan su semántica y su **rótulo de alcance visible** (texto, no solo `aria-label`); el copy declara **local** («no toca al otro padre»), consistente con la conducta verificada.
- **FR-007:** Se corrigen los docstrings STALE (`MisHijos.tsx:20-21`, `hijos.ts:342`) para que digan **local per-padre (D-4)**, no «GLOBAL §3.1-bis».
- **FR-008 (candado):** ninguna superficie del gráfico (nodo, anillo, aria-label) contiene un número de reportantes; el conteo solo existe en el detalle (ola-2). Muere si alguien agrega un contador al gráfico.

## Restricciones que NO se tocan
- **Nunca rojo**, ni para un reporte sobre un hijo (SPEC-362): el peso lo carga el **copy**, no el color. Ámbar-atención; el hueco de cobertura es **cielo**, no ámbar (un color = un significado).
- **Lógica de negocio intacta:** validaciones (documento-menor), alta múltiple de identificadores, payload del POST, contador de cupo (activos; reactivar cuenta), las cuatro acciones. Edad por año (D-127/D-134). El simulador no vuelve.
- **I-397 (CEO):** el aviso está **encadenado a la clasificación** y con el motor caído no sale. **PROHIBIDO** escribir «te avisamos» como **garantía incondicional** en cualquier pantalla de ola-1 hasta que I-397 cierre. El copy de calma dice qué se vigila, no promete el aviso.

## Dependencias y secuencia
- **#569 (Dev 3, SPEC-668)** ya empujado toca `MisHijos.tsx` + `hijos.ts`. **Rebasar sobre main después de que #569 mergee** antes de tocar esos archivos (el CEO avisa). Mientras tanto se construyen componentes NUEVOS sin conflicto.
- **Ola-2 bloqueada** en: (a) cruce de reportes **por hijo** (Datos, pedido por el CEO) — el mismo que ya tiene el círculo para contactos; (b) **SPEC-644** (franja persistida) para el detalle; (c) el mockup vigente que Diseño está por actualizar con la capa círculo-en-gráfico.
- **El par Pausar/Quitar (re-corte de Diseño): último.** Ahí convergen `hover:text-rubi` (viola nunca rojo), el peso de la destructiva (por claridad, con deshacer, nunca rojo) y la corrección del comentario stale.

## Fuera de alcance
- Ola-2 completa (US4). El texto del reporte y quién reportó **nunca** (contrato). La limpieza de huérfanos SPEC-654 (aparte). `worker.ts` (SPEC-657, Dev 3).
