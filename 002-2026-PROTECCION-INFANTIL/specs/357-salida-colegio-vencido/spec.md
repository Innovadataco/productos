# SPEC-357 · El colegio que vence a mitad del camino no queda encerrado (I-254)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: I-254 (Calidad, reproducido en vivo en prod `e137caab`; contradicción confirmada en fuente por el CEO)

## El problema

Un colegio con la vigencia caída a mitad del camino guiado quedaba **sin ninguna
salida de producto**: el guardián lo mandaba al paso pendiente, la pantalla le
exigía cargar un profesor, y `POST /api/colegio/profesores` (y cursos, y carga)
respondía 403 «El servicio del colegio ha vencido». Ir a pagar tampoco: la
suscripción y el paso del plan devolvían 307 al paso pendiente. Y comprar por
API fallaba con 409 «Ya existe una suscripción vigente para este titular».

**El corazón del defecto:** la misma suscripción era **vigente** cuando el rector
quería comprar y **vencida** cuando quería trabajar — dos criterios opuestos
sobre el mismo estado, en dos capas distintas. Solo un administrador podía
sacarlo de ahí.

## Requisitos

- **FR-001**: La caja siempre abierta. `/dashboard/colegio/suscripcion` y
  `/camino/colegio/plan` DEBEN ser alcanzables por un colegio vencido, sin
  rebote al paso pendiente del camino.
- **FR-002**: Criterio único de "vigente". El chequeo que impide comprar
  (`existeSuscripcionVigenteParaTitular`) DEBE mirar estado **y** fecha, igual
  que el guardián que bloquea el uso. Una suscripción ACTIVA cuya ventana
  venció NO impide comprar de nuevo.
- **FR-003**: Los pasos del camino no se cierran por vigencia. Mientras
  `derivarPasoPendienteColegio` devuelva un paso, las cinco familias de rutas
  que el camino necesita (profesores, cursos, materias, alumnos, carga) DEBEN
  responder normalmente aunque el servicio esté vencido.
- **FR-004**: La excepción es acotada. Apenas el camino cierra, la vigencia
  vuelve a mandar sin cambios; y un colegio `inactivo` (dado de baja) sigue
  cortado — el camino no es una puerta trasera para volver a operar.

## Fuera de alcance (por orden del CEO)

`/api/reportes` (I-253, lo lleva Dev PI-1) y `/api/colegio/alertas` (I-251, va
en la spec agrupada de guardianes desalineados).

## Impacto en arquitectura:

Una fuente nueva de decisión (`src/lib/colegio/vigencia-camino.ts`) que compone
las dos existentes (vigencia del cliente + paso derivado del camino); sin
migraciones, sin estado persistido, sin cambios de contrato de API. El criterio
de "suscripción vigente" del repositorio de pagos queda alineado con el del
guardián de vigencia.
