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
# SportsPerformance Admin Control v4.2 - 100% ENGINE FIDELITY
# ==============================================================================
# RESTORED: Every single function from v3.4 Engine (PDF/Text coordinate parser)
# INTEGRATED: v4.0 Expanded Modular Layout
# ==============================================================================

ROOT = os.path.dirname(os.path.abspath(__file__))
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
PACKAGE = "com.example.sportsperformance"
PORT = 8767
PRIMARY_RUNTIME_SITE_PACKAGES = os.path.expandvars(r"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages")
if os.path.isdir(PRIMARY_RUNTIME_SITE_PACKAGES) and PRIMARY_RUNTIME_SITE_PACKAGES not in sys.path:
    sys.path.append(PRIMARY_RUNTIME_SITE_PACKAGES)

STABLE_DB = r"C:\Users\clyns\AndroidStudioProjects\SportsPerformance\work\admin-desktop\sports_performance_db"

try: from pypdf import PdfReader
except: PdfReader = None

# ------------------------------------------------------------------------------
# CORE DATABASE & ADB (Exact from v3.4)
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

def split_numbers(value):
    if value is None: return []
    if isinstance(value, (list, tuple)): return list(value)
    return [float(part) for part in str(value).split(",") if part.strip()]

# ------------------------------------------------------------------------------
# TARGETSCAN FIDELITY ENGINE (Copied EXACTLY from v3.4)
# ------------------------------------------------------------------------------

def normalize_target_scan_score(token, is_rifle):
    text = str(token or "").replace(" ", "").replace("*", "").replace("x", "").replace("X", "").replace(",", ".")
    if text.startswith("-"): return None
    match = re.search(r"(?<!\d)(10(?:\.\d)?|[0-9](?:\.\d)?)(?!\d)", text)
    if not match: return None
    value = float(match.group(1))
    if not (0.0 <= value <= 10.9): return None
    return value if is_rifle else float(int(value))

def extract_targetscan_series_from_pdf_layout(pdf_base64, is_rifle):
    if not PdfReader: return []
    raw = base64.b64decode(pdf_base64)
    reader = PdfReader(BytesIO(raw))
    if not reader.pages: return []
    page = reader.pages[0]; items = []
    def visitor_text(text, cm, tm, font_dict, font_size):
        token = str(text or "").strip()
        if token: items.append((float(tm[4]), float(tm[5]), token))
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
    total_left = grouped_tokens(230, 290); total_right = grouped_tokens(500, 560); bands = []
    for y in sorted(set(total_left) & set(total_right), reverse=True):
        left = total_left.get(y, ""); right = total_right.get(y, "")
        left_match = re.match(r"^(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?$", left)
        right_match = re.match(r"^(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?$", right)
        if left_match and right_match and int(left_match.group(1)) >= 60 and int(right_match.group(1)) >= 60: bands.append(y)
    bands = sorted(bands[:3])
    if len(bands) != 3: return []
    left_scores = grouped_tokens(248, 280); right_scores = grouped_tokens(522, 552); series_chunks = []
    for band_y in bands:
        for row_map in (left_scores, right_scores):
            shots = []
            for y in sorted(row_map.keys(), reverse=True):
                if band_y > y >= band_y - 110:
                    score = normalize_target_scan_score(row_map[y], is_rifle)
                    if score is not None: shots.append(score)
            if len(shots) >= 10: series_chunks.append(shots[:10])
    return series_chunks[:6]

def extract_targetscan_series_from_exploded_pages(pdf_base64, is_rifle):
    if not PdfReader: return []
    raw = base64.b64decode(pdf_base64); reader = PdfReader(BytesIO(raw))
    if len(reader.pages) < 2: return []
    blocks = []
    for page_index, page in enumerate(reader.pages[1:], start=1):
        items = []
        def visitor_text(text, cm, tm, font_dict, font_size):
            token = str(text or "").strip()
            if token: items.append((float(tm[4]), float(tm[5]), token))
        page.extract_text(visitor_text=visitor_text)
        if not items: continue
        anchors = []
        for x, y, token in items:
            if not re.fullmatch(r"\d{1,2}", token): continue
            index = int(token)
            if not (1 <= index <= 99): continue
            if 30 <= x <= 50 or 305 <= x <= 325: anchors.append((index, x, y))
        for index, x, y in anchors:
            is_left = x < 200; x_min, x_max = ((0, 290) if is_left else (290, 560))
            top, bottom = y - 8, y + 42; score_x_min, score_x_max = ((245, 278) if is_left else (525, 548))
            score_tokens = []
            for item_x, item_y, token in items:
                if not (x_min <= item_x <= x_max and top <= item_y <= bottom): continue
                normalized = normalize_target_scan_score(token, is_rifle)
                if normalized is not None: score_tokens.append((item_y, item_x, normalized))
            if not score_tokens: continue
            score_tokens.sort(key=lambda item: (item[0], item[1]))
            shots = []
            for item_y, item_x, value in score_tokens:
                if score_x_min <= item_x <= score_x_max:
                    if value > 10.9: break
                    shots.append(value)
            if shots: blocks.append((index, page_index, shots))
    if not blocks: return []
    blocks.sort(key=lambda item: item[0]); flat_shots = []
    for _, _, shots in blocks: flat_shots.extend(shots)
    if len(flat_shots) < 60: return []
    return [flat_shots[start:start + 10] for start in range(0, 60, 10)]

def extract_text_from_targetscan_pdf(pdf_base64):
    if not PdfReader: raise ValueError("PdfReader absent")
    raw = base64.b64decode(pdf_base64); reader = PdfReader(BytesIO(raw))
    return "".join((page.extract_text() or "") for page in reader.pages)

def build_target_scan_rows_from_chunks(chunks, athlete, event, session, prova):
    now = int(time.time() * 1000); rows = []
    for index, chunk in enumerate(chunks[:6]):
        rows.append({
            "submissionId": f"{athlete}_{event}_{session}_SR{index + 1}_{now + index}",
            "athlete": athlete, "event": event, "session": session, "prova": prova, "serie": f"SR{index + 1}",
            "shots": ",".join(str(round(value, 1)).rstrip("0").rstrip(".") for value in chunk),
            "source": "TARGETSCAN_ADMIN", "notes": "Importado do TargetScan pela plataforma Admin.", "status": "PENDING_COACH_REVIEW", "submittedAt": now + index,
        })
    return rows

def parse_target_scan_text(text, athlete, event, session, prova):
    clean_text = str(text or "").replace(",", ".")
    is_rifle = str(prova).upper() == "RIFLE"
    numeric = [float(value) for value in re.findall(r"\b(?:10(?:\.\d)?|[0-9](?:\.\d)?)\b", clean_text)]
    shots = numeric[-60:] if len(numeric) >= 60 else numeric
    if len(shots) < 10: raise ValueError("Insufficient shots")
    if not is_rifle: shots = [float(int(shot)) for shot in shots]
    chunks = [shots[idx:idx + 10] for idx in range(0, min(len(shots), 60), 10)]
    return build_target_scan_rows_from_chunks(chunks, athlete, event, session, prova)

def import_target_scan(payload):
    athlete = str(payload.get("athlete", "")).strip()
    event = str(payload.get("event", "")).strip() or "TARGETSCAN_ADMIN"
    session = str(payload.get("session", "")).strip() or "TREINO"
    prova = str(payload.get("prova", "")).strip().upper() or "PISTOL"
    text = str(payload.get("text", "")).strip(); pdf_base64 = str(payload.get("pdfBase64", "")).strip()
    is_rifle = prova == "RIFLE"; layout_rows = []
    if pdf_base64: layout_rows = extract_targetscan_series_from_exploded_pages(pdf_base64, is_rifle)
    if pdf_base64 and not layout_rows: layout_rows = extract_targetscan_series_from_pdf_layout(pdf_base64, is_rifle)
    if layout_rows: text = "\n".join(",".join(str(v).rstrip("0").rstrip(".") for v in row) for row in layout_rows)
    if not text and pdf_base64: text = extract_text_from_targetscan_pdf(pdf_base64)
    rows = build_target_scan_rows_from_chunks(layout_rows, athlete, event, session, prova) if layout_rows else parse_target_scan_text(text, athlete, event, session, prova)

    conn = sqlite3.connect(STABLE_DB); cur = conn.cursor()
    for row in rows:
        cur.execute("INSERT OR REPLACE INTO athlete_submission (submissionId, athlete, event, session, prova, serie, shots, source, notes, status, submittedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (row["submissionId"], row["athlete"], row["event"], row["session"], row["prova"], row["serie"], row["shots"], row["source"], row["notes"], row["status"], row["submittedAt"]))
    conn.commit(); conn.close(); return {"ok": True, "series": len(rows)}

def pending_groups(submissions):
    groups = {}
    for item in submissions:
        key = "|".join([item["athlete"], item["event"], item["session"], item["prova"], item["source"]])
        groups.setdefault(key, []).append(item)
    result = []
    for key, rows in groups.items():
        rows = sorted(rows, key=lambda r: r["serie"])
        shot_count = sum(len(split_numbers(r["shots"])) for r in rows)
        result.append({"key": key, "athlete": rows[0]["athlete"], "event": rows[0]["event"], "shots": shot_count, "complete": len(rows) >= 6})
    return result

def approve_group(group_key):
    athlete, event, session, prova, source = group_key.split("|")
    conn = sqlite3.connect(STABLE_DB); cur = conn.cursor()
    rows = rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE athlete=? AND event=? AND session=? AND prova=? AND source=? AND status='PENDING_COACH_REVIEW' ORDER BY serie ASC", (athlete, event, session, prova, source))
    for row in rows:
        order = int("".join(filter(str.isdigit, row["serie"])) or "1")
        chave = f"{athlete}_{prova}_{event}_{session}_{row['serie']}"
        cur.execute("INSERT OR REPLACE INTO shot_series (chaveSerie, dataColeta, prova, atleta, evento, sessao, serie, tiros, hciSerieOrder, hciEventRowValid) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (chave, row["submittedAt"], prova, athlete, event, session, row["serie"], row["shots"], order, 1))
        cur.execute("UPDATE athlete_submission SET status='APPROVED' WHERE submissionId=?", (row["submissionId"],))
    conn.commit()
    conn.close()
    try:
        push_database(STABLE_DB)
    except:
        pass
    return {"ok": True}

# ------------------------------------------------------------------------------
# SNAPSHOT & UI
# ------------------------------------------------------------------------------

def build_snapshot():
    if not os.path.exists(STABLE_DB): return {"leads":[], "athlete360":[], "pendingGroups":[]}
    conn = sqlite3.connect(STABLE_DB); conn.row_factory = sqlite3.Row; cur = conn.cursor()
    leads = rows_as_dicts(cur, "SELECT * FROM qualified_lead ORDER BY updatedAt DESC")
    shot_rows = rows_as_dicts(cur, "SELECT * FROM shot_series ORDER BY dataColeta DESC")
    pending = rows_as_dicts(cur, "SELECT * FROM athlete_submission WHERE status = 'PENDING_COACH_REVIEW' ORDER BY submittedAt DESC")
    target_rows = rows_as_dicts(cur, "SELECT * FROM target_session ORDER BY submittedAt DESC LIMIT 200")

    athlete360 = []
    unique_athletes = sorted({*(r.get("atleta") for r in shot_rows), *(r.get("athleteName") for r in leads)} - {None, ""})
    for athlete in unique_athletes:
        a_shots = [r for r in shot_rows if r.get("atleta") == athlete]
        sessions = []
        groups = {}
        for row in a_shots:
            key = f"{row['evento']}|{row['sessao']}"
            groups.setdefault(key, []).append(row)
        for key, rows in groups.items():
            shots = [float(v) for r in rows for v in str(r["tiros"]).split(",") if v.strip()]
            if shots: sessions.append({"evento": rows[0]["evento"], "sessao": rows[0]["sessao"], "total": round(sum(shots), 1), "data": rows[0]["dataColeta"]})
        sessions.sort(key=lambda x: x['data'], reverse=True)
        athlete360.append({"athlete": athlete, "hci": 0.0, "sessions": sessions[:10]})
    conn.close()
    return {"leads": leads, "athlete360": athlete360, "pendingGroups": pending_groups(pending), "targetSessions": target_rows}

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" /><title>SportsPerformance Admin v4.2</title>
  <style>
    :root { --bg:#f4f7f6; --panel:#fff; --header-bg:#003399; --text:#2c3e50; --muted:#7f8c8d; --accent:#1877f2; --border:#e0e4e9; --danger:#fa3e3e; --success:#42b72a; }
    body{margin:0; font-family:'Segoe UI', sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden}
    header { padding: 0 30px; background: var(--header-bg); color: white; display: flex; justify-content: space-between; align-items: center; min-height: 85px; flex-shrink: 0; }
    .header-main { font-size: 22px; font-weight: 700; }
    .sync-btn { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 10px 24px; color: white; display: flex; align-items: center; gap: 15px; cursor: pointer; }
    .sync-icon { width: 30px; height: 30px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--header-bg); font-weight: bold; }
    main{display:grid; grid-template-columns:320px 1fr; flex:1; overflow:hidden}
    aside{background:var(--panel); border-right:1px solid var(--border); padding:25px; overflow-y:auto}
    .content-area{padding:25px; overflow-y:auto}
    .tabs{display:flex; gap: 15px; margin-bottom:25px; border-bottom: 1px solid var(--border); }
    .tab{padding:10px 15px; cursor:pointer; font-weight:700; color:var(--muted); border-bottom:3px solid transparent; font-size:12px; text-transform: uppercase; }
    .tab.active{color:var(--accent); border-bottom-color:var(--accent)}
    .card { background:var(--panel); border-radius:12px; border:1px solid var(--border); box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow:hidden; margin-bottom:25px }
    .card-header { background:#f8fafc; padding:15px 20px; border-bottom:1px solid var(--border) }
    .card-header h3 { margin:0; font-size:14px; font-weight:700; color:#1c1e21; text-transform:uppercase; }
    table{width:100%; border-collapse:collapse; font-size:12px} th,td{border-bottom:1px solid var(--border); padding:10px; text-align:left}
    input, select, textarea { padding:10px 15px; border:1px solid var(--border); border-radius:8px; font-size:12px; width:100% }
    .btn { border:none; border-radius:8px; color:white; padding:10px 20px; cursor:pointer; font-weight:700; font-size:12px; }
    .btn-blue { background:var(--accent) } .btn-red { background:var(--danger) } .btn-green { background:var(--success) }
  </style>
</head>
<body>
<header>
  <div class="header-title"><span style="font-size:10px; opacity:0.8">HCI PERFORMANCE</span><br/><span class="header-main">COACH PLANNER FRAMEWORK</span></div>
  <div style="display:flex; gap:15px; align-items:center">
    <div class="sync-btn" onclick="load()"><div class="sync-icon">🔄</div><div><b>SINCRONIZAR</b><br/><span style="font-size:9px">PC <-> Celular</span></div></div>
    <button class="btn" style="background:#666" onclick="shutdown()">SAIR</button>
  </div>
</header>
<main>
  <aside>
    <h3 style="font-size:12px; color:var(--muted); margin-top:0; text-transform: uppercase;">Atleta</h3>
    <select id="athleteSelect" onchange="renderTabs()" style="font-weight:700; font-size:14px; margin-bottom:25px"></select>
  </aside>
  <div class="content-area">
    <div class="tabs"><div class="tab active" onclick="setTab('Resumo')">RESUMO</div><div class="tab">ÍNDICES</div><div class="tab">MESOCICLO & PLANO</div><div class="tab">ANÁLISE RADIAL</div><div class="tab">RITMO DUAL-AXIS</div></div>
    <div id="view_Resumo" class="view">
      <div class="card"><div class="card-header"><h3>Entradas Pendentes para Aprovação (Motor v3.4)</h3></div><div class="card-body" id="pendingList"></div></div>
      <div class="card">
        <div class="card-header"><h3>Importar TargetScan para Atleta</h3></div>
        <div class="card-body">
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:12px">
            <input id="tsEvent" placeholder="Evento" value="TS_IMPORT"/><select id="tsProva"><option>PISTOL</option><option>RIFLE</option></select><input type="file" id="tsFile" />
          </div>
          <textarea id="tsText" placeholder="Texto TargetScan ou carregue PDF..." style="height:100px"></textarea>
          <button class="btn btn-blue" style="width:100%; margin-top:10px" onclick="importTargetScan()">Carregar e Processar</button>
          <div id="tsStatus" style="margin-top:10px; font-size:11px; color:var(--muted); text-align:center"></div>
        </div>
      </div>
      <div class="card"><div class="card-header"><h3>Histórico de Sessões</h3></div><div class="card-body" id="issfHistory"></div></div>
    </div>
  </div>
</main>
<script>
let SNAPSHOT = null; let TAB = 'Resumo'; let TARGETSCAN_PDF_BASE64 = '';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setTab(t) { TAB=t; document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active', el.innerText.includes(t.toUpperCase()))); renderTabs(); }

async function load() { const d = await fetch('/api/snapshot').then(r=>r.json()); SNAPSHOT=d; athleteSelect.innerHTML = d.athlete360.map(a=>`<option value="${a.athlete}">${a.athlete}</option>`).join(''); renderTabs(); }

function renderTabs() { if(!SNAPSHOT) return; const item = SNAPSHOT.athlete360.find(a=>a.athlete===athleteSelect.value)||SNAPSHOT.athlete360[0]; if(TAB==='Resumo') renderResumo(item); }

function renderResumo(item) {
    pendingList.innerHTML = SNAPSHOT.pendingGroups.length ? '<table>' + SNAPSHOT.pendingGroups.map(p => `<tr><td>${p.athlete}</td><td>${p.event}</td><td>${p.shots} disparos</td><td><button class="btn btn-green" onclick="approve('${p.key}')">Aprovar</button></td></tr>`).join('') + '</table>' : 'Sem pendências.';
    if(item) issfHistory.innerHTML = '<table>' + (item.sessions || []).map(s => `<tr><td>${s.evento}</td><td>${s.sessao}</td><td><b>${s.total}</b></td></tr>`).join('') + '</table>';
}

document.getElementById('tsFile')?.addEventListener('change', async (event)=>{
    const file=event.target.files?.[0]; if(!file) return;
    TARGETSCAN_PDF_BASE64='';
    if(file.type==='application/pdf' || file.name.toLowerCase().endsWith('.pdf')){
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary=''; const chunk=0x8000;
        for(let i=0;i<bytes.length;i+=chunk){ binary += String.fromCharCode(...bytes.subarray(i, i+chunk)); }
        TARGETSCAN_PDF_BASE64=btoa(binary);
        tsText.value = "[PDF Carregado - Clique em Carregar e Processar]";
        return;
    }
    tsText.value=await file.text();
});

async function importTargetScan(){
    const athlete=athleteSelect.value;
    tsStatus.textContent='Importando...';
    const res=await fetch('/api/import-targetscan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athlete,event:tsEvent.value,prova:tsProva.value,text:tsText.value,pdfBase64:TARGETSCAN_PDF_BASE64})});
    const data=await res.json();
    if(data.ok){ tsStatus.textContent=`Sucesso! ${data.series} series.`; tsText.value=''; TARGETSCAN_PDF_BASE64=''; load(); }
    else { tsStatus.textContent=data.error; }
}

async function approve(key) { await fetch('/api/approve?key='+encodeURIComponent(key), {method:'POST'}); load(); }
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
        p = urlparse(self.path).path; q = parse_qs(urlparse(self.path).query)
        len_ = int(self.headers.get("Content-Length", "0")); body = json.loads(self.rfile.read(len_).decode("utf-8") or "{}")
        try:
            if p == "/api/import-targetscan": return self._send(import_target_scan(body))
            if p == "/api/approve": return self._send(approve_group(q.get('key', [''])[0]))
            if p == "/api/shutdown": self._send({"ok": True}); threading.Thread(target=self.server.shutdown).start(); return
            return self._send("Not found", status=404)
        except Exception as e: return self._send({"ok": False, "error": str(e)}, status=400)

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Admin v4.0 Master rodando em http://127.0.0.1:{PORT}")
    server.serve_forever()
