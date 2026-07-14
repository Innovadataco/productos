# Quickstart: Validación del Frontend Público

**Prerequisites**: Backend del módulo de reportes funcionando (fase 2), Ollama con modelos cargados, admin sembrado.

---

## 1. Iniciar servidor

```bash
npm run dev          # App en :5005
```

---

## 2. Validar escenarios end-to-end

### Escenario A: Consulta pública (sin reportes)

```bash
curl -s "http://localhost:5005/api/consulta?identificador=%2B57300999999&plataforma=whatsapp"
```

**Esperado**: `{"tieneReportes":false,"mensaje":"Sin reportes registrados para este identificador."}`

---

### Escenario B: Crear reporte anónimo y consultar seguimiento

```bash
curl -s -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{"identificador":"+57300TEST01","plataforma":"whatsapp","texto":"Este número contactó a mi hija ofreciendo regalos.","fechaIncidente":"2026-07-10T14:30:00Z","ciudad":"Bogotá","pais":"Colombia"}'
```

**Esperado**: `201` con `numeroSeguimiento`.

```bash
# Seguimiento
curl -s "http://localhost:5005/api/reportes/seguimiento/RPT-XXXXXX"
```

**Esperado**: `200` con estado `PENDIENTE` o `CLASIFICADO`.

---

### Escenario C: Registro y login de padre

```bash
# Solicitar código
curl -s -X POST http://localhost:5005/api/auth/verificar/solicitar \
  -H "Content-Type: application/json" \
  -d '{"email":"padre@test.com"}'

# Completar registro (usar código recibido por email)
curl -s -X POST http://localhost:5005/api/auth/verificar/completar \
  -H "Content-Type: application/json" \
  -d '{"email":"padre@test.com","codigo":"123456","password":"Password123!","nombre":"Padre Test"}'

# Login
curl -s -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"padre@test.com","password":"Password123!"}' \
  -c /tmp/padre.txt

# Verificar sesión
curl -s http://localhost:5005/api/me -b /tmp/padre.txt
```

**Esperado**: `200` con `rol: "PARENT"`.

---

### Escenario D: Panel "Mis reportes"

```bash
curl -s "http://localhost:5005/api/reportes/mis-reportes?page=1&pageSize=10" \
  -b /tmp/padre.txt
```

**Esperado**: `200` con array de reportes del usuario, sin `textoOriginal`, con `estadoVisual` mapeado.

---

### Escenario E: UI end-to-end (manual)

1. Abrir `http://localhost:5005`
2. Buscar un identificador con reportes (usar umbral bajado a 1 para pruebas)
3. Verificar que canales oficiales aparecen en pantalla
4. Navegar a "Reportar", completar 4 pasos, confirmar checkbox
5. Guardar número de seguimiento
6. Consultar seguimiento en página dedicada

---

## 3. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

---

## 4. Verificar accesibilidad básica

- Todos los inputs tienen `<label>` asociado
- Foco visible en elementos interactivos
- Contraste mínimo 4.5:1 en textos
- Sin inputs de archivo en ninguna pantalla de reporte