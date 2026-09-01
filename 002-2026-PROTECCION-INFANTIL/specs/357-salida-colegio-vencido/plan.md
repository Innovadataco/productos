# SPEC-357 · Plan

1. **Leer la evidencia antes de cortar** (candado 15v5): fila I-254 de
   `04-INCIDENCIAS.md` y el inventario de Calidad
   (`07-INVENTARIO-GUARDS-DESALINEADOS.md`, §3-bis con la tabla del encierro).
2. **Enumerar 22v5** los callsites de `existeSuscripcionVigenteParaTitular` y
   todos los handlers de las cinco familias del camino que corren guard propio.
3. **FR-001**: exentar `/dashboard/colegio/suscripcion` del guardián del camino
   y levantar la doble valla de `/camino/colegio/plan` cuando el colegio está
   vencido.
4. **FR-002**: `existeSuscripcionVigenteParaTitular` mira estado Y fecha.
5. **FR-003/004**: una función única `verificarVigenciaColegioSalvoCamino` y su
   aplicación a los 28 handlers; excepción restringida al estado `vencido` y al
   rol SCHOOL_ADMIN.
6. **Tests** (candado 24v2): los que afirmaban el encierro se actualizan con las
   dos mitades de la regla, renombrados; fixture compartido para no duplicar.
