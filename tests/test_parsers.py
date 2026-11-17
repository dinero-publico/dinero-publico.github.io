"""Comprueba los parsers con ficheros oficiales reales (tests/fixtures).

Si Hacienda cambia el formato de un Excel, estos tests ayudan a detectar
qué parser hay que adaptar sin depender de la red.
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import fetch_data as fd  # noqa: E402

FX = ROOT / "tests" / "fixtures"


def read(name):
    return (FX / name).read_bytes()


def test_estado_2026():
    d = fd.parse_estado(read("M_ESTADO_2026.xlsx"))
    assert d["anio"] == 2026
    assert d["meses"][-1] == "Septiembre"
    rec = next(p for p in d["partidas"] if p["bloque"] == "recursos" and p["nivel"] == 0)
    emp = next(p for p in d["partidas"] if p["bloque"] == "empleos" and p["nivel"] == 0)
    b9 = next(p for p in d["partidas"] if p["codigo"] == "B.9")
    assert rec["valores"][-1] == 247062
    assert emp["valores"][-1] == 286096
    assert b9["valores"][-1] == pytest.approx(rec["valores"][-1] - emp["valores"][-1])
    # Las partidas de detalle suman el total de su bloque.
    for bloque, tot in (("recursos", rec), ("empleos", emp)):
        det = sum(p["valores"][-1] for p in d["partidas"] if p["bloque"] == bloque and p["nivel"] == 2)
        assert det == pytest.approx(tot["valores"][-1], abs=5)
    assert d["pib"] and d["pib"] > 1_000_000


def test_pge_consolidado():
    d = fd.parse_pge(read("pge_consolidados_2025-P.xlsx"))
    col = d["columnas"][-1]
    assert col == "2025-P"
    assert len(d["politicas"]) >= 25
    suma = sum(p["valores"][col] or 0 for p in d["politicas"])
    assert suma == pytest.approx(d["total"][col], rel=1e-6)
    pens = next(p for p in d["politicas"] if p["codigo"] == "21")
    assert pens["politica"] == "Pensiones"
    for p in d["politicas"]:
        progs = sum(g["valores"][col] or 0 for g in p["programas"])
        assert progs == pytest.approx(p["valores"][col] or 0, abs=0.1)


def test_entregas_2026():
    d = fd.parse_entregas(read("entregas-a-cuenta-2026.xlsx"))
    nombres = {f["comunidad"] for f in d["filas"]}
    assert {"Madrid", "Cataluña", "Andalucía", "Ceuta", "Melilla"} <= nombres
    assert "País Vasco" not in nombres
    total = sum(f["total"] for f in d["filas"])
    assert total == pytest.approx(157730.78, abs=1)
    mad = next(f for f in d["filas"] if f["comunidad"] == "Madrid")
    assert mad["total"] == pytest.approx(22061.27, abs=0.01)
    assert mad["fondo_garantia"] < 0


def test_entregas_2019_formato_antiguo():
    d = fd.parse_entregas(read("entregas-a-cuenta-2019.xlsx"))
    assert len(d["filas"]) == 17
    assert "Real Decreto" in d["norma"]
    assert sum(f["total"] for f in d["filas"]) == pytest.approx(102800, abs=1)
    for f in d["filas"]:
        assert f["irpf"] is not None and f["iva"] is not None


def test_enlace_entregas_nombres_antiguos():
    import re
    pat = r"entregas?[-_]a[-_]cuenta[-_](\d{4})[^/]*\.xlsx$"
    for href, y in [("x/entregas-a-cuenta-2026.xlsx", "2026"), ("x/entregas-a-cuenta-2024-actualizadas.xlsx", "2024"),
                    ("x/entrega-a-cuenta-2022.xlsx", "2022"), ("x/entrega_a_cuenta_2021.xlsx", "2021"),
                    ("x/financiacion_entregas_a_cuenta_2019.xlsx", "2019")]:
        assert re.search(pat, href, re.I).group(1) == y
    assert not re.search(pat, "x/prevision-liquidacion-2023.xlsx", re.I)


def test_cofog_detalle_ccaa_2024():
    d = fd.parse_cofog_detalle(read("COFOG_A_Detalle_CCAA_2024.xlsx"))
    assert d["anio"] == 2024 and d["provisional"]
    nombres = {f["comunidad"] for f in d["filas"]}
    assert nombres == set(fd.CCAA.values())
    and_ = next(f for f in d["filas"] if f["comunidad"] == "Andalucía")
    assert and_["divisiones"]["07"] == 14660
    for f in d["filas"]:
        assert sum(f["divisiones"].values()) == pytest.approx(f["total"], abs=5)


def test_cofog_serie_central():
    s = fd.parse_cofog_serie(read("cofog_serie_central.xlsx"), desde=2014)
    assert s[0]["anio"] == 2014 and s[-1]["anio"] >= 2024
    a = next(x for x in s if x["anio"] == 2024)
    assert a["total"] == 357732
    assert a["divisiones"]["07"] == 3585
    assert a["transferencias_aapp"] == 193390
    assert sum(a["divisiones"].values()) == pytest.approx(a["total"], abs=5)


def test_funcional_madrid_2026():
    d = fd.parse_funcional(read("funcional_12_2026.xlsx"))
    assert d["anio"] == 2026
    assert d["total"] == pytest.approx(33271.72, abs=0.01)
    assert sum(p["importe"] for p in d["politicas"]) == pytest.approx(d["total"], abs=1)
    san = next(p for p in d["politicas"] if p["codigo"] == "31")
    assert san["politica"] == "Sanidad" and san["area"] == "Bienes públicos preferentes"


def test_funcional_por_capitulos_andalucia_2026():
    d = fd.parse_funcional(read("funcional_cap_01_2026.xlsx"))
    assert d["anio"] == 2026
    assert d["total"] == pytest.approx(51597.94, abs=0.01)
    assert d["capitulos"][0] == "Gastos de personal" and len(d["capitulos"]) == 9
    san = next(p for p in d["politicas"] if p["codigo"] == "31")
    assert san["importe"] == pytest.approx(15989.27, abs=0.01)
    assert san["capitulos"][0] == pytest.approx(7580.0, abs=0.01)  # personal
    for p in d["politicas"]:
        assert sum(p["capitulos"]) == pytest.approx(p["importe"], abs=0.1)


def test_desglose_gastos_andalucia_2026():
    d = fd.parse_gastos(read("gastos_01_2026.xlsx"))
    g = {p["codigo"]: p for p in d["partidas"]}
    assert d["total"] == pytest.approx(51597.94, abs=0.01)
    assert g["481"]["nombre"] == "Recetas médicas"
    assert g["481"]["importe"] == pytest.approx(2671.45, abs=0.01)
    # Los artículos suman su capítulo.
    assert g["20"]["importe"] + g["29"]["importe"] == pytest.approx(g["2"]["importe"], abs=0.1)
    assert all(p["importe"] for p in d["partidas"])


def test_parse_html_links_and_hidden():
    p = fd.parse_html('<form><input type="hidden" name="__VIEWSTATE" value="abc"></form>'
                      '<a href="/x/entregas-a-cuenta-2026.xlsx">Excel</a>')
    assert p.hidden == {"__VIEWSTATE": "abc"}
    assert p.links == [("/x/entregas-a-cuenta-2026.xlsx", "Excel")]
