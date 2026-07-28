# Feature Specification: SPEC-114 — Suite E2E por rol y estabilización por ciclos

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28

**Status**: FINALIZADO (6 ciclos verdes; ver `cierre.md` y `docs/ciclos-estabilizacion-114.md`)

**Input**: `Gestion-de-proyectos/.../03-EJECUCION/BRIEF-SPEC-114-SUITE-E2E-POR-ROL.md`
(diseño cerrado por ZEUS). Con 941 tests en verde, el CEO encontró a mano dos bloqueantes
del piloto (I-35, I-38): la pieza estaba bien y EL CAMINO roto. Se prueban caminos
completos, por cada rol, cerrando en la base de datos. Cinco ciclos con datos distintos.

## Requisitos (resumen del brief, que manda)

- **FR-1 (sesión por rol)**: para los 5 roles (PARENT, SCHOOL_ADMIN, ADMIN, OPERADOR,
  COMITE_VALIDACION): entrar → home correcto → menú solo con lo suyo (I-36) → logo que
  nunca es clic muerto (nunca apunta al pathname actual, I-38) → salir con la sesión
  muerta de verdad (ruta privada devuelve al login; I-32/I-35b).
- **FR-2 (padre)**: registro público, reportar autenticado Y anónimo alcanzables desde la
  interfaz (I-38), Mis reportes, Círculo de Confianza con varios identificadores,
  seguimiento, cambiar contraseña (I-33), y el número RPT nunca en la URL (D-11).
- **FR-3 (colegio)**: primer ingreso con contraseña temporal → cambio obligatorio →
  completa y entra (I-35); cursos, carga masiva, alumnos, alertas, estadísticas; salida.
- **FR-4 (admin)**: bandeja, spam, estadísticas, Centro IA, operadores, colegios,
  anti-abuso, dataset, configuración; **crear un colegio y un operador DE VERDAD**.
- **FR-5 (operador/comité)**: bandeja asignada, abrir y resolver (transición registrada y
  visibilidad recalculada en BD); bandeja del comité y auditoría.
- **FR-6 (aislamiento)**: por rol, lo que NO debe alcanzar (403 correcto = esperado):
  PARENT sin admin ni colegio; SCHOOL_ADMIN sin admin ni área de padres; OPERADOR sin
  gestión/auditoría de comité; COMITE sin configuración ni gestión de operadores; roles
  internos sin /reportar.
- **FR-7 (público/agregación)**: consulta pública sin sesión y desde cada rol con el MISMO
  resultado; protocolo I-11 con DOS identificadores (pocos vs varios reportes, render
  idéntico); varios reportes al mismo identificador (umbral, ratio, SPAM/OTRO no suman,
  D-08); dashboard público sin nivel de riesgo ni score (D-10/I-23); seguimiento sin
  ningún dato personal (I-28).
- **FR-8 (§9, la pantalla no es la prueba)**: cada recorrido cierra verificando la BD:
  texto original intacto, PII cifrada nunca en claro, identificador normalizado, votos por
  modelo persistidos con preguntas canónicas, contadores que cuadran, SPAM/OTRO no suman,
  hash bcrypt, AuditLog en acciones sensibles, transiciones registradas.
- **FR-9 (ciclos)**: 5 ciclos completos, cada uno con seed de DATOS NUEVOS. Rojo → arreglo
  (primero el test, después el arreglo; un commit por arreglo citando ciclo y recorrido) →
  suite ENTERA verde → bitácora → siguiente. Clasificación SIMULADA en los recorridos y
  UNA prueba lenta con el motor real, marcada y fuera del gate rápido.
- **FR-10 (criterio de aceptación)**: con la SPEC-113 revertida, la suite DEBE ponerse roja
  en el recorrido del padre y del colegio (demostrado, no afirmado).

## Fuera de alcance

- Pruebas de carga/rendimiento; accesibilidad (auditoría propia); decisiones de
  arquitectura, contratos de API, modelo de datos, permisos de fondo, motor/terna/umbral,
  constitución (se anotan en la bitácora para ZEUS, sin bloquear el ciclo).

## Prohibiciones (invalidan la noche)

Ablandar un test para que pase · desactivar un recorrido · reescribir la historia de git ·
desplegar · cambiar el motor por defecto.

## Success Criteria

- **SC-001**: 5 ciclos verdes con datos distintos, bitácora `docs/ciclos-estabilizacion-114.md`
  con una tabla por ciclo (recorridos, rojos con causa, arreglos con commit, deudas para
  ZEUS, tiempo de suite).
- **SC-002**: la suite se pone roja con la SPEC-113 revertida (demostrado).
- **SC-003**: la suite corre en el gate y en CI sin exceder unos minutos (motor simulado).
