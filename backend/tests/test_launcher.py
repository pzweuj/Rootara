from pathlib import Path

import deploy.launcher as launcher


def test_jwt_secret_is_created_and_reused(tmp_path, monkeypatch):
    secret_path = tmp_path / "config" / "jwt-secret"
    secret_path.parent.mkdir()
    monkeypatch.setattr(launcher, "JWT_SECRET_PATH", secret_path)

    first = launcher._load_or_create_jwt_secret()
    second = launcher._load_or_create_jwt_secret()

    assert len(first) >= 32
    assert first == second
    assert secret_path.stat().st_mode & 0o777 == 0o600


def test_launcher_requires_admin_password(monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    try:
        launcher._require_configuration()
    except RuntimeError as error:
        assert "ADMIN_PASSWORD" in str(error)
    else:
        raise AssertionError("missing ADMIN_PASSWORD must fail startup")
