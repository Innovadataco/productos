# Quickstart: Simulación — Ver detalle del reporte (Spec 072)

**Prerequisites**: El proyecto debe estar corriendo (`npm run dev` o `./scripts/dev-restart.sh`), con la BD migrada y las 4 cuentas de trabajo disponibles (admin, padre, operador, comité). El Spec 070 debe estar implementado para poder crear simulaciones.

---

## 1. Iniciar sesión como admin

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }` y cookie `token` establecida.

---

## 2. Crear una simulación con un set de casos (si no hay ninguna)

Usar la UI en `http://localhost:5005/dashboard/admin/ia?tab=simulacion` o el endpoint del Spec 070:

```bash
# Subir set de casos JSON (ejemplo mínimo con 2 casos)
cat > /tmp/casos.json << 'EOF'
{
  "casos": [
    {
      "texto": "te doy dinero si me mandas fotos",
      "plataforma": "whatsapp",
      "identificador": "SIM-DET-1",
      "fechaIncidente": "2026-07-20T00:00:00Z",
      "ciudad": "Bogotá",
      "pais": "Colombia",
      "categoriaEsperada": "SOLICITUD_MATERIAL"
    },
    {
      "texto": "hola, ¿cuántos años tenés? hablemos por privado",
      "plataforma": "instagram",
      "identificador": "SIM-DET-2",
      "fechaIncidente": "2026-07-20T00:00:00Z",
      "ciudad": "Medellín",
      "pais": "Colombia",
      "categoriaEsperada": "CONTACTO_INSISTENTE"
    }
  ]
}
EOF

curl -X POST http://localhost:5005/api/admin/ia/simulaciones \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d @/tmp/casos.json
```

**Esperado**: `201` con el id de la corrida.

---

## 3. Ejecutar la simulación y esperar resultados

En la UI, seleccionar el modelo y lanzar la corrida, o usar el endpoint correspondiente. Esperar a que pase a `COMPLETADA`.

Verificar progreso:

```bash
curl http://localhost:5005/api/admin/ia/simulaciones/{runId} \
  -b cookies.txt
```

**Esperado**: `"estado": "COMPLETADA"`.

---

## 4. Verificar que el endpoint devuelve `reporteId`

```bash
curl "http://localhost:5005/api/admin/ia/simulaciones/{runId}/resultados?page=1&pageSize=50" \
  -b cookies.txt
```

**Esperado**: Cada ítem contiene `reporteId` no vacío.

---

## 5. Probar el botón "Ver detalle" en la UI

1. Abrir `http://localhost:5005/dashboard/admin/ia?tab=simulacion`.
2. Seleccionar la corrida creada.
3. En la tabla de resultados, hacer clic en "Ver detalle" (ícono de ojo o texto) de una fila.
4. **Esperado**: se abre el modal "Detalle del reporte" con el texto, categoría, confianza, estado y transiciones del reporte.
5. Cerrar el modal con:
   - El botón "Cerrar" del modal.
   - Clic fuera del modal (overlay).
   - Tecla Escape.
6. **Esperado**: el modal se cierra en los tres casos y se vuelve a la tabla de resultados.

---

## 6. Verificar acción desde el modal

1. Abrir el detalle de un caso que quedó en `REVISION_MANUAL`.
2. Si aplica, validar la anonimización o escalar el caso.
3. **Esperado**: la acción se completa y, al cerrar el modal, la tabla de resultados se refresca reflejando el nuevo estado.

---

## 7. Ejecutar tests y build

```bash
npm run test
npm run build
```

**Meta**: Tests verdes, build sin errores.
