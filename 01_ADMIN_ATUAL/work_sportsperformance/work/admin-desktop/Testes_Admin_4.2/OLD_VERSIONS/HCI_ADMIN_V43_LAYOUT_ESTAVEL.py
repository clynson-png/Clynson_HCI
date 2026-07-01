import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import threading
import webbrowser
import sys
import base64
from math import sqrt
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# VERSION: 4.3 layout + v3.4 motores conectados - ajustes TargetScan e exclusao
ROOT = os.path.dirname(os.path.abspath(__file__))
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
PACKAGE = "com.example.sportsperformance"
PORT = 8768
PRIMARY_RUNTIME_SITE_PACKAGES = os.path.expandvars(
    r"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages"
)
if os.path.isdir(PRIMARY_RUNTIME_SITE_PACKAGES) and PRIMARY_RUNTIME_SITE_PACKAGES not in sys.path:
    sys.path.append(PRIMARY_RUNTIME_SITE_PACKAGES)

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


def run_adb(args, *, capture=True, input_bytes=None):
    return subprocess.run([ADB, *args], input=input_bytes, capture_output=capture, check=True)


def copy_app_database():
    tmp = tempfile.mkdtemp(prefix="hci-admin-db-")
    db_path = os.path.join(tmp, "sports_performance_db")
    for suffix in ["", "-wal", "-shm"]:
        remote = f"databases/sports_performance_db{suffix}"
        local = os.path.join(tmp, f"sports_performance_db{suffix}")
        try:
            result = run_adb(["exec-out", "run-as", PACKAGE, "cat", remote], capture=True)
            with open(local, "wb") as fh:
                fh.write(result.stdout)
        except subprocess.CalledProcessError:
            if suffix == "":
                raise
    return tmp, db_path


def push_database(tmp):
    run_adb(["shell", "am", "force-stop", PACKAGE], capture=True)
    for suffix in ["", "-wal", "-shm"]:
        local = os.path.join(tmp, f"sports_performance_db{suffix}")
        if os.path.exists(local):
            remote_tmp = f"/data/local/tmp/sports_performance_db{suffix}"
            run_adb(["push", local, remote_tmp], capture=True)
            run_adb(["shell", "run-as", PACKAGE, "cp", remote_tmp, f"databases/sports_performance_db{suffix}"], capture=True)
            run_adb(["shell", "rm", "-f", remote_tmp], capture=True)


def rows_as_dicts(cur, query, params=()):
    cur.execute(query, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def split_numbers(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    return [float(part) for part in str(value).split(",") if part.strip()]


def avg(values):
    clean = [float(v) for v in values if v is not None]
    return sum(clean) / len(clean) if clean else 0.0


def median(values):
    clean = sorted([float(v) for v in values if v is not None])
    if not clean:
        return 0.0
    n = len(clean)
    return clean[n // 2] if n % 2 == 1 else (clean[n // 2 - 1] + clean[n // 2]) / 2.0


def stdev(values):
    clean = [float(v) for v in values if v is not None]
    if len(clean) < 2:
        return 0.0
    baseline = median(clean)
    return sqrt(sum((v - baseline) ** 2 for v in clean) / len(clean))


def limit010(value):
    return max(0.0, min(10.0, float(value)))


def score_level(score, lang="PT"):
    if score >= 9:
        return "ELITE"
    if score >= 7:
        return "HIGH PERFORMANCE" if lang == "EN" else "ALTO RENDIMENTO"
    if score >= 5:
        return "INTERMEDIATE" if lang == "EN" else "INTERMEDIARIO"
    return "BEGINNER" if lang == "EN" else "INICIANTE"


def series_order(value):
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return int(digits or 0)


def max_sequence(shots, predicate):
    best = 0
    current = 0
    for shot in shots:
        if predicate(shot):
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def sequence_stats(shots, predicate):
    max_len = 0
    count = 0
    current = 0
    for shot in shots:
        if predicate(shot):
            current += 1
            max_len = max(max_len, current)
        else:
            if current >= 3:
                count += 1
            current = 0
    if current >= 3:
        count += 1
    return {"count": count, "maxLen": max_len}


def calculate_resilience(series_totals):
    if len(series_totals) < 2:
        return 7.0
    improvements = sum(1 for idx in range(1, len(series_totals)) if series_totals[idx] > series_totals[idx - 1])
    return limit010(5.0 + improvements * 1.0)


def calculate_group_penalty(group):
    size = len(group)
    has_error = "ERRO" in group
    if size >= 3:
        return 2.0 if has_error else 1.2
    if size == 2:
        return 1.0 if has_error else 0.6
    return 0.5 if has_error else 0.2


def calculate_emotional_score(shots, med_tiro, is_rifle):
    base = med_tiro if med_tiro is not None else (10.0 if is_rifle else 9.0)
    penalty = 0.0
    group = []
    for shot in shots:
        if is_rifle:
            label = "LIMPO" if shot >= base else ("ALERTA" if shot >= base - 0.2 else "ERRO")
        else:
            label = "LIMPO" if shot >= base else ("ALERTA" if shot >= base - 1.0 else "ERRO")
        if label == "LIMPO":
            if group:
                penalty += calculate_group_penalty(group)
                group = []
        else:
            group.append(label)
    if group:
        penalty += calculate_group_penalty(group)
    return max(3.0, limit010(10.0 - penalty))


def calculate_physical_degradation(shots):
    if len(shots) < 40:
        return 0
    half = len(shots) // 2
    return 2 if median(shots[half:]) < median(shots[:half]) - 0.2 else 0


def hci_engine_scores(rows, athlete_rows):
    sorted_rows = sorted(rows, key=lambda r: series_order(r.get("serie")))
    valid_rows = []
    for row in sorted_rows:
        valid_rows.append(row)
        if str(row.get("statusEvento", "")).upper() == "FINAL":
            break

    all_shots = [shot for row in valid_rows for shot in split_numbers(row.get("tiros"))]
    series_totals = [sum(split_numbers(row.get("tiros"))) for row in valid_rows]
    prova = valid_rows[0].get("prova") if valid_rows else "PISTOL"
    is_rifle = "RIFLE" in str(prova).upper() or "CARABINA" in str(prova).upper()

    seq910 = sequence_stats(all_shots, lambda shot: shot >= 9.0)
    seq10 = sequence_stats(all_shots, lambda shot: shot >= 10.0)
    process_score = limit010(((seq910["maxLen"] * min(seq910["count"], 2)) / 60.0) * 10.0)
    deepening_score = limit010((seq10["maxLen"] / 7.0) * 10.0)
    amplitude = (max(series_totals) - min(series_totals)) if series_totals else 0.0
    consistency_score = limit010(10.0 - (amplitude * 0.7))

    rhythm_std = stdev(all_shots)
    rhythm_baseline = median(all_shots)
    drops = [shot for shot in all_shots if shot < rhythm_baseline - 1.5]
    drop_count = len(drops)
    rhythm_score = limit010(10.0 - (rhythm_std * 2.5))
    total_evento = sum(series_totals)
    outcome_reference = 632.0 if is_rifle else 578.0

    athlete_comp = [r for r in athlete_rows if str(r.get("sessao", "")).upper() == "COMPETICAO"]
    athlete_sim = [r for r in athlete_rows if str(r.get("sessao", "")).upper() == "SIMULADO"]

    def grouped_event_totals(items):
        grouped = {}
        for item in items:
            key = f"{item.get('evento')}|{item.get('atleta')}"
            grouped.setdefault(key, 0.0)
            grouped[key] += sum(split_numbers(item.get("tiros")))
        return list(grouped.values())

    med_competicoes = avg(grouped_event_totals(athlete_comp)) if athlete_comp else None
    med_simulados = avg(grouped_event_totals(athlete_sim)) if athlete_sim else None
    med_tiro_sim_treino = median(all_shots) if all_shots else (10.0 if is_rifle else 9.0)

    outcome_score = (
        limit010(((med_competicoes / outcome_reference) * 10.0 - 9.0) * 10.0)
        if med_competicoes is not None
        else limit010(((total_evento / outcome_reference) * 10.0 - 9.0) * 10.0)
    )
    transfer_score = limit010((total_evento / med_simulados) * 10.0) if med_simulados and med_simulados > 0 else 0.0
    resilience_score = calculate_resilience(series_totals)
    pressure_load_evento = rhythm_std + (drop_count * 0.1)
    pressure_score = limit010(7.0 + abs(pressure_load_evento - 1.2) * 3.0) if pressure_load_evento <= 1.2 else limit010(7.0 - (pressure_load_evento - 1.2) * 3.0)
    emotional_score = calculate_emotional_score(all_shots, med_tiro_sim_treino, is_rifle)
    physical_score = limit010(10.0 - calculate_physical_degradation(all_shots))

    overall = round(
        (
            outcome_score * 0.40
            + process_score * 0.10
            + rhythm_score * 0.10
            + deepening_score * 0.05
            + consistency_score * 0.10
            + transfer_score * 0.05
            + resilience_score * 0.05
            + pressure_score * 0.05
            + physical_score * 0.05
            + (emotional_score / 10.0) * 0.05
        ) * 100
    ) / 100.0

    return {
        "OUTCOME": outcome_score,
        "PROCESS": process_score,
        "RHYTHM": rhythm_score,
        "DEEPENING": deepening_score,
        "CONSISTENCY": consistency_score,
        "TRANSFER": transfer_score,
        "RESILIENCE": resilience_score,
        "PRESSURE": pressure_score,
        "EMOTIONAL": emotional_score,
        "PHYSICAL": physical_score,
        "overall": overall,
        "rhythmStd": rhythm_std,
        "dropCount": drop_count,
        "validRows": valid_rows,
    }


def build_athlete360(data, lang="PT"):
    athletes = sorted(
        {
            *(row.get("athleteName") for row in data["leads"]),
            *(row.get("atleta") for row in data["shotSeries"]),
            *(row.get("athlete") for row in data["targetSessions"]),
        }
        - {None, ""}
    )
    result = []
    for athlete in athletes:
        shot_rows = [r for r in data["shotSeries"] if r.get("atleta") == athlete]
        target_rows = [r for r in data["targetSessions"] if r.get("athlete") == athlete]
        prescriptions = [
            r
            for r in data["prescriptions"]
            if athlete.lower() in str((r.get("block") or "") + " " + (r.get("trainingTitle") or "")).lower()
        ]

        groups = {}
        for row in shot_rows:
            key = "|".join([str(row.get("evento", "")), str(row.get("sessao", "")), str(row.get("idBloco", ""))])
            groups.setdefault(key, []).append(row)

        sessions = []
        for _key, rows in groups.items():
            rows = sorted(rows, key=lambda r: series_order(r.get("serie")))
            shots = [shot for row in rows for shot in split_numbers(row.get("tiros"))]
            if not shots:
                continue

            rhythm_path = []
            series_points = []
            previous_media = None
            for row in rows:
                s_shots = split_numbers(row.get("tiros"))
                if len(s_shots) >= 10:
                    windows = [
                        (f"{row.get('serie')}_P1", s_shots[0:3]),
                        (f"{row.get('serie')}_P2", s_shots[3:7]),
                        (f"{row.get('serie')}_P3", s_shots[7:10]),
                    ]
                    rhythm_path.extend({"label": label, "val": round(median(vals), 2)} for label, vals in windows)
                serie_media = median(s_shots)
                drop = (previous_media - serie_media) if previous_media is not None and previous_media > serie_media else 0.0
                break_count = 1 if drop > 0 else 0
                previous_media = serie_media
                series_points.append(
                    {
                        "serie": row.get("serie"),
                        "media": round(serie_media, 2),
                        "std": round(stdev(s_shots), 2),
                        "total": round(sum(s_shots), 1),
                        "mainDropDepth": round(drop, 2),
                        "breakCount": break_count,
                    }
                )

            sessions.append(
                {
                    "evento": rows[0].get("evento"),
                    "sessao": rows[0].get("sessao"),
                    "prova": rows[0].get("prova"),
                    "data": rows[0].get("dataColeta"),
                    "total": round(sum(shots), 1),
                    "media": round(median(shots), 2),
                    "std": round(stdev(shots), 2),
                    "seriesCount": len(rows),
                    "series": series_points,
                    "rhythmPath": rhythm_path,
                }
            )

        sessions = sorted(sessions, key=lambda r: r.get("data") or 0, reverse=True)
        if not sessions:
            result.append(
                {
                    "athlete": athlete,
                    "prova": "",
                    "hci": 0,
                    "level": score_level(0, lang),
                    "latestTotal": 0,
                    "medianTotal": 0,
                    "sessionsCount": 0,
                    "targetCount": len(target_rows),
                    "prescriptionCount": len(prescriptions),
                    "parameters": [],
                    "sessions": [],
                    "prescriptions": prescriptions,
                }
            )
            continue

        latest = sessions[0]
        prova = latest.get("prova")
        latest_rows = [r for r in shot_rows if r.get("evento") == latest.get("evento") and r.get("sessao") == latest.get("sessao")]
        scores = hci_engine_scores(latest_rows, shot_rows)

        params = [
            ("OUTCOME", scores["OUTCOME"], "Entrega competitiva na regua OUTPUT."),
            ("PROCESS", scores["PROCESS"], "Continuidade de tiros aceitaveis."),
            ("RHYTHM", scores["RHYTHM"], "Estabilidade temporal entre series."),
            ("DEEPENING", scores["DEEPENING"], "Sequencia maxima de tiros profundos."),
            ("CONSISTENCY", scores["CONSISTENCY"], "Repetibilidade dos totais por serie."),
            ("TRANSFER", scores["TRANSFER"], "Transferencia para ambiente competitivo."),
            ("RESILIENCE", scores["RESILIENCE"], "Recuperacao depois de tiros abaixo do padrao."),
            ("PRESSURE", scores["PRESSURE"], "Carga de pressao combinando ritmo e quebras."),
            ("EMOTIONAL", scores["EMOTIONAL"], "Controle emocional inferido por quedas recorrentes."),
            ("PHYSICAL", scores["PHYSICAL"], "Degradacao fisica entre metades da prova."),
        ]
        parameters = [
            {"parameter": name, "score": round(score, 2), "level": score_level(score, lang), "reading": text}
            for name, score, text in params
        ]
        hci = scores["overall"]

        result.append(
            {
                "athlete": athlete,
                "prova": prova,
                "hci": round(hci, 2),
                "level": score_level(hci, lang),
                "latestTotal": latest.get("total"),
                "medianTotal": round(median([s["total"] for s in sessions]), 1),
                "sessionsCount": len(sessions),
                "targetCount": len(target_rows),
                "prescriptionCount": len(prescriptions),
                "parameters": parameters,
                "sessions": sessions,
                "prescriptions": prescriptions,
            }
        )
    return result


def pending_groups(submissions):
    groups = {}
    for item in submissions:
        key = "|".join([item["athlete"], item["event"], item["session"], item["prova"], item["source"]])
        groups.setdefault(key, []).append(item)
    result = []
    for key, rows in groups.items():
        rows = sorted(rows, key=lambda r: r["serie"])
        shot_count = sum(len(split_numbers(r["shots"])) for r in rows)
        series = {r["serie"] for r in rows}
        result.append(
            {
                "key": key,
                "athlete": rows[0]["athlete"],
                "event": rows[0]["event"],
                "session": rows[0]["session"],
                "prova": rows[0]["prova"],
                "source": rows[0]["source"],
                "seriesCount": len(rows),
                "shotCount": shot_count,
                "complete": len(rows) == 6 and shot_count == 60 and all(f"SR{i}" in series for i in range(1, 7)),
                "total": sum(sum(split_numbers(r["shots"])) for r in rows),
            }
        )
    return result


def load_snapshot(lang="PT"):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        data = {
            "leads": rows_as_dicts(cur, "SELECT * FROM qualified_lead ORDER BY updatedAt DESC"),
            "pendingGroups": pending_groups(
                rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE status = 'PENDING_COACH_REVIEW' ORDER BY submittedAt DESC")
            ),
            "approvedSubmissions": rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE status = 'APPROVED' ORDER BY reviewedAt DESC LIMIT 100"),
            "shotSeries": rows_as_dicts(cur, "SELECT * FROM shot_series ORDER BY dataColeta DESC LIMIT 500"),
            "targetSessions": rows_as_dicts(cur, "SELECT * FROM target_session ORDER BY submittedAt DESC LIMIT 200"),
            "trainingPlan": rows_as_dicts(cur, "SELECT * FROM training_plan_config"),
            "prescriptions": rows_as_dicts(cur, "SELECT * FROM training_plan_prescription ORDER BY updatedAt DESC"),
        }
        data["pendingISSF"] = data.get("pendingGroups", [])
        data["athlete360"] = build_athlete360(data, lang)
        conn.close()
        return data
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def delete_session(athlete, event, session_type):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM shot_series WHERE atleta=? AND evento=? AND sessao=?", (athlete, event, session_type))
        deleted = cur.rowcount
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "deleted": deleted}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def create_manual_lead(name, email):
    if not str(name).strip() or "@" not in str(email):
        raise ValueError("Informe nome e email valido.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        now = int(time.time() * 1000)
        cur.execute(
            """
            INSERT OR REPLACE INTO qualified_lead
            (leadId, athleteName, athleteEmail, source, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (email.strip().lower(), name.strip(), email.strip().lower(), "ADMIN_MANUAL", now, now),
        )
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def update_manual_lead(payload):
    lead_id = str(payload.get("leadId", "")).strip()
    name = str(payload.get("athleteName", "")).strip()
    email = str(payload.get("athleteEmail", "")).strip().lower()
    source = str(payload.get("source", "")).strip() or "LOGIN_APP"
    if not lead_id:
        raise ValueError("Lead nao informado.")
    if not name or "@" not in email:
        raise ValueError("Informe nome e email valido.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT createdAt FROM qualified_lead WHERE leadId=? LIMIT 1", (lead_id,))
        row = cur.fetchone()
        if row is None:
            raise ValueError("Lead nao encontrado.")
        now = int(time.time() * 1000)
        cur.execute("DELETE FROM qualified_lead WHERE leadId=?", (lead_id,))
        cur.execute(
            """
            INSERT OR REPLACE INTO qualified_lead
            (leadId, athleteName, athleteEmail, source, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (email, name, email, source, int(row[0] or now), now),
        )
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "leadId": email}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def delete_manual_lead(payload):
    lead_id = str(payload.get("leadId", "")).strip()
    if not lead_id:
        raise ValueError("Lead nao informado.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM qualified_lead WHERE leadId=?", (lead_id,))
        deleted = cur.rowcount
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "deleted": deleted}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def approve_group(group_key):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        athlete, event, session, prova, source = group_key.split("|")
        rows = rows_as_dicts(
            cur,
            """
            SELECT * FROM athlete_submission
            WHERE athlete=? AND event=? AND session=? AND prova=? AND source=?
              AND status='PENDING_COACH_REVIEW'
            ORDER BY serie ASC
            """,
            (athlete, event, session, prova, source),
        )
        group = pending_groups(rows)[0] if rows else None
        if not group or not group["complete"]:
            raise ValueError("Grupo incompleto: exige SR1..SR6 com 60 disparos.")
        block_id = f"{athlete}_{event}_{session}"
        for row in rows:
            order = int("".join(filter(str.isdigit, row["serie"])) or "1")
            cur.execute(
                """
                INSERT OR REPLACE INTO shot_series
                (chaveSerie, dataColeta, prova, atleta, evento, sessao, idBloco, statusEvento, serie, tiros, hciSerieOrder, hciEventRowValid)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    f"{athlete}_{prova}_{event}_{session}_{block_id}_{row['serie']}",
                    row["submittedAt"],
                    prova,
                    athlete,
                    event,
                    session,
                    block_id,
                    "FINAL" if row["serie"] == "SR6" else "PARCIAL",
                    row["serie"],
                    row["shots"],
                    order,
                    1,
                ),
            )
            cur.execute("UPDATE athlete_submission SET status='APPROVED', reviewedAt=?, reviewerRole=? WHERE submissionId=?", (int(time.time() * 1000), "ADMIN_DESKTOP", row["submissionId"]))
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "approved": len(rows)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def reject_group(group_key):
    if not group_key:
        raise ValueError("Grupo nao informado.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        athlete, event, session, prova, source = group_key.split("|")
        now = int(time.time() * 1000)
        cur.execute(
            """
            UPDATE athlete_submission
            SET status='REJECTED', reviewedAt=?, reviewerRole=?
            WHERE athlete=? AND event=? AND session=? AND prova=? AND source=?
              AND status='PENDING_COACH_REVIEW'
            """,
            (now, "ADMIN_DESKTOP", athlete, event, session, prova, source),
        )
        rejected = cur.rowcount
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "rejected": rejected}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def create_extra_prescription(payload):
    title = str(payload.get("trainingTitle", "")).strip()
    if not title:
        raise ValueError("Informe o titulo do treino extra.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        now = int(time.time() * 1000)
        cell_key = f"EXTRA_{now}"
        cur.execute(
            """
            INSERT OR REPLACE INTO training_plan_prescription
            (cellKey, day, block, code, trainingId, trainingTitle, prescribedByRole, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cell_key,
                int(payload.get("day", 0) or 0),
                str(payload.get("block", "Treino extra")).strip() or "Treino extra",
                str(payload.get("code", "EXTRA")).strip() or "EXTRA",
                str(payload.get("trainingId", cell_key)).strip() or cell_key,
                title,
                str(payload.get("prescribedByRole", "ADMIN_DESKTOP")).strip() or "ADMIN_DESKTOP",
                now,
            ),
        )
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "cellKey": cell_key}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def update_target_session(payload):
    session_id = str(payload.get("sessionId", "")).strip()
    athlete = str(payload.get("athlete", "")).strip()
    event = str(payload.get("event", "")).strip()
    session = str(payload.get("session", "")).strip()
    recommended = str(payload.get("recommendedTraining", "")).strip()
    if not session_id:
        raise ValueError("Sessao Target nao informada.")
    if not athlete or not event or not session:
        raise ValueError("Informe atleta, evento e sessao.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE target_session
            SET athlete=?, event=?, session=?, recommendedTraining=?
            WHERE sessionId=?
            """,
            (athlete, event, session, recommended, session_id),
        )
        if cur.rowcount == 0:
            raise ValueError("Sessao Target nao encontrada.")
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "updated": 1}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def delete_target_session(payload):
    session_id = str(payload.get("sessionId", "")).strip()
    if not session_id:
        raise ValueError("Sessao Target nao informada.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM target_session WHERE sessionId=?", (session_id,))
        deleted = cur.rowcount
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "deleted": deleted}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def create_target_session_prescription(payload):
    session_id = str(payload.get("sessionId", "")).strip()
    if not session_id:
        raise ValueError("Informe a sessao Target.")
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM target_session WHERE sessionId = ? LIMIT 1", (session_id,))
        row = cur.fetchone()
        if row is None:
            raise ValueError("Sessao Target nao encontrada.")
        target = dict(row)
        now = int(time.time() * 1000)
        title = str(payload.get("trainingTitle", "")).strip() or str(target.get("recommendedTraining") or "").strip()
        if not title:
            title = f"Treino orientado por alvo {target.get('targetType', '')}".strip()
        block = str(payload.get("block", "")).strip() or (
            f"{target.get('athlete', 'Atleta')} | {target.get('event', 'Evento')} | "
            f"{target.get('session', 'Sessao')} | {target.get('targetType', 'Alvo')} | "
            f"{target.get('totalShots', 0)} tiros"
        )
        cell_key = f"EXTRA_TARGET_{now}"
        cur.execute(
            """
            INSERT OR REPLACE INTO training_plan_prescription
            (cellKey, day, block, code, trainingId, trainingTitle, prescribedByRole, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cell_key, int(payload.get("day", 0) or 0), block, "TARGET", f"TARGET_{session_id}", title, "ADMIN_DESKTOP", now),
        )
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "cellKey": cell_key}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def parse_target_scan_text(text, athlete, event, session, prova):
    clean_text = str(text or "").replace(",", ".")
    shots = []
    is_rifle = str(prova).upper() == "RIFLE"

    colon_matches = re.findall(r"(?:^|\s)(?:[1-9]|[1-5][0-9]|60)\s*[:\-]\s*(10(?:\.\d)?|[0-9](?:\.\d)?)", clean_text)
    if colon_matches:
        shots = [float(value) for value in colon_matches]
    else:
        table_series = parse_target_scan_series_table(clean_text, is_rifle)
        if table_series:
            shots = [shot for series in table_series[:6] for shot in series]
        else:
            numeric = [float(value) for value in re.findall(r"\b(?:10(?:\.\d)?|[0-9](?:\.\d)?)\b", clean_text)]
            shots = numeric[-60:] if len(numeric) >= 60 else numeric

    shots = [min(10.9, max(0.0, shot)) for shot in shots]
    if len(shots) < 10:
        raise ValueError("TargetScan sem disparos suficientes. Cole/exporte o texto com os tiros ou use TXT/CSV.")

    if not is_rifle:
        shots = [float(int(shot)) for shot in shots]

    chunks = [shots[idx:idx + 10] for idx in range(0, min(len(shots), 60), 10)]
    chunks = [chunk for chunk in chunks if len(chunk) == 10]
    if len(chunks) != 6:
        raise ValueError(f"Nao foi possivel montar 6 series completas do TargetScan. Extraido: {len(chunks)} serie(s).")

    now = int(time.time() * 1000)
    rows = []
    for index, chunk in enumerate(chunks[:6]):
        rows.append(
            {
                "submissionId": f"{athlete}_{event}_{session}_SR{index + 1}_{now + index}",
                "athlete": athlete,
                "event": event,
                "session": session,
                "prova": prova,
                "serie": f"SR{index + 1}",
                "shots": ",".join(str(round(value, 1)).rstrip("0").rstrip(".") for value in chunk),
                "source": "TARGETSCAN_ADMIN",
                "notes": "Importado do TargetScan pela plataforma Admin.",
                "status": "PENDING_COACH_REVIEW",
                "submittedAt": now + index,
            }
        )
    return rows


def build_target_scan_rows_from_chunks(chunks, athlete, event, session, prova):
    now = int(time.time() * 1000)
    rows = []
    for index, chunk in enumerate(chunks[:6]):
        rows.append(
            {
                "submissionId": f"{athlete}_{event}_{session}_SR{index + 1}_{now + index}",
                "athlete": athlete,
                "event": event,
                "session": session,
                "prova": prova,
                "serie": f"SR{index + 1}",
                "shots": ",".join(str(round(value, 1)).rstrip("0").rstrip(".") for value in chunk),
                "source": "TARGETSCAN_ADMIN",
                "notes": "Importado do TargetScan pela plataforma Admin.",
                "status": "PENDING_COACH_REVIEW",
                "submittedAt": now + index,
            }
        )
    return rows


def clean_target_scan_lines(text):
    return [
        line.strip()
        for line in str(text or "").replace("\ufb02", "f").splitlines()
        if line.strip()
    ]


def is_series_header(line):
    normalized = str(line or "").strip().rstrip(":")
    return normalized.lower() in {"series", "serie"}


def is_series_total_line(line):
    match = re.fullmatch(r"(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?", str(line or "").strip(), re.I)
    if not match:
        return False
    total = int(match.group(1))
    return 30 <= total <= 109


def score_from_target_scan_line(line, is_rifle):
    tokens = [token.replace("*", "") for token in re.split(r"\s+", str(line or "").strip())]
    for token in reversed(tokens):
        if re.fullmatch(r"\d{1,2}(?:[.,]\d)?", token):
            value = float(token.replace(",", "."))
            if 0.0 <= value <= 10.9:
                return value if is_rifle else float(int(value))
    return None


def parse_target_scan_series_table(text, is_rifle):
    lines = clean_target_scan_lines(text)
    sixty_index = next((i for i, line in enumerate(lines) if line == "60"), -1)
    start = next((i for i, line in enumerate(lines) if i > sixty_index and is_series_header(line)), -1)
    if start < 0:
        return []
    end = next((i for i, line in enumerate(lines) if i > start and line.lower() == "targets"), len(lines))
    section = lines[start + 1:end]
    result = []
    for index, line in enumerate(section):
        if not is_series_total_line(line):
            continue
        series = []
        cursor = index - 1
        while cursor >= 0 and len(series) < 10:
            score = score_from_target_scan_line(section[cursor], is_rifle)
            if score is not None:
                series.append(score)
            cursor -= 1
        if len(series) == 10:
            result.append(list(reversed(series)))
    return result[:6]


def normalize_target_scan_score(token, is_rifle):
    text = str(token or "").replace(" ", "").replace("*", "").replace("x", "").replace("X", "").replace(",", ".")
    if text.startswith("-"):
        return None
    match = re.search(r"(?<!\d)(10(?:\.\d)?|[0-9](?:\.\d)?)(?!\d)", text)
    if not match:
        return None
    value = float(match.group(1))
    if not (0.0 <= value <= 10.9):
        return None
    return value if is_rifle else float(int(value))


def extract_targetscan_series_from_pdf_layout(pdf_base64, is_rifle):
    if not PdfReader:
        return []
    raw = base64.b64decode(pdf_base64)
    reader = PdfReader(BytesIO(raw))
    if not reader.pages:
        return []

    page = reader.pages[0]
    items = []

    def visitor_text(text, cm, tm, font_dict, font_size):
        token = str(text or "").strip()
        if token:
            items.append((float(tm[4]), float(tm[5]), token))

    page.extract_text(visitor_text=visitor_text)

    def grouped_tokens(x_min, x_max):
        rows = {}
        for x, y, token in items:
            if x_min <= x <= x_max:
                bucket = round(y)
                rows.setdefault(bucket, []).append((x, token))
        merged = {}
        for bucket, parts in rows.items():
            merged[bucket] = "".join(part for _, part in sorted(parts, key=lambda pair: pair[0])).strip()
        return merged

    total_left = grouped_tokens(230, 290)
    total_right = grouped_tokens(500, 560)
    bands = []
    for y in sorted(set(total_left) & set(total_right), reverse=True):
        left = total_left.get(y, "")
        right = total_right.get(y, "")
        left_match = re.match(r"^(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?$", left)
        right_match = re.match(r"^(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?$", right)
        if left_match and right_match and int(left_match.group(1)) >= 60 and int(right_match.group(1)) >= 60:
            bands.append(y)
    bands = sorted(bands[:3])
    if len(bands) != 3:
        return []

    left_scores = grouped_tokens(248, 280)
    right_scores = grouped_tokens(522, 552)
    series_chunks = []
    for band_y in bands:
        for row_map in (left_scores, right_scores):
            shots = []
            for y in sorted(row_map.keys(), reverse=True):
                if band_y > y >= band_y - 110:
                    score = normalize_target_scan_score(row_map[y], is_rifle)
                    if score is not None:
                        shots.append(score)
            if len(shots) >= 10:
                series_chunks.append(shots[:10])
    return series_chunks[:6]


def extract_targetscan_series_from_exploded_pages(pdf_base64, is_rifle):
    if not PdfReader:
        return []
    raw = base64.b64decode(pdf_base64)
    reader = PdfReader(BytesIO(raw))
    if len(reader.pages) < 2:
        return []

    blocks = []

    for page_index, page in enumerate(reader.pages[1:], start=1):
        items = []

        def visitor_text(text, cm, tm, font_dict, font_size):
            token = str(text or "").strip()
            if token:
                items.append((float(tm[4]), float(tm[5]), token))

        page.extract_text(visitor_text=visitor_text)
        if not items:
            continue

        anchors = []
        for x, y, token in items:
            if not re.fullmatch(r"\d{1,2}", token):
                continue
            index = int(token)
            if not (1 <= index <= 99):
                continue
            if 30 <= x <= 50 or 305 <= x <= 325:
                anchors.append((index, x, y))

        for index, x, y in anchors:
            is_left = x < 200
            x_min, x_max = ((0, 290) if is_left else (290, 560))
            top = y - 8
            bottom = y + 42
            score_x_min, score_x_max = ((245, 278) if is_left else (525, 548))
            score_tokens = []
            for item_x, item_y, token in items:
                if not (x_min <= item_x <= x_max and top <= item_y <= bottom):
                    continue
                normalized = normalize_target_scan_score(token, is_rifle)
                if normalized is None:
                    continue
                score_tokens.append((item_y, item_x, normalized))

            if not score_tokens:
                continue

            score_tokens.sort(key=lambda item: (item[0], item[1]))
            shots = []
            total = None
            for item_y, item_x, value in score_tokens:
                if score_x_min <= item_x <= score_x_max:
                    if value > 10.9:
                        total = value
                        break
                    shots.append(value)

            if not shots:
                continue
            blocks.append((index, page_index, shots))

    if not blocks:
        return []

    blocks.sort(key=lambda item: item[0])
    flat_shots = []
    for _, _, shots in blocks:
        flat_shots.extend(shots)

    if len(flat_shots) < 60:
        return []
    return [flat_shots[start:start + 10] for start in range(0, 60, 10)]


def extract_text_from_targetscan_pdf(pdf_base64):
    if not PdfReader:
        raise ValueError("Leitura de PDF indisponivel neste ambiente Admin.")
    if not pdf_base64:
        raise ValueError("PDF TargetScan nao informado.")
    try:
        raw = base64.b64decode(pdf_base64)
    except Exception as exc:
        raise ValueError(f"Falha ao decodificar PDF: {exc}")
    try:
        reader = PdfReader(BytesIO(raw))
        return "".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:
        raise ValueError(f"Falha ao extrair texto do PDF TargetScan: {exc}")



# ------------------------------------------------------------------------------
# TargetScan 60-shot block override for v4.2 layout connection
# ------------------------------------------------------------------------------
def _format_shot(value):
    return str(round(float(value), 1)).rstrip("0").rstrip(".")


def build_target_scan_rows_from_chunks(chunks, athlete, event, session, prova):
    now = int(time.time() * 1000)
    rows = []
    clean_chunks = [list(chunk) for chunk in (chunks or []) if len(chunk) == 10]
    if len(clean_chunks) < 6:
        raise ValueError(f"TargetScan precisa formar ao menos 6 series completas. Extraido: {len(clean_chunks)} serie(s).")
    block_count = len(clean_chunks) // 6
    batch_source = f"TARGETSCAN_ADMIN_{now}"
    for block_index in range(block_count):
        block_chunks = clean_chunks[block_index * 6:(block_index + 1) * 6]
        event_name = str(event or "TARGETSCAN_ADMIN").strip() or "TARGETSCAN_ADMIN"
        if block_count > 1:
            event_name = f"{event_name}_{block_index + 1:02d}"
        block_id = f"{athlete}_{event_name}_{session}_{now}_{block_index + 1}"
        for index, chunk in enumerate(block_chunks):
            rows.append(
                {
                    "submissionId": f"{block_id}_SR{index + 1}",
                    "athlete": athlete,
                    "event": event_name,
                    "session": session,
                    "prova": prova,
                    "serie": f"SR{index + 1}",
                    "shots": ",".join(_format_shot(value) for value in chunk),
                    "source": batch_source,
                    "notes": f"Importado do TargetScan pela plataforma Admin. Bloco {block_index + 1}/{block_count}.",
                    "status": "PENDING_COACH_REVIEW",
                    "submittedAt": now + block_index * 10 + index,
                }
            )
    return rows


def parse_target_scan_text(text, athlete, event, session, prova):
    clean_text = str(text or "").replace(",", ".")
    is_rifle = str(prova).upper() == "RIFLE"
    colon_matches = re.findall(r"(?:^|\s)(?:[1-9]|[1-9][0-9]|[1-9][0-9][0-9])\s*[:\-]\s*(10(?:\.\d)?|[0-9](?:\.\d)?)", clean_text)
    if colon_matches:
        shots = [float(value) for value in colon_matches]
    else:
        table_series = parse_target_scan_series_table(clean_text, is_rifle)
        if table_series:
            shots = [shot for series in table_series for shot in series]
        else:
            numeric = [float(value) for value in re.findall(r"\b(?:10(?:\.\d)?|[0-9](?:\.\d)?)\b", clean_text)]
            shots = numeric

    shots = [min(10.9, max(0.0, shot)) for shot in shots]
    if not is_rifle:
        shots = [float(int(shot)) for shot in shots]
    if len(shots) < 60:
        raise ValueError(f"TargetScan sem 60 disparos completos. Extraido: {len(shots)} disparo(s).")

    full_blocks = len(shots) // 60
    usable = shots[:full_blocks * 60]
    chunks = [usable[idx:idx + 10] for idx in range(0, len(usable), 10)]
    return build_target_scan_rows_from_chunks(chunks, athlete, event, session, prova)

def import_target_scan(payload):
    athlete = str(payload.get("athlete", "")).strip()
    event = str(payload.get("event", "")).strip() or "TARGETSCAN_ADMIN"
    session = str(payload.get("session", "")).strip() or "TREINO"
    prova = str(payload.get("prova", "")).strip().upper() or "PISTOL"
    text = str(payload.get("text", "")).strip()
    pdf_base64 = str(payload.get("pdfBase64", "")).strip()
    if not athlete:
        raise ValueError("Selecione o atleta.")
    if prova not in {"PISTOL", "RIFLE"}:
        raise ValueError("Prova deve ser PISTOL ou RIFLE.")
    if not text and not pdf_base64:
        raise ValueError("Envie texto/TXT/CSV ou selecione um PDF TargetScan.")
    is_rifle = prova == "RIFLE"
    layout_rows = []
    if pdf_base64:
        layout_rows = extract_targetscan_series_from_exploded_pages(pdf_base64, is_rifle)
    if pdf_base64 and not layout_rows:
        layout_rows = extract_targetscan_series_from_pdf_layout(pdf_base64, is_rifle)
    if layout_rows:
        text = "\n".join(",".join(str(v).rstrip("0").rstrip(".") for v in row) for row in layout_rows)
    if not text and pdf_base64:
        text = extract_text_from_targetscan_pdf(pdf_base64)
    if not text:
        raise ValueError("Nao foi possivel extrair texto do arquivo TargetScan.")

    rows = build_target_scan_rows_from_chunks(layout_rows, athlete, event, session, prova) if layout_rows else parse_target_scan_text(text, athlete, event, session, prova)
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for row in rows:
            cur.execute(
                """
                INSERT OR REPLACE INTO athlete_submission
                (submissionId, athlete, event, session, prova, serie, shots, source, notes, status, submittedAt, reviewedAt, reviewerRole)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["submissionId"],
                    row["athlete"],
                    row["event"],
                    row["session"],
                    row["prova"],
                    row["serie"],
                    row["shots"],
                    row["source"],
                    row["notes"],
                    row["status"],
                    row["submittedAt"],
                    None,
                    None,
                ),
            )
        conn.commit()
        conn.close()
        push_database(tmp)
        return {"ok": True, "series": len(rows), "shots": sum(len(split_numbers(row["shots"])) for row in rows)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" /><title>SportsPerformance Admin v4.3</title>
  <style>
    :root {
      --bg: #f4f7f6; --panel: #ffffff; --header-bg: #1c1e21; --text-main: #2c3e50;
      --text-muted: #7f8c8d; --accent: #1877f2; --border: #dcdde1; --danger: #fa3e3e; --success: #42b72a; --warn: #f5c33b;
    }
    body { margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: var(--bg); color: var(--text-main); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    header { padding: 12px 20px; background: var(--header-bg); color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    header h1 { font-size: 18px; margin: 0; font-weight: 600; }
    main { display: grid; grid-template-columns: 320px 1fr; flex: 1; overflow: hidden; }
    aside { background: var(--panel); border-right: 1px solid var(--border); padding: 20px; overflow-y: auto; }
    .sidebar-stat { padding: 12px; background: #f0f7ff; border-radius: 8px; border-left: 4px solid var(--accent); margin-bottom: 12px; }
    .sidebar-stat label { display: block; font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .sidebar-stat b { font-size: 18px; color: var(--accent); }
    .content-area { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; }
    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid var(--border); flex-shrink: 0; }
    .tab { padding: 14px 24px; cursor: pointer; font-weight: bold; color: var(--text-muted); transition: 0.2s; border-bottom: 3px solid transparent; font-size: 13px; }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .card { background: var(--panel); border-radius: 10px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 20px; }
    .card-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .card-header h3 { margin: 0; font-size: 14px; font-weight: bold; color: var(--header-bg); text-transform: uppercase; }
    .card-body { padding: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 10px; background: #f8fafc; color: var(--text-muted); font-weight: bold; border-bottom: 1px solid var(--border); }
    td { padding: 10px; border-bottom: 1px solid #f1f1f1; vertical-align: middle; }
    input, select, textarea { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; width: 100%; box-sizing: border-box; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; transition: 0.2s; color: white; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
    .btn-blue { background: var(--accent); } .btn-red { background: var(--danger); } .btn-green { background: var(--success); } .btn-muted { background: var(--text-muted); }
    .tag { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .form-row { display: flex; gap: 10px; margin-bottom: 10px; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
    .compare-bar { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; gap: 15px; overflow-x: auto; white-space: nowrap; align-items: center; }
    .event-chip { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid var(--border); padding: 8px 15px; border-radius: 8px; font-size: 11px; cursor: pointer; transition: 0.2s; }
    .event-chip.active { border-color: var(--accent); background: #f0f7ff; font-weight: bold; }
  </style>
</head>
<body>
<header>
  <h1>Admin Framework v4.3 - SportsPerformance</h1>
  <div style="display: flex; gap: 10px;">
    <button class="btn btn-green" onclick="load()">SINCRONIZAR PC <-> CELULAR</button>
    <button class="btn btn-muted" onclick="shutdown()">SAIR</button>
  </div>
</header>
<main>
  <aside>
    <h3 style="font-size: 13px; color: var(--text-muted); margin-top: 0;">Contexto do Atleta</h3>
    <select id="athleteSelect" onchange="renderTabs()" style="font-weight: bold; padding: 10px; margin-bottom: 20px;"></select>
    <div id="sidebarContext"></div>
    <hr style="margin: 20px 0; border: 0; border-top: 1px solid var(--border);" />
    <button class="btn btn-blue" style="width: 100%;" onclick="window.print()">Imprimir Relatório 360</button>
  </aside>
  <div class="content-area">
    <div class="tabs">
      <div class="tab active" onclick="setTab('Resumo')">RESUMO</div>
      <div class="tab" onclick="setTab('Indices')">ÍNDICES</div>
      <div class="tab" onclick="setTab('Plano')">MESOCICLO & PLANO</div>
      <div class="tab" onclick="setTab('Target')">ANÁLISE RADIAL</div>
      <div class="tab" onclick="setTab('Ritmo')">RITMO DUAL-AXIS</div>
    </div>

    <!-- VIEW RESUMO -->
    <div id="view_Resumo" class="view">
      <div class="card">
        <div class="card-header"><h3>Gestão de Leads (Motor v3.4)</h3></div>
        <div class="card-body">
          <div style="display:flex; gap:10px; margin-bottom:15px">
            <input id="newLeadName" placeholder="Nome do atleta" />
            <input id="newLeadEmail" placeholder="Email" />
            <button class="btn btn-blue" onclick="addLead()">Criar Lead</button>
          </div>
          <div id="leadsList"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Entradas dos atletas - ISSF pendente</h3></div>
        <div class="card-body" id="pendingISSF"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Historico de sessoes ISSF - gerenciar</h3></div>
        <div class="card-body" id="issfSessions"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Resultados ISSF gravados</h3></div>
        <div class="card-body" id="issfResults" style="padding: 0; max-height: 250px; overflow: auto;"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>HCI Target Sessions</h3></div>
        <div class="card-body" id="targetSessionsTable" style="padding: 0; max-height: 300px; overflow: auto;"></div>
      </div>
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header"><h3>Importar TargetScan para atleta</h3></div>
          <div class="card-body">
            <div class="form-row">
              <input id="tsEvent" placeholder="Evento" value="TARGETSCAN_ADMIN" />
              <input id="tsSession" placeholder="Sessao" value="TREINO" />
              <select id="tsProva"><option>PISTOL</option><option>RIFLE</option></select>
            </div>
            <input id="tsFile" type="file" accept=".pdf,.txt,.csv" style="margin-bottom: 10px;" />
            <textarea id="tsText" placeholder="Cole o texto exportado aqui..." style="height: 60px; margin-bottom: 10px;"></textarea>
            <button class="btn btn-blue" style="width: 100%;" onclick="importTargetScan()">Carregar para Atleta</button>
            <div id="tsStatus" style="margin-top:8px; font-size:11px; color:var(--text-muted);"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Enviar treino extra</h3></div>
          <div class="card-body">
            <div class="form-row">
              <input id="exDay" placeholder="Dia" style="width: 60px;" />
              <input id="exTitle" placeholder="Titulo do treino extra" />
              <input id="exCode" placeholder="Codigo" style="width: 80px;" />
            </div>
            <input id="exBlock" placeholder="Atleta / contexto / observação" style="margin-bottom: 10px;" />
            <button class="btn btn-green" style="width: 100%;" onclick="sendExtra()">Enviar</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Plan e prescricoes</h3></div>
        <div class="card-body" id="prescriptionsList" style="padding: 0;"></div>
      </div>
    </div>

    <!-- OUTRAS VIEWS (LAYOUT v4.0) -->
    <div id="view_Indices" class="view" style="display:none">
       <div class="card"><div class="card-header"><h3>Tabela de Índices HCI</h3></div><div class="card-body" id="indicesTable"></div></div>
       <div class="dashboard-grid"><div class="card"><div class="card-header"><h3>HCI Structure Radar</h3></div><div class="card-body" id="radarStructure" style="text-align:center"></div></div><div class="card"><div class="card-header"><h3>Target Radar (App Parameters)</h3></div><div class="card-body" id="radarTarget" style="text-align:center"></div></div></div>
    </div>
    <div id="view_Plano" class="view" style="display:none">
      <div class="card"><div class="card-header"><h3>Mesociclo - 31 dias</h3></div><div class="card-body" style="padding:0"><div id="mesoGridContainer" style="overflow:auto"></div></div></div>
    </div>
    <div id="view_Target" class="view" style="display:none">
      <div class="card"><div class="card-header"><h3>Análise Direcional de Precisão</h3></div><div class="card-body" id="targetContent"></div></div>
    </div>
    <div id="view_Ritmo" class="view" style="display:none">
      <div id="compareBar" class="compare-bar"></div>
      <div class="card"><div class="card-header"><h3>Rhythm chart principal: barras + linhas (v3.4)</h3></div><div class="card-body" id="ritmoMainChart" style="height:380px"></div></div>
      <div id="ritmoGrid" class="chart-grid"></div>
    </div>
  </div>
</main>


<script>
let SNAPSHOT = null; let TAB = 'Resumo'; let TARGETSCAN_PDF_BASE64 = '';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = ms => ms ? new Date(Number(ms)).toLocaleString('pt-BR') : '-';
function jsonArg(value){ return escapeHtml(JSON.stringify(value ?? '')); }
function safeId(value){ return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g,'_'); }
function table(rows, cols){
    if(!rows || !rows.length) return '<div style="color:var(--text-muted); text-align:center; padding:20px">Sem registros.</div>';
    return '<table><thead><tr>'+cols.map(c=>`<th>${escapeHtml(c[0])}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c[2] ? c[2](r[c[1]], r) : escapeHtml(r[c[1]])}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
}
function setTab(t) {
    TAB = t;
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${t}'`)));
    document.querySelectorAll('.view').forEach(el => el.style.display = (el.id === 'view_' + t ? 'block' : 'none'));
    renderTabs();
}
async function load() {
    const selected = athleteSelect.value;
    const d = await fetch('/api/snapshot').then(r => r.json());
    SNAPSHOT = d;
    const athletes = d.athlete360 || [];
    athleteSelect.innerHTML = athletes.map(a => `<option value="${escapeHtml(a.athlete)}">${escapeHtml(a.athlete)}</option>`).join('');
    if([...athleteSelect.options].some(o=>o.value===selected)) athleteSelect.value = selected;
    renderTabs();
}
function renderTabs() {
    if(!SNAPSHOT) return;
    const item = (SNAPSHOT.athlete360 || []).find(a => a.athlete === athleteSelect.value) || (SNAPSHOT.athlete360 || [])[0];
    if(!item){ sidebarContext.innerHTML=''; return; }
    sidebarContext.innerHTML = `<div class="sidebar-stat"><label>HCI ATUAL</label><b>${escapeHtml(item.hci ?? 0)} (${escapeHtml(item.level ?? '-')})</b></div><div class="sidebar-stat"><label>SESSÕES</label><b>${escapeHtml(item.sessionsCount ?? 0)}</b></div><div class="sidebar-stat"><label>TARGETS</label><b>${escapeHtml(item.targetCount ?? 0)}</b></div>`;
    if(TAB === 'Resumo') renderResumo(item);
    if(TAB === 'Indices') renderIndices(item);
    if(TAB === 'Plano') renderPlano(item);
    if(TAB === 'Target') renderTarget(item);
    if(TAB === 'Ritmo') renderRitmo(item);
}
function renderResumo(item) {
    leadsList.innerHTML = renderLeads(SNAPSHOT.leads || []);
    pendingISSF.innerHTML = table(SNAPSHOT.pendingGroups || SNAPSHOT.pendingISSF || [], [
        ['Atleta','athlete'],['Evento','event'],['Sessão','session'],['Prova','prova'],['Séries','seriesCount'],['Disparos','shotCount'],['Total','total',v=>Number(v||0).toFixed(1)],
        ['Ação','key',(v,r)=>`<div style="display:flex; gap:6px"><button class="btn btn-blue" ${r.complete?'':'disabled'} onclick="approve(${jsonArg(v)})">Aprovar</button><button class="btn btn-red" onclick="reject(${jsonArg(v)})">Reprovar</button></div>`]
    ]);
    issfSessions.innerHTML = table(item.sessions || [], [
        ['Evento','evento'],['Sessão','sessao'],['Prova','prova'],['Total','total'],['Média','media'],['Data','data',fmtDate],
        ['Ação','evento',(v,r)=>`<button class="btn btn-red" onclick="delSession(${jsonArg(item.athlete)},${jsonArg(r.evento)},${jsonArg(r.sessao)})">Deletar</button>`]
    ]);
    issfResults.innerHTML = table((SNAPSHOT.shotSeries || []).slice(0,200), [['Atleta','atleta'],['Evento','evento'],['Sessão','sessao'],['Prova','prova'],['Série','serie'],['Tiros','tiros'],['Data','dataColeta',fmtDate],['Ação','evento',(v,r)=>`<button class="btn btn-red" onclick="delSession(${jsonArg(r.atleta)},${jsonArg(r.evento)},${jsonArg(r.sessao)})">Deletar prova</button>`]]);
    const athleteTargets = (SNAPSHOT.targetSessions || []).filter(t => t.athlete === item.athlete);
    targetSessionsTable.innerHTML = renderTargets(athleteTargets.length ? athleteTargets : (SNAPSHOT.targetSessions || []).slice(0,20));
    prescriptionsList.innerHTML = table(SNAPSHOT.prescriptions || [], [['Dia','day'],['Bloco','block'],['Código','code'],['Treino','trainingTitle'],['Por','prescribedByRole'],['Atualizado','updatedAt',fmtDate]]);
}
function renderLeads(rows){
    if(!rows || !rows.length) return '<div style="color:var(--text-muted); text-align:center; padding:20px">Sem leads.</div>';
    return '<table><thead><tr><th>Atleta</th><th>Email</th><th>Origem</th><th>Ação</th></tr></thead><tbody>'+
      rows.map((l,idx) => `<tr><td><input id="ln_${idx}" value="${escapeHtml(l.athleteName)}"/></td><td><input id="le_${idx}" value="${escapeHtml(l.athleteEmail)}"/></td><td>${escapeHtml(l.source || '')}</td><td><button class="btn btn-blue" onclick="saveLead(${jsonArg(l.leadId)}, ${idx})">Salvar</button> <button class="btn btn-red" onclick="delLead(${jsonArg(l.leadId)})">Deletar</button></td></tr>`).join('') + '</tbody></table>';
}
function renderTargets(rows){
    if(!rows || !rows.length) return '<div style="color:var(--text-muted); text-align:center; padding:20px">Sem sessões Target.</div>';
    return '<table><thead><tr><th>Atleta</th><th>Evento</th><th>Sessão</th><th>Alvo</th><th>Tiros</th><th>Zonas</th><th>Contagens</th><th>Treino</th><th>Ações</th></tr></thead><tbody>'+
      rows.map((t,idx)=>{ const id=safeId(t.sessionId || idx); return `<tr><td><input id="ta_${id}" value="${escapeHtml(t.athlete)}"/></td><td><input id="te_${id}" value="${escapeHtml(t.event)}"/></td><td><input id="ts_${id}" value="${escapeHtml(t.session)}"/></td><td>${escapeHtml(t.targetType)}</td><td>${escapeHtml(t.totalShots)}</td><td>${escapeHtml(t.zoneLabels)}</td><td>${escapeHtml(t.zoneCounts)}</td><td><input id="tt_${id}" value="${escapeHtml(t.recommendedTraining)}"/></td><td><button class="btn btn-blue" onclick="saveTarget(${jsonArg(t.sessionId)},${jsonArg(id)})">Salvar</button> <button class="btn btn-blue" onclick="prescribeFromTarget(${jsonArg(t.sessionId)},${jsonArg(t.recommendedTraining || '')})">Lançar</button> <button class="btn btn-red" onclick="deleteTarget(${jsonArg(t.sessionId)})">Deletar</button></td></tr>`; }).join('') + '</tbody></table>';
}
function renderIndices(item){
    indicesTable.innerHTML = table(item.parameters || [], [['Parâmetro','parameter'],['Score','score'],['Nível','level'],['Leitura','reading']]);
    radarStructure.innerHTML = radarChart((item.parameters || []).filter(p=>['TRANSFER','RESILIENCE','PRESSURE','EMOTIONAL','PHYSICAL'].includes(p.parameter)), 'Structure & Resilience');
    radarTarget.innerHTML = radarChart((item.parameters || []).filter(p=>['OUTCOME','PROCESS','RHYTHM','DEEPENING','CONSISTENCY'].includes(p.parameter)), 'Performance Targets');
}
function radarChart(data,label){
    if(!data || !data.length) return '<div style="color:var(--text-muted); padding:20px">Sem dados para radar.</div>';
    const w=320,h=300,cx=160,cy=145,r=95,step=(Math.PI*2)/data.length;
    const pts=data.map((d,i)=>{const v=(Number(d.score||0)/10)*r; return `${(cx+v*Math.cos(i*step-Math.PI/2)).toFixed(1)},${(cy+v*Math.sin(i*step-Math.PI/2)).toFixed(1)}`;}).join(' ');
    const grid=[2,4,6,8,10].map(v=>`<circle cx="${cx}" cy="${cy}" r="${(v/10)*r}" fill="none" stroke="#e2e8f0"/>`).join('');
    const axes=data.map((d,i)=>`<line x1="${cx}" y1="${cy}" x2="${cx+r*Math.cos(i*step-Math.PI/2)}" y2="${cy+r*Math.sin(i*step-Math.PI/2)}" stroke="#e2e8f0"/><text x="${cx+(r+28)*Math.cos(i*step-Math.PI/2)}" y="${cy+(r+28)*Math.sin(i*step-Math.PI/2)}" font-size="9" text-anchor="middle" dominant-baseline="middle">${escapeHtml(d.parameter)}</text>`).join('');
    return `<h4>${escapeHtml(label)}</h4><svg viewBox="0 0 ${w} ${h}" width="100%" height="300">${grid}${axes}<polygon points="${pts}" fill="#1877f2" fill-opacity="0.2" stroke="#1877f2" stroke-width="3"/></svg>`;
}
function renderPlano(item){
    mesoGridContainer.innerHTML = table(SNAPSHOT.prescriptions || [], [['Dia','day'],['Bloco','block'],['Código','code'],['Treino','trainingTitle'],['Por','prescribedByRole'],['Atualizado','updatedAt',fmtDate]]);
}
function renderTarget(item){
    const targets=(SNAPSHOT.targetSessions||[]).filter(t=>t.athlete===item.athlete);
    targetContent.innerHTML = `<div class="dashboard-grid"><div>${targetDirectionBars(targets)}</div><div>${renderTargets(targets)}</div></div>`;
}
function targetDirectionBars(targets){
    const counts={};
    (targets||[]).forEach(t=>{ const labels=String(t.zoneLabels||'').split(','); const vals=String(t.zoneCounts||'').split(','); labels.forEach((label,i)=>{ const k=label.trim(); if(k) counts[k]=(counts[k]||0)+Number(vals[i]||0); }); });
    const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    if(!rows.length) return '<div style="color:var(--text-muted); padding:20px">Sem dados direcionais de alvo para este atleta.</div>';
    const max=Math.max(...rows.map(r=>r[1]),1);
    return '<table><thead><tr><th>Direção/Zona</th><th>Incidência</th></tr></thead><tbody>'+rows.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td><div style="height:9px;background:#e5e7eb;border-radius:9px;overflow:hidden"><span style="display:block;height:100%;width:${(v/max)*100}%;background:var(--accent)"></span></div>${v}</td></tr>`).join('')+'</tbody></table>';
}
function renderRitmo(item){
    const sessions=item.sessions||[];
    compareBar.innerHTML = sessions.map((s,i)=>`<div class="event-chip ${i===0?'active':''}">${escapeHtml(s.evento)} | ${escapeHtml(s.total)}</div>`).join('') || '<span style="color:var(--text-muted)">Sem sessões ISSF.</span>';
    ritmoMainChart.innerHTML = simpleLineChart((sessions[0]?.series)||[], 'total', 'Total por série');
    ritmoGrid.innerHTML = table(sessions, [['Data','data',fmtDate],['Evento','evento'],['Sessão','sessao'],['Prova','prova'],['Total','total'],['Média','media']]);
}
function simpleLineChart(points,field,label){
    const vals=(points||[]).map(p=>Number(p[field]||0));
    if(!vals.length) return '<div style="color:var(--text-muted); padding:20px">Sem dados de ritmo.</div>';
    const w=900,h=320,p=45,min=Math.min(...vals),max=Math.max(...vals),range=(max-min)||1;
    const coords=vals.map((v,i)=>[p+i*((w-p*2)/Math.max(1,vals.length-1)),h-p-((v-min)/range)*(h-p*2),v]);
    const line=coords.map(c=>c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="340"><rect x="0" y="0" width="${w}" height="${h}" fill="#fbfdff" stroke="#dcdde1"/><text x="${p}" y="25" font-size="14" font-weight="bold">${escapeHtml(label)}</text><polyline points="${line}" fill="none" stroke="#1877f2" stroke-width="3"/>${coords.map((c,i)=>`<circle cx="${c[0]}" cy="${c[1]}" r="4" fill="#1877f2"><title>${escapeHtml(points[i].serie||i+1)}: ${c[2].toFixed(1)}</title></circle>`).join('')}</svg>`;
}
document.getElementById('tsFile')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    TARGETSCAN_PDF_BASE64 = '';
    if (!file) {
        tsStatus.textContent = '';
        return;
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        TARGETSCAN_PDF_BASE64 = btoa(binary);
        tsText.value = '';
        tsStatus.textContent = `PDF selecionado: ${file.name}`;
        return;
    }
    tsText.value = await file.text();
    tsStatus.textContent = `Arquivo selecionado: ${file.name}`;
});
async function addLead() { await fetch('/api/create-lead', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:newLeadName.value, email:newLeadEmail.value})}); await load(); }
async function saveLead(id, idx) { const payload = {leadId:id, athleteName:document.getElementById('ln_'+idx).value, athleteEmail:document.getElementById('le_'+idx).value, source:'ADMIN_DESKTOP'}; await fetch('/api/update-lead', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); await load(); }
async function delLead(id) { if(confirm('Deletar lead?')) { await fetch('/api/delete-lead', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({leadId:id})}); await load(); } }
async function approve(key){ const d=await fetch('/api/approve?key='+encodeURIComponent(key),{method:'POST'}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao aprovar.'); await load(); }
async function reject(key){ if(!confirm('Reprovar este grupo pendente?')) return; const d=await fetch('/api/reject?key='+encodeURIComponent(key),{method:'POST'}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao reprovar.'); await load(); }
async function delSession(a,e,s){ if(!confirm(`Deletar sessão ${e} de ${a}?`)) return; const d=await fetch('/api/delete-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athlete:a,event:e,session:s})}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao deletar.'); await load(); }
async function sendExtra() { const payload = {day:exDay.value, trainingTitle:exTitle.value, block:exBlock.value, code:exCode.value, prescribedByRole:'ADMIN_DESKTOP'}; const d=await fetch('/api/prescribe-extra', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao enviar treino.'); await load(); }
async function importTargetScan() {
    tsStatus.textContent = 'Importando TargetScan...';
    const payload = {athlete:athleteSelect.value, event:tsEvent.value, session:tsSession.value, prova:tsProva.value, text:tsText.value, pdfBase64:TARGETSCAN_PDF_BASE64};
    const d=await fetch('/api/import-targetscan', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).then(r=>r.json());
    if(!d.ok) {
        tsStatus.textContent = d.error || 'Falha ao importar TargetScan.';
        return alert(d.error||'Falha ao importar TargetScan.');
    }
    tsStatus.textContent = `Importado: ${d.series} séries / ${d.shots || 0} disparos.`;
    tsText.value='';
    tsFile.value='';
    TARGETSCAN_PDF_BASE64 = '';
    await load();
}
async function saveTarget(sessionId, domId){ const payload={sessionId,athlete:document.getElementById(`ta_${domId}`).value,event:document.getElementById(`te_${domId}`).value,session:document.getElementById(`ts_${domId}`).value,recommendedTraining:document.getElementById(`tt_${domId}`).value}; const d=await fetch('/api/update-target-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao salvar Target.'); await load(); }
async function deleteTarget(sessionId){ if(!confirm('Deletar sessão Target?')) return; const d=await fetch('/api/delete-target-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao deletar Target.'); await load(); }
async function prescribeFromTarget(sessionId,suggestedTitle){ const title=prompt('Treino a enviar para o atleta:', suggestedTitle||'Treino orientado por alvo'); if(title===null) return; const d=await fetch('/api/prescribe-from-target',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,trainingTitle:title})}).then(r=>r.json()); if(!d.ok) alert(d.error||'Falha ao prescrever.'); await load(); }
async function shutdown() { await fetch('/api/shutdown', {method:'POST'}); window.close(); }
load();
</script>

</body></html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, content_type="text/html; charset=utf-8", status=200):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
            content_type = "application/json; charset=utf-8"
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        lang = parse_qs(parsed.query).get("lang", ["PT"])[0]
        if path == "/":
            return self._send(HTML)
        if path == "/api/snapshot":
            try:
                return self._send(load_snapshot(lang))
            except Exception as exc:
                return self._send({"ok": False, "error": str(exc)}, status=500)
        return self._send("Not found", "text/plain", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0") or "0")
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            body = {}
        try:
            if parsed.path == "/api/approve":
                return self._send(approve_group(parse_qs(parsed.query).get("key", [""])[0]))
            if parsed.path == "/api/reject":
                return self._send(reject_group(parse_qs(parsed.query).get("key", [""])[0]))
            if parsed.path == "/api/create-lead":
                return self._send(create_manual_lead(body.get("name", ""), body.get("email", "")))
            if parsed.path == "/api/update-lead":
                return self._send(update_manual_lead(body))
            if parsed.path == "/api/delete-lead":
                return self._send(delete_manual_lead(body))
            if parsed.path == "/api/delete-session":
                return self._send(delete_session(body["athlete"], body["event"], body["session"]))
            if parsed.path == "/api/update-target-session":
                return self._send(update_target_session(body))
            if parsed.path == "/api/delete-target-session":
                return self._send(delete_target_session(body))
            if parsed.path == "/api/prescribe-extra":
                return self._send(create_extra_prescription(body))
            if parsed.path == "/api/prescribe-from-target":
                return self._send(create_target_session_prescription(body))
            if parsed.path == "/api/import-targetscan":
                return self._send(import_target_scan(body))
            if parsed.path == "/api/shutdown":
                self._send({"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            return self._send("Not found", "text/plain", 404)
        except Exception as exc:
            return self._send({"ok": False, "error": str(exc)}, status=400)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"SportsPerformance Admin v3.3 rodando sob demanda em {url}")
    print("Sem polling automatico. Use ATUALIZAR SOB DEMANDA e ENCERRAR.")
    webbrowser.open(url)
    server.serve_forever()
