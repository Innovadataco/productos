"""Canonicaliza SQL con sqlglot para que el jurado compare AST, no strings.
Trata como iguales: whitespace, comentarios, orden de predicados AND,
alias opcionales, WHERE 1=1 AND a=1 vs WHERE a=1.
NO trata como iguales: IN(1,2) vs a=1 OR a=2."""
from __future__ import annotations

from typing import Iterable

from sqlglot import exp, parse_one
from sqlglot.optimizer.simplify import simplify


class CanonizadorError(ValueError):
    pass


def _flatten_and(node: exp.Expression) -> list[exp.Expression]:
    if isinstance(node, exp.And):
        return _flatten_and(node.this) + _flatten_and(node.expression)
    return [node]


def _rebuild_and(operandos: Iterable[exp.Expression]) -> exp.Expression:
    ops = list(operandos)
    if not ops:
        return exp.true()
    result: exp.Expression = ops[0]
    for op in ops[1:]:
        result = exp.And(this=result, expression=op)
    return result


def _sort_and(node: exp.Expression) -> exp.Expression:
    if isinstance(node, exp.And):
        operandos = _flatten_and(node)
        operandos = [o for o in operandos if not (isinstance(o, exp.EQ) and o.sql() == "1 = 1")]
        operandos.sort(key=lambda o: o.sql())
        return _rebuild_and(operandos)
    return node


def canonicalizar(sql: str) -> str:
    if not isinstance(sql, str) or not sql.strip():
        raise CanonizadorError("sql_vacio")
    try:
        tree = parse_one(sql, read="postgres")
    except Exception as e:
        raise CanonizadorError(f"parse_error:{e}") from e
    try:
        tree = simplify(tree)
    except Exception:
        pass
    tree = tree.transform(_sort_and)
    return tree.sql(dialect="postgres", pretty=False, normalize=True)
