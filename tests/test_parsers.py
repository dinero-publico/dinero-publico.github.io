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


def test_funcional_madrid_2026():
    d = fd.parse_funcional(read("funcional_12_2026.xlsx"))
    assert d["anio"] == 2026
    assert d["total"] == pytest.approx(33271.72, abs=0.01)
    assert sum(p["importe"] for p in d["politicas"]) == pytest.approx(d["total"], abs=1)
    san = next(p for p in d["politicas"] if p["codigo"] == "31")
    assert san["politica"] == "Sanidad" and san["area"] == "Bienes públicos preferentes"


def test_parse_html_links_and_hidden():
    p = fd.parse_html('<form><input type="hidden" name="__VIEWSTATE" value="abc"></form>'
                      '<a href="/x/entregas-a-cuenta-2026.xlsx">Excel</a>')
    assert p.hidden == {"__VIEWSTATE": "abc"}
    assert p.links == [("/x/entregas-a-cuenta-2026.xlsx", "Excel")]
