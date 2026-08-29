"""SPEC-012 · candado 5 · canonicalización AST con sqlglot."""
import pytest

from vanna.canonizador import CanonizadorError, canonicalizar


def test_whitespace_no_afecta():
    a = canonicalizar("SELECT   a  ,  b   FROM t   LIMIT 10")
    b = canonicalizar("SELECT a, b FROM t LIMIT 10")
    assert a == b


def test_orden_and_no_afecta():
    a = canonicalizar("SELECT a FROM t WHERE a = 1 AND b = 2 LIMIT 5")
    b = canonicalizar("SELECT a FROM t WHERE b = 2 AND a = 1 LIMIT 5")
    assert a == b


def test_alias_as_opcional_equivalente():
    a = canonicalizar("SELECT COUNT(*) AS n FROM t LIMIT 1")
    b = canonicalizar("SELECT COUNT(*) n FROM t LIMIT 1")
    assert a == b


def test_where_1_igual_1_and_a_1_equivale_a_where_a_1():
    a = canonicalizar("SELECT a FROM t WHERE 1=1 AND a=1 LIMIT 5")
    b = canonicalizar("SELECT a FROM t WHERE a=1 LIMIT 5")
    assert a == b


def test_in_y_or_no_son_equivalentes():
    a = canonicalizar("SELECT a FROM t WHERE a IN (1,2) LIMIT 5")
    b = canonicalizar("SELECT a FROM t WHERE a=1 OR a=2 LIMIT 5")
    assert a != b


def test_sql_invalido_eleva_error():
    with pytest.raises(CanonizadorError):
        canonicalizar("NOT SQL AT ALL @@@")


def test_sql_vacio_eleva_error():
    with pytest.raises(CanonizadorError):
        canonicalizar("")
