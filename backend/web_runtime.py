"""Serve the static browser application and its authenticated API in one worker."""
import hashlib
import hmac
import json
import os
import socket
import time
from contextlib import ExitStack
from datetime import date
from urllib.parse import urlencode

import jwt
import uvicorn
from fastapi import Body, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import ValidationError
from starlette.staticfiles import StaticFiles

import main as api


public = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
SESSION_SECONDS = 8 * 3600
MAX_BODY = 50 * 1024 * 1024
WEB_ROOT = os.environ.get("ROOTARA_WEB_ROOT", "/opt/rootara/web")
OPEN_PATHS = {"/login", "/login.txt", "/login.html", "/health", "/health/live", "/health/ready",
              "/api/auth/login", "/api/auth/logout"}


def session(request):
    token = request.cookies.get("auth_token")
    if token:
        try:
            return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"],
                              options={"require": ["exp", "iat"]})
        except jwt.InvalidTokenError:
            pass
    return None


def require_session(request: Request):
    if not request.state.user:
        raise HTTPException(401, "Unauthorized")
    return request.state.user


# Reuse the private handlers with cookie authentication on the public listener.
public.dependency_overrides[api.verify_api_key] = require_session


@public.post("/api/auth/login")
async def login(request: Request, credentials: dict):
    email = os.environ["ADMIN_EMAIL"]
    password = credentials.get("password")
    if not isinstance(password, str) or not hmac.compare_digest(
        hashlib.sha256(password.encode()).digest(),
        hashlib.sha256(os.environ["ADMIN_PASSWORD"].encode()).digest(),
    ) or credentials.get("email") != email:
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)
    user = {"email": email, "name": email.split("@", 1)[0] or "Admin"}
    now = int(time.time())
    token = jwt.encode({**user, "iat": now, "exp": now + SESSION_SECONDS},
                       os.environ["JWT_SECRET"], algorithm="HS256")
    response = JSONResponse(user)
    secure = request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https"
    response.set_cookie("auth_token", token, max_age=SESSION_SECONDS, httponly=True,
                        secure=secure, samesite="strict" if secure else "lax")
    return response


@public.post("/api/auth/logout")
async def logout():
    response = JSONResponse({"success": True})
    response.delete_cookie("auth_token", httponly=True)
    return response


@public.get("/api/auth/me")
async def me(request: Request):
    return require_session(request)


@public.get("/health/live")
async def live():
    return {"status": "alive", "timestamp": int(time.time() * 1000)}


@public.get("/health/ready")
async def ready():
    result = await api.readiness_check()
    if isinstance(result, Response):
        return JSONResponse({"status": "not_ready", "backend": json.loads(result.body)}, status_code=503)
    return {"status": "ready", "backend": result}


@public.get("/health")
async def health():
    result = await api.health_check()
    payload = json.loads(result.body)
    return JSONResponse({"status": "healthy" if result.status_code == 200 else "degraded",
                         "version": api.app.version, "backend": payload,
                         "traitCatalog": payload.get("checks", {}).get("trait_catalog")},
                        status_code=result.status_code)


for path, method, handler in (
    ("/imports/{job}", "GET", api.import_status),
    ("/reports/{report_id}/dashboard", "GET", api.dashboard),
    ("/reports/{report_id}/traits/results", "GET", api.api_get_trait_results),
    ("/traits/catalog", "GET", api.api_get_trait_catalog),
    ("/user/id", "POST", api.api_get_user_id),
    ("/report/all", "POST", api.api_get_all_report_info),
    ("/report/create", "POST", api.api_create_new_report),
    ("/report/delete", "POST", api.api_delete_report),
    ("/report/table", "POST", api.api_get_table_data),
    ("/report/clinvar", "POST", api.api_get_clinvar_data),
):
    public.add_api_route("/api" + path, handler, methods=[method])
public.add_api_route("/api/imports/{job}", api.submit_import, methods=["POST"], status_code=202)


@public.api_route("/api/report/{report_id}/rawdata", methods=["GET", "POST"])
async def rawdata(report_id: str):
    result = await api.api_export_rawdata(report_id)
    result.headers["content-type"] = "application/octet-stream"
    result.headers["cache-control"] = "no-store"
    return result


@public.post("/api/report/info")
async def report_info(reportId: str = Body(embed=True)):
    return await api.api_get_report_info(reportId)


@public.post("/api/report/default")
async def default_report(report_id: str = Body(embed=True)):
    return await api.api_set_default_report(report_id)


@public.post("/api/report/rename")
async def rename(report_id: str = Body(), new_name: str = Body()):
    return await api.api_update_report_name(report_id, new_name)


@public.post("/api/ancestry/admixture")
async def ancestry(reportId: str = Body(embed=True)):
    return await api.api_get_admixture_info(reportId)


@public.post("/api/ancestry/haplogroup")
async def haplogroup(reportId: str = Body(embed=True)):
    return await api.api_get_haplogroup_info(reportId)


@public.post("/api/report/clinvar-summary")
def clinvar_summary(reportId: str = Body(embed=True)):
    return api.api_get_clinvar_data(api.ClinvarQueryInput(report_id=reportId, summary=True))


@public.post("/api/variant/rsid")
async def variant(rsid: str = Body(), reportId: str = Body()):
    return await api.api_get_snp_info_by_rsid(api.RsidInput(rsid=[rsid], report_id=reportId))


@public.post("/api/traits/info")
async def trait_info(request: Request):
    try:
        report = (await request.json()).get("report_id")
    except (ValueError, AttributeError):
        report = request.query_params.get("report_id")
    if not report:
        return JSONResponse({"error": "report_id is required"}, status_code=400)
    return await api.api_get_traits_info(report)


@public.post("/api/traits/delete")
async def delete_trait(traits_id: str = Body(embed=True)):
    return await api.api_delete_trait(traits_id)


@public.post("/api/traits/add")
async def add_trait(traitData: dict = Body(embed=True)):
    data = dict(traitData)
    for key in ("name", "description", "scoreThresholds", "result"):
        if key in data and not isinstance(data[key], str):
            data[key] = json.dumps(data[key], ensure_ascii=False)
    for key, default in (("icon", "AlertCircle"), ("confidence", "medium"), ("category", "appearance"),
                         ("rsids", []), ("formula", "")):
        data[key] = data.get(key) or default
    refs = data.get("reference", [])
    data["reference"] = [part.strip() for ref in refs for part in ref.split(",")] if (
        isinstance(refs, list) and all(isinstance(ref, str) for ref in refs)) else []
    try:
        trait = api.TraitInput.model_validate(data)
    except ValidationError:
        raise HTTPException(422, "Invalid trait")
    return await api.api_add_trait(trait)


@public.post("/api/traits/import")
async def import_traits(input_data: str = Body(embed=True)):
    try:
        traits = api.TraitImportRequest.model_validate_json(input_data)
    except ValidationError:
        return JSONResponse({"error": "Expected a JSON array of traits"}, status_code=400)
    return await api.api_import_trait(traits)


@public.post("/api/traits/export")
async def export_traits():
    traits = await api.api_export_trait()
    return Response(traits.model_dump_json(indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="traits-export-{date.today()}.json"'})


public.add_api_route("/api/traits/{trait_id}", api.api_get_trait_detail, methods=["GET"])


class ExportedPages(StaticFiles):
    async def get_response(self, path, scope):
        if path in {".", ""}:
            path = "index.html"
        elif path.startswith("analysis/traits/") and path.count("/") == 2 and path.rsplit("/", 1)[1] not in {
            "detail", "detail.html", "detail.txt",
        }:
            return RedirectResponse("/analysis/traits/detail?" + urlencode({"id": path.rsplit("/", 1)[1]}))
        elif "." not in path.rsplit("/", 1)[-1]:
            path += ".html"
        result = await super().get_response(path, scope)
        result.headers["cache-control"] = ("public, max-age=31536000, immutable" if path.startswith("_next/static/")
                                           else "private, no-cache")
        return result


public.mount("/", ExportedPages(directory=WEB_ROOT, check_dir=False))


async def application(scope, receive, send):
    # Select by the actual bound socket. The Host and forwarding headers do
    # not decide which API the caller reaches. Initialize the shared queue once.
    if scope["type"] == "lifespan" or scope["server"][1] == 8000:
        return await api.app(scope, receive, send)
    if scope["type"] != "http":
        return await public(scope, receive, send)
    request = Request(scope)
    path = scope["path"]
    assets = path.startswith("/_next/static/") or path.endswith((".svg", ".png", ".ico", ".jpg", ".jpeg", ".gif"))
    if ".." in path.split("/"):
        return await Response(status_code=404)(scope, receive, send)
    if assets and not path.startswith("/api/"):
        return await public(scope, receive, send)
    user = session(request)
    scope.setdefault("state", {})["user"] = user
    if path.rstrip("/") == "/login" and user:
        return await RedirectResponse("/")(scope, receive, send)
    if not user and path.rstrip("/") not in OPEN_PATHS:
        response = (JSONResponse({"error": "Unauthorized"}, status_code=401)
                    if path.startswith("/api/") else RedirectResponse("/login"))
        if request.cookies.get("auth_token"):
            response.delete_cookie("auth_token", httponly=True)
        return await response(scope, receive, send)
    if request.method == "POST":
        if int(request.headers.get("content-length", "0")) > MAX_BODY:
            return await JSONResponse({"detail": "Maximum upload size is 50 MiB"}, status_code=413)(scope, receive, send)
        size = 0

        async def limited_receive():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > MAX_BODY:
                raise HTTPException(413, "Maximum upload size is 50 MiB")
            return message

        return await public(scope, limited_receive, send)
    return await public(scope, receive, send)


if __name__ == "__main__":
    with ExitStack() as stack:
        sockets = []
        for host, port in (("0.0.0.0", 3000), ("127.0.0.1", 8000)):
            sock = stack.enter_context(socket.socket())
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            sockets.append(sock)
        uvicorn.Server(uvicorn.Config(application, loop="uvloop", http="httptools")).run(sockets=sockets)
