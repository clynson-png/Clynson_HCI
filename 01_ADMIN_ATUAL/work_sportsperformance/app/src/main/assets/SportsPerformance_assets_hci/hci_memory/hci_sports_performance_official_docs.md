# Official Documentation - SportsPerformance HCI

This is the consolidated documentation for the **SportsPerformance** application, an intelligent ecosystem designed for high-performance sports and operational shooting analysis, using advanced algorithms (HCI - Human-Computer Interaction) for technical diagnosis and prescription.

---

## 1. Access and Security Modules

### 1.1 Login Screen and Security
- **Current mechanism:** local operational login with athlete name and valid email.
- **Current workflow:** the app requires minimum identity before internal routes are available. The provided email is stored locally as a qualified lead in Room (`qualified_lead`), without generating local/mock email or mock athlete data.
- **Post-login entry:** after login, the app opens the data-entry area (`ENTRY`) so the athlete can record real data before dashboard/report generation.
- **Logout:** a visible logout button is available in the top header beside the PT/EN selector, using `R.drawable.imgout`. Logout clears the in-memory session and returns to the login screen.
- **Current limit:** Firebase authentication, password recovery, and remote session persistence are not active in the current flow.

---

## 2. Target Intelligence Engines

The application processes various target types to identify technical trends and execution failures.

### 2.1 Duel 20 Target (ISSF/Manual)
- **Modes:** 10 meters and 25 meters.
- **Scoring Rules:**
    - **10m Mode:** Max score 240 (20 shots). The 'X' (Center) is worth **12 points**.
    - **25m Mode:** Max score 200 (20 shots). The 'X' (Center) is worth **10 points**.
- **Direction Rule:** The 'X' must be recorded in the **Center (C)**.

### 2.2 Humanoid Target (Defense/Operational)
- **Structure:** 8 zones of interest (Head, Chest, Abdomen, Pelvis, Shoulders, and Lower Quadrants).
- **Prescription Algorithm:**
    - If there are **zero shots**, the hierarchical priority is to correct **POSITION**.
    - If shots are spread across 4 or more zones, the focus is **AIMING**.
    - If shots concentrate in lower/right zones, the focus is **TRIGGERING**.
    - If there is consistent lateralization (left or right), the focus is **GRIP**.

### 2.3 Color Cards (Visual Precision and Reaction)
- **Structure:** 4 colored quadrants (Yellow, Green, Red, Blue).
- **Prescription Algorithm:**
    - More than one zero error indicates a primary failure in **COLOR IDENTIFICATION**.
    - Errors in specific quadrants (e.g., upper left) indicate **POSITION** or **AIMING** failures.
    - Errors concentrated in the lower section indicate **TRIGGERING** or **GRIP** failures.

---

## 3. Performance Metrics and Calculation Engines

The system operates on two main axes: ISSF regulatory metrics and HCI diagnostic metrics.

### 3.1 ISSF Metrics (International Standard)
- **Total Score:** Absolute sum of all shots (integers for Pistol, decimals for Rifle).
- **Series Subtotals (SR1-SR6):** Rhythmic and regulatory groupings of 10 shots.
- **Olympic Benchmarking:** Direct comparison with world-class elite scores:
    - **Rifle:** Top 8 (>= 631.0), Elite (>= 628.0).
    - **Pistol:** Top 8 (>= 582), Elite (>= 578).

### 3.2 HCI Analytical Metrics (Structure & Targets)
The HCI engine breaks down the event into "Structure" (the capacity to sustain the event) and "Targets" (pure technical quality) dimensions.

#### A. Target Radial Chart (Targets)
Focused on **Process** and **Refinement**:
- **Process Score:** Ratio between "clean" shot sequences (>= 9.0) and total volume.
- **Deepening Score:** Measures the depth of the excellence zone (consecutive shots >= 10.0).
- **Consistency Score:** Evaluates stability across series (max vs. min amplitude).

#### B. Structure Radial Chart (Structure)
Evaluates physical and mental resilience:
- **Resilience Score:** Paced recovery capacity after a "drop" (bad shot).
- **Pressure Score:** Impact of stress on rhythmic stability (rhythmic standard deviation).
- **Physical Score:** Performance degradation from the first half to the second half of the event.
- **Emotional Score:** Penalty based on the recurrence of negative sequences.

#### C. Rhythm Path (Line Chart)
Micro-rhythmic analysis of the event:
- Divides each 10-shot series into 3 windows (P1: shots 1-3, P2: 4-7, P3: 8-10).
- Identifies patterns such as "slow entry," "loss of focus at the end of the series," or "central stability."

#### D. History and Tendency (Bar Chart)
- Visual comparison between the current event and the athlete's **Baseline (Historical Context)**.
- Helps identify if a technical deviation is an isolated event or a stage change (Tier Change).

---

## 4. Technical Prescription Hierarchy and Logic

The application uses an intelligent logical hierarchy to select exercises from the **Training Library (JSON)**.

### 4.1 Priority Levels (Decision Flow)
1.  **Safety and Base (Position):** Triggered by total target loss or major alignment errors.
2.  **Execution Process (Aiming/Triggering/Grip):** Triggered when the athlete hits the target but shows consistent technical error patterns.
3.  **Visual Refinement (Color Identification):** Specific for decision-making and cognitive processing drills.

### 4.2 Training Library (V4)
The `training_library_canonical.json` file is the Single Source of Truth ("Master Library") containing:
- **Training ID:** Unique identifier for each exercise.
- **Linked Parameter:** Connects intelligence engine diagnostics to specific exercises (e.g., `TARGET_TRIGGERING`).
- **Training Phases:** General Preparation, Specific Preparation, Pre-Competition, and Competition.
- **Weapon Classes:** PISTOL, RIFLE, and specialized targets (HUMANOID/COLOR_CARD).

---

## 5. TargetScan Data Extraction (PDF Parsing)

The application features a specialized module to import and process reports generated by **TargetScan**, enabling a seamless transition from physical targets to digital diagnosis.

### 5.1 Parsing Mechanism
- **Technology:** Uses the `PDFBox` library for structured text extraction.
- **Automatic Identification:** The engine automatically detects the athlete's name, event date, discipline type (Rifle or Pistol), and session details.
- **Score Extraction:** 
    - Performs "stripping" of score tables from the PDF.
    - Recognizes regulatory shot patterns (e.g., `10.5`, `9.8`).
    - Validates series totals to ensure the integrity of imported data.

### 5.2 Series Mapping
- The system reconstructs the 6 official 10-shot series (SR1 to SR6).
- **Decimal Handling:** Preserves decimals for Rifle events (e.g., 10.9) and converts to integers for Pistol events according to ISSF rules, feeding the HCI engine with the correct precision for each modality.

---

## 6. Export, Reports and BI
The application generates professional PDF reports for athletes and coaches, featuring:
- **Official Metrics:** Total shots, dominant zone, mean dispersion, and peak concentration.
- **Dynamic Insights:** AI-generated texts interpreting the athlete's error pattern.
- **Technical Prescription:** Direct training suggestions with "How-to" guides, "Coach Cues," and suggested load.

### 6.1 Current Target Report State
- The Target/Entry screen generates and saves `TargetSession` with athlete, event, session, target type, zones, counts, total shots, recommended training, and timestamp.
- The general `Report` tab is still centered on the Olympic HCI flow and full-entry review; it does not yet show a dedicated Target Reports section.
- Next integration: make `CoachReportScreen` observe `targetSessions` and display a separate "Target Reports" section for Duel 20, Humanoid, and Color Cards.

### 6.2 GOLD Possession/Carry Technical Report
- Approved future pipeline, not implemented yet: this must be an internal section of the reports area for GOLD users.
- It must not be a loose standalone button. Heavy data should be collected only when the user opens/generates this technical report.
- Required future note: "This report is a technical training/simulation document. It does not replace an official evaluation, legal report, legal exam, or formal procedure required by the competent authority."

---

## 7. Operational Update - Admin, Target and Reports (2026-06-05)

- The desktop Admin platform is local and on-demand, available at `http://127.0.0.1:8766` during development.
- Admin must not run continuously, does not perform automatic polling, and does not depend on internet or an external server.
- The primary data entry and final adjustment authority belong to Admin/Coach on desktop.
- Athletes may enter data, but athlete ISSF entries go to review where applicable; official data is finalized by Admin/Coach.
- Humanoid, Duel 20, and Color Cards save directly as `TargetSession`; these areas do not require Admin approval.
- Target sessions remain available for visualization, data crossing, and future report generation.
- PDF/report generation in Target areas is restricted to Coach/Admin or GOLD users.
- Desktop Admin must show the same athlete area the athlete sees, with the functional areas `Overview`, `Indexes`, `Rhythm`, `Target`, and `Plan`.
- Administrative controls, such as ISSF approval, lead creation, extra prescription, or session deletion, remain separate from the athlete view.
- Admin can choose how many latest trainings/sessions are included in comparative charts; the operational default is 5.
- The ISSF session delete button is a sensitive administrative action and must keep confirmation before deleting local data.
- The UI regression caused by invalid JavaScript in the Admin radar chart was fixed; future HTML/JS changes must validate the page before operational use.
- The Admin `Rhythm chart` must be validated against the Excel VBA `HCI_RHYTHM_TIMELINE`, respecting real series and the latest-training cutoff selected by Admin.

---
*Consolidated document for licensing and technical audit purposes.*
*Updated: June 2026*
