# SPEC-361 · A-70 tanda 2 · Formularios del camino: mensajes, cupo y validaciones (F4–F9)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: brief A-70 (recorrido de Jelkin en prod `e137caab`)

## Requisitos

- **FR-F4**: Los errores del servidor llegan al usuario con sentido, nombrando el
  campo. Se acabó el "no se pudo registrar" para todo.
- **FR-F5**: El tope de menores cuenta **solo los ACTIVOS**. Inactivar es
  decisión del padre y libera cupo solo; el producto **nunca** inactiva por su
  cuenta ni sugiere a cuál. Mensaje del bloqueo fijado por Jelkin: *"Tienes N de
  M menores activos. Si quieres registrar otro, primero inactiva uno."*
- **FR-F6**: Contador de cupo visible siempre ("3 de 5 menores activos").
- **FR-F7**: El número de documento se valida según su tipo (hoy entraba
  `84opkioniby` en una tarjeta de identidad).
- **FR-F8**: En el camino se pide la **edad (5 a 17)**, no el año de nacimiento;
  el año guardado se deriva de la edad contra el año en curso.
- **FR-F9**: La edad al reportar es una **lista de 4 a 17**, opcional (era campo
  libre de 1 a 120).

## Impacto en arquitectura:

Un módulo puro nuevo (`src/lib/padre/documento-menor.ts`) con las reglas de
documento y edad, compartido por pantalla y servidor — una sola definición para
las dos capas. La página del Paso 3 del camino pasa a server component para leer
el parámetro del tope; sin endpoints nuevos, sin migraciones, sin cambios de
contrato.
