# Quickstart: SPEC-237 — validación manual

Base: app corriendo (`./scripts/dev-restart.sh`), base de datos migrada y sembrada, usuarios de prueba: un `COMITE_VALIDACION`, un segundo `COMITE_VALIDACION`, un `ADMIN` y un `PARENT`.

## Preparación

1. Verificar que existen los parámetros:

```bash
curl -X GET http://localhost:5005/api/config/parametros/padre.comite.miembros_minimos_aprobacion \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt

curl -X GET http://localhost:5005/api/config/parametros/padre.comite.sla_horas_consolidacion \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt
```

Esperado: valores `2` y `72` respectivamente.

2. Si es necesario, crear un expediente PADRE con `InformeConsolidado` en estado `PENDIENTE_CONSOLIDACION` (proceso de SPEC-234/SPEC-236).

---

## Bloque A — Bandeja unificada y filtro por tipo

1. Loguearse como `COMITE_VALIDACION`:

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-comite.txt \
  -d '{"email":"comite@proteccion.local","password":"Comite123Test"}'
```

2. Abrir `/dashboard/admin/comite`.
3. Verificar que aparecen tareas `REVISION_REPORTE` y `CONSOLIDACION_EXPEDIENTE` con icono y badge distintivos.
4. Seleccionar filtro "Consolidaciones" → solo aparecen filas de tipo `CONSOLIDACION_EXPEDIENTE`.
5. Seleccionar filtro "Revisiones de reporte" → solo aparecen filas de tipo `REVISION_REPORTE`.
6. Verificar que el SLA se muestra en hora Bogotá con indicador verde/ámbar/rubi según la antigüedad.

---

## Bloque B — Vista de consolidación

1. Hacer clic en una fila de tipo `CONSOLIDACION_EXPEDIENTE`.
2. Navegar a `/dashboard/admin/comite/consolidacion/[expedienteId]`.
3. Verificar bloques visibles:
   - Encabezado con identificador, estado, categoría dominante y SLA.
   - Timeline de eventos del expediente.
   - Resumen consolidado editable.
   - Patrones N1 verificables.
   - Señal comunitaria (estadísticas agregadas).
   - Selector de guía de acción (default = categoría dominante).
4. Cambiar la guía de acción a otra categoría y guardar → el selector refleja el cambio tras recargar.

---

## Bloque C — Aprobación multi-miembro

1. Con `COMITE_VALIDACION` #1, pulsar "Aprobar".
2. Esperado:
   - Mensaje: "Aprobación registrada (1/2)".
   - El expediente NO transiciona aún.
3. Loguearse como `COMITE_VALIDACION` #2 (cookie distinta):

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-comite2.txt \
  -d '{"email":"comite2@proteccion.local","password":"Comite123Test"}'
```

4. Con el segundo miembro, pulsar "Aprobar".
5. Esperado:
   - Mensaje: "Informe aprobado por el comité".
   - El expediente cambia a estado `EN_APROBACION_PADRE`.
   - Se publica el evento `expediente.comite.aprobo` (verificable en logs o tabla de eventos de SPEC-236).
6. Intentar aprobar de nuevo con cualquiera de los dos → 409 "El miembro ya aprobó este informe".

---

## Bloque D — Corrección de texto con historial

1. Abrir un informe pendiente como `COMITE_VALIDACION`.
2. Editar el resumen consolidado, añadir motivo "Ajuste redacción" y pulsar "Corregir".
3. Esperado:
   - Estado del informe pasa a `CORREGIDO`.
   - El texto actualizado se refleja en la vista.
4. Volver a corregir con otro motivo.
5. Verificar en BD que `correccionesJson` contiene dos snapshots con texto anterior, texto nuevo, autor y timestamp.
6. Aprobar el informe corregido → al alcanzar umbral, transiciona normalmente.

---

## Bloque E — Devolución con motivo obligatorio

1. Abrir un informe pendiente como `COMITE_VALIDACION`.
2. Pulsar "Devolver" sin motivo → validación rechaza con mensaje visible.
3. Ingresar motivo "Falta evidencia de respaldo" y confirmar.
4. Esperado:
   - Estado del informe pasa a `DEVUELTO`.
   - Desaparece de la bandeja de pendientes.
   - Existe registro en `AuditLog` con acción `INFORME_CONSOLIDADO_DEVUELTO`.

---

## Bloque F — Control de acceso

1. Loguearse como `ADMIN`:

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-admin.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

2. Abrir `/dashboard/admin/comite/consolidacion/[expedienteId]`.
3. Esperado: vista en modo lectura; botones Aprobar/Corregir/Devolver no visibles.
4. Llamar directamente:

```bash
curl -X POST http://localhost:5005/api/admin/comite/consolidacion/[expedienteId]/aprobar \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt
```

Esperado: `403`.

5. Loguearse como `PARENT` y abrir `/dashboard/admin/comite`.
6. Esperado: redirección a página sin acceso o `403`.

---

## Bloque G — SLA en Bogotá

1. Crear o identificar un informe recién creado (SLA verde).
2. Forzar `padre.comite.sla_horas_consolidacion = 0` temporalmente o esperar el tiempo configurado.
3. Recargar la bandeja.
4. Esperado: el indicador de SLA pasa a rojo (`rubi`) y la fecha/hora se muestra en zona `America/Bogota`.

---

## Invariantes de privacidad y seguridad

- En ninguna vista o log aparece texto original de reportes.
- La señal comunitaria es estadística/descriptiva, nunca un veredicto.
- Solo `COMITE_VALIDACION` ejecuta acciones de aprobación/corrección/devolución.
