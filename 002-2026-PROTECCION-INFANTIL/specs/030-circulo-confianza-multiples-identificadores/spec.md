# Spec 030 — Rediseño del Círculo de Confianza: contacto = persona con múltiples identificadores

> **Status**: CERRADA.

## Objetivo

Permitir que un usuario agrupe varios identificadores (teléfono, nick, usuario, email, etc.) bajo un mismo contacto del Círculo de Confianza, en lugar de tratar cada identificador como un contacto independiente.

## Problema que resuelve

El modelo anterior obligaba a crear un contacto por cada identificador. Si una persona cercana al menor usa WhatsApp y Minecraft, el usuario debía agregar dos contactos separados, perdiendo la noción de "persona". Además, la búsqueda de reportes filtraba por `identificador` **y** `plataformaId`, lo que ocultaba reportes del mismo identificador en otras plataformas o, peor, omitía alertas cuando el reporte existía en una plataforma diferente a la registrada.

## Alcance

- Cambio del modelo: `ContactoConfianza` pasa a representar una persona; `IdentificadorContacto` almacena cada valor asociado a esa persona.
- Migración transparente de los datos existentes: cada contacto viejo se convierte en un contacto nuevo con un único identificador.
- Refactor de la lógica de negocio para agregar, listar, actualizar, notificar y ver el detalle usando el nuevo modelo.
- Ajuste de endpoints y UI para soportar múltiples identificadores por contacto.
- Tests unitarios y de API con el escenario obligatorio: contacto "Tío" con WhatsApp y Minecraft, reporte en Minecraft → detalle muestra la alerta en ese identificador.

## Fuera de alcance

- No se modifica el pipeline de clasificación (R7).
- No se alteran los reportes, sus estados ni los datos del denunciante.
- No se cambian las preferencias de notificación ni la lógica de cooldown.

## Reglas de privacidad

- Los endpoints de círculo nunca devuelven texto, email, teléfono ni nombre del denunciante.
- Los reportes se buscan únicamente por el valor del identificador; no se filtra por plataforma, para evitar omitir alertas.
- Los emails de notificación son ciegos: solo indican que hay novedades, sin incluir el identificador ni detalles del reporte.
- Cada usuario solo ve sus propios contactos y reportes asociados a esos identificadores.

## Decisión de modelo: contacto = persona

- `ContactoConfianza` representa a una persona cercana al menor: etiqueta, nota y estado activo/inactivo.
- `IdentificadorContacto` representa un medio de contacto de esa persona: valor, tipo, plataforma (opcional) y activo/inactivo.
- Un contacto debe tener al menos un identificador.
- El mismo valor puede repetirse en identificadores de contactos distintos del mismo usuario (no se valida cross-contacto).
- El estado de riesgo de un contacto se calcula sobre todos sus identificadores activos; gana el peor estado (`enRevision` > `clasificado` > `sinReportes`).

## Criterios de aceptación

1. Un usuario puede crear un contacto con múltiples identificadores.
2. Al desactivar un contacto, todos sus identificadores se desactivan.
3. Al reactivar un contacto, sus identificadores vuelven a activarse.
4. El detalle de un contacto muestra cada identificador con su estado y reportes agregados.
5. Una notificación de circulo se dispara si un reporte visible coincide con cualquier identificador activo, sin importar la plataforma.
6. Los tests unitarios y de API pasan, incluyendo el escenario obligatorio de WhatsApp + Minecraft.
