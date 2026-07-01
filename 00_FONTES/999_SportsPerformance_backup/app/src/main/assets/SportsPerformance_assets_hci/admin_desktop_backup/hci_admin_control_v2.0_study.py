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
from math import sqrt, pi, cos, sin
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# SportsPerformance Admin Control v2.0 - FULL OPERATIONAL + MESOCICLO
ROOT = os.path.dirname(os.path.abspath(__file__))
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
PACKAGE = "com.example.sportsperformance"
PORT = 8766

def run_adb(args, *, capture=True):
    return subprocess.run([ADB, *args], capture_output=capture, check=True)

def copy_app_database():
    tmp = tempfile.mkdtemp(prefix="hci-admin-db-")
    db_path = os.path.join(tmp, "sports_performance_db")
    for suffix in ["", "-wal", "-shm"]:
        remote = f"databases/sports_performance_db{suffix}"
        local = os.path.join(tmp, f"sports_performance_db{suffix}")
        try:
            result = run_adb(["exec-out", "run-as", PACKAGE, "cat", remote])
            with open(local, "wb") as fh: fh.write(result.stdout)
        except:
            if suffix == "": raise
    return tmp, db_path

def push_database(tmp):
    run_adb(["shell", "am", "force-stop", PACKAGE])
    for suffix in ["", "-wal", "-shm"]:
        local = os.path.join(tmp, f"sports_performance_db{suffix}")
        if os.path.exists(local):
            remote_tmp = f"/data/local/tmp/sports_performance_db{suffix}"
            run_adb(["push", local, remote_tmp])
            run_adb(["shell", "run-as", PACKAGE, "cp", remote_tmp, f"databases/sports_performance_db{suffix}"])
            run_adb(["shell", "rm", "-f", remote_tmp])

def rows_as_dicts(cur, query, params=()):
    cur.execute(query, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def split_numbers(value):
    if not value: return []
    return [float(part) for part in str(value).split(",") if part.strip()]

def avg(values):
    clean = [float(v) for v in values if v is not None]
    return sum(clean) / len(clean) if clean else 0.0

def median(values):
    clean = sorted([float(v) for v in values if v is not None])
    if not clean: return 0.0
    n = len(clean)
    return clean[n // 2] if n % 2 == 1 else (clean[n // 2 - 1] + clean[n // 2]) / 2.0

def stdev(values):
    clean = [float(v) for v in values if v is not None]
    if len(clean) < 2: return 0.0
    mean = avg(clean)
    return sqrt(sum((v - mean) ** 2 for v in clean) / len(clean))

def score_level(score, lang='PT'):
    if score >= 9: return "ELITE"
    if score >= 7: return "HIGH PERFORMANCE" if lang == 'EN' else "ALTO RENDIMENTO"
    if score >= 5: return "INTERMEDIATE" if lang == 'EN' else "INTERMEDIARIO"
    return "BEGINNER" if lang == 'EN' else "INICIANTE"

def build_athlete360(data, lang='PT'):
    athletes = sorted({*(row.get("athleteName") for row in data["leads"]), *(row.get("atleta") for row in data["shotSeries"]), *(row.get("athlete") for row in data["targetSessions"])} - {None, ""})
    result = []
    for athlete in athletes:
        shot_rows = [r for r in data["shotSeries"] if r.get("atleta") == athlete]
        target_rows = [r for r in data["targetSessions"] if r.get("athlete") == athlete]

        groups = {}
        for row in shot_rows:
            key = "|".join([str(row.get("evento", "")), str(row.get("sessao", "")), str(row.get("idBloco", ""))])
            groups.setdefault(key, []).append(row)

        sessions = []
        for key, rows in groups.items():
            rows = sorted(rows, key=lambda r: int("".join(filter(str.isdigit, r.get("serie",""))) or "0"))
            shots = [shot for row in rows for shot in split_numbers(row.get("tiros"))]
            if not shots: continue

            rhythm_path_points = []
            for row in rows:
                s_shots = split_numbers(row.get("tiros"))
                if len(s_shots) >= 3:
                    p1=avg(s_shots[0:3]); p2=avg(s_shots[3:6]); p3=avg(s_shots[6:9])
                    r_id = row.get("serie", "")
                    rhythm_path_points.extend([{"label": f"{r_id}_P1", "val": round(p1, 2)},{"label": f"{r_id}_P2", "val": round(p2, 2)},{"label": f"{r_id}_P3", "val": round(p3, 2)}])

            series_points = []
            for row in rows:
                s_shots = split_numbers(row.get("tiros")); th = 9.0 if row.get("prova") == "PISTOL" else 10.0
                m = median(s_shots); drop = round(th - m, 2) if m < th else None
                series_points.append({"serie": row.get("serie"), "media": round(m, 2), "std": round(stdev(s_shots), 2), "total": round(sum(s_shots), 1), "mainDropDepth": drop})

            sessions.append({"key": key, "evento": rows[0].get("evento"), "sessao": rows[0].get("sessao"), "prova": rows[0].get("prova"), "data": rows[0].get("dataColeta"), "total": round(sum(shots), 1), "media": round(median(shots), 2), "series": series_points, "rhythmPath": rhythm_path_points})

        sessions = sorted(sessions, key=lambda r: r.get("data") or 0, reverse=True)
        if not sessions:
            result.append({"athlete": athlete, "prova": "-", "hci": 0, "level": score_level(0, lang), "latestTotal": 0, "medianTotal": 0, "sessionsCount": 0, "targetCount": len(target_rows), "parameters": [], "sessions": [], "directionalData": []})
            continue

        latest = sessions[0]; prova = latest.get("prova"); reference = 578.0 if prova == "PISTOL" else 632.6
        rhythm = max(0.0, min(10.0, 10.0 - stdev([s.get("media", 0) for s in latest.get("series", [])]) * 10.0))
        consistency = max(0.0, min(10.0, 10.0 - stdev([float(p["total"]) for p in latest.get("series", [])]) * 1.2))
        outcome = max(0.0, min(10.0, (float(latest.get("total") or 0) / reference) * 10.0))

        params = [
            {"parameter": "RHYTHM", "score": round(rhythm, 2), "level": score_level(rhythm, lang), "reading": f"• RHYTHM — {score_level(rhythm, lang)}: Stable rhythm." if lang=='EN' else f"• RITMO — {score_level(rhythm, lang)}: Ritmo estável."},
            {"parameter": "OUTCOME", "score": round(outcome, 2), "level": score_level(outcome, lang), "reading": "• OUTCOME: Result level."},
            {"parameter": "CONSISTENCY", "score": round(consistency, 2), "level": score_level(consistency, lang), "reading": "• CONSISTENCY: Repeating level."},
            {"parameter": "PROCESS", "score": 9.2, "level": "ELITE", "reading": "• PROCESS: Sustainment."},
            {"parameter": "DEEPENING", "score": 8.8, "level": "ELITE", "reading": "• DEEPENING: Impact sequence."},
            {"parameter": "RESILIENCE", "score": 8.0, "level": "HIGH PERFORMANCE", "reading": "• RESILIENCE: Reset pattern."},
            {"parameter": "TRANSFER", "score": 7.5, "level": "HIGH PERFORMANCE", "reading": "• TRANSFER: Field adaptation."},
            {"parameter": "PRESSURE", "score": 7.0, "level": "HIGH PERFORMANCE", "reading": "• PRESSURE: Mental load."},
            {"parameter": "EMOTIONAL", "score": 9.0, "level": "ELITE", "reading": "• EMOTIONAL: Control."},
            {"parameter": "PHYSICAL", "score": 10.0, "level": "ELITE", "reading": "• PHYSICAL: Match endurance."}
        ]

        directional_data = []
        for s in latest.get("series", []):
            try:
                row = next(r for r in shot_rows if r.get("serie") == s["serie"] and r.get("evento") == latest["evento"] and r.get("sessao") == latest["sessao"])
                notes = str(row.get("notes", ""))
                if "DIRECTIONS:" in notes:
                    parts = notes.split("DIRECTIONS: ")[1].split(" | ")
                    for p in parts:
                        if p.startswith(s["serie"]):
                            shot_map = p.split("=")[1].split(",")
                            for sm in shot_map:
                                dir_code = sm.split(":")[1]
                                if dir_code != "-": directional_data.append(dir_code)
            except: pass

        result.append({"athlete": athlete, "prova": prova, "hci": round(avg([p["score"] for p in params]), 2), "level": score_level(avg([p["score"] for p in params]), lang), "latestTotal": latest.get("total"), "medianTotal": round(median([s['total'] for s in sessions]), 1), "sessionsCount": len(sessions), "targetCount": len(target_rows), "parameters": params, "sessions": sessions, "directionalData": directional_data})
    return result

def load_snapshot(lang='PT'):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); conn.row_factory = sqlite3.Row; cur = conn.cursor()
        data = {
            "leads": rows_as_dicts(cur, "SELECT * FROM qualified_lead ORDER BY updatedAt DESC"),
            "pendingGroups": pending_groups(rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE status = 'PENDING_COACH_REVIEW' ORDER BY submittedAt DESC")),
            "shotSeries": rows_as_dicts(cur, "SELECT * FROM shot_series ORDER BY dataColeta DESC LIMIT 500"),
            "targetSessions": rows_as_dicts(cur, "SELECT * FROM target_session ORDER BY submittedAt DESC LIMIT 200"),
            "prescriptions": rows_as_dicts(cur, "SELECT * FROM training_plan_prescription ORDER BY day ASC, block ASC"),
            "periodization": rows_as_dicts(cur, "SELECT * FROM periodization_config LIMIT 1")
        }
        data["athlete360"] = build_athlete360(data, lang)
        conn.close(); return data
    finally: shutil.rmtree(tmp, ignore_errors=True)

def save_periodization(c):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("DELETE FROM periodization_config")
        cur.execute("INSERT INTO periodization_config (id, phaseName, volumePercentage, intensityPercentage, technicalFocus, physicalFocus) VALUES (?,?,?,?,?,?)", ('main', c['phaseName'], c['volumePercentage'], c['intensityPercentage'], c['technicalFocus'], c['physicalFocus']))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

def save_prescription(p):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO training_plan_prescription (cellKey, day, block, code, trainingId, trainingTitle, prescribedByRole, updatedAt) VALUES (?,?,?,?,?,?,?,?)", (p['cellKey'], p['day'], p['block'], p['code'], p['cellKey'], p['trainingTitle'], 'ADMIN_DESKTOP', int(time.time()*1000)))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

def delete_session(athlete, event, session_type):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("DELETE FROM shot_series WHERE atleta=? AND evento=? AND sessao=?", (athlete, event, session_type))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

def pending_groups(submissions):
    groups = {}
    for item in submissions:
        key = "|".join([item["athlete"], item["event"], item["session"], item["prova"], item["source"]])
        groups.setdefault(key, []).append(item)
    res = []
    for key, rows in groups.items():
        rows = sorted(rows, key=lambda r: r["serie"])
        res.append({"key": key, "athlete": rows[0]["athlete"], "event": rows[0]["event"], "total": sum(sum(split_numbers(r["shots"])) for r in rows)})
    return res

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" /><title>SportsPerformance Admin v2.0 FULL</title>
  <style>
    :root { --bg:#f5f7fb; --panel:#fff; --line:#d8e0ea; --text:#1f2937; --muted:#667085; --accent:#2459d6; --ok:#166534; --error:#dc2626; --warn:#b45309; }
    body{margin:0; font-family:Inter,Segoe UI,Arial; background:var(--bg); color:var(--text)}
    header{padding:16px; background:#101827; color:white; display:flex; justify-content:space-between; align-items:center}
    main{padding:16px; display:grid; gap:16px; grid-template-columns:1fr 1fr}
    section{background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:20px; position:relative}
    .wide{grid-column:1/-1} .scroll{max-height:400px; overflow:auto}
    table{width:100%; border-collapse:collapse; font-size:12px} th,td{border-bottom:1px solid var(--line); padding:10px; text-align:left}
    button{border:0; border-radius:6px; background:var(--accent); color:white; padding:8px 12px; cursor:pointer; font-weight:bold; font-size:12px}
    .metric{border:1px solid var(--line); border-radius:8px; padding:12px; background:#fbfdff} .metric b{display:block; font-size:24px}
    .tabs{display:flex; border-bottom:1px solid var(--line); margin:16px 0} .tab{background:none; color:var(--muted); padding:12px 24px; border-bottom:3px solid transparent; font-weight:bold; cursor:pointer} .tab.active{color:var(--accent); border-bottom-color:var(--accent)}
    .meso-grid{display:grid; grid-template-columns:160px repeat(31, minmax(50px, 1fr)); gap:1px; background:var(--line); border:1px solid var(--line); overflow-x:auto}
    .meso-cell{background:white; padding:8px; min-height:90px; font-size:11px; cursor:pointer} .meso-cell:hover{background:#f0f7ff}
    .meso-hdr{background:#f8fafc; font-weight:bold; text-align:center; padding:12px 0}
    .code-pill{display:inline-block; padding:2px 6px; border-radius:4px; background:var(--accent); color:white; font-weight:bold; margin-bottom:4px}
    .period-panel{display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:16px}
    .intel-box{border-left:4px solid var(--accent); padding-left:12px; margin:10px 0; font-size:13px; line-height:1.5}
    .drop-note{fill:var(--error); font-size:11px; font-weight:bold}
    .grid2{display:grid; grid-template-columns:1fr 1fr; gap:24px}
    @media print { .no-print { display:none !important; } main { display:block !important; } section { border:0 !important; } }
  </style>
</head>
<body>
<header>
  <h1>Admin Control v2.0</h1>
  <div class="no-print" style="display:flex; gap:8px">
    <button onclick="toggleLang()">PT / EN</button>
    <button onclick="load()" style="background:var(--ok)">SINCRONIZAR (CELULAR <-> PC)</button>
    <button onclick="shutdown()" style="background:#475569">SAIR</button>
  </div>
</header>
<main>
  <section class="wide no-print"><h2>Gerenciamento & Leads</h2>
    <div style="display:flex; gap:10px">
      <input id="newLeadName" placeholder="Nome do Atleta" style="flex:1; padding:8px" />
      <input id="newLeadEmail" placeholder="Email" style="flex:1; padding:8px" />
      <button onclick="addLead()">Criar Lead</button>
      <button onclick="exportLeads()" style="background:#475569">Exportar Leads CSV</button>
    </div>
  </section>

  <section class="wide"><h2>Visão do Atleta 360 <button onclick="window.print()" style="float:right" class="no-print">Imprimir Relatório</button></h2>
    <div class="no-print" style="margin-bottom:10px"><select id="athleteSelect" onchange="renderAthlete360()" style="padding:10px; width:300px; font-weight:bold"></select></div>
    <div id="athlete360"></div>
  </section>

  <section class="no-print"><h2>Histórico de Sessões (Deletar Erros)</h2><div id="sessionHistory" class="scroll"></div></section>
  <section class="no-print"><h2>Aprovações ISSF Pendentes</h2><div id="pending" class="scroll"></div></section>
</main>

<div id="modalEdit" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); align-items:center; justify-content:center; z-index:1000">
  <div style="background:white; padding:24px; border-radius:12px; width:450px">
    <h2 id="modalTitle">Editar Treino do Plano</h2>
    <label>Código (Ex: RT, D, COM)</label><input id="editCode" style="width:100%; padding:10px; margin-bottom:10px" />
    <label>Título do Treino</label><input id="editTitle" style="width:100%; padding:10px; margin-bottom:20px" />
    <div style="display:flex; gap:8px; justify-content:flex-end">
      <button onclick="closeModal()" style="background:#64748b">Cancelar</button>
      <button onclick="saveCell()">Salvar</button>
    </div>
  </div>
</div>

<script>
let SNAPSHOT = null; let ATHLETE_TAB = 'Plano'; let LANG = 'PT'; let EDITING_CELL = null;
const BLOCKS = ["ROUTINE", "PHYSICAL - AEROBIC", "KEY COMPETITION SKILLS", "KEY FUNDAMENTAL SKILLS"];
const TXT = { PT: { med: "Mediana Histórica", rhythm: "RITMO SAÍDA", target: "RADAR DIRECIONAL" }, EN: { med: "Historical Median", rhythm: "RHYTHM OUTPUT", target: "DIRECTIONAL RADAR" } };

function toggleLang() { LANG = LANG === 'PT' ? 'EN' : 'PT'; load(); }

function radarChart(data, label, color) {
  if(!data || !data.length) return "";
  const w=380, h=380, center=190, radius=130; const angleStep = (Math.PI*2)/data.length;
  const pts = data.map(function(d,i){ const v=(d.score/10)*radius; return (center+v*Math.cos(i*angleStep-Math.PI/2)).toFixed(1)+","+(center+v*Math.sin(i*angleStep-Math.PI/2)).toFixed(1); }).join(' ');
  const grids = [2,4,6,8,10].map(function(r){ return '<circle cx="'+center+'" cy="'+center+'" r="'+(r/10)*radius+'" fill="none" stroke="#e2e8f0" />'; }).join('');
  const lbls = data.map(function(d,i){ const x=center+(radius+30)*Math.cos(i*angleStep-Math.PI/2), y=center+(radius+30)*Math.sin(i*angleStep-Math.PI/2); return '<text x="'+x+'" y="'+y+'" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle" dominant-baseline="middle">'+d.parameter+'</text>'; }).join('');
  return '<div style="text-align:center"><h4>'+label+'</h4><svg viewBox="0 0 '+w+' '+h+'" width="100%" height="340">'+grids+data.map(function(_,i){return '<line x1="'+center+'" y1="'+center+'" x2="'+(center+radius*Math.cos(i*angleStep-Math.PI/2))+'" y2="'+(center+radius*Math.sin(i*angleStep-Math.PI/2))+'" stroke="#e2e8f0" />';}).join('')+'<polygon points="'+pts+'" fill="'+color+'" fill-opacity="0.25" stroke="'+color+'" stroke-width="3" />'+lbls+'</svg></div>';
}

function rhythmChart(series) {
  if(!series || !series.length) return '';
  const vals = series.map(function(s){return s.media;}); const w=800, h=280, pad=40, min=8, max=11, range=max-min;
  const xStep = (w-pad*2)/Math.max(1, series.length-1);
  const pts = vals.map(function(v,i){ return [pad+i*xStep, h-pad-((v-min)/range)*(h-pad*2)]; });
  const poly = pts.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1);}).join(' ');
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="300"><rect x="0" y="0" width="'+w+'" height="'+h+'" fill="#fbfdff" stroke="#cbd5e1"/><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="#94a3b8" stroke-width="2"/><polyline points="'+poly+'" fill="none" stroke="#2563eb" stroke-width="3"/>'+pts.map(function(p,i){ return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="#1e293b"/>' + (series[i].mainDropDepth ? '<text x="'+p[0]+'" y="'+(p[1]-15)+'" class="drop-note" text-anchor="middle">DROP '+series[i].mainDropDepth+'</text>' : ''); }).join('')+'<text x="'+pad+'" y="25" font-size="16" font-weight="bold">'+TXT[LANG].rhythm+'</text></svg>';
}

function targetRadar(directionalData) {
  const dirs = { "N":0, "NE":0, "E":0, "SE":0, "S":0, "SW":0, "W":0, "NW":0 }; (directionalData||[]).forEach(function(d){ if(dirs.hasOwnProperty(d)) dirs[d]++; });
  const sectors = Object.keys(dirs); const max = Math.max(...Object.values(dirs), 1);
  const w=380, center=190, radius=130;
  const pts = sectors.map(function(s,i){ const v=(dirs[s]/max)*radius; return (center+v*Math.cos(i*(Math.PI/4)-Math.PI/2)).toFixed(1)+","+(center+v*Math.sin(i*(Math.PI/4)-Math.PI/2)).toFixed(1); }).join(' ');
  return '<div style="text-align:center"><h4>'+TXT[LANG].target+'</h4><svg viewBox="0 0 '+w+' '+w+'" width="100%" height="340"><circle cx="'+center+'" cy="'+center+'" r="'+radius+'" fill="none" stroke="#cbd5e1" />'+sectors.map(function(s,i){ return '<line x1="'+center+'" y1="'+center+'" x2="'+(center+radius*Math.cos(i*(Math.PI/4)-Math.PI/2))+'" y2="'+(center+radius*Math.sin(i*(Math.PI/4)-Math.PI/2))+'" stroke="#e2e8f0" /><text x="'+(center+(radius+25)*Math.cos(i*(Math.PI/4)-Math.PI/2))+'" y="'+(center+(radius+25)*Math.sin(i*(Math.PI/4)-Math.PI/2))+'" text-anchor="middle" font-size="11" font-weight="bold">'+s+'</text>'; }).join('')+'<polygon points="'+pts+'" fill="#dc2626" fill-opacity="0.25" stroke="#dc2626" stroke-width="3" /></svg></div>';
}

function renderAthlete360() {
  const list = SNAPSHOT ? SNAPSHOT.athlete360 : []; if(!list.length) return;
  const item = list.find(function(a){return a.athlete === athleteSelect.value;}) || list[0];
  const latest = item.sessions[0] || {}; const radarData = item.parameters;
  const tabs = '<div class="tabs no-print">' + ['Plano', 'Resumo', 'Ritmo', 'Target'].map(function(t){ return '<button class="tab '+(ATHLETE_TAB===t?'active':'')+'" onclick="setAthleteTab(\''+t+'\')">'+t+'</button>'; }).join('') + '</div>';
  const content = {
    'Plano': renderPlanoTab(item),
    'Resumo': '<section><div class="intel-box">'+radarData.map(function(p){return '<div>'+p.reading+'</div>';}).join('')+'</div><div class="grid2">'+radarChart(radarData.slice(0,5), "Performance Targets", "#2459d6")+radarChart(radarData.slice(5), "Structure & Resilience", "#7c3aed")+'</div></section>',
    'Ritmo': '<section class="wide">'+rhythmChart(latest.series)+'</section>',
    'Target': '<section class="wide"><div class="grid2">'+targetRadar(item.directionalData)+'<div class="intel-box"><h4>Target Intelligence</h4>'+(item.directionalData.length ? 'Baseado em '+item.directionalData.length+' disparos extraídos.' : 'Aguardando dados direcionais do App.')+'</div></div></section>'
  }[ATHLETE_TAB];
  athlete360.innerHTML = '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px"><div class="metric"><span>Atleta</span><b>'+item.athlete+'</b></div><div class="metric"><span>HCI Geral</span><b>'+item.hci+'</b></div><div class="metric"><span>'+TXT[LANG].med+'</span><b>'+item.medianTotal+'</b></div><div class="metric"><span>Sessões</span><b>'+item.sessionsCount+'</b></div></div>'+tabs+content;

  const histHtml = item.sessions.map(function(s){ return '<tr><td>'+s.evento+'</td><td>'+s.sessao+'</td><td>'+s.total+'</td><td><button class="btn-del no-print" onclick="delSession(\''+item.athlete+'\',\''+s.evento+'\',\''+s.sessao+'\')" style="background:#dc2626">DELETAR</button></td></tr>'; }).join('');
  sessionHistory.innerHTML = '<table><thead><tr><th>Evento</th><th>Tipo</th><th>Total</th><th>Ação</th></tr></thead><tbody>' + histHtml + '</tbody></table>';
}

function renderPlanoTab(item) {
  const config = SNAPSHOT.periodization[0] || {phaseName:'Geral', volumePercentage:0.6, intensityPercentage:0.7, technicalFocus:0.6, physicalFocus:0.4};
  return '<section class="wide"><h2>Mesociclo Operacional</h2>' +
    '<div class="period-panel no-print">' +
    '<div class="metric"><span>Fase</span><select id="pPhase" onchange="updatePeriod()" style="width:100%; padding:5px"><option '+(config.phaseName==='PREPARO GERAL'?'selected':'')+'>PREPARO GERAL</option><option '+(config.phaseName==='PREPARO ESPECÍFICO'?'selected':'')+'>PREPARO ESPECÍFICO</option><option '+(config.phaseName==='PRÉ-COMPETIÇÃO'?'selected':'')+'>PRÉ-COMPETIÇÃO</option><option '+(config.phaseName==='COMPETIÇÃO'?'selected':'')+'>COMPETIÇÃO</option></select></div>' +
    '<div class="metric"><span>Volume</span><input type="range" id="pVol" value="'+(config.volumePercentage*100)+'" oninput="updatePeriod()" /> <b>'+Math.round(config.volumePercentage*100)+'%</b></div>' +
    '<div class="metric"><span>Intensidade</span><input type="range" id="pInt" value="'+(config.intensityPercentage*100)+'" oninput="updatePeriod()" /> <b>'+Math.round(config.intensityPercentage*100)+'%</b></div>' +
    '<div class="metric"><span>Foco Técnico</span><input type="range" id="pTech" value="'+(config.technicalFocus*100)+'" oninput="updatePeriod()" /> <b>'+Math.round(config.technicalFocus*100)+'%</b></div>' +
    '</div><div class="meso-grid"><div class="meso-hdr">Bloco / Dia</div>' + Array.from({length:31}, function(_,i){return '<div class="meso-hdr">'+(i+1)+'</div>';}).join('') +
    BLOCKS.map(function(block){ return '<div class="meso-hdr">'+block+'</div>' + Array.from({length:31}, function(_,i){ const d=i+1; const k=d+'_'+block; const p=SNAPSHOT.prescriptions.find(function(x){return x.cellKey===k;})||{code:'',trainingTitle:''}; return '<div class="meso-cell" onclick="openEdit(\''+k+'\','+d+',\''+block+'\')">'+(p.code?'<span class="code-pill">'+p.code+'</span>':'')+'<div>'+p.trainingTitle+'</div></div>'; }).join(''); }).join('') +
    '</div></section>';
}

async function updatePeriod() {
  const tech = document.getElementById('pTech').value / 100;
  await fetch('/api/save-periodization', {method:'POST', body:JSON.stringify({phaseName: document.getElementById('pPhase').value, volumePercentage: document.getElementById('pVol').value/100, intensityPercentage: document.getElementById('pInt').value/100, technicalFocus: tech, physicalFocus: 1 - tech})});
}
function openEdit(key, day, block) { EDITING_CELL = { cellKey: key, day, block }; const p = SNAPSHOT.prescriptions.find(function(x){return x.cellKey===key;})||{code:'',trainingTitle:''}; document.getElementById('editCode').value=p.code; document.getElementById('editTitle').value=p.trainingTitle; document.getElementById('modalEdit').style.display='flex'; }
function closeModal() { document.getElementById('modalEdit').style.display='none'; }
async function saveCell() { await fetch('/api/save-prescription', {method:'POST', body:JSON.stringify(Object.assign({}, EDITING_CELL, {code: document.getElementById('editCode').value, trainingTitle: document.getElementById('editTitle').value}))}); closeModal(); load(); }
function setAthleteTab(t) { ATHLETE_TAB=t; renderAthlete360(); }
async function shutdown() { await fetch('/api/shutdown', {method:'POST'}); window.close(); }
async function load() {
  const d = await (await fetch('/api/snapshot?lang='+LANG)).json(); SNAPSHOT = d;
  athleteSelect.innerHTML = d.athlete360.map(function(a){return '<option value="'+a.athlete+'">'+a.athlete+'</option>';}).join('');
  renderAthlete360();
  pending.innerHTML = '<table>' + d.pendingGroups.map(function(g){return '<tr><td>'+g.athlete+'</td><td>'+g.total+'</td><td><button onclick="approve(\''+g.key+'\')">Aprovar</button></td></tr>';}).join('') + '</table>';
}
async function addLead() { await fetch('/api/create-lead', {method:'POST', body:JSON.stringify({name:newLeadName.value, email:newLeadEmail.value})}); load(); }
async function approve(key) { await fetch('/api/approve?key=' + encodeURIComponent(key), { method:'POST' }); load(); }
function exportLeads(){ let csv = "Nome;Email;Origem\n"; SNAPSHOT.leads.forEach(function(l){csv += l.athleteName+";"+l.athleteEmail+";"+l.source+"\n";}); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='leads.csv'; a.click(); }
load();
</script>
</body></html>"""

class Handler(BaseHTTPRequestHandler):
    def _send(self, body, content_type="text/html; charset=utf-8", status=200):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode("utf-8"); content_type="application/json"
        elif isinstance(body, str): body = body.encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = urlparse(self.path).path; q = parse_qs(urlparse(self.path).query); lang = q.get("lang", ["PT"])[0]
        if p == "/": return self._send(HTML)
        if p == "/api/snapshot": return self._send(load_snapshot(lang))
        return self._send("Not found", status=404)
    def do_POST(self):
        p = urlparse(self.path).path; len_ = int(self.headers.get("Content-Length", "0")); body = json.loads(self.rfile.read(len_).decode("utf-8") or "{}")
        if p == "/api/approve": return self._send(approve_group(parse_qs(urlparse(self.path).query).get("key", [""])[0]))
        if p == "/api/create-lead": return self._send(create_manual_lead(body['name'], body['email']))
        if p == "/api/save-periodization": return self._send(save_periodization(body))
        if p == "/api/save-prescription": return self._send(save_prescription(body))
        if p == "/api/shutdown": self._send({"ok": True}); threading.Thread(target=self.server.shutdown).start(); return
        return self._send("Not found", status=404)

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"SportsPerformance Admin Control v2.0 FULL rodando em http://127.0.0.1:{PORT}")
    server.serve_forever()
