# Dinero Público

Web: https://dinero-publico.github.io/

**¿De dónde viene y a dónde va el dinero público en España?**
Una web estática con los datos oficiales del Ministerio de Hacienda y del INE:

- **Ejecución del Estado mes a mes**: ingresos, gastos y déficit acumulados, comparados con el año anterior.
- **Presupuesto por política de gasto** (pensiones, desempleo, deuda, defensa…), con el detalle de cada programa, su tendencia y la comparación con cualquier año anterior.
- **Quién gasta en qué**: Estado, comunidades, ayuntamientos y Seguridad Social por función (sanidad, educación, protección social…).
- **Comunidades autónomas**: lo que recibe cada una del sistema de financiación, en qué lo gasta partida a partida, cómo evoluciona y cómo se compara, también por habitante.
- Los **presupuestos prorrogados** (del Estado y de cada comunidad) se marcan en tablas y gráficos.

## Cómo funciona

La obtención de los datos y la web están separadas en dos repositorios:

```
Hacienda / INE ──► dinero-publico/datos ──► /datos/v1/*.json ──► esta web (site/)
                   descarga, transforma        (GitHub Pages)       lee los JSON en el navegador
                   y analiza, cada día
```

- **[dinero-publico/datos](https://github.com/dinero-publico/datos)**: la herramienta que descarga, transforma y analiza los datos (comprobaciones de coherencia, prórrogas…) y los publica en https://dinero-publico.github.io/datos/. Ahí están el formato de cada fichero y las instrucciones para actualizarlos.
- **Este repositorio**: solo la web. No descarga nada; `site/app.js` lee los JSON de `/datos/v1/`, en el mismo dominio. El workflow `.github/workflows/publicar.yml` publica `site/` en GitHub Pages cuando cambia la web.

Los datos se actualizan sin volver a publicar la web: cuando el repositorio de datos publica ficheros nuevos, la web los muestra en la siguiente visita.

El histórico de datos anterior a la separación está en el historial de git de este repositorio (carpeta `data/`, hasta el commit que la retiró).

## Uso en local

La web necesita los datos en `/datos/v1/`. Con los dos repositorios clonados uno al lado del otro:

```bash
rm -rf _site && mkdir -p _site && cp -r site/* _site/ && cp -r ../datos/publicado _site/datos
python -m http.server -d _site 8000        # abre http://localhost:8000
```

## Estructura

```
site/                   web estática: una página por sección (index, estado, presupuesto, quien-gasta,
                        comunidades, fuentes), app.js, style.css, vendor/d3.min.js, sitemap.xml, robots.txt
.github/workflows/      publicación de la web en GitHub Pages
```

## Notas de interpretación

- La ejecución del Estado está en **contabilidad nacional**: no es lo mismo que la ejecución presupuestaria en caja ni que los créditos aprobados.
- Mientras no haya nuevos Presupuestos, sigue vigente el último aprobado, **prorrogado**. La SEPG etiqueta cada prórroga con el año del que procede («2025-P» rige en 2026); la web la muestra en el año en que rige. Las modificaciones de crédito durante el año no aparecen en esta serie.
- Los presupuestos autonómicos **prorrogados** no vienen señalados en los datos de Hacienda: la herramienta de datos los deduce cuando un presupuesto repite el total exacto o al menos cinco políticas al céntimo del año anterior.
- Las variaciones entre años están en euros corrientes, sin descontar la inflación.
- Las **entregas a cuenta** son anticipos y se liquidan dos años después con la recaudación real. Buena parte son impuestos cedidos pagados en la propia comunidad.
- Los presupuestos autonómicos son los **iniciales**, no el gasto ejecutado. El gasto ejecutado por función lo da la COFOG de la IGAE, con unos dos años de retraso.
- La financiación autonómica **no es finalista**. Las comparaciones entre lo que recibe una comunidad y lo que dedica a sanidad, educación y servicios sociales muestran a qué equivale, no que esté reservado por ley.

## Licencia

Código: MIT (ver `LICENSE`). Datos: Ministerio de Hacienda e INE, según sus condiciones de reutilización.
