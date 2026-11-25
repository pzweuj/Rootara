"""Measure one real upload in each fresh, memory-limited local Rootara container."""
import argparse
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
import time
from statistics import median
import urllib.error
import urllib.request
import uuid


TEMPLATE = Path(__file__).resolve().parents[1] / "backend/database/TEMPLATE01.txt"
MONITOR = """
cd /sys/fs/cgroup || exit 1
read limit < memory.max
read swap < memory.swap.max
echo "limits $limit $swap"
pagesize=$(getconf PAGESIZE)
while read current < memory.current; do
    read peak < memory.peak || exit 1
    while read k v; do
        case "$k" in anon) anon=$v;; file) files=$v;; esac
    done < memory.stat
    while read k v; do
        case "$k" in oom_kill) kills=$v;; esac
    done < memory.events
    maxrss=0
    owner=unknown
    for proc in /proc/[0-9]*; do
        read size rss rest 2>/dev/null < "$proc/statm" || continue
        if [ "$rss" -gt "$maxrss" ]; then
            read comm 2>/dev/null < "$proc/comm" || continue
            owner=$comm
            maxrss=$rss
        fi
    done
    while read k v; do
        case "$k" in usage_usec) cpu=$v;; esac
    done < cpu.stat
    echo "$current $peak $anon $files $kills $((maxrss * pagesize)) $owner $cpu"
    sleep 0.5
done
"""


def docker(*args, **kwargs):
    return subprocess.check_output(["docker", *args], text=True, **kwargs).strip()


def trial(image, limit, cpus, download_method="POST", expected_variant_sha256=None):
    name = "rootara-membench-" + uuid.uuid4().hex[:12]
    email, password = "benchmark@example.invalid", secrets.token_urlsafe(27)
    env = dict(os.environ, ADMIN_PASSWORD=password)
    container = docker("run", "-d", "--name", name, "--memory", f"{limit}m",
                       "--memory-swap", f"{limit}m", "--cpus", str(cpus),
                       "-p", "127.0.0.1::3000", "-e", f"ADMIN_EMAIL={email}",
                       "-e", "ADMIN_PASSWORD", "-e", "ROOTARA_EXPECTED_TRAIT_COUNT=152",
                       "-e", "ROOTARA_REQUIRE_CURATED_CATALOG=1", image, env=env)
    samples, limits = [], []
    phase = "startup"
    out = {"limit_mib": limit, "cpus": cpus, "image": image}
    monitor = None
    print(f"{limit} MiB: starting fresh container", file=sys.stderr, flush=True)

    def collect():
        for line in monitor.stdout:
            if line.startswith("limits "):
                limits.extend(map(int, line.split()[1:]))
            else:
                current, peak, anon, files, kills, rss, rest = line.strip().split(" ", 6)
                owner, cpu = rest.rsplit(" ", 1)
                samples.append((phase, int(current), int(peak), int(anon),
                                int(files), int(kills), int(rss), owner, int(cpu)))

    try:
        base = "http://" + docker("port", container, "3000/tcp")
        monitor = subprocess.Popen(["docker", "exec", container, "sh", "-c", MONITOR],
                                   stdout=subprocess.PIPE, text=True)
        reader = threading.Thread(target=collect, daemon=True)
        reader.start()
        client = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                     urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def request(path, body=None, headers=None, method=None, raw=False):
            req = urllib.request.Request(base + path, data=body, headers=headers or {}, method=method)
            with client.open(req, timeout=30) as res:
                return res.read() if raw else json.load(res)

        def state():
            return json.loads(docker("inspect", "--format", "{{json .State}}", container))

        start = time.monotonic()
        for _ in range(240):
            try:
                if request("/health/ready")["status"] == "ready":
                    break
            except (OSError, urllib.error.URLError):
                if not state()["Running"]:
                    raise RuntimeError("container exited during startup")
            time.sleep(1)
        else:
            raise RuntimeError("startup timed out")
        out["ready_s"] = round(time.monotonic() - start, 2)
        request("/api/auth/login", json.dumps(dict(email=email, password=password)).encode(),
                {"Content-Type": "application/json"})
        phase = "idle_before"
        time.sleep(30)
        assert samples and limits == [limit * 1048576, 0], f"invalid instrumentation: {limits}"
        out["idle_bytes"] = samples[-1][1]
        cpu_start = samples[-1][8]
        phase = "upload"
        started = time.monotonic()
        job = "/api/imports/" + str(uuid.uuid4())
        with TEMPLATE.open("rb") as upload:
            request(job + "?source=23andme&name=benchmark", upload,
                    {"Content-Length": str(TEMPLATE.stat().st_size),
                     "Content-Type": "application/octet-stream"})
        while time.monotonic() - started < 600:
            job_state = request(job)
            if job_state["stage"] in ("done", "failed"):
                break
            if phase != job_state["stage"]:
                phase = job_state["stage"]
                print(f"{limit} MiB: {phase}", file=sys.stderr, flush=True)
            time.sleep(0.5)
        else:
            raise RuntimeError("import timed out")
        out["import_s"] = round(time.monotonic() - started, 2)
        out["import_cpu_s"] = round((samples[-1][8] - cpu_start) / 1e6, 2)
        if job_state["stage"] == "failed":
            raise RuntimeError(job_state["error"])
        phase = "verify"
        report = job_state["report_id"]
        summary = request("/api/reports/" + report + "/dashboard")
        raw = request("/api/report/" + report + "/rawdata", method=download_method, raw=True)
        assert hashlib.sha256(raw).digest() == hashlib.sha256(TEMPLATE.read_bytes()).digest()
        assert summary["totalSnps"] > 300000 and all(summary["haplogroups"].get(k) for k in ("y_hap", "mt_hap"))
        estimates = summary["ancestry"]
        assert len(estimates) == 47 and abs(sum(estimates.values()) - 100) <= 0.24
        out.update(snps=summary["totalSnps"], ancestry=estimates,
                   haplogroups=summary["haplogroups"])
        phase = "idle_after"
        time.sleep(30)
        phase = "verify_rows"
        try:
            out["variant_sha256"] = docker(
                "exec", container, "/usr/local/bin/rootara-server", "verify-rows", report
            )
        except subprocess.CalledProcessError:
            out["variant_sha256"] = docker("exec", container, "python", "-c", """
import hashlib, json, sqlite3, sys
from scripts.rootara_table_info import validate_report_table_name
table = validate_report_table_name(sys.argv[1])
digest = hashlib.sha256()
with sqlite3.connect("/data/rootara.db") as db:
    for row in db.execute(f"SELECT * FROM {table} ORDER BY rowid"):
        digest.update(json.dumps(row, separators=(",", ":")).encode() + b'\\n')
print(digest.hexdigest())
""", report)
        if expected_variant_sha256 and out["variant_sha256"] != expected_variant_sha256:
            raise AssertionError("variant rows differ from the expected report digest")
        assert samples[-1][0] in {"idle_after", "verify_rows"}, "resource sampler stopped early"
        out["result"] = "ok"
    except (OSError, RuntimeError, AssertionError) as exc:
        out.update(result="failed", phase_at_failure=phase, error=str(exc))
    finally:
        try:
            status = json.loads(docker("inspect", "--format", "{{json .State}}", container))
            out["docker_oom"] = status["OOMKilled"]
            if not status["Running"]:
                out["exit_code"] = status["ExitCode"]
            if monitor:
                monitor.terminate()
                monitor.wait(timeout=10)
                reader.join(timeout=3)
            for label in dict.fromkeys(row[0] for row in samples):
                group = [row for row in samples if row[0] == label]
                high = max(group, key=lambda row: row[1])
                out.setdefault("phases", {})[label] = dict(sample_bytes=high[1],
                    lifetime_peak_bytes=max(row[2] for row in group), anon_bytes=high[3],
                    file_bytes=high[4], oom_kills=max(row[5] for row in group),
                    largest_rss_bytes=high[6], largest_process=high[7])
                if label.startswith("idle_"):
                    out[label] = {key: int(median(row[i] for row in group))
                                  for key, i in (("current_bytes", 1), ("anon_bytes", 3), ("file_bytes", 4))}
        finally:
            docker("rm", "-f", "-v", container)
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="rootara-local:optimized")
    parser.add_argument("--cpus", type=float, default=2)
    parser.add_argument("--download-method", choices=("POST", "GET"), default="POST",
                        help="use GET to exercise the v2 browser download link")
    parser.add_argument("--expected-variant-sha256", help="compare every report row to a baseline run")
    parser.add_argument("limits", nargs="+", type=int, help="successive container limits in MiB")
    args = parser.parse_args()
    for limit in args.limits:
        print(json.dumps(trial(args.image, limit, args.cpus, args.download_method,
                               args.expected_variant_sha256)), flush=True)
