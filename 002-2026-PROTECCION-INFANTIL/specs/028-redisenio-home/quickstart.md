# Quickstart: Rediseño completo del Home

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

### Escenario A: Barra superior simplificada

```bash
curl -s http://localhost:5005/ | grep -oE 'Dashboard|Iniciar sesión|Consultar|Reportar' | sort | uniq -c
```

**Esperado**: `Dashboard` e `Iniciar sesión` presentes; `Consultar` y `Reportar` ausentes del HTML renderizado.

### Escenario B: Hero muestra tarjetas y buscador integrado

```bash
curl -s http://localhost:5005/ | grep -E "Protege a quienes más importan|Crear un reporte|Consultar|Busca un número, nick o usuario|Buscar|Canales oficiales de denuncia"
```

**Esperado**: Todos los textos aprobados están presentes.

### Escenario C: Navegación a reportar desde la tarjeta

```bash
curl -s http://localhost:5005/ | grep -o 'href="/reportar"'
```

**Esperado**: Al menos un enlace a `/reportar`.

### Escenario D: Sin secciones eliminadas

```bash
curl -s http://localhost:5005/ | grep -oE '¿Cómo funciona\?|Crear una cuenta|Ver estadísticas|Reportar</a>'
```

**Esperado**: Ninguna de estas cadenas aparece en el HTML.

### Escenario E: Footer con copyright correcto

```bash
curl -s http://localhost:5005/ | grep -o '© 2026 Innovadataco'
```

**Esperado**: El copyright aparece exactamente.

---

## 3. Validar consulta desde el buscador integrado

### Escenario F: Consulta sin reportes

Ingresar un identificador inexistente en el buscador de la tarjeta "Consultar" y presionar "Buscar".

**Esperado**: Mensaje de "Sin reportes registrados" dentro de la tarjeta.

### Escenario G: Consulta con pocos reportes (1-2)

Ingresar un identificador con 1 o 2 reportes visibles.

**Esperado**: Resumen compacto inline dentro de la tarjeta (plataformas, ubicaciones, última fecha).

### Escenario H: Consulta con muchos reportes (>2)

Ingresar un identificador con más de 2 reportes visibles.

**Esperado**: Resumen agregado con total, autenticados, anónimos y enlace a la vista completa `/consulta`.

### Escenario I: Campo vacío

Presionar "Buscar" con el input vacío.

**Esperado**: El formulario muestra "Ingresa un número, nick o usuario." dentro de la tarjeta y no ejecuta la consulta.

---

## 4. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests de UI pasan.

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
3. Confirmar que el buscador integrado y el resultado se ven bien dentro de la tarjeta.
4. Confirmar que los textos son legibles y los botones tocables.

---

## 7. Smoke E2E

```bash
npx tsx scripts/smoke-e2e.ts
```

**Esperado**: Smoke test pasa (8/8 pasos).
