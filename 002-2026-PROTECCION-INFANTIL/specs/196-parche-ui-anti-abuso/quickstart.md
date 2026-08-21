# Quickstart — SPEC-196

## Ver F1 · Nota limpia
1. Admin → Anti-abuso → Simulador.
2. Escribir una nota.
3. Cambiar el escenario.
4. Verificar que el campo Nota queda vacío.

## Ver F2 · Columna ID
1. Admin → Anti-abuso → Simulador → Historial.
2. Verificar columna "ID" con hash truncado y botón copiar.

## Ver F3 · Array de identificadores
1. Nueva corrida.
2. Llenar "Identificador objetivo" y "Identificadores (array)" con 5 valores.
3. Iniciar.
4. En BD: `SELECT config_json->'identificadores' FROM simulacion_abuso_runs ORDER BY creado_en DESC LIMIT 1;` debe devolver array; `identificador` debe ser null.

## Ver F4a · Bloquear IP en claro
1. Admin → Anti-abuso → Operativo.
2. Ingresar `192.0.2.50` en "IP a bloquear".
3. Enviar.
4. Verificar en BD que `BlockList.ip_hash` es el SHA-256 lowercase de `192.0.2.50`.

## Ver F4b · Desbloquear con motivo
1. En "Bloqueos vigentes", clic en "Desbloquear".
2. Ingresar motivo ≥20 caracteres.
3. Confirmar.
4. Verificar en `AuditLog` fila con `accion = 'IP_DESBLOQUEADA_MANUAL'` y metadatos con motivo.
