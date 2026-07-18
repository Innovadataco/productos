# Quickstart: Rediseño del Home con buscador integrado

**Prerequisites**: Servidor de desarrollo en `http://localhost:5005` o build de producción corriendo.

---

## 1. Iniciar el servidor

```bash
npm run dev
# o, para validar producción:
npm run build && npm start
```

Servidor en `http://localhost:5005`.

---

## 2. Validar escenarios de la landing

### Escenario A: Home muestra acciones principales y buscador integrado

```bash
curl -s http://localhost:5005/ | grep -E "Protege a quienes más importan|Crear un reporte|Consultar|Crear una cuenta|Ver estadísticas|Buscar|Busca un número, nick o usuario"
```

**Esperado**: Todos los textos aprobados están presentes en el HTML renderizado.

### Escenario B: Navegación a reportar

```bash
curl -s http://localhost:5005/ | grep -o 'href="/reportar"'
```

**Esperado**: Al menos un enlace a `/reportar`.

### Escenario C: Navegación a registro y dashboard público

```bash
curl -s http://localhost:5005/ | grep -oE 'href="/registro"|href="/dashboard/publico"'
```

**Esperado**:Enlaces a `/registro` y `/dashboard/publico`.

---

## 3. Validar consulta desde el buscador integrado

### Escenario D: Consulta con reportes

```bash
# Desde el browser, ingresar un identificador en el input de la tarjeta "Consultar" y presionar "Buscar".
# O directamente por API:
curl -X GET "http://localhost:5005/api/consulta?identificador=30009000002" -H "Accept: application/json"
```

**Esperado**: Respuesta JSON con datos del identificador (si existe y tiene visibilidad). El home debe mostrar el resultado debajo de las tarjetas.

### Escenario E: Consulta sin reportes o inexistente

```bash
# Ingresar en el buscador integrado un identificador inexistente.
curl -X GET "http://localhost:5005/api/consulta?identificador=NOEXISTE123" -H "Accept: application/json"
```

**Esperado**: Respuesta controlada sin crash (mensaje de "no encontrado" o similar). El home debe mostrar el mensaje debajo de las tarjetas.

### Escenario F: Campo vacío

**Esperado**: Al presionar "Buscar" con el campo vacío, el formulario muestra el error "Ingresa un número, nick o usuario." y no dispara la consulta.

---

## 4. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests de UI pasan, especialmente los de landing/consulta.

---

## 5. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

---

## 6. Responsive (manual)

1. Abrir `http://localhost:5005/` en modo móvil (ancho < 640 px).
2. Confirmar que las dos tarjetas se apilan verticalmente.
3. Confirmar que el buscador integrado es usable (input y botón apilados o en línea según el ancho).
4. Confirmar que los textos son legibles y los botones tocables.

---

## 7. Smoke E2E

```bash
npx tsx scripts/smoke-e2e.ts
```

**Esperado**: Smoke test pasa (8/8 pasos).
