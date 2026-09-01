# Tasks: SPEC-339 · El camino guiado del padre (A-67 · Fase 1)

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Branch**: `work/pi-SPEC-339-camino-guiado-padre`

**Pruebas obligatorias**: sí. `AGENTS.md` lo exige — «todo endpoint CRUD nuevo debe traer su `.test.ts`» — y el candado 24 obliga a correr las pruebas de **todo lo que toca lo editado**, no solo las del archivo abierto.

**Formato**: `- [ ] TNNN [P?] [US?] descripción con ruta de archivo`. `[P]` = puede ir en paralelo (archivos distintos, sin dependencias pendientes).

---

## Fase 1 · Preparación

- [ ] T001 Poner al día la base de datos local (`npm run db:migrate && npm run db:seed`) — está por detrás de `main` y ni siquiera tiene la tabla `Hijo`
- [ ] T002 Leer línea por línea, antes de tocar nada, los archivos que este plan modifica: `middleware.ts`, `src/lib/routing/guardias.ts`, `src/lib/routing/vigencia-cookie.ts`, `src/lib/routing/sesion-estado-emitter.ts`, `src/lib/dal/services/hijos/hijos.ts`, `src/app/api/auth/verificar/solicitar/route.ts`, `src/app/api/padre/perfil/route.ts`. Anotar en el PR cualquier hallazgo fuera de alcance en vez de arreglarlo callado

---

## Fase 2 · Fundaciones (bloquean todo lo demás)

**Nada de las historias compila sin esto.**

### Esquema y migraciones

- [ ] T003 Añadir `documentoTipo` y `documentoNumero` (opcionales) más `@@index([documentoTipo, documentoNumero])` al modelo `Usuario` en `prisma/schema.prisma`
- [ ] T004 Añadir el modelo `TokenRegistro` (`email`, `tokenHash`, `expiraEn`, `usado`, marcas de tiempo, índices por `email`/`tokenHash`/`expiraEn`) en `prisma/schema.prisma`
- [ ] T005 Añadir `usuarioId` (opcional por ahora) y `@@index([usuarioId])` al modelo `Hijo` en `prisma/schema.prisma`
- [ ] T006 Generar la migración aditiva de T003–T005 en `prisma/migrations/` y verificar que **no** toca ninguno de los cinco índices críticos del motor de IA
- [ ] T007 Escribir la migración de datos que rellena `Hijo.usuarioId` desde `HijoPadre`, **con una guarda que aborta en voz alta** si encuentra un menor con más de un padre (hoy son 0; si eso cambió, el supuesto de D-4 ya no vale y debe reventar, no adivinar)
- [ ] T078 Verificar la migración con datos, no con fe: contar menores e identificadores **por padre** antes y después de T007/T008 y afirmar que los números coinciden
- [ ] T008 Segunda migración: `Hijo.usuarioId` pasa a obligatorio, se retira `@@unique([documentoTipo, documentoNumero])` y entra `@@unique([usuarioId, documentoTipo, documentoNumero])`
- [ ] T075 Declarar la **regla de borrado en cascada** en `Hijo.usuarioId` (`onDelete: Cascade`, igual que la tabla puente tiene hoy). Sin ella `usuario.delete` falla con error de clave foránea
- [ ] T076 Poner al día `scripts/limpieza/borrar-padre.ts` — borra tabla por tabla y **no menciona `Hijo`**: hoy funciona porque la ficha del menor sobrevive como fila global, y con dueño propio deja de funcionar. Mismo defecto que A-65. Verificar también que borrar un padre arrastra sus identificadores de menor
- [ ] T009 Marcar en `prisma/schema.prisma` los modelos `HijoPadre` e `IdentificadorHijoDesvinculado` como **sin uso desde SPEC-339**, con la razón y la fecha, y sin eliminarlos (orden del CEO: reversible si Jelkin revierte la regla)

### Siembra

- [ ] T010 [P] Sembrar `padre.hijos.maximo = 5` (entero, idempotente) en el bloque `padre.*` de `prisma/seed.ts`
- [ ] T011 [P] Sembrar el evento y la plantilla `auth.registro_enlace` en `prisma/seed.ts`, en tuteo neutro, siguiendo el patrón de `auth.cuenta_existente`
- [ ] T012 [P] Sembrar el evento y la plantilla `auth.bienvenida_padre` en `prisma/seed.ts`, en tuteo neutro
- [ ] T013 Añadir `auth.registro_enlace` y `auth.bienvenida_padre` a la lista de eventos migrados en `src/lib/email.migracion.test.ts` (ratchet: sin esto el PR va rojo)
- [ ] T014 [P] Añadir los dos envoltorios de envío en `src/lib/email.ts`, junto a `enviarEmailCuentaExistente`

### El corazón: el paso pendiente

- [ ] T015 Crear `src/lib/camino/pasos.ts` — **única fuente** del orden de los cuatro pasos, sus destinos y sus etiquetas. El guardián en Edge, las pantallas y el emisor de la cookie leen de aquí; tres listas paralelas es el defecto que SPEC-287 vino a matar
- [ ] T016 Crear `src/lib/camino/estado.ts` — deriva el paso pendiente desde la base de datos (consentimiento vigente → perfil completo → **al menos un menor activo** → suscripción resuelta). Un menor inactivo **no** cuenta: el padre lo inactivó, no lo está cuidando. Sin columna de progreso: se calcula, no se guarda
- [ ] T017 Crear `src/lib/camino/estado.test.ts` — cubre los cinco resultados posibles (paso 1, 2, 3, 4 y terminado), el padre que inactiva su único menor y vuelve al paso 3 (no existe borrado de menores, solo activar/inactivar), y que **ningún rol distinto de padre** produce un paso pendiente

---

## Fase 3 · Historia 2 · El guardián del camino (P1) — el riesgo más alto, primero

**Meta**: que no se pueda entrar a un módulo con el camino incompleto, ni escribiendo la URL a mano, ni con la cookie vencida.

**Prueba independiente**: cuenta recién creada + URL escrita a mano en cada uno de los cuatro estados → siempre vuelve al paso pendiente.

- [ ] T018 [US2] Añadir `pasoCamino` al valor firmado en `src/lib/routing/vigencia-cookie.ts` (tipo + validación estricta al leer, igual que los otros tres campos). Una cookie vieja sin el campo se descarta y se re-sella: nadie tiene que volver a entrar
- [ ] T019 [US2] Calcular `pasoCamino` en `src/lib/routing/sesion-estado-emitter.ts`, solo para el rol padre; el resto de roles siempre sin paso pendiente
- [ ] T020 [US2] Añadir el bloque `camino` (destino + exentas) a `GUARDIAS_ACCESO` en `src/lib/routing/guardias.ts`, **con el destino dentro de sus propias exentas** — la invariante que el ratchet verifica al importar (historial I-25 → I-111 → I-141)
- [ ] T021 [US2] Añadir el quinto paso a `middleware.ts`, después del consentimiento y antes de la vigencia: pantallas → redirección al paso pendiente; rutas `/api/**` → `403` con `code: "CAMINO_INCOMPLETO"` y `redirectTo`, nunca una redirección (SPEC-329)
- [ ] T022 [US2] Crear `src/app/api/sesion/al-dia/route.ts` — el rebote que cierra la falla-abierta: re-sella con `sellarCookieSesionEstado` y devuelve al destino o al paso pendiente. Solo acepta destinos internos (`/` y no `//`), como ya hace el registro
- [ ] T023 [US2] Registrar `/api/sesion/al-dia` como ruta de sesión en `GUARDIAS_ACCESO.sesion` — no puede evaluar el camino o rebotaría contra sí misma
- [ ] T024 [US2] En `middleware.ts`, para el rol padre en ruta gobernada por el camino y con la cookie ilegible: **no dejar pasar** — un solo salto al rebote. Para los demás roles y los otros tres guardianes, el comportamiento de hoy no cambia
- [ ] T025 [US2] Ampliar `src/lib/routing/middleware.test.ts`: los cuatro estados del camino, las exentas, el `403` con destino en rutas de datos, el rebote de cookie ilegible, **y que administrador, colegio, operador y comité no evalúan el camino** — un error aquí no rompe una pantalla, cierra la aplicación
- [ ] T026 [US2] Ampliar `src/lib/routing/sesion-estado-emitter.test.ts` y `vigencia-cookie.test.ts` con el campo nuevo y con la compatibilidad de la cookie vieja
- [ ] T027 [US2] Pasar a tuteo el mensaje del guardián de consentimiento en `middleware.ts` («Debés aceptar…» → «Debes aceptar…») y el de vigencia («Renová» → «Renueva»); actualizar las pruebas que afirman ese texto

### Candados exigidos por el CEO (se ejecutan dentro de la Fase 3)

**Candado A · el padre nunca queda atrapado.** Precedentes I-25 y I-35: un colegio quedó sin poder entrar **ni salir** porque el guardián le tapaba también la puerta.

Verificado en fuente: el guardián del camino se sienta en el paso 5 de `middleware.ts`, **después** del paso 1 (rutas públicas) y del paso 3 (rutas de sesión). Por construcción, entonces, ya no puede ver estas rutas — pero eso hay que **probarlo**, no suponerlo, y el rebote de T024 debe quedar en la misma posición o empezaría a tapar lo que hoy pasa libre.

- [ ] T067 [US2] Enumerar en `src/lib/routing/guardias.ts`, con comentario y razón, las rutas que el camino **nunca** puede tapar: `/api/auth/logout` (salir) · `/cambiar-password` y `/api/auth/cambiar-password` (I-35) · `/consentimiento` y `/api/consentimiento` (para poder cumplir el Paso 1) · `/login` · `/reportar` y `/api/reportes` (regla de Jelkin: **proteger a un menor está por encima del cobro**, reportar no se bloquea jamás) · `/camino/**` y las rutas de datos que alimentan los pasos · `/api/sesion/al-dia`
- [ ] T068 [US2] Probar **una por una** esas rutas en `src/lib/routing/middleware.test.ts`, con un padre a mitad del camino en cada uno de los cuatro pasos: todas responden, ninguna redirige al camino
- [ ] T069 [US2] Probar que el rebote de cookie ilegible **tampoco** las toca — la fase que falla cerrado vive después de las rutas públicas y de sesión, no antes

**Candado B · el rebote no puede ciclar.** Si el re-sellado falla (secreto corto, base caída, cookie bloqueada por el navegador), «rebota una vez» tiene que terminar en algún lado, no ir y volver.

- [ ] T070 [US2] En `src/app/api/sesion/al-dia/route.ts`, si el re-sellado falla o la cookie no vuelve a leerse: terminar en `/login` con un mensaje claro y sereno, cerrando la sesión. Nunca devolver al paso que volvería a rebotar
- [ ] T071 [US2] Probar el camino **infeliz** del rebote, no solo el feliz: re-sellado que lanza excepción, secreto ausente o corto, y navegador que no acepta la cookie → en los tres casos termina en `/login` y **no** se produce un segundo rebote


---

## Fase 4 · Historia 1 · La puerta (P1)

**Meta**: el padre se registra con un enlace y nunca transcribe un código.

**Prueba independiente**: correo nuevo → enlace → contraseña → cuenta creada + correo de bienvenida.

- [ ] T028 [P] [US1] Crear `src/lib/dal/services/registro-enlace.ts` — emitir token (solo se guarda el hash), validar (existe · no usado · no vencido) y consumir en una transacción
- [ ] T029 [P] [US1] Crear `src/lib/dal/services/registro-enlace.test.ts` — token válido, ya usado, vencido, inexistente, y que el token en claro **nunca** se persiste
- [ ] T030 [US1] Crear `src/app/api/auth/registro/solicitar/route.ts` — respuesta idéntica exista o no el correo; correo nuevo → token + `auth.registro_enlace`; correo existente → el aviso «ya tienes una cuenta» que ya existe; reutiliza el limitador del registro por dirección y por correo
- [ ] T031 [US1] Crear `src/app/api/auth/registro/solicitar/route.test.ts` — incluida la prueba de que las dos respuestas son **byte a byte iguales** (anti-enumeración, SPEC-338)
- [ ] T032 [US1] Crear `src/app/api/auth/registro/completar/route.ts` — valida contraseña (8 caracteres, coinciden), crea el usuario con rol padre, marca el token usado, inicia sesión, **sella `sesion_estado`** para que caiga directo en el Paso 1 sin rebote, y envía `auth.bienvenida_padre`
- [ ] T033 [US1] Crear `src/app/api/auth/registro/completar/route.test.ts` — `400`/`404`/`409`/`410` y que la cookie de estado sale sellada en la respuesta
- [ ] T080 [US1] Probar el CORREO CAÍDO en el registro (Calidad · R2-11): si el envío falla, la cuenta y el token **quedan creados** y el padre puede pedir el enlace de nuevo. Un fallo del proveedor de correo no puede costarle la cuenta
- [ ] T034 [US1] Rehacer `src/app/registro/page.tsx` para el padre: una sola pantalla de correo → pantalla de aviso (correo escrito, nota de correo no deseado, enviar de nuevo, escribir otro correo). **Sin tocar `VerificacionForm`**, que es del colegio
- [ ] T035 [US1] Crear `src/app/registro/crear-clave/page.tsx` — contraseña dos veces, las dos condiciones a la vista, botón apagado hasta cumplirlas, y mensajes serenos para token usado o vencido con la opción de pedir otro. Es pública por herencia de `/registro` (las rutas se comparan por segmento)
- [ ] T036 [US1] Verificar que `src/app/registro-colegio/page.tsx` y las tres rutas del código de 6 dígitos **quedan intactas** y sus pruebas siguen verdes

---

## Fase 5 · Historia 3-bis · Cada padre, su propia lista (P1)

**Meta**: dos padres cuidan al mismo menor sin pisarse.

**Prueba independiente**: dos cuentas, mismo documento de menor, listas independientes.

- [ ] T037 [US3bis] Reescribir `registrarHijo` en `src/lib/dal/services/hijos/hijos.ts`: deja de enganchar al menor de otro padre; **siempre crea la ficha de este padre**. Choque de documento solo dentro de la lista propia → `409`
- [ ] T038 [US3bis] Cambiar `listarHijos` y `exigirDueno` en el mismo archivo para acotar por `Hijo.usuarioId` en vez de por la tabla puente, y dejar de leer el mecanismo de desvinculación
- [ ] T039 [US3bis] Dejar de escribir en `IdentificadorHijoDesvinculado` (`desvincularIdentificador`): con ficha propia, quitar una cuenta es quitarla de verdad. Documentar el porqué en el archivo
- [ ] T040 [US3bis] Ampliar `src/lib/dal/services/hijos/hijos.test.ts`: dos padres con el mismo documento obtienen fichas distintas; el padre A inactiva y el padre B **no** se entera; el padre A corrige el nombre y la ficha del padre B **no** cambia; documento repetido dentro del mismo padre → `409`
- [ ] T041 [US3bis] Correr las pruebas de **todo** lo que toca este cambio, no solo las de hijos: `src/app/api/padre/hijos/**`, `src/components/modules/padre/MisHijos.tsx` y cualquier consumidor de la tabla puente (candado 24)

---

## Fase 6 · Historia 3 · Los menores en el camino (P1)

**Meta**: cargar, corregir y toparse con el límite.

**Prueba independiente**: cargar un menor, corregirle un apellido, intentar el sexto.

- [ ] T073 [US3] **Sellar la cookie con `sellarCookieSesionEstado` al registrar un hijo** en `src/app/api/padre/hijos/route.ts` — es el momento en que el Paso 3 se cumple; y también al inactivar el último menor activo en `[id]/route.ts`, que es cuando deja de cumplirse
- [ ] T074 [US2] Probar en `src/app/api/padre/perfil/route.test.ts` y en `src/app/api/padre/hijos/route.test.ts` que la respuesta trae la cookie re-sellada **sin paso pendiente en ese paso** — la prueba de que el padre no se atasca
- [ ] T079 [US2] Probar el sellado FALLIDO al cerrar el Paso 2 y el Paso 3 (Calidad · R1-8): si el re-sellado lanza, el padre ve un mensaje claro y el paso **no se da por hecho en silencio**. T070/T071 cubren el rebote, que es otro momento
- [ ] T042 [US3] Aplicar el tope en `src/app/api/padre/hijos/route.ts`: leer `padre.hijos.maximo` con `getParametroSistemaValor` y responder `409` con el mensaje del parámetro. **Sin número escrito en el código**
- [ ] T077 [US3] Volver **obligatorios** los apellidos del menor en el esquema de `POST` en `src/app/api/padre/hijos/route.ts` — hoy son opcionales (línea 12) y el modelo trae `@default("")`, en contra de lo que exige el requisito. Cambio de validación, no de esquema: las fichas viejas sin apellidos se conservan
- [ ] T043 [US3] Ampliar el esquema de `PATCH` en `src/app/api/padre/hijos/[id]/route.ts` — hoy acepta solo `{ estado }` — para admitir la corrección de nombre, apellidos, tipo y número de documento, año de nacimiento y sexo (todos opcionales, al menos uno)
- [ ] T044 [US3] Añadir `actualizarHijo` a `src/lib/dal/services/hijos/hijos.ts`, con dueño verificado, `409` por documento repetido en la lista propia y auditoría **sin el documento en claro**
- [ ] T045 [P] [US3] Crear/ampliar `src/app/api/padre/hijos/route.test.ts` y `src/app/api/padre/hijos/[id]/route.test.ts` — tope alcanzado, tope cambiado por parámetro sin desplegar, corrección válida, documento repetido, menor de otro padre → `404`
- [ ] T046 [US3] Construir la pantalla del Paso 3 en `src/app/camino/hijos/page.tsx` — datos del menor, cuentas opcionales (plataforma + nick), lista de lo ya cargado y el aviso del tope

---

## Fase 7 · Historia 2 (continuación) · Las pantallas del camino (P1)

- [ ] T047 [US2] Crear `src/app/camino/layout.tsx` — el armazón común: indicador «Paso N de 4», una sola cosa por pantalla, 390 px primero, marca El Guardián, el ámbar como único color de alerta y **respeto a la preferencia de movimiento reducido**
- [ ] T048 [US2] Crear `src/app/camino/permiso/page.tsx` — integra `ModalConsentimiento` tal cual, **sin rehacerlo**, con el indicador de Paso 1
- [ ] T049 [US2] Crear `src/app/camino/datos/page.tsx` — Paso 2, reutilizando `PerfilPadreForm` con documento añadido y fecha de nacimiento retirada
- [ ] T050 [US2] Añadir tipo y número de documento del padre al esquema y a la respuesta de `src/app/api/padre/perfil/route.ts`, y quitar la fecha de nacimiento de lo que se pide (el campo permanece en la base de datos)
- [ ] T072 [US2] **Sellar la cookie con `sellarCookieSesionEstado` al guardar el perfil** en `src/app/api/padre/perfil/route.ts`. Sin esto el padre completa el Paso 2 y el estado sigue diciendo «Paso 2»: queda atascado hasta que la cookie venza a los 5 minutos. Es la clase de bug I-211/222/224/227 y este plan existe para no repetirla
- [ ] T051 [P] [US2] Ampliar `src/app/api/padre/perfil/route.test.ts` con los campos nuevos y con el rechazo cuando falta el documento
- [ ] T052 [US2] Actualizar `src/components/modules/padre/PerfilPadreForm.tsx` — documento sí, fecha de nacimiento no, ciudad sin «Otra ciudad» (ya está así)

---

## Fase 8 · Historia 4 · El plan y el cierre (P2)

- [ ] T053 [US4] Crear `src/app/camino/plan/page.tsx` — tarjetas de los planes activos que el administrador tenga configurados, prueba gratis destacada, campo de bono
- [ ] T054 [US4] Verificar que activar la prueba gratis re-sella la cookie **incluyendo el paso del camino**, para que los módulos abran al instante (SPEC-337 ya re-sella; lo que cambia es que ahora el valor lleva un campo más)
- [ ] T055 [US4] Crear `src/app/camino/listo/page.tsx` — el cierre: nombra al menor, ofrece los dos accesos siguientes y el botón al panel. Nunca un callejón sin salida
- [ ] T056 [P] [US4] Ampliar `src/app/api/padre/suscripcion/activar-freemium/route.test.ts` para afirmar que el estado sellado ya no tiene paso pendiente

---

## Fase 9 · Historia 5 · Móvil (P2)

- [ ] T057 [US5] Crear `src/components/modules/padre/PadreNavMovil.tsx` — barra inferior con los destinos de `PADRE_NAV_ITEMS` (`src/lib/nav-items.ts`), sin lista paralela. «Reportar» se queda (precedente I-38)
- [ ] T058 [US5] Montarla en `src/app/dashboard/padre/layout.tsx` junto a `PadreSideNav`, que sigue siendo la de escritorio y no se toca
- [ ] T059 [P] [US5] Crear `src/components/modules/padre/PadreNavMovil.test.tsx` — todos los destinos presentes, el activo marcado
- [ ] T060 [US5] Repasar las seis pantallas del camino a 390 px: una sola cosa por pantalla, sin desborde horizontal

---

## Fase 10 · Voz, cierre y candados

- [ ] T061 Repasar **todo** el texto nuevo y corregir cualquier voseo que se haya colado: tuteo neutro colombiano, tono sereno, sin jerga, sin nombres internos, sin rojo
- [ ] T062 [P] Crear `tests/e2e/camino-padre.spec.ts` — el recorrido completo a 390 px, con el intento de saltar el paso por URL escrita a mano
- [ ] T063 Regenerar `docs/architecture/` y dejar `npm run arch:check` en verde (el cambio toca esquema, navegación y guardianes: el CI lo exige)
- [ ] T064 Puerta de calidad completa: `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build` · `npm run indices:check` · `./scripts/dev-restart.sh`
- [ ] T065 Recorrer `quickstart.md` de punta a punta y adjuntar al PR las capturas que pide (las seis pantallas a 390 px, el intento con la cookie vencida y las dos listas del recorrido de los dos padres)
- [ ] T066 Escribir `specs/339-camino-guiado-padre/cierre.md` y la sección de Implementación en `spec.md`; pasar el estado a `IMPLEMENTADO` y actualizar la fila en `specs/README.md`

---

## Dependencias

```text
Fase 1 (T001-T002)
   └─> Fase 2 · Fundaciones (T003-T017)
          ├─> Fase 3 · Guardián (T018-T027 + candados T067-T071)  ← el riesgo más alto, va primero
          ├─> Fase 4 · Puerta (T028-T036)
          ├─> Fase 5 · Un menor por padre (T037-T041)
          │       └─> Fase 6 · Menores en el camino (T042-T046)
          ├─> Fase 7 · Pantallas del camino (T047-T052)   [necesita Fase 3]
          ├─> Fase 8 · Plan y cierre (T053-T056)          [necesita Fases 3 y 7]
          └─> Fase 9 · Móvil (T057-T060)                  [independiente]
                 └─> Fase 10 · Cierre (T061-T066)
```

**Orden y por qué**: el portero va primero aunque no sea la primera historia del recorrido. Es lo único que puede cerrar la aplicación para todos los roles si sale mal; se quiere descubrir eso el primer día, no el último.

**Qué se puede hacer en paralelo**: T010–T012 y T014 (siembra y correos, archivos distintos); T028–T029 con T018–T020; toda la Fase 9 desde que termina la Fase 2; los archivos de prueba marcados `[P]`.

---

## Producto mínimo utilizable

**Fases 2, 3 y 4** (T003–T036 y T067–T071): un padre se registra con un enlace y no puede entrar a ningún módulo sin completar el camino. Ya con eso el problema del brief —cuentas a medias que no reciben un solo aviso— queda cerrado, aunque falten el pulido de las pantallas y el menú móvil.

---

## Resumen

- **80 tareas** · 10 fases
- Por historia: US1 la puerta **9** · US2 el guardián y sus pantallas **23** · US3 los menores **8** · US3-bis un menor por padre **5** · US4 el plan **4** · US5 móvil **4** · fundaciones **18** · preparación y cierre **8**
- Tareas de prueba: **21** (obligatorias por `AGENTS.md`, más el candado 24 sobre todo lo que toca lo editado)
