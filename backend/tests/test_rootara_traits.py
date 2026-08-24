import pytest

from scripts.rootara_traits import InsufficientGeneticData, parse_formula


def test_score_formula_requires_every_declared_genotype():
    with pytest.raises(InsufficientGeneticData):
        parse_formula(
            "SCORE(rs1:AA=10,AG=5,GG=0; rs2:CC=5,CT=3,TT=0)",
            {"rs1": "AA"},
        )


def test_score_formula_rejects_unmapped_genotype():
    with pytest.raises(InsufficientGeneticData):
        parse_formula("SCORE(rs1:AA=10,AG=5,GG=0)", {"rs1": "NN"})


def test_if_formula_does_not_turn_missing_data_into_true():
    with pytest.raises(InsufficientGeneticData):
        parse_formula("IF(rs1:AA=true,GG=false)", {})


def test_body_odor_direction_matches_abcc11_evidence():
    assert parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", {"rs17822931": "TT"}) == 0
    assert parse_formula("SCORE(rs17822931:TT=0,CT=5,CC=10)", {"rs17822931": "CC"}) == 10
