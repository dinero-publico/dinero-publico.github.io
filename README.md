# Presupuestos abiertos

**¿De dónde viene y a dónde va el dinero público en España?**
Una web estática que se actualiza sola con los datos oficiales del Ministerio de Hacienda:

- **Ejecución del Estado mes a mes**: ingresos, gastos y déficit acumulados, comparados con el año anterior.
- **Presupuesto en vigor por política de gasto** (pensiones, desempleo, deuda, defensa…), con el detalle de cada programa.
- **Reparto a las comunidades autónomas**: entregas a cuenta del sistema de financiación, desglosadas por IRPF, IVA, impuestos especiales y fondos.
- **En qué gasta cada comunidad**: su presupuesto por política (sanidad, educación, servicios sociales, deuda…) y una tabla comparativa.

## Cómo funciona

```
Hacienda (Excel oficiales) ──► scripts/fetch_data.py ──► data/*.json ──► site/ (GitHub Pages)
                                     ▲
                       GitHub Actions, todos los días
```

1. Cada día, un workflow de GitHub Actions (`.github/workflows/actualizar.yml`) ejecuta `scripts/fetch_data.py`.
2. El script descarga los Excel oficiales, los convierte a JSON en `data/` y anota en `data/meta.json` cuándo cambió cada fuente.
3. Si hay datos nuevos, el workflow hace commit en `data/`. Así el historial de git es también el historial de los datos.
4. La web (`site/`) se publica en GitHub Pages y lee esos JSON. No hay servidor ni base de datos.

Si una fuente falla (Hacienda caída, cambio de formato…), se conservan sus últimos datos válidos, la web avisa en «Fuentes» y el resto sigue actualizándose.

## Fuentes

| Datos | Organismo | Frecuencia | Origen |
|---|---|---|---|
| Operaciones no financieras del Estado, serie mensual (SEC 2010) | IGAE | Mensual | [igae.pap.hacienda.gob.es](https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Paginas/EstadoOperacionesNF.aspx) |
| PGE consolidados: políticas y programas de gasto | SEPG | Anual (o al prorrogarse) | [sepg.pap.hacienda.gob.es](https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/DocumentacionEstadisticas/Estadisticas/Paginas/Estadisticas.aspx) |
| Entregas a cuenta del sistema de financiación autonómica | S. G. Financiación Autonómica y Local | Anual + actualizaciones | [hacienda.gob.es](https://www.hacienda.gob.es/es-es/cdi/paginas/sistemasfinanciaciondeuda/informacionccaas/informes%20financiacion%20comunidades%20autonomas1.aspx) |
| Presupuestos iniciales de las CCAA por política de gasto | S. G. de Coordinación de la Información Económico-Financiera | Anual | [serviciostelematicosext.hacienda.gob.es](https://serviciostelematicosext.hacienda.gob.es/SGCIEF/PublicacionPresupuestos/aspx/inicio.aspx) |
| Gasto ejecutado por función (COFOG) de cada administración y de cada comunidad | IGAE | Anual | [igae.pap.hacienda.gob.es](https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Paginas/iacofogCA.aspx) |

Se guardan unos diez años de histórico de cada fuente. Los presupuestos autonómicos de años cerrados no cambian, así que el script los reutiliza del JSON ya guardado y solo vuelve a descargar los dos últimos años.

Los datos se reutilizan según el [aviso legal del Ministerio de Hacienda](https://www.hacienda.gob.es/es-ES/Paginas/Avisolegal.aspx). No existe una API pública: el script descarga los mismos Excel que cualquier persona puede bajar desde esas páginas.

## Puesta en marcha en GitHub

1. Crea un repositorio público y sube este proyecto a la rama `main`.
2. En **Settings → Pages**, en *Build and deployment → Source*, elige **GitHub Actions**.
3. En **Settings → Actions → General → Workflow permissions**, marca **Read and write permissions**.
4. En la pestaña **Actions**, abre «Actualizar datos y publicar web» y pulsa **Run workflow**.

La web quedará en `https://<tu-usuario>.github.io/<repositorio>/`. A partir de ahí se actualiza sola cada día a las 07:17 UTC.

> **Si la descarga falla desde GitHub:** algunos servidores de Hacienda bloquean o ralentizan conexiones desde centros de datos extranjeros. Si en los registros de Actions ves errores de conexión con `*.hacienda.gob.es`, tienes dos opciones:
> - Ejecuta el script en tu ordenador y sube `data/` (ver abajo).
> - Usa un [runner autoalojado](https://docs.github.com/es/actions/hosting-your-own-runners) en España: cambia `runs-on: ubuntu-latest` por `runs-on: self-hosted` en el trabajo `datos`.

## Uso en local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python scripts/fetch_data.py               # descarga y actualiza data/
python scripts/fetch_data.py --only estado # solo una fuente
python scripts/fetch_data.py --offline raw # reprocesa los Excel guardados en raw/ sin usar la red

python -m pytest -q                        # tests de los parsers con Excel reales

# Ver la web
mkdir -p _site && cp -r site/* _site/ && cp -r data _site/data
python -m http.server -d _site 8000        # abre http://localhost:8000
```

Cada descarga guarda una copia del Excel original en `raw/` (no se sube al repositorio).

## Estructura

```
scripts/fetch_data.py   descarga + parseo de las cuatro fuentes
tests/                  tests con Excel oficiales reales (tests/fixtures)
data/                   JSON generados (los actualiza el workflow)
site/                   web estática: index.html, app.js, style.css, vendor/d3.min.js
.github/workflows/      actualización diaria y publicación en GitHub Pages
```

### Formato de los datos

- `data/estado.json`: para cada año, los meses publicados y cada partida SEC (`codigo`, `concepto`, `bloque` = recursos/empleos/saldos, `nivel` 0-2, `valores` acumulados en M€).
- `data/pge.json`: políticas de gasto (capítulos 1 a 8) con sus programas, en M€, para cada ejercicio de la serie (`2025-P` = prorrogado).
- `data/entregas.json`: entregas a cuenta por comunidad y concepto, en M€, de los últimos ejercicios publicados.
- `data/ccaa.json`: presupuesto inicial consolidado de cada comunidad por política de gasto, en M€.
- `data/cofog.json`: gasto ejecutado por división COFOG (`07` sanidad, `09` educación, `10` protección social…), en M€. `subsectores` tiene la serie anual de la Administración central, regional, local y Seguridad Social (con `transferencias_aapp`, el grupo 01.8); `comunidades`, el detalle por comunidad de cada año.
- `data/meta.json`: fecha en que cambió cada fuente y último error, si lo hubo.

## Notas de interpretación

- La ejecución del Estado está en **contabilidad nacional**: no es lo mismo que la ejecución presupuestaria en caja ni que los créditos aprobados.
- Mientras no haya nuevos Presupuestos, sigue vigente el último aprobado, **prorrogado**. Las modificaciones de crédito durante el año no aparecen en esta serie.
- Las **entregas a cuenta** son anticipos y se liquidan dos años después con la recaudación real. Buena parte son impuestos cedidos pagados en la propia comunidad.
- Los presupuestos autonómicos son los **iniciales**, no el gasto ejecutado. El gasto ejecutado por función lo da la COFOG de la IGAE, con unos dos años de retraso.
- La financiación autonómica **no es finalista**. Las comparaciones entre lo que recibe una comunidad y lo que dedica a sanidad, educación y servicios sociales muestran a qué equivale, no que esté reservado por ley.

## Licencia

Código: MIT (ver `LICENSE`). Datos: Ministerio de Hacienda, según sus condiciones de reutilización.
