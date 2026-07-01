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

# VERSION: 3.4.1 - Admin athlete JSON export plus stable 3.4 behavior
ROOT = os.path.dirname(os.path.abspath(__file__))
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
PACKAGE = "com.example.sportsperformance"
PORT = 8766
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



def rhythm_score_from_std(std_value):
    std_value = max(0.0, float(std_value or 0.0))
    if std_value <= 0.42:
        return 10.0
    if std_value <= 0.50:
        return 10.0 - ((std_value - 0.42) / 0.08) * 1.5
    if std_value <= 0.90:
        return 8.5 - ((std_value - 0.50) / 0.40) * 3.5
    return max(0.0, 5.0 - ((std_value - 0.90) * 4.0))


def hci_level_for_parameter(parameter, score, rhythm_std=None):
    parameter = str(parameter or "").upper()
    if parameter == "RHYTHM" and rhythm_std is not None:
        if rhythm_std <= 0.42:
            return "ELITE"
        if rhythm_std <= 0.50:
            return "ALTO RENDIMENTO"
        if rhythm_std <= 0.90:
            return "INTERMEDIARIO"
        return "INICIANTE"
    if parameter == "TRANSFER" and score <= 0:
        return "SEM BASELINE"
    if score >= 8.5:
        return "ELITE"
    if score >= 6.0:
        return "ALTO RENDIMENTO"
    if score >= 3.0:
        return "INTERMEDIARIO"
    return "INICIANTE"
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
    rhythm_score = limit010(rhythm_score_from_std(rhythm_std))
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

    med_competicoes = median(grouped_event_totals(athlete_comp)) if athlete_comp else None
    med_simulados = median(grouped_event_totals(athlete_sim)) if athlete_sim else None
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
            + emotional_score * 0.05
        ) * 100
    ) / 100.0

    score_values = {
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
    }
    return {
        **score_values,
        "overall": overall,
        "rhythmStd": rhythm_std,
        "levels": {
            parameter: hci_level_for_parameter(
                parameter,
                value,
                rhythm_std if parameter == "RHYTHM" else None,
            )
            for parameter, value in score_values.items()
        },
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

        target_order = ["OUTCOME", "PROCESS", "RHYTHM", "DEEPENING", "CONSISTENCY"]
        structure_order = ["TRANSFER", "RESILIENCE", "PRESSURE", "EMOTIONAL", "PHYSICAL"]
        readings = {
            "OUTCOME": "Entrega competitiva na regua OUTPUT.",
            "PROCESS": "Continuidade de tiros aceitaveis.",
            "RHYTHM": "Estabilidade temporal entre series; score convertido do STD para base 10.",
            "DEEPENING": "Sequencia maxima de tiros profundos.",
            "CONSISTENCY": "Repetibilidade dos totais por serie.",
            "TRANSFER": "Transferencia para ambiente competitivo.",
            "RESILIENCE": "Recuperacao depois de tiros abaixo do padrao.",
            "PRESSURE": "Carga de pressao combinando ritmo e quebras.",
            "EMOTIONAL": "Controle emocional inferido por quedas recorrentes.",
            "PHYSICAL": "Degradacao fisica entre metades da prova.",
        }
        parameters = []
        for index, name in enumerate(target_order + structure_order, start=1):
            score = scores[name]
            parameters.append(
                {
                    "displayOrder": index,
                    "parameter": name,
                    "score": round(score, 2),
                    "level": scores.get("levels", {}).get(name) or hci_level_for_parameter(name, score, scores.get("rhythmStd") if name == "RHYTHM" else None),
                    "reading": readings[name],
                    "reportProfile": "TARGETS" if name in target_order else "STRUCTURE",
                }
            )

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
  <meta charset="utf-8" /><title>SportsPerformance Admin v3.4.1</title>
  <style>
    :root { --bg:#f5f7fb; --panel:#fff; --line:#d8e0ea; --text:#1f2937; --muted:#667085; --accent:#2459d6; --ok:#166534; --error:#dc2626; }
    body{margin:0; font-family:Segoe UI,Arial; background:var(--bg); color:var(--text)}
    header{padding:16px; background:#101827; color:white; display:flex; justify-content:space-between; align-items:center}
    main{padding:16px; display:grid; gap:16px; grid-template-columns:1fr 1fr}
    section{background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px}
    input,select{border:1px solid var(--line); border-radius:6px; padding:8px; background:white; color:var(--text)}
    .wide{grid-column:1/-1}.scroll{max-height:400px; overflow:auto}
    table{width:100%; border-collapse:collapse; font-size:12px} th,td{border-bottom:1px solid var(--line); padding:8px; text-align:left; vertical-align:top}
    button{border:0; border-radius:6px; background:var(--accent); color:white; padding:8px 12px; cursor:pointer; font-weight:bold}
    button:disabled{background:#cbd5e1; cursor:not-allowed}.btn-del{background:var(--error); font-size:10px}
    .metric{border:1px solid var(--line); border-radius:8px; padding:12px; background:#fbfdff}.metric b{display:block; font-size:24px}
    .cards{display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin:10px 0}
    .bar{height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden}.bar span{display:block; height:100%; background:var(--accent)}
    .tabs{display:flex; border-bottom:1px solid var(--line); margin:16px 0}.tab{background:white; color:var(--muted); padding:12px 20px; border-bottom:3px solid transparent}.tab.active{color:var(--accent); border-bottom-color:var(--accent)}
    .grid2{display:grid; grid-template-columns:1fr 1fr; gap:14px}
    .pill{display:inline-block; padding:2px 6px; border-radius:999px; background:#eef4ff; color:var(--accent); font-size:11px}
    @media print { .no-print { display:none !important; } section { border:0 !important; } }
  </style>
</head>
<body>
<header>
  <h1>SportsPerformance Admin Control v3.4</h1>
  <div class="no-print" style="display:flex; gap:8px">
    <button onclick="toggleLang()">PT / EN</button>
    <button onclick="load()">ATUALIZAR SOB DEMANDA</button>
    <button onclick="shutdown()" style="background:#475569">ENCERRAR</button>
  </div>
</header>
<main>
  <section class="wide no-print"><h2>Ferramentas</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:10px">
      <input id="newLeadName" placeholder="Nome do atleta" />
      <input id="newLeadEmail" placeholder="Email" />
      <button onclick="addLead()">Criar lead</button>
      <button onclick="exportLeads()" style="background:#475569">Exportar leads</button>
    </div>
  </section>
  <section class="wide"><h2>Visao do atleta <button onclick="window.print()" style="float:right; font-size:11px">Imprimir relatorio</button><button onclick="exportSelectedAthleteJson()" style="float:right; font-size:11px; margin-right:8px; background:#0f766e">Exportar JSON</button></h2>
    <div class="no-print" style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
      <select id="athleteSelect" onchange="renderAthlete360()"></select>
      <span>Cruzar ultimos treinos:</span>
      <select id="trainingLimit" onchange="setTrainingLimit(this.value)"><option>3</option><option selected>5</option><option>8</option><option>10</option><option>15</option><option>20</option></select>
    </div>
    <div id="athlete360"></div>
  </section>
  <section class="no-print"><h2>Leads</h2><div id="leads" class="scroll"></div></section>
  <section class="no-print"><h2>Entradas dos atletas - ISSF pendente</h2><div id="pending" class="scroll"></div></section>
  <section class="wide no-print"><h2>Historico de sessoes ISSF - gerenciar</h2><div id="sessionHistory" class="scroll"></div></section>
  <section class="wide no-print"><h2>Resultados ISSF gravados</h2><div id="series" class="scroll"></div></section>
  <section class="wide no-print"><h2>HCI Target Sessions</h2><div id="targets" class="scroll"></div></section>
  <section class="wide no-print"><h2>Enviar treino extra</h2>
    <div style="display:grid; grid-template-columns:80px 1fr 1fr 1fr auto; gap:8px">
      <input id="extraDay" type="number" min="0" placeholder="Dia" />
      <input id="extraTitle" placeholder="Titulo do treino extra" />
      <input id="extraBlock" placeholder="Atleta / contexto / observacao" />
      <input id="extraCode" placeholder="Codigo" />
      <button onclick="sendExtra()">Enviar</button>
      <button onclick="exportTrainingCsv()" style="background:#0f766e">Exportar CSV</button>
    </div>
  </section>
  <section class="wide no-print"><h2>Importar TargetScan para atleta</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:8px">
      <input id="targetScanEvent" placeholder="Evento" value="TARGETSCAN_ADMIN" />
      <input id="targetScanSession" placeholder="Sessao" value="TREINO" />
      <select id="targetScanProva"><option>PISTOL</option><option>RIFLE</option></select>
      <input id="targetScanFile" type="file" accept=".txt,.csv,.pdf" />
    </div>
    <textarea id="targetScanText" placeholder="Cole aqui o texto exportado do TargetScan, ou carregue TXT/CSV. PDF sem extracao textual sera avisado." style="width:100%; min-height:120px; border:1px solid var(--line); border-radius:6px; padding:8px"></textarea>
    <div style="margin-top:8px; display:flex; gap:8px; align-items:center">
      <button onclick="importTargetScan()">Carregar para atleta selecionado</button>
      <span id="targetScanStatus" style="color:var(--muted)"></span>
    </div>
  </section>
  <section class="wide no-print"><h2>Plan e prescricoes</h2><div id="plan"></div></section>
</main>
<script>
let SNAPSHOT = null; let ATHLETE_TAB = 'Resumo'; let LANG = 'PT'; let TRAINING_LIMIT = 5; let RHYTHM_PICK = {}; let TARGETSCAN_PDF_BASE64 = '';
const fmtDate = ms => ms ? new Date(Number(ms)).toLocaleString("pt-BR") : "-";
function toggleLang(){ LANG = LANG === 'PT' ? 'EN' : 'PT'; load(); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function jsonArg(value){ return escapeHtml(JSON.stringify(value ?? '')); }
function safeId(value){ return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g,'_'); }
function table(rows, cols){ if(!rows || !rows.length) return '<div style="color:#667085">Sem registros.</div>'; return '<table><thead><tr>'+cols.map(c=>`<th>${escapeHtml(c[0])}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c[2] ? c[2](r[c[1]], r) : escapeHtml(r[c[1]])}</td>`).join('')+'</tr>').join('')+'</tbody></table>'; }
function renderLeads(rows){
  if(!rows || !rows.length) return '<div style="color:#667085">Sem registros.</div>';
  return `<table><thead><tr><th>Atleta</th><th>Email</th><th>Origem</th><th>Atualizado</th><th>Acao</th></tr></thead><tbody>`+
    rows.map((r,idx)=>{
      const id=safeId(r.leadId || idx);
      return `<tr>
        <td><input id="lead_name_${id}" value="${escapeHtml(r.athleteName)}" style="width:220px" /></td>
        <td><input id="lead_email_${id}" value="${escapeHtml(r.athleteEmail)}" style="width:240px" /></td>
        <td><input id="lead_source_${id}" value="${escapeHtml(r.source)}" style="width:170px" /></td>
        <td>${fmtDate(r.updatedAt)}</td>
        <td style="white-space:nowrap">
          <button onclick="saveLead(${jsonArg(r.leadId)}, ${jsonArg(id)})">Salvar</button>
          <button class="btn-del" onclick="deleteLead(${jsonArg(r.leadId)})">Deletar</button>
        </td>
      </tr>`;
    }).join('') + '</tbody></table>';
}
function renderTargets(rows){
  if(!rows || !rows.length) return '<div style="color:#667085">Sem registros.</div>';
  return `<table><thead><tr><th>Atleta</th><th>Evento</th><th>Sessao</th><th>Alvo</th><th>Tiros</th><th>Zonas</th><th>Contagens</th><th>Treino</th><th>Data</th><th>Acao</th></tr></thead><tbody>`+
    rows.map((r,idx)=>{
      const id=safeId(r.sessionId || idx);
      return `<tr>
        <td><input id="target_athlete_${id}" value="${escapeHtml(r.athlete)}" style="width:180px" /></td>
        <td><input id="target_event_${id}" value="${escapeHtml(r.event)}" style="width:110px" /></td>
        <td><input id="target_session_${id}" value="${escapeHtml(r.session)}" style="width:130px" /></td>
        <td>${escapeHtml(r.targetType)}</td>
        <td>${escapeHtml(r.totalShots)}</td>
        <td>${escapeHtml(r.zoneLabels)}</td>
        <td>${escapeHtml(r.zoneCounts)}</td>
        <td><input id="target_training_${id}" value="${escapeHtml(r.recommendedTraining)}" style="width:220px" /></td>
        <td>${fmtDate(r.submittedAt)}</td>
        <td style="white-space:nowrap">
          <button onclick="saveTarget(${jsonArg(r.sessionId)}, ${jsonArg(id)})">Salvar</button>
          <button onclick="prescribeFromTarget(${jsonArg(r.sessionId)},${jsonArg(r.recommendedTraining||'')})">Lancar treino</button>
          <button class="btn-del" onclick="deleteTarget(${jsonArg(r.sessionId)})">Deletar</button>
        </td>
      </tr>`;
    }).join('') + '</tbody></table>';
}
function metric(label,value,hint=''){ return `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(hint)}</small></div>`; }
function radarChart(data,label,color="#2459d6"){ if(!data || !data.length) return '<div style="color:#667085">Sem dados para radar.</div>'; const w=340,h=340,center=170,radius=120,angleStep=(Math.PI*2)/data.length; const pts=data.map((d,i)=>{const v=(Number(d.score||0)/10)*radius;return `${(center+v*Math.cos(i*angleStep-Math.PI/2)).toFixed(1)},${(center+v*Math.sin(i*angleStep-Math.PI/2)).toFixed(1)}`;}).join(' '); const grids=[2,4,6,8,10].map(r=>`<circle cx="${center}" cy="${center}" r="${(r/10)*radius}" fill="none" stroke="#e2e8f0" />`).join(''); const axes=data.map((_,i)=>`<line x1="${center}" y1="${center}" x2="${center+radius*Math.cos(i*angleStep-Math.PI/2)}" y2="${center+radius*Math.sin(i*angleStep-Math.PI/2)}" stroke="#e2e8f0" />`).join(''); const lbls=data.map((d,i)=>{const x=center+(radius+25)*Math.cos(i*angleStep-Math.PI/2),y=center+(radius+25)*Math.sin(i*angleStep-Math.PI/2);return `<text x="${x}" y="${y}" font-size="10" font-weight="bold" fill="#475569" text-anchor="middle" dominant-baseline="middle">${escapeHtml(d.parameter)}</text>`;}).join(''); return `<div style="text-align:center"><h4>${escapeHtml(label)}</h4><svg viewBox="0 0 ${w} ${h}" width="100%" height="300">${grids}${axes}<polygon points="${pts}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" />${lbls}</svg></div>`; }
function lineChart(points,field,label,minFixed=null,maxFixed=null){ const values=(points||[]).map(p=>Number(p[field]||0)).filter(v=>Number.isFinite(v)); if(!values.length) return '<div style="color:#667085">Sem dados para grafico.</div>'; const w=760,h=250,pad=48,min=minFixed ?? Math.min(...values),max=maxFixed ?? Math.max(...values),range=(max-min)||1; const clamp=v=>Math.max(min,Math.min(max,v)); const coords=values.map((v,i)=>[pad+i*((w-pad*2)/Math.max(1,values.length-1)), h-pad-((clamp(v)-min)/range)*(h-pad*2), v]); const smoothPath=(coords)=>{ if(!coords.length) return ''; let d=`M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`; for(let i=1;i<coords.length;i++){ const prev=coords[i-1], cur=coords[i], midX=(prev[0]+cur[0])/2; d+=` C ${midX.toFixed(1)} ${prev[1].toFixed(1)}, ${midX.toFixed(1)} ${cur[1].toFixed(1)}, ${cur[0].toFixed(1)} ${cur[1].toFixed(1)}`; } return d; }; const path=smoothPath(coords); const ticks=[0,.25,.5,.75,1].map(t=>({y:h-pad-t*(h-pad*2),v:min+t*range})); return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="280"><rect x="0" y="0" width="${w}" height="${h}" fill="#fbfdff" stroke="#cbd5e1"/><text x="${pad}" y="20" font-size="14" font-weight="bold">${escapeHtml(label)}</text>${ticks.map(t=>`<line x1="${pad}" y1="${t.y}" x2="${w-pad}" y2="${t.y}" stroke="#e2e8f0"/><text x="${pad-8}" y="${t.y+4}" text-anchor="end" font-size="10" fill="#475569">${t.v.toFixed(1)}</text>`).join('')}<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#94a3b8"/><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#94a3b8"/><path d="${path}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${coords.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#1e293b"><title>${escapeHtml(points[i].serie || points[i].label || points[i].evento || i+1)}: ${p[2].toFixed(2)}</title></circle>`).join('')}<text x="${pad}" y="${h-8}" font-size="10" fill="#667085">Eixo Y: ${min.toFixed(2)} a ${max.toFixed(2)}</text></svg>`; }
function dualAxisRhythmChart(session){
  const rows=(session?.series||[]).map((r,i)=>({label:r.serie||`SR${i+1}`, total:Number(r.total||0), media:Number(r.media||0), std:Number(r.std||0), drop:Number(r.mainDropDepth||0), breakCount:Number(r.breakCount||0)}));
  const pathRows=(session?.rhythmPath||[]).map((r,i)=>({label:r.label||`P${i+1}`, val:Number(r.val||0)})).filter(r=>Number.isFinite(r.val));
  if(!rows.length) return '<div style="color:#667085">Sem dados de ritmo.</div>';
  const w=980,h=380,padL=58,padR=62,padT=42,padB=52,plotW=w-padL-padR,plotH=h-padT-padB;
  const isRifle=String(session?.prova||'').toUpperCase().includes('RIFLE');
  const leftMin=0,leftMax=isRifle?2:3,rightMin=isRifle?9.5:8,rightMax=isRifle?10.9:10;
  const x=(i)=>padL+(i+0.5)*(plotW/rows.length), xPath=(i)=>padL+(i+0.5)*(plotW/Math.max(1,pathRows.length)), yL=(v)=>padT+plotH-((v-leftMin)/(leftMax-leftMin||1))*plotH, yR=(v)=>padT+plotH-((v-rightMin)/(rightMax-rightMin||1))*plotH;
  const barW=Math.max(8,(plotW/rows.length)*0.16);
  const rhythmCoords=pathRows.map((r,i)=>[xPath(i),yR(r.val),r]);
  const logPoints=pathRows.map((r,i)=>({x:Math.log(i+1), y:r.val}));
  const n=logPoints.length, sx=logPoints.reduce((s,p)=>s+p.x,0), sy=logPoints.reduce((s,p)=>s+p.y,0), sxx=logPoints.reduce((s,p)=>s+p.x*p.x,0), sxy=logPoints.reduce((s,p)=>s+p.x*p.y,0);
  const denom=(n*sxx-sx*sx)||1, b=(n*sxy-sx*sy)/denom, a=(sy-b*sx)/n;
  const predLine=pathRows.map((_,i)=>`${xPath(i).toFixed(1)},${yR(a+b*Math.log(i+1)).toFixed(1)}`).join(' ');
  const smoothPath=(coords)=>{ if(!coords.length) return ''; let d=`M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`; for(let i=1;i<coords.length;i++){ const prev=coords[i-1], cur=coords[i], midX=(prev[0]+cur[0])/2; d+=` C ${midX.toFixed(1)} ${prev[1].toFixed(1)}, ${midX.toFixed(1)} ${cur[1].toFixed(1)}, ${cur[0].toFixed(1)} ${cur[1].toFixed(1)}`; } return d; };
  const topDropLabels=new Set([...rows].filter(r=>r.drop>0).sort((a,b)=>b.drop-a.drop).slice(0,2).map(r=>r.label));
  const yTicks=[0,.25,.5,.75,1].map(t=>({ly:yL(leftMin+(leftMax-leftMin)*t), lv:leftMin+(leftMax-leftMin)*t, ry:yR(rightMin+(rightMax-rightMin)*t), rv:rightMin+(rightMax-rightMin)*t}));
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="420">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#fbfdff" stroke="#cbd5e1"/>
    <text x="${padL}" y="24" font-size="15" font-weight="bold">Rhythm chart principal: barras + linhas</text>
    <text x="${padL}" y="40" font-size="11" fill="#667085">${isRifle?'RIFLE':'PISTOL'} | Eixo esquerdo: queda ${leftMin}-${leftMax} | eixo direito: media ${rightMin}-${rightMax}</text>
    ${yTicks.map(t=>`<line x1="${padL}" y1="${t.ly}" x2="${w-padR}" y2="${t.ly}" stroke="#e2e8f0"/><text x="${padL-8}" y="${t.ly+4}" text-anchor="end" font-size="10" fill="#475569">${t.lv.toFixed(1)}</text><text x="${w-padR+8}" y="${t.ry+4}" font-size="10" fill="#7c3aed">${t.rv.toFixed(1)}</text>`).join('')}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h-padB}" stroke="#64748b"/><line x1="${w-padR}" y1="${padT}" x2="${w-padR}" y2="${h-padB}" stroke="#7c3aed"/><line x1="${padL}" y1="${h-padB}" x2="${w-padR}" y2="${h-padB}" stroke="#64748b"/>
    ${pathRows.map((p,i)=>{ const serie=String(p.label).split('_')[0]; const r=rows.find(row=>row.label===serie)||{}; const std=Math.min(leftMax,Number(r.std||0)), breaks=Math.min(leftMax,Number(r.breakCount||0)); const stdH=std>0?Math.max(3,h-padB-yL(std)):0, breakH=breaks>0?Math.max(3,h-padB-yL(breaks)):0; return `<rect x="${xPath(i)-barW-1}" y="${h-padB-stdH}" width="${barW}" height="${stdH}" fill="#22c55e" opacity="0.58"><title>${escapeHtml(p.label)} STD serie: ${Number(r.std||0).toFixed(2)}</title></rect><rect x="${xPath(i)+1}" y="${h-padB-breakH}" width="${barW}" height="${breakH}" fill="#f59e0b" opacity="0.68"><title>${escapeHtml(p.label)} break count: ${Number(r.breakCount||0)}</title></rect>`; }).join('')}
    ${rows.map((r,i)=>{ const showDrop=topDropLabels.has(r.label); const drop=showDrop?Math.min(leftMax,r.drop):0; const dropH=drop>0?Math.max(3,h-padB-yL(drop)):0; return `<rect x="${x(i)-barW/2}" y="${h-padB-dropH}" width="${barW}" height="${dropH}" fill="#dc2626" opacity="0.86"><title>${escapeHtml(r.label)} drop depth: ${showDrop?r.drop.toFixed(2):'oculto pela regra dos 2 piores'}</title></rect><text x="${x(i)}" y="${h-24}" text-anchor="middle" font-size="10" fill="#475569">${escapeHtml(r.label)}</text>`; }).join('')}
    <path d="${smoothPath(rhythmCoords)}" fill="none" stroke="#2563eb" stroke-width="2.8" opacity="0.84" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${predLine}" fill="none" stroke="#dc2626" stroke-width="2.8" stroke-dasharray="7 4"/>
    ${rhythmCoords.map(([cx,cy,r])=>`<circle cx="${cx}" cy="${cy}" r="3.8" fill="#2563eb" stroke="#ffffff" stroke-width="1.4" opacity="0.95"><title>${escapeHtml(r.label)}: ${r.val.toFixed(2)}</title></circle>`).join('')}
    <g font-size="11"><rect x="${w-500}" y="18" width="12" height="12" fill="#22c55e" opacity="0.62"/><text x="${w-483}" y="29">STD</text><rect x="${w-435}" y="18" width="12" height="12" fill="#dc2626" opacity="0.82"/><text x="${w-418}" y="29">Drop depth</text><rect x="${w-322}" y="18" width="12" height="12" fill="#f59e0b" opacity="0.76"/><text x="${w-305}" y="29">Break count</text><line x1="${w-193}" y1="24" x2="${w-166}" y2="24" stroke="#2563eb" stroke-width="2.8" opacity="0.82"/><text x="${w-160}" y="29">Ritmo P1/P2/P3</text><line x1="${w-55}" y1="24" x2="${w-28}" y2="24" stroke="#dc2626" stroke-width="2.8" stroke-dasharray="7 4"/><text x="${w-22}" y="29">Pred.</text></g>
  </svg>`;
}
function rhythmChart(session){ if(!session) return '<div style="color:#667085">Sem sessao selecionada.</div>'; const isRifle=String(session?.prova||'').toUpperCase().includes('RIFLE'); return `<div>${dualAxisRhythmChart(session)}<div class="grid2"><section><h2>Rhythm Path P1/P2/P3</h2>${lineChart(session.rhythmPath||[],'val','Janelas ritmicas',isRifle?9.5:8,isRifle?10.9:10)}</section><section><h2>Desvio por serie</h2>${lineChart(session.series||[],'std','STD por serie',0,isRifle?2:3)}</section></div></div>`; }
function disciplineKey(session){ return String(session?.prova||'SEM PROVA').toUpperCase().includes('RIFLE') ? 'RIFLE' : 'PISTOL'; }
function rhythmSectionsByDiscipline(sessions){
  const groups={};
  (sessions||[]).forEach(s=>{ const key=disciplineKey(s); (groups[key] ||= []).push(s); });
  return Object.entries(groups).map(([prova,rows])=>{
    const latest=rows[0]||{};
    const ordered=[...rows].reverse();
    const isRifle=prova==='RIFLE';
    return `<section class="wide"><h2>Rhythm chart - ${prova}</h2>${rhythmChart(latest)}<h2>Comparativo ${prova} - ultimos ${rows.length}</h2><div class="grid2">${lineChart(ordered,'total',`Total por treino - ${prova}`)}${lineChart(ordered,'media',`Media por treino - ${prova}`,isRifle?9.5:8,isRifle?10.9:10)}</div>${table(rows,[['Data','data',fmtDate],['Evento','evento'],['Sessao','sessao'],['Prova','prova'],['Total','total'],['Media','media']])}</section>`;
  }).join('');
}
function targetBars(targets){ const counts={}; (targets||[]).forEach(t=>String(t.zoneLabels||'').split(',').forEach((label,i)=>{const vals=String(t.zoneCounts||'').split(','); const key=label.trim(); if(key) counts[key]=(counts[key]||0)+Number(vals[i]||0);})); const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]); if(!rows.length) return '<div style="color:#667085">Sem sessoes Target.</div>'; const max=Math.max(...rows.map(r=>r[1]),1); return '<table><thead><tr><th>Zona/Direcao</th><th>Incidencia</th></tr></thead><tbody>'+rows.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td><div class="bar"><span style="width:${(v/max)*100}%"></span></div>${v}</td></tr>`).join('')+'</tbody></table>'; }
function setAthleteTab(t){ ATHLETE_TAB=t; renderAthlete360(); }
function setTrainingLimit(v){ TRAINING_LIMIT=Math.max(1, Number(v||5)); renderAthlete360(); }
function renderAthlete360(){ const list=SNAPSHOT?.athlete360||[]; if(!list.length){ athlete360.innerHTML='<div style="color:#667085">Sem dados reais de atleta.</div>'; return; } const item=list.find(a=>a.athlete===athleteSelect.value)||list[0]; const sessions=(item.sessions||[]).slice(0,TRAINING_LIMIT); const targets=(SNAPSHOT.targetSessions||[]).filter(t=>t.athlete===item.athlete).slice(0,TRAINING_LIMIT); const tabs=`<div class="tabs no-print">${['Resumo','Indices','Ritmo','Target','Plano'].map(t=>`<button class="tab ${ATHLETE_TAB===t?'active':''}" onclick="setAthleteTab('${t}')">${t}</button>`).join('')}</div>`; const content={ 'Resumo':`<section><div class="grid2">${radarChart((item.parameters||[]).filter(p=>["OUTCOME","PROCESS","RHYTHM","DEEPENING","CONSISTENCY"].includes(p.parameter)),'Performance Targets')}${radarChart((item.parameters||[]).filter(p=>["TRANSFER","RESILIENCE","PRESSURE","EMOTIONAL","PHYSICAL"].includes(p.parameter)),'Structure & Resilience','#7c3aed')}</div></section>`, 'Indices':`<section>${table(item.parameters||[],[['Parametro','parameter'],['Score','score'],['Nivel','level'],['Leitura','reading']])}</section>`, 'Ritmo': rhythmSectionsByDiscipline(sessions), 'Target':`<section>${targetBars(targets)}${table(targets,[['Data','submittedAt',fmtDate],['Evento','event'],['Sessao','session'],['Alvo','targetType'],['Tiros','totalShots'],['Treino','recommendedTraining'],['Acao','sessionId',(v,r)=>`<button onclick="prescribeFromTarget(${jsonArg(v)},${jsonArg(r.recommendedTraining||'')})">Lancar treino</button>`]])}</section>`, 'Plano':`<section>${table(SNAPSHOT.prescriptions||[],[['Dia','day'],['Bloco','block'],['Codigo','code'],['Treino','trainingTitle'],['Por','prescribedByRole'],['Atualizado','updatedAt',fmtDate]])}</section>` }[ATHLETE_TAB]||''; athlete360.innerHTML=`<div class="cards">${metric('Atleta',item.athlete,item.prova||'-')}${metric('HCI geral',item.hci,item.level||'-')}${metric('Mediana total',item.medianTotal,'Excel OUTPUT usa mediana')}${metric('Sessoes',item.sessionsCount,'ISSF')}${metric('Targets / prescricoes',`${item.targetCount||0} / ${item.prescriptionCount||0}`,'cruzamento')}</div>${tabs}${content}`; const histHtml=(item.sessions||[]).map(s=>`<tr><td>${escapeHtml(s.evento)}</td><td>${escapeHtml(s.sessao)}</td><td>${escapeHtml(s.total)}</td><td><button class="btn-del" onclick="delSession(${jsonArg(item.athlete)},${jsonArg(s.evento)},${jsonArg(s.sessao)})">DELETAR</button></td></tr>`).join(''); sessionHistory.innerHTML=`<table><thead><tr><th>Evento</th><th>Tipo</th><th>Total</th><th>Acao</th></tr></thead><tbody>${histHtml}</tbody></table>`; }
async function delSession(a,e,s){ if(!confirm(`Deletar sessao ${e} de ${a}?`)) return; const res=await fetch('/api/delete-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athlete:a,event:e,session:s})}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao deletar sessao.'); await load(); }
function csvCell(value){ return '"'+String(value??'').replaceAll('"','""')+'"'; }
function selectedAthletePrescriptions(){
  const athlete = athleteSelect.value || '';
  const typed = {day:Number(extraDay.value||0),block:extraBlock.value||'',code:extraCode.value||'EXTRA',trainingId:extraCode.value||'EXTRA',trainingTitle:extraTitle.value||'',prescribedByRole:'ADMIN_DESKTOP_CSV',updatedAt:Date.now()};
  const rows = (SNAPSHOT?.prescriptions||[]).filter(r=>String((r.block||'')+' '+(r.trainingTitle||'')).toLowerCase().includes(String(athlete).toLowerCase()));
  if(typed.trainingTitle.trim()) rows.unshift(typed);
  return rows;
}
function exportTrainingCsv(){
  const athlete = athleteSelect.value || 'atleta';
  const rows = selectedAthletePrescriptions();
  if(!rows.length){ alert('Nao ha treino para exportar. Preencha um treino extra ou selecione atleta com prescricoes.'); return; }
  const header = ['cellKey','day','block','code','trainingId','trainingTitle','prescribedByRole','updatedAt'];
  const lines = [
    ['indicator','SPORTS_PERFORMANCE_TRAINING_DB_V1'].map(csvCell).join(','),
    ['athlete',athlete].map(csvCell).join(','),
    ['exportedAt',Date.now()].map(csvCell).join(','),
    header.join(',')
  ];
  rows.forEach((r,index)=>{
    const cellKey = r.cellKey || `ADMIN_CSV_${Date.now()}_${index}`;
    lines.push([cellKey,r.day||0,r.block||'',r.code||'ADMIN',r.trainingId||r.code||cellKey,r.trainingTitle||'',r.prescribedByRole||'ADMIN_DESKTOP_CSV',r.updatedAt||Date.now()].map(csvCell).join(','));
  });
  const blob = new Blob([lines.join('\n')+'\n'], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sportsperformance_${String(athlete).replace(/[^a-z0-9_-]+/gi,'_')}_training_db.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function sendExtra(){ const payload={day:Number(extraDay.value||0),trainingTitle:extraTitle.value,block:extraBlock.value||'Treino extra',code:extraCode.value||'EXTRA',prescribedByRole:'ADMIN_DESKTOP'}; const res=await fetch('/api/prescribe-extra',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json(); if(!data.ok) return alert(data.error||'Falha ao enviar treino.'); extraDay.value=''; extraTitle.value=''; extraBlock.value=''; extraCode.value=''; await load(); }
async function prescribeFromTarget(sessionId,suggestedTitle){ const title=prompt('Treino a enviar para o atleta:', suggestedTitle||'Treino orientado por alvo'); if(title===null) return; const res=await fetch('/api/prescribe-from-target',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,trainingTitle:title})}); const data=await res.json(); if(!data.ok) return alert(data.error||'Falha ao prescrever pelo alvo.'); await load(); }
targetScanFile?.addEventListener('change', async (event)=>{ const file=event.target.files?.[0]; if(!file) return; TARGETSCAN_PDF_BASE64=''; if(file.type==='application/pdf' || file.name.toLowerCase().endsWith('.pdf')){ const bytes = new Uint8Array(await file.arrayBuffer()); let binary=''; const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk){ binary += String.fromCharCode(...bytes.subarray(i, i+chunk)); } TARGETSCAN_PDF_BASE64=btoa(binary); targetScanStatus.textContent=`PDF ${file.name} carregado. A extracao textual sera feita no Admin ao importar.`; return; } targetScanText.value=await file.text(); targetScanStatus.textContent=`Arquivo ${file.name} carregado.`; });
async function importTargetScan(){ const athlete=athleteSelect.value; const payload={athlete,event:targetScanEvent.value,session:targetScanSession.value,prova:targetScanProva.value,text:targetScanText.value,pdfBase64:TARGETSCAN_PDF_BASE64}; targetScanStatus.textContent='Importando...'; const res=await fetch('/api/import-targetscan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json(); if(!data.ok){ targetScanStatus.textContent=data.error||'Falha ao importar TargetScan.'; return; } targetScanStatus.textContent=`Importado: ${data.series} series / ${data.shots} disparos para ${athlete}.`; targetScanText.value=''; TARGETSCAN_PDF_BASE64=''; targetScanFile.value=''; await load(); }
async function shutdown(){ await fetch('/api/shutdown',{method:'POST'}); document.body.innerHTML='<main><section><h2>Plataforma encerrada</h2><div style="color:#667085">Rode Start-HciAdminControl.ps1 para abrir novamente.</div></section></main>'; }
async function addLead(){ const res=await fetch('/api/create-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newLeadName.value,email:newLeadEmail.value})}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao criar lead.'); await load(); }
async function approve(key){ const res=await fetch('/api/approve?key='+encodeURIComponent(key),{method:'POST'}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao aprovar.'); await load(); }
async function reject(key){ if(!confirm('Reprovar este grupo pendente?')) return; const res=await fetch('/api/reject?key='+encodeURIComponent(key),{method:'POST'}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao reprovar.'); await load(); }
async function saveLead(leadId, domId){ const payload={leadId,athleteName:document.getElementById(`lead_name_${domId}`).value,athleteEmail:document.getElementById(`lead_email_${domId}`).value,source:document.getElementById(`lead_source_${domId}`).value}; const res=await fetch('/api/update-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao salvar lead.'); await load(); }
async function deleteLead(leadId){ if(!confirm('Deletar este lead?')) return; const res=await fetch('/api/delete-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId})}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao deletar lead.'); await load(); }
async function saveTarget(sessionId, domId){ const payload={sessionId,athlete:document.getElementById(`target_athlete_${domId}`).value,event:document.getElementById(`target_event_${domId}`).value,session:document.getElementById(`target_session_${domId}`).value,recommendedTraining:document.getElementById(`target_training_${domId}`).value}; const res=await fetch('/api/update-target-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao salvar sessao Target.'); await load(); }
async function deleteTarget(sessionId){ if(!confirm('Deletar esta sessao Target?')) return; const res=await fetch('/api/delete-target-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})}); const data=await res.json(); if(!data.ok) alert(data.error||'Falha ao deletar sessao Target.'); await load(); }
function exportSelectedAthleteJson(){
  const athlete = athleteSelect.value;
  const item = (SNAPSHOT?.athlete360||[]).find(a=>a.athlete===athlete);
  if(!athlete || !item){ alert('Selecione um atleta para exportar.'); return; }
  const payload = {
    format: 'SPORTS_PERFORMANCE_ATHLETE_TRAINING_DB',
    indicator: 'SPORTS_PERFORMANCE_TRAINING_DB_V1',
    version: '3.4.1',
    exportedAt: Date.now(),
    athlete,
    athlete360: item,
    shotSeries: (SNAPSHOT.shotSeries||[]).filter(r=>r.atleta===athlete),
    athleteSubmissions: (SNAPSHOT.pendingGroups||[]).filter(r=>r.athlete===athlete),
    targetSessions: (SNAPSHOT.targetSessions||[]).filter(r=>r.athlete===athlete),
    trainingPlan: SNAPSHOT.trainingPlan||[],
    prescriptions: (SNAPSHOT.prescriptions||[]).filter(r=>String((r.block||'')+' '+(r.trainingTitle||'')).toLowerCase().includes(String(athlete).toLowerCase()))
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sportsperformance_${String(athlete).replace(/[^a-z0-9_-]+/gi,'_')}_training_db.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportLeads(){ const rows=SNAPSHOT?.leads||[]; const csv=['athleteName,athleteEmail,source,updatedAt',...rows.map(r=>[r.athleteName,r.athleteEmail,r.source,r.updatedAt].map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='sportsperformance_leads.csv'; a.click(); }
async function load(){ const d=await (await fetch('/api/snapshot?lang='+LANG)).json(); SNAPSHOT=d; const selected=athleteSelect.value; athleteSelect.innerHTML=(d.athlete360||[]).map(a=>`<option value="${escapeHtml(a.athlete)}">${escapeHtml(a.athlete)}</option>`).join(''); if([...athleteSelect.options].some(o=>o.value===selected)) athleteSelect.value=selected; renderAthlete360(); leads.innerHTML=renderLeads(d.leads||[]); pending.innerHTML=table(d.pendingGroups||[],[['Atleta','athlete'],['Evento','event'],['Sessao','session'],['Prova','prova'],['Series','seriesCount'],['Disparos','shotCount'],['Total','total',v=>Number(v||0).toFixed(1)],['Acao','key',(v,r)=>`<div style="display:flex; gap:6px"><button ${r.complete?'':'disabled'} onclick="approve(${jsonArg(v)})">Aprovar</button><button class="btn-del" onclick="reject(${jsonArg(v)})">Reprovar</button></div>`]]); series.innerHTML=table((d.shotSeries||[]).slice(0,200),[['Atleta','atleta'],['Evento','evento'],['Sessao','sessao'],['Prova','prova'],['Serie','serie'],['Tiros','tiros'],['Data','dataColeta',fmtDate]]); targets.innerHTML=renderTargets(d.targetSessions||[]); plan.innerHTML=`<div><span class="pill">configs: ${(d.trainingPlan||[]).length}</span> <span class="pill">prescricoes: ${(d.prescriptions||[]).length}</span></div>`+table(d.prescriptions||[],[['Dia','day'],['Bloco','block'],['Codigo','code'],['Treino','trainingTitle'],['Por','prescribedByRole'],['Atualizado','updatedAt',fmtDate]]); }
load();
</script>
</body></html>"""


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
