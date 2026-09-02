# SPEC-367 · A-73 — Tu círculo de confianza (rediseño G12)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: A-73 (brief del CEO + mockup aprobado por Jelkin)

## Qué estaba mal

La pantalla mezclaba 4 métricas, un formulario técnico (etiqueta / tipo /
identificadores), la lista, una dona, un mapa y una "vista agregada", todo junto.
Jelkin la rechazó **cuatro veces** por confusa.

## Cómo quedó

Se construyó sobre el mockup aprobado, con las tres decisiones de Jelkin:

1. **Nombre: las dos.** La miga dice **"A quién vigilo"** (el menú) y el título
   **"Tu círculo de confianza"**.
2. **Aviso de una vez.** Un reporte **en revisión** ya se muestra; no se espera a
   que esté procesado.
3. **Las estadísticas viven DENTRO de cada persona** ("Ver de qué se trata"). La
   pantalla principal quedó simple: sin mapas ni donas sueltas.

Además:
- **Vacío = primer paso**: tres pasos e ideas concretas (el tío, la niñera, el
  entrenador), no una pantalla en blanco.
- **Tarjeta por persona** con nombre, parentesco, estado y acciones claras: Ver de
  qué se trata · Otro dato · Pausar · Quitar.
- **"Necesita tu atención"** arriba, solo cuando hay algo.
- **Agregar** con tres preguntas en orden humano y parentesco por chips.
- **"Qué recibes cuando pasa algo"** con el ejemplo del aviso y el interruptor
  real de la preferencia. Se aclara que **a la persona nunca le llega nada**.

## Lo que NO se tocó (candado 15v5)

La API ya tenía todo: `listarContactos` usa `include`, así que **ya devolvía
`nombre`, `parentesco` y `creadoEn`** — la pantalla vieja solo declaraba
`etiqueta` (deprecada) y por eso no los mostraba. Se reusan alta, PATCH de
contacto y de identificadores (**lista COMPLETA**: el backend desactiva los que no
vengan), baja lógica, detalle con agregado, preferencias y catálogo de
plataformas.

**Único agregado de backend:** la lista ahora devuelve `tope`
(`circulo.max_contactos`) para poder mostrar el cupo real ("2 de 20") sin
inventarlo. Es aditivo.

**El candado de acceso no se relajó:** la página conserva el mismo guard de rol
que tenía (mismos roles redirigidos, ni más ni menos).

## Voz y color

Voz **tú** neutro de Colombia. **Nunca rojo**: verde tranquila · ámbar necesita
atención · gris en pausa. Sin jerga (no se dice "identificador", "etiqueta" ni
"tipo"). Los textos son **neutros en género** a propósito: el sistema guarda
nombre y parentesco, no el género, y no se infiere de un nombre.

## Impacto en arquitectura: no

Sin modelo ni migración. La pantalla pasa de un archivo cliente de 775 líneas a
componentes en `components/modules/padre/circulo/`; la ruta del padre
(SPEC-317) la reexporta, así que el rediseño entra por las dos rutas. La paleta
suelta de Tailwind que usaba la pantalla vieja desaparece: `tokens:check` baja de
1083 a 1064.

## Cómo se probó

- `CirculoConfianzaClient.test.tsx` (7): los **tres estados** (vacío = primer
  paso · con personas · agregando), el nombre doble (decisión 1), que el reporte
  en revisión ya se muestre (decisión 2), que la pantalla principal NO tenga
  estadísticas sueltas (decisión 3), que no se use rojo, y que a alguien sin
  reportes no se le ofrezca "Ver de qué se trata".
- Tests del círculo existentes (39) verdes tras el agregado de `tope`.
- La ruta compila y responde 200 en el navegador (dev). **El recorrido visual con
  sesión de padre queda para Calidad**: entrar requiere escribir una contraseña, y
  esta sesión no maneja credenciales.
