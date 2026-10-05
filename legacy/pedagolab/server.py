#!/usr/bin/env python3
"""PédagoLab Worlds V7 — FastAPI backend compatible Vercel + Neon.

- Comptes élèves/professeur
- Progression centralisée PostgreSQL/Neon
- Overrides professeur pour decks CODE//STATION et mondes PédagoLab
- Frontend statique servi depuis /public

Variables production:
  DATABASE_URL
  SESSION_SECRET
Variables optionnelles:
  SESSION_TTL_SECONDS
  PIN_PBKDF2_ITERATIONS
  MAX_PROGRESS_BYTES
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
IS_VERCEL = bool(os.environ.get("VERCEL"))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
SESSION_SECRET = os.environ.get("SESSION_SECRET", "").strip()
LOCAL_DB = Path("/tmp/pedagolab-worlds.sqlite3") if IS_VERCEL else ROOT / "data" / "pedagolab-worlds.sqlite3"
if not IS_VERCEL:
    LOCAL_DB.parent.mkdir(parents=True, exist_ok=True)


def env_int(name: str, default: int, *, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = os.environ.get(name)
    try:
        value = int(str(raw).strip()) if raw is not None and str(raw).strip() else default
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


SESSION_TTL_SECONDS = env_int("SESSION_TTL_SECONDS", 43200, minimum=300, maximum=604800)
ITERATIONS = env_int("PIN_PBKDF2_ITERATIONS", 260000, minimum=100000, maximum=2000000)
MAX_PROGRESS_BYTES = env_int("MAX_PROGRESS_BYTES", 2_000_000, minimum=100000, maximum=20_000_000)
if not SESSION_SECRET and not IS_VERCEL:
    SESSION_SECRET = "pedagolab-worlds-local-dev-secret-change-me"

app = FastAPI(title="PédagoLab Worlds API", version="7.1-curriculum")
_schema_lock = threading.Lock()
_schema_ready = False

WORLD_IDS = ["code-station", "bunker", "rocket", "infiltration", "assault"]


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def loads(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def hash_pin(pin: str, salt: Optional[str] = None) -> Dict[str, Any]:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", str(pin).encode(), bytes.fromhex(salt), ITERATIONS)
    return {"salt": salt, "hash": dk.hex(), "iterations": ITERATIONS}


def check_pin(pin: str, salt: str, expected_hash: str, iterations: int) -> bool:
    try:
        dk = hashlib.pbkdf2_hmac("sha256", str(pin).encode(), bytes.fromhex(salt), int(iterations or ITERATIONS)).hex()
        return hmac.compare_digest(dk, expected_hash)
    except Exception:
        return False


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def issue_token(role: str, user_id: str) -> str:
    if not SESSION_SECRET:
        raise RuntimeError("SESSION_SECRET manquant")
    payload = {"role": role, "userId": user_id, "iat": int(time.time()), "exp": int(time.time()) + SESSION_TTL_SECONDS, "nonce": secrets.token_hex(8)}
    body = b64(dumps(payload).encode())
    sig = b64(hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(token: str, role: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not SESSION_SECRET:
        return None
    try:
        body, sig = token.split(".", 1)
        expected = b64(hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(unb64(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        if role and payload.get("role") != role:
            return None
        return payload
    except Exception:
        return None


def bearer(request: Request) -> str:
    raw = request.headers.get("authorization", "")
    return raw[7:] if raw.startswith("Bearer ") else ""


def auth(request: Request, role: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return verify_token(bearer(request), role)


def clean_progress(progress: Any) -> Dict[str, Any]:
    if not isinstance(progress, dict):
        raise ValueError("Progression invalide")
    if len(dumps(progress).encode()) > MAX_PROGRESS_BYTES:
        raise ValueError("Progression trop volumineuse")
    return progress


def normalize_all_overrides(value: Any) -> Dict[str, bool]:
    raw = loads(value, {})
    return {str(k): bool(v) for k, v in raw.items()} if isinstance(raw, dict) else {}


def deck_overrides(value: Any) -> Dict[str, bool]:
    raw = normalize_all_overrides(value)
    return {str(n): bool(raw.get(str(n), False)) for n in range(1, 5)}


def world_overrides(value: Any) -> Dict[str, bool]:
    raw = normalize_all_overrides(value)
    return {wid: bool(raw.get(f"world:{wid}", False)) for wid in WORLD_IDS}


@contextmanager
def db_conn():
    if DATABASE_URL:
        import psycopg
        from psycopg.rows import dict_row
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(LOCAL_DB, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def sql(q: str) -> str:
    return q.replace("?", "%s") if DATABASE_URL else q


def one(conn, q: str, params: Iterable[Any] = ()) -> Optional[Dict[str, Any]]:
    row = conn.execute(sql(q), tuple(params)).fetchone()
    return dict(row) if row is not None else None


def rows(conn, q: str, params: Iterable[Any] = ()) -> list[Dict[str, Any]]:
    return [dict(r) for r in conn.execute(sql(q), tuple(params)).fetchall()]


def execute(conn, q: str, params: Iterable[Any] = ()):
    return conn.execute(sql(q), tuple(params))


def init_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        stmts = [
            """CREATE TABLE IF NOT EXISTS teacher_config(id INTEGER PRIMARY KEY,pin_salt TEXT NOT NULL,pin_hash TEXT NOT NULL,iterations INTEGER NOT NULL,created_at TEXT NOT NULL)""",
            """CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,pin_salt TEXT NOT NULL,pin_hash TEXT NOT NULL,iterations INTEGER NOT NULL,override_decks TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,last_login_at TEXT)""",
            """CREATE TABLE IF NOT EXISTS student_progress(student_id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)",
        ]
        with db_conn() as conn:
            for stmt in stmts:
                execute(conn, stmt)
        _schema_ready = True


def teacher_record():
    init_schema()
    with db_conn() as conn:
        return one(conn, "SELECT * FROM teacher_config WHERE id=1")


def student_by_username(username: str):
    init_schema()
    with db_conn() as conn:
        return one(conn, "SELECT * FROM students WHERE username=?", (username,))


def student_by_id(student_id: str):
    init_schema()
    with db_conn() as conn:
        return one(conn, "SELECT * FROM students WHERE id=?", (student_id,))


def get_progress(student_id: str):
    init_schema()
    with db_conn() as conn:
        row = one(conn, "SELECT payload FROM student_progress WHERE student_id=?", (student_id,))
    return loads(row["payload"], None) if row else None


def public_student(s: Dict[str, Any], progress=None):
    return {"id": s["id"], "username": s["username"], "displayName": s["display_name"], "overrideDecks": deck_overrides(s.get("override_decks")), "worldOverrides": world_overrides(s.get("override_decks")), "createdAt": s.get("created_at"), "updatedAt": s.get("updated_at"), "progress": progress}


def error(message: str, status=400):
    return JSONResponse({"error": message}, status_code=status, headers={"Cache-Control": "no-store"})


def ok(payload: Dict[str, Any], status=200):
    return JSONResponse(payload, status_code=status, headers={"Cache-Control": "no-store"})


@app.middleware("http")
async def config_guard(request: Request, call_next):
    if request.url.path.startswith("/api"):
        if IS_VERCEL and not DATABASE_URL:
            return error("DATABASE_URL manquant. Connecte Neon/PostgreSQL au projet Vercel.", 503)
        if IS_VERCEL and not SESSION_SECRET:
            return error("SESSION_SECRET manquant.", 503)
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/status")
def api_status():
    try:
        init_schema()
        with db_conn() as conn:
            teacher = one(conn, "SELECT id FROM teacher_config WHERE id=1")
            count = one(conn, "SELECT COUNT(*) n FROM students")
        return ok({"pedagoLabServer": True, "codeStationServer": True, "version": "7.0", "storage": "postgres" if DATABASE_URL else "sqlite", "teacherConfigured": bool(teacher), "students": int(count["n"] if count else 0), "worlds": WORLD_IDS})
    except Exception as exc:
        return error(f"Stockage indisponible: {exc}", 503)


@app.post("/api/teacher/setup")
async def teacher_setup(request: Request):
    data = await request.json(); pin = str(data.get("pin", ""))
    if len(pin) < 4: return error("PIN trop court")
    if teacher_record(): return error("Espace professeur déjà initialisé", 409)
    rec = hash_pin(pin)
    with db_conn() as conn:
        execute(conn, "INSERT INTO teacher_config(id,pin_salt,pin_hash,iterations,created_at) VALUES(1,?,?,?,?)", (rec["salt"], rec["hash"], rec["iterations"], now()))
    return ok({"ok": True})


@app.post("/api/login/teacher")
async def login_teacher(request: Request):
    data = await request.json(); teacher = teacher_record()
    if not teacher or not check_pin(str(data.get("pin", "")), teacher["pin_salt"], teacher["pin_hash"], teacher["iterations"]): return error("PIN professeur incorrect", 401)
    return ok({"token": issue_token("teacher", "teacher"), "user": {"id": "teacher", "displayName": "Professeur", "role": "teacher"}})


@app.post("/api/login/student")
async def login_student(request: Request):
    data = await request.json(); username = str(data.get("username", "")).strip().lower(); s = student_by_username(username)
    if not s or not check_pin(str(data.get("pin", "")), s["pin_salt"], s["pin_hash"], s["iterations"]): return error("Identifiant ou code incorrect", 401)
    stamp = now()
    with db_conn() as conn: execute(conn, "UPDATE students SET last_login_at=?,updated_at=? WHERE id=?", (stamp, stamp, s["id"]))
    return ok({"token": issue_token("student", s["id"]), "user": {"id": s["id"], "username": s["username"], "displayName": s["display_name"], "role": "student"}, "overrideDecks": deck_overrides(s.get("override_decks")), "worldOverrides": world_overrides(s.get("override_decks")), "progress": get_progress(s["id"])})


@app.get("/api/me/access")
def me_access(request: Request):
    sess = auth(request, "student")
    if not sess: return error("Session élève requise", 401)
    s = student_by_id(sess["userId"])
    if not s: return error("Compte introuvable", 404)
    return ok({"overrideDecks": deck_overrides(s.get("override_decks")), "worldOverrides": world_overrides(s.get("override_decks"))})


@app.post("/api/progress")
async def save_progress(request: Request):
    sess = auth(request, "student")
    if not sess: return error("Session élève requise", 401)
    data = await request.json()
    try: progress = clean_progress(data.get("progress"))
    except ValueError as exc: return error(str(exc))
    stamp = now(); progress["updatedAt"] = stamp; raw = dumps(progress); init_schema()
    with db_conn() as conn:
        if DATABASE_URL:
            execute(conn, "INSERT INTO student_progress(student_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at", (sess["userId"], raw, stamp))
        else:
            execute(conn, "INSERT INTO student_progress(student_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", (sess["userId"], raw, stamp))
        execute(conn, "UPDATE students SET updated_at=? WHERE id=?", (stamp, sess["userId"]))
    return ok({"ok": True, "updatedAt": stamp})


def save_progress_for_student(student_id: str, progress: Dict[str, Any]) -> str:
    progress = clean_progress(progress)
    stamp = now()
    progress["updatedAt"] = stamp
    raw = dumps(progress)
    init_schema()
    with db_conn() as conn:
        if DATABASE_URL:
            execute(conn, "INSERT INTO student_progress(student_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at", (student_id, raw, stamp))
        else:
            execute(conn, "INSERT INTO student_progress(student_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", (student_id, raw, stamp))
        execute(conn, "UPDATE students SET updated_at=? WHERE id=?", (stamp, student_id))
    return stamp


@app.post("/api/teacher/students/{student_id}/evidence")
async def add_teacher_evidence(student_id: str, request: Request):
    if not auth(request, "teacher"):
        return error("Accès professeur requis", 401)
    if not student_by_id(student_id):
        return error("Élève introuvable", 404)
    data = await request.json()
    criterion = str(data.get("criterion", "")).strip().upper()
    if not criterion or not __import__("re").match(r"^(BC|BCT)\d{2}-C\d+-\d+$", criterion):
        return error("Critère invalide")
    try:
        score = int(data.get("score"))
    except Exception:
        return error("Score invalide")
    if score not in (0, 1, 2, 3):
        return error("Le score doit être compris entre 0 et 3")
    ev_type = str(data.get("type", "observation")).strip()[:40] or "observation"
    note = str(data.get("note", "")).strip()[:800]
    evaluation_id = str(data.get("evaluationId", "")).strip()[:40]
    ev_date = str(data.get("date", "")).strip()[:10] or now()[:10]
    transfer = bool(data.get("transfer"))
    progress = get_progress(student_id) or {}
    platform = progress.setdefault("platform", {})
    evidence = platform.setdefault("evidence", [])
    item = {
        "id": "ev_" + secrets.token_hex(8),
        "criterion": criterion,
        "score": score,
        "type": ev_type,
        "note": note,
        "evaluationId": evaluation_id,
        "date": ev_date,
        "transfer": transfer,
        "source": "teacher",
        "createdAt": now(),
    }
    evidence.append(item)
    save_progress_for_student(student_id, progress)
    return ok({"ok": True, "evidence": item, "progress": progress})


@app.delete("/api/teacher/students/{student_id}/evidence/{evidence_id}")
def delete_teacher_evidence(student_id: str, evidence_id: str, request: Request):
    if not auth(request, "teacher"):
        return error("Accès professeur requis", 401)
    if not student_by_id(student_id):
        return error("Élève introuvable", 404)
    progress = get_progress(student_id) or {}
    platform = progress.setdefault("platform", {})
    evidence = platform.setdefault("evidence", [])
    before = len(evidence)
    platform["evidence"] = [e for e in evidence if str(e.get("id")) != evidence_id]
    if len(platform["evidence"]) == before:
        return error("Preuve introuvable", 404)
    save_progress_for_student(student_id, progress)
    return ok({"ok": True})


@app.get("/api/teacher/students")
def teacher_students(request: Request):
    if not auth(request, "teacher"): return error("Accès professeur requis", 401)
    init_schema()
    with db_conn() as conn:
        ss = rows(conn, "SELECT * FROM students ORDER BY display_name,username")
        pp = rows(conn, "SELECT student_id,payload FROM student_progress")
    pm = {r["student_id"]: loads(r["payload"], None) for r in pp}
    return ok({"students": [public_student(s, pm.get(s["id"])) for s in ss]})


@app.post("/api/teacher/students")
async def create_student(request: Request):
    if not auth(request, "teacher"): return error("Accès professeur requis", 401)
    data = await request.json(); display = str(data.get("displayName", "")).strip()[:40]; username = str(data.get("username", "")).strip().lower()[:32]; pin = str(data.get("pin", ""))
    if not display or not username or len(pin) < 4: return error("Nom, identifiant et code (4+) requis")
    if not all(c.isalnum() or c in "._-" for c in username): return error("Identifiant invalide")
    rec=hash_pin(pin); sid="stu_"+secrets.token_hex(8); stamp=now(); overrides=dumps({str(n):False for n in range(1,5)})
    try:
        with db_conn() as conn: execute(conn, "INSERT INTO students(id,username,display_name,pin_salt,pin_hash,iterations,override_decks,created_at,updated_at,last_login_at) VALUES(?,?,?,?,?,?,?,?,?,NULL)", (sid,username,display,rec["salt"],rec["hash"],rec["iterations"],overrides,stamp,stamp))
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower(): return error("Identifiant déjà utilisé", 409)
        raise
    return ok({"student": public_student(student_by_id(sid), None)}, 201)


@app.post("/api/teacher/students/{student_id}/overrides")
async def set_deck_override(student_id: str, request: Request):
    if not auth(request, "teacher"): return error("Accès professeur requis", 401)
    data=await request.json()
    try: deck=int(data.get("deck"))
    except Exception: return error("Deck invalide")
    if deck not in (1,2,3,4): return error("Deck invalide")
    s=student_by_id(student_id)
    if not s: return error("Élève introuvable",404)
    ov=normalize_all_overrides(s.get("override_decks")); ov[str(deck)]=bool(data.get("value"))
    with db_conn() as conn: execute(conn,"UPDATE students SET override_decks=?,updated_at=? WHERE id=?",(dumps(ov),now(),student_id))
    return ok({"ok":True,"overrideDecks":deck_overrides(ov),"worldOverrides":world_overrides(ov)})


@app.post("/api/teacher/students/{student_id}/world-overrides")
async def set_world_override(student_id: str, request: Request):
    if not auth(request, "teacher"): return error("Accès professeur requis",401)
    data=await request.json(); world_id=str(data.get("worldId", ""))
    if world_id not in WORLD_IDS: return error("Monde invalide")
    s=student_by_id(student_id)
    if not s: return error("Élève introuvable",404)
    ov=normalize_all_overrides(s.get("override_decks")); ov[f"world:{world_id}"]=bool(data.get("value"))
    with db_conn() as conn: execute(conn,"UPDATE students SET override_decks=?,updated_at=? WHERE id=?",(dumps(ov),now(),student_id))
    return ok({"ok":True,"overrideDecks":deck_overrides(ov),"worldOverrides":world_overrides(ov)})


@app.post("/api/teacher/students/{student_id}/pin")
async def reset_pin(student_id: str, request: Request):
    if not auth(request, "teacher"): return error("Accès professeur requis",401)
    data=await request.json(); pin=str(data.get("pin", ""))
    if len(pin)<4: return error("Code trop court")
    if not student_by_id(student_id): return error("Élève introuvable",404)
    rec=hash_pin(pin)
    with db_conn() as conn: execute(conn,"UPDATE students SET pin_salt=?,pin_hash=?,iterations=?,updated_at=? WHERE id=?",(rec["salt"],rec["hash"],rec["iterations"],now(),student_id))
    return ok({"ok":True})


@app.post("/api/teacher/students/{student_id}/reset-progress")
def reset_progress(student_id: str, request: Request):
    if not auth(request,"teacher"): return error("Accès professeur requis",401)
    if not student_by_id(student_id): return error("Élève introuvable",404)
    with db_conn() as conn:
        execute(conn,"DELETE FROM student_progress WHERE student_id=?",(student_id,)); execute(conn,"UPDATE students SET updated_at=? WHERE id=?",(now(),student_id))
    return ok({"ok":True})


@app.get("/api")
def api_root():
    return ok({"service":"PédagoLab Worlds","version":"7.1-curriculum","worlds":WORLD_IDS})


def safe_public(path: str) -> Optional[Path]:
    candidate = (PUBLIC / path).resolve()
    try:
        candidate.relative_to(PUBLIC.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


@app.get("/", include_in_schema=False)
def frontend_root():
    p = PUBLIC / "index.html"
    return FileResponse(p, media_type="text/html") if p.exists() else error("Frontend introuvable",500)


@app.get("/{path:path}", include_in_schema=False)
def frontend_files(path: str):
    if path.startswith("api/"):
        return JSONResponse({"detail":"Not Found"},status_code=404)
    p = safe_public(path)
    if not p:
        return JSONResponse({"detail":"Not Found"},status_code=404)
    media = "text/html" if p.suffix==".html" else None
    return FileResponse(p, media_type=media)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=os.environ.get("HOST","127.0.0.1"), port=env_int("PORT",8765,minimum=1,maximum=65535), reload=False)
