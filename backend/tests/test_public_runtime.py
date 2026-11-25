"""Exercise the public listener, including authentication before body ingestion."""
import time

import jwt
import pytest
from starlette.testclient import TestClient


@pytest.fixture
def gateway(tmp_path, monkeypatch):
    import scripts.runtime_config as config

    for name, path in (("DATA_DIR", tmp_path), ("TEMP_DIR", tmp_path / "temp"),
                       ("RAWDATA_DIR", tmp_path / "rawdata"), ("DB_PATH", tmp_path / "report.db")):
        monkeypatch.setattr(config, name, path)
    monkeypatch.setenv("ROOTARA_API_KEY", "test-internal-key")
    monkeypatch.setenv("ADMIN_EMAIL", "demo@example.invalid")
    monkeypatch.setenv("ADMIN_PASSWORD", "temporary password")
    monkeypatch.setenv("JWT_SECRET", "test-" * 8)
    import web_runtime
    return TestClient(web_runtime.application)


def test_public_listener_requires_a_signed_unexpired_session(gateway):
    path = "/api/auth/me"
    assert gateway.get(path, headers={"Host": "localhost:8000", "X-API-Key": "test-internal-key"}).status_code == 401
    now = int(time.time())
    for secret, expiry in (("another-" * 5, now + 100), ("test-" * 8, now - 1)):
        token = jwt.encode({"iat": now - 20, "exp": expiry}, secret, algorithm="HS256")
        assert gateway.get(path, headers={"Cookie": f"auth_token={token}"}).status_code == 401
    assert gateway.get("/analysis/traits", follow_redirects=False).headers["location"] == "/login"
    response = gateway.post("/api/auth/login", json={"email": "demo@example.invalid", "password": "temporary password"})
    assert response.status_code == 200 and "HttpOnly" in response.headers["set-cookie"]
    assert gateway.get(path).json()["email"] == "demo@example.invalid"
    assert gateway.post("/api/auth/logout").status_code == 200
    assert gateway.get(path).status_code == 401


def test_auth_and_limits_precede_upload_processing(gateway, monkeypatch):
    import web_runtime

    monkeypatch.setattr(web_runtime, "MAX_BODY", 12)
    assert gateway.post("/api/report/create", content=b"x" * 13).status_code == 401
    for body in (b"x" * 13, iter([b"1" * 8, b"2" * 5])):
        response = gateway.post("/api/auth/login", content=body, headers={"Content-Type": "application/json"})
        assert response.status_code == 413
