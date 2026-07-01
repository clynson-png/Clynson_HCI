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

# ==============================================================================
# SportsPerformance Admin Control v4.2 - INTEGRATED DEPLOYMENT
# ==============================================================================
# INTEGRATION: v3.4 TargetScan Engine + v4.2 Precision Sync + Unified ISSF Panels
# ==============================================================================

ROOT = os.path.dirname(os.path.abspath(__file__))
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
PACKAGE = "com.example.sportsperformance"
PORT = 8767
PRIMARY_RUNTIME_SITE_PACKAGES = os.path.expandvars(r"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages")
if os.path.isdir(PRIMARY_RUNTIME_SITE_PACKAGES) and PRIMARY_RUNTIME_SITE_PACKAGES not in sys.path:
    sys.path.append(PRIMARY_RUNTIME_SITE_PACKAGES)

try: from pypdf import PdfReader
except: PdfReader = None

# ------------------------------------------------------------------------------
# DATABASE & ADB CORE
# ------------------------------------------------------------------------------

def run_adb(args, *, capture=True, input_bytes=None):
    return subprocess.run([ADB, *args], input=input_bytes, capture_output=capture, check=True)

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

# ------------------------------------------------------------------------------
# TargetScan Logic Engine (v3.4)
# ------------------------------------------------------------------------------

def parse_target_scan_text(text, athlete, event, session, prova):
    clean_text = str(text or "").replace(",", ".")
    numeric = [float(v) for v in re.findall(r"\b(?:10(?:\.\d)?|[0-9](?:\.\d)?)\b", clean_text)]
    shots = numeric[-60:] if len(numeric) >= 60 else numeric
    if len(shots) < 10: raise ValueError("Disparos insuficientes no TargetScan.")

    is_rifle = str(prova).upper() == "RIFLE"
    if not is_rifle: shots = [float(int(s)) for s in shots]

    chunks = [shots[i:i+10] for i in range(0, min(len(shots), 60), 10)]
    now = int(time.time() * 1000)
    rows = []
    for idx, chunk in enumerate(chunks):
        rows.append({
            "submissionId": f"{athlete}_{event}_{session}_SR{idx+1}_{now+idx}",
            "athlete": athlete, "event": event, "session": session, "prova": prova,
            "serie": f"SR{idx+1}", "shots": ",".join(map(str, chunk)),
            "source": "TARGETSCAN_ADMIN", "status": "PENDING_COACH_REVIEW", "submittedAt": now + idx
        })
    return rows

def import_target_scan(payload):
    athlete = str(payload.get("athlete", "")).strip()
    if not athlete: raise ValueError("Selecione o atleta.")
    rows = parse_target_scan_text(payload.get("text", ""), athlete, payload.get("event", "TS_ADMIN"), payload.get("session", "TREINO"), payload.get("prova", "PISTOL"))
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        for r in rows:
            cur.execute("INSERT OR REPLACE INTO athlete_submission (submissionId, athlete, event, session, prova, serie, shots, source, status, submittedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (r["submissionId"], r["athlete"], r["event"], r["session"], r["prova"], r["serie"], r["shots"], r["source"], r["status"], r["submittedAt"]))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True, "series": len(rows)}
    finally: shutil.rmtree(tmp, ignore_errors=True)

# ------------------------------------------------------------------------------
# LEADS & ADMIN ENGINES (v4.1 Stable)
# ------------------------------------------------------------------------------

def update_manual_lead(payload):
    lead_id = str(payload.get("leadId", "")).strip()
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("UPDATE qualified_lead SET athleteName=?, athleteEmail=? WHERE leadId=?", (payload['athleteName'], payload['athleteEmail'], lead_id))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

def delete_manual_lead(lead_id):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("DELETE FROM qualified_lead WHERE leadId=?", (lead_id,))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

def create_manual_lead(name, email):
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); cur = conn.cursor()
        now = int(time.time()*1000)
        cur.execute("INSERT INTO qualified_lead (leadId, athleteName, athleteEmail, source, createdAt, updatedAt) VALUES (?,?,?,?,?,?)", (email, name, email, "ADMIN_MANUAL", now, now))
        conn.commit(); conn.close(); push_database(tmp); return {"ok": True}
    finally: shutil.rmtree(tmp, ignore_errors=True)

# ------------------------------------------------------------------------------
# DATA AGGREGATION
# ------------------------------------------------------------------------------

def build_snapshot():
    tmp, db_path = copy_app_database()
    try:
        conn = sqlite3.connect(db_path); conn.row_factory = sqlite3.Row; cur = conn.cursor()
        shot_rows = rows_as_dicts(cur, "SELECT * FROM shot_series ORDER BY dataColeta DESC LIMIT 1000")
        target_rows = rows_as_dicts(cur, "SELECT * FROM target_session ORDER BY submittedAt DESC LIMIT 200")
        leads = rows_as_dicts(cur, "SELECT * FROM qualified_lead ORDER BY updatedAt DESC")

        athletes = sorted({*(r.get("atleta") for r in shot_rows), *(r.get("athlete") for r in target_rows), *(r.get("athleteName") for r in leads)} - {None, ""})
        athlete360 = []
        for athlete in athletes:
            a_shots = [r for r in shot_rows if r.get("atleta") == athlete]
            sessions = []
            for row in a_shots[:10]:
                shots = split_numbers(row["tiros"])
                sessions.append({"evento": row["evento"], "sessao": row["sessao"], "total": sum(shots), "media": (sum(shots)/len(shots) if shots else 0), "data": row["dataColeta"]})
            athlete360.append({"athlete": athlete, "sessions": sessions})

        return {
            "leads": leads,
            "pendingISSF": rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE status = 'PENDING_COACH_REVIEW' ORDER BY submittedAt DESC"),
            "targetSessions": target_rows,
            "prescriptions": rows_as_dicts(cur, "SELECT * FROM training_plan_prescription ORDER BY updatedAt DESC LIMIT 20"),
            "athlete360": athlete360,
            "shotSeries": shot_rows[:50]
        }
    finally: shutil.rmtree(tmp, ignore_errors=True)

# ------------------------------------------------------------------------------
# UI FRAMEWORK
# ------------------------------------------------------------------------------

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" /><title>SportsPerformance Admin v4.2</title>
  <style>
    :root { --bg:#f4f7f6; --panel:#fff; --header-bg:#1c1e21; --text:#2c3e50; --muted:#7f8c8d; --accent:#1877f2; --border:#e0e4e9; --danger:#fa3e3e; --success:#42b72a; }
    body{margin:0; font-family:'Segoe UI', sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden}
    header{padding:12px 20px; background:var(--header-bg); color:white; display:flex; justify-content:space-between; align-items:center; flex-shrink:0}
    main{display:grid; grid-template-columns:320px 1fr; flex:1; overflow:hidden}
    aside{background:var(--panel); border-right:1px solid var(--border); padding:20px; overflow-y:auto}
    .content-area{padding:20px; overflow-y:auto}
    .tabs{display:flex; border-bottom:2px solid var(--border); margin-bottom:20px}
    .tab{padding:14px 24px; cursor:pointer; font-weight:bold; color:var(--muted); border-bottom:3px solid transparent; font-size:13px}
    .tab.active{color:var(--accent); border-bottom-color:var(--accent)}
    .card { background:var(--panel); border-radius:10px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.1); overflow:hidden; margin-bottom:20px }
    .card-header { background:#f8fafc; padding:12px 16px; border-bottom:1px solid var(--border) }
    .card-header h3 { margin:0; font-size:14px; font-weight:bold; color:var(--header-bg); text-transform:uppercase }
    .card-body { padding:16px; }
    table{width:100%; border-collapse:collapse; font-size:12px} th,td{border-bottom:1px solid var(--border); padding:10px; text-align:left}
    input, select, textarea { padding:8px 12px; border:1px solid var(--border); border-radius:6px; font-size:12px; width:100% }
    .btn { border:none; border-radius:6px; color:white; padding:8px 16px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s }
    .btn-blue { background:var(--accent) } .btn-red { background:var(--danger) } .btn-green { background:var(--success) }
    .tag { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
  </style>
</head>
<body>
<header>
  <h1>Admin Framework v4.2</h1>
  <div style="display:flex; gap:10px"><button class="btn btn-green" onclick="load()">SINCRONIZAR</button><button class="btn btn-red" onclick="shutdown()">SAIR</button></div>
</header>
<main>
  <aside>
    <h3 style="font-size:13px; color:var(--muted); margin-top:0">Contexto Atleta</h3>
    <select id="athleteSelect" onchange="renderTabs()" style="font-weight:bold; margin-bottom:20px"></select>
  </aside>
  <div class="content-area">
    <div class="tabs">
      <div class="tab active" onclick="setTab('Resumo')">RESUMO</div>
      <div class="tab" onclick="setTab('Target')">ANÁLISE RADIAL</div>
      <div class="tab" onclick="setTab('Ritmo')">RITMO DUAL-AXIS</div>
    </div>

    <div id="view_Resumo" class="view">
      <!-- LEADS ENGINE (v4.1) -->
      <div class="card">
        <div class="card-header"><h3>Gestão de Leads</h3></div>
        <div class="card-body">
          <div style="display:flex; gap:10px; margin-bottom:15px">
            <input id="newLeadName" placeholder="Nome Completo" style="flex:1" />
            <input id="newLeadEmail" placeholder="email@atleta.com" style="flex:1" />
            <button class="btn btn-blue" onclick="addLead()">Criar Lead</button>
          </div>
          <div id="leadsList"></div>
        </div>
      </div>

      <!-- ISSF PANEL (Unified Design v4.2) -->
      <div class="card">
        <div class="card-header"><h3>Histórico de Sessões ISSF (Gerenciar)</h3></div>
        <div class="card-body">
          <div id="issfSessions"></div>
        </div>
      </div>

      <!-- TARGET SESSIONS PANEL (Unification style) -->
      <div class="card">
        <div class="card-header"><h3>HCI Target Sessions</h3></div>
        <div class="card-body" id="targetSessions" style="padding:0"></div>
      </div>

      <!-- TARGETSCAN ENGINE INTEGRATED (v4.2) -->
      <div class="card">
        <div class="card-header"><h3>Importar TargetScan para atleta (Motor v3.4)</h3></div>
        <div class="card-body">
          <div style="display:flex; gap:10px; margin-bottom:10px">
            <input id="tsEvent" placeholder="Evento" value="TS_IMPORT" />
            <select id="tsSession"><option>TREINO</option><option>COMPETIÇÃO</option></select>
            <select id="tsProva"><option>PISTOL</option><option>RIFLE</option></select>
          </div>
          <textarea id="tsText" placeholder="Cole o texto exportado do TargetScan aqui..." style="height:100px; margin-bottom:15px"></textarea>
          <button class="btn btn-blue" style="width:100%" onclick="importTS()">Carregar para Atleta Selecionado</button>
          <div id="tsStatus" style="margin-top:10px; font-size:11px; color:var(--muted)"></div>
        </div>
      </div>
    </div>

    <div id="view_Target" class="view" style="display:none">Análise Radial...</div>
    <div id="view_Ritmo" class="view" style="display:none">Ritmo...</div>
  </div>
</main>

<script>
let SNAPSHOT = null; let TAB = 'Resumo';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setTab(t) { TAB=t; document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active', el.innerText.includes(t.toUpperCase()))); document.querySelectorAll('.view').forEach(el=>el.style.display=(el.id==='view_'+t?'block':'none')); renderTabs(); }

async function load() {
    const d = await fetch('/api/snapshot').then(r=>r.json()); SNAPSHOT=d;
    athleteSelect.innerHTML = d.athlete360.map(a=>`<option value="${a.athlete}">${a.athlete}</option>`).join('');
    renderTabs();
}

function renderTabs() {
    if(!SNAPSHOT) return;
    const item = SNAPSHOT.athlete360.find(a=>a.athlete===athleteSelect.value)||SNAPSHOT.athlete360[0];
    if(TAB==='Resumo') renderResumo(item);
}

function renderResumo(item) {
    leadsList.innerHTML = '<table><thead><tr><th>Atleta</th><th>E-mail</th><th>Ações</th></tr></thead><tbody>' +
        SNAPSHOT.leads.map((l,idx) => `<tr><td><input id="ln_${idx}" value="${l.athleteName}"/></td><td><input id="le_${idx}" value="${l.athleteEmail}"/></td><td><button class="btn btn-blue" onclick="saveLead('${l.leadId}',${idx})">Salvar</button> <button class="btn btn-red" onclick="delLead('${l.leadId}')">Deletar</button></td></tr>`).join('') + '</tbody></table>';

    issfSessions.innerHTML = '<table><thead><tr><th>Evento</th><th>Sessão</th><th>Total</th><th>Média</th><th>Ação</th></tr></thead><tbody>' +
        (item.sessions || []).map(s => `<tr><td>${s.evento}</td><td>${s.sessao}</td><td>${s.total.toFixed(1)}</td><td>${s.media.toFixed(2)}</td><td><button class="btn btn-red">Deletar</button></td></tr>`).join('') + '</tbody></table>';

    targetSessions.innerHTML = '<table><thead><tr><th>Atleta</th><th>Evento</th><th>Zonas</th><th>Ações</th></tr></thead><tbody>' +
        SNAPSHOT.targetSessions.slice(0,5).map(t => `<tr><td>${t.athlete}</td><td>${t.event}</td><td>${t.zoneCounts}</td><td><button class="btn btn-blue">Salvar</button> <button class="btn btn-blue">Lançar</button></td></tr>`).join('') + '</tbody></table>';
}

async function addLead() { await fetch('/api/create-lead', {method:'POST', body:JSON.stringify({name:newLeadName.value, email:newLeadEmail.value})}); load(); }
async function saveLead(id, idx) { await fetch('/api/update-lead', {method:'POST', body:JSON.stringify({leadId:id, athleteName:document.getElementById('ln_'+idx).value, athleteEmail:document.getElementById('le_'+idx).value})}); load(); }
async function delLead(id) { if(confirm('Deletar?')) { await fetch('/api/delete-lead', {method:'POST', body:JSON.stringify({leadId:id})}); load(); } }

async function importTS() {
    tsStatus.innerText = "Importando...";
    const res = await fetch('/api/import-targetscan', {method:'POST', body:JSON.stringify({athlete:athleteSelect.value, event:tsEvent.value, session:tsSession.value, prova:tsProva.value, text:tsText.value})});
    const d = await res.json();
    tsStatus.innerText = d.ok ? `Importado: ${d.series} séries.` : `Erro: ${d.error}`;
    if(d.ok) { tsText.value=""; load(); }
}

async function shutdown() { await fetch('/api/shutdown', {method:'POST'}); window.close(); }
load();
</script>
</body></html>"""

class Handler(BaseHTTPRequestHandler):
    def _send(self, body, content_type="application/json", status=200):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str): body = body.encode("utf-8"); content_type="text/html"
        self.send_response(status); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/": return self._send(HTML)
        if p == "/api/snapshot": return self._send(build_snapshot())
        return self._send("Not found", status=404)
    def do_POST(self):
        p = urlparse(self.path).path; len_ = int(self.headers.get("Content-Length", "0")); body = json.loads(self.rfile.read(len_).decode("utf-8") or "{}")
        try:
            if p == "/api/create-lead": return self._send(create_manual_lead(body['name'], body['email']))
            if p == "/api/update-lead": return self._send(update_manual_lead(body))
            if p == "/api/delete-lead": return self._send(delete_manual_lead(body['leadId']))
            if p == "/api/import-targetscan": return self._send(import_target_scan(body))
            if p == "/api/shutdown": self._send({"ok": True}); threading.Thread(target=self.server.shutdown).start(); return
            return self._send("Not found", status=404)
        except Exception as e: return self._send({"ok": False, "error": str(e)}, status=400)

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Admin v4.2 Integrado (Porta {PORT})")
    server.serve_forever()
