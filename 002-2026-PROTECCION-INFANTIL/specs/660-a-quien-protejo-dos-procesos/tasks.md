# SPEC-660 · tasks (ola-1)

**Status:** en implementación · **Rama:** `work/pi-SPEC-660-a-quien-protejo-dos-procesos`
Orden por dependencias. `[#569]` = espera el merge de #569 (Dev 3, toca `MisHijos.tsx`+`hijos.ts`) y rebase antes de tocar esos archivos. `[nuevo]` = archivo nuevo, sin conflicto, se puede hacer ya.

## Fase A — el gráfico en calma (Proceso 2, Estado A) · `[nuevo]`, sin Datos
- **T001 [nuevo]** `GraficoProteccion.tsx` (nuevo, en `components/modules/padre/`): SVG que compone las TRES poblaciones sin fundirlas.
  - Hijos = nodos **r=27** llenos; estado derivado SOLO de `listarHijos`: `tranquilo` (activo ≥1 identificador activo) · `sin-cuentas` (activo, 0 activos → hueco, tono **cielo**) · `en-pausa` (inactivo, gris). Color por estado, **nunca rojo**; ámbar reservado a reporte (ola-2, aún no).
  - Círculo = **reusar el arco existente** (no un anillo nuevo): familiares = **4 puntos r=5** apagados sobre el arco. En calma todos grises + línea «Tu círculo: N personas cercanas · todas tranquilas», **sin etiquetar a cada uno**.
  - **PROHIBIDO** cualquier número de reportantes sobre nodo/arco (invariante estructural: el gráfico muestra ESTADO, no cuenta).
  - Tokens del sistema de diseño (como `IlustracionCirculo`), no paleta Tailwind suelta (piso `tokens:check`).
- **T002 [nuevo]** `grafico-proteccion-sin-contador.candado.test.ts`: el árbol del gráfico NO contiene un número de reportantes sobre un nodo/anillo (conducta, no palabras). Muere si alguien agrega un contador. Ejercitar con un hijo encendido (cuando exista ola-2) y con calma.
- **T003 [nuevo]** `grafico-proteccion-nunca-rojo.candado.test.ts` (o extender el barrido de color): cero rojo/rubí en el árbol del gráfico; el hueco de cobertura es **cielo**, no ámbar.

## Fase B — «A quién protejo» = enterarse, sin formularios · `[#569]`
- **T010 [#569]** `hijos/page.tsx` + su client: repuntar «A quién protejo» al **gráfico + estado vacío diseñado + bloque de atención (solo huecos de cobertura)**; jerarquía `<h1>`. **Cero formularios** acá (el alta/edición se mudan a Mi perfil, Fase C). Un enlace «Gestionar en tu perfil →».
- **T011 [#569]** Bloque de atención (US3): lista los **huecos de cobertura** (hijo activo, 0 identificadores activos), tono **cielo/neutro**, copy «A *X* no le agregaste ninguna cuenta: agrégale una para poder cuidarlo» + «Agregar una cuenta». Inactivo **nunca** entra. **Sin** promesa incondicional «te avisamos» (I-397).

## Fase C — Configurar en Mi perfil › «Menores de edad» · `[#569]`
- **T020 [#569]** Mover el CRUD de menores (alta a pedido + tarjetas + las 4 acciones) de `MisHijos.tsx` a la sección «Menores de edad» del perfil. Alta = **un botón** que abre el panel a pedido; cada menor = una línea que se despliega. Conservar: validaciones documento-menor, alta múltiple de identificadores, payload POST, cupo (activos; reactivar cuenta, `hijos.ts:259`), edad por AÑO (D-127/D-134). **NO** revivir `RegistroHijoWizard` (D-133).
- **T021 [#569]** Corregir los docstrings STALE: `MisHijos.tsx:20-21` y `hijos.ts:342` dicen «flag GLOBAL compartido §3.1-bis, afecta a ambos» → decir **local per-padre (D-4)**. **NO tocar `hijos.ts:295` ni `:23`** (SPEC-669, Dev 3). El copy de las acciones declara **local** («no toca al otro padre»), consistente con la conducta verificada (`cambiarEstadoIdentificador`).

## Fase D — el par Pausar/Quitar (re-corte de Diseño, `FORMA-SPEC660-RECORTE-PAR-PAUSAR-QUITAR`) · ÚLTIMO
- **T030 [#569]** Copy exacto del re-corte:
  - **«Pausar la vigilancia»** → «Dejamos de avisarte por esta cuenta. Queda acá y la reactivas cuando quieras.» · **toggle · SIN modal, SIN deshacer**.
  - **«Quitarla de mi lista»** → «La sacamos de tu lista. Si la vuelves a necesitar, hay que agregarla de nuevo.» · borra · **SIN modal previo, CON deshacer posterior** («Quitaste {cuenta}. Deshacer.»).
  - **Quitar `hover:text-rubi`** de «Quitar» (`HijoCard.tsx:193`). Peso anti-mis-clic = tres cosas NEUTRAS: etiquetas, «se guarda» vs «se borra», borde más firme. **Nunca rojo.**
  - El **«otro padre» se dice UNA vez** como nota al pie del bloque, no en cada acción. El `title` transitorio de «Quitar» que entra por #569 («La quita de tu lista. El otro padre la sigue viendo en la suya.») se **REEMPLAZA** por la nota al pie (no preservar).
- **T031 [#569] ⚠️ TRAMPA DE CANDADO DE VOZ — re-anclar EN EL MISMO COMMIT.** `voz-cuenta.candado.test.ts` (SPEC-512) ancla en el `title` del control de vigilancia como **portador de la palabra «cuenta»**. Post-#569 quedó anclado a:
  ```
  :162  presentes → title="Activa o inactiva la vigilancia de esta cuenta
  :172  ausentes  → title="Activa o inactiva la vigilancia de este identificador
  ```
  El re-corte renombra ese control → **romperá el candado**. Al cambiar el copy, **re-anclar `:162`/`:172` conservando la PAREJA**: la frase nueva DEBE decir «cuenta», la vetada la misma con «identificador». **NO borrar ni aflojar la aserción** (ahí SPEC-512 pierde la pantalla en silencio y el próximo barrido reintroduce «identificador»). Verificar el número de línea real tras rebasar sobre #569.
- **Regla dura (lección del día):** al borrar/cambiar **cualquier cadena visible al usuario**, correr el **lane unit COMPLETO** antes de empujar — no solo el test del componente. Un candado de voz puede anclar en esa cadena **desde otro archivo** (a Dev 3 le costó media tarde por correr solo `MisHijos.test`).

## Bloqueado (ola-2 — NO en esta rama sin el carril)
- Estado B (reporte): necesita el **cruce de reportes por hijo** (Datos, D-121 — el mismo que ya tiene el círculo) y va **después de SPEC-644** (franja). Conteo verificados vs anónimos **nunca sumados** (FORMA-666, candado de conducta). El nodo ámbar del hijo y el punto ámbar (r<hijo) del familiar dependen del cruce. **Placeholder señalado, no inventado.**

## Preflight por PR
`tsc` · `eslint` · `tokens:check` · `arch:check` · **lane unit COMPLETO** (regla CEO: el razonamiento no es la prueba) · certificación de Diseño de la forma.
