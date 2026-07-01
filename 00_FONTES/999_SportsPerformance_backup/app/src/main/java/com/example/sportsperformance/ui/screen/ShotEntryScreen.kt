package com.example.sportsperformance.ui.screen

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.R
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.Duelo20Mode
import com.example.sportsperformance.data.model.Duelo20Rules
import com.example.sportsperformance.data.model.SubscriptionTier
import com.example.sportsperformance.data.model.UserRole
import com.example.sportsperformance.logic.ShotCsvExporter
import com.example.sportsperformance.logic.ShotCsvPayload
import com.example.sportsperformance.logic.ShotCsvSeries
import com.example.sportsperformance.logic.TargetIntelligenceEngine
import com.example.sportsperformance.logic.TargetReportPdfExporter
import com.example.sportsperformance.ui.components.DirectionalTargetRadialChart
import com.example.sportsperformance.ui.components.DirectionalTargetSector
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

private data class TargetHotspot(
    val id: String,
    val label: String,
    val x: Float,
    val y: Float,
    val color: Color
)

private data class TargetAnalysis(
    val percentages: List<Pair<String, Int>>,
    val insights: List<String>,
    val recommendedTraining: String,
    val reportPayload: TargetReportPayload
)

@Composable
fun ShotEntryScreen(viewModel: HciViewModel) {
    var entryMode by remember { mutableStateOf("ISSF") } // "ISSF" or "HCI_TARGET"

    Scaffold(
        topBar = {
            HciScreenTopBar(title = if (entryMode == "ISSF") stringResource(R.string.entry_screen_title) else "HCI Target Studio", viewModel = viewModel)
        },
        bottomBar = { HciBottomNavigation(viewModel) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(HciBackground)
        ) {
            TabRow(selectedTabIndex = if (entryMode == "ISSF") 0 else 1, containerColor = Color.White) {
                Tab(selected = entryMode == "ISSF", onClick = { entryMode = "ISSF" }, text = { Text("ISSF Manual") })
                Tab(selected = entryMode == "HCI_TARGET", onClick = { entryMode = "HCI_TARGET" }, text = { Text("HCI Target") })
            }

            Box(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                if (entryMode == "ISSF") {
                    IssfManualEntryContent(viewModel)
                } else {
                    HciTargetEntryContent(viewModel)
                }
            }
        }
    }
}

@Composable
private fun IssfManualEntryContent(viewModel: HciViewModel) {
    val context = LocalContext.current
    val csvExporter = remember(context) { ShotCsvExporter(context) }
    val appLanguage by viewModel.appLanguage.collectAsState()
    val selectedAthlete by viewModel.selectedAthlete.collectAsState()
    val selectedEvent by viewModel.selectedEvent.collectAsState()
    val selectedSession by viewModel.selectedSession.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()
    val allSeries by viewModel.allSeries.collectAsState(initial = emptyList())
    val submissions by viewModel.athleteSubmissions.collectAsState(initial = emptyList())
    val targetSessions by viewModel.targetSessions.collectAsState(initial = emptyList())
    var prova by remember { mutableStateOf("PISTOL") }
    var serie by remember { mutableStateOf("SR1") }
    var notes by remember { mutableStateOf("") }
    var selectedShotIndex by remember { mutableIntStateOf(0) }
    var rifleWhole by remember { mutableIntStateOf(10) }
    var rifleDecimal by remember { mutableIntStateOf(0) }
    var selectedShotDirection by remember { mutableStateOf("C") }
    val seriesNames = listOf("SR1", "SR2", "SR3", "SR4", "SR5", "SR6")
    val radialDirections = listOf("C", "N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val seriesShots = remember {
        mutableStateMapOf<String, androidx.compose.runtime.snapshots.SnapshotStateList<Double?>>()
    }
    val shotDirections = remember { mutableStateMapOf<String, String>() }
    val shots = remember(serie) { seriesShots.getOrPut(serie) { mutableStateListOf(*Array(10) { null }) } }
    val currentSeriesTotal = shots.filterNotNull().sum()
    val exportableSeries = seriesNames.mapNotNull { seriesName ->
        val values = seriesShots[seriesName]?.mapNotNull { it }.orEmpty()
        if (values.isEmpty()) null else {
            ShotCsvSeries(
                name = seriesName,
                shots = if (prova == "PISTOL") values.map { kotlin.math.floor(it) } else values,
                directions = (1..values.size).map { shotNumber -> shotDirections["$seriesName:$shotNumber"] ?: "" }
            )
        }
    }
    val eventDraftTotal = seriesNames.sumOf { name -> seriesShots[name]?.filterNotNull()?.sum() ?: 0.0 }
    val completedSeries = seriesNames.count { name -> seriesShots[name]?.all { it != null } == true }
    val currentRole by viewModel.currentRole.collectAsState()
    val athletes = if (currentRole == UserRole.ADMIN || currentRole == UserRole.COACH) {
        allSeries.map { it.atleta }.distinct().sorted().ifEmpty { listOf(selectedAthlete) }
    } else {
        listOf(selectedAthlete)
    }
    val events = allSeries.filter { it.atleta == selectedAthlete }.map { it.evento }.distinct().sorted().ifEmpty { listOf(selectedEvent) }
    val sessions = allSeries
        .filter { it.atleta == selectedAthlete && it.evento == selectedEvent }
        .map { it.sessao }
        .distinct()
        .sorted()
        .ifEmpty { listOf("TREINO", "SIMULADO", "COMPETICAO", selectedSession).distinct() }
    val visibleSubmissions = submissions
        .filter { it.athlete == selectedAthlete && it.event == selectedEvent && it.session == selectedSession }
        .take(6)

    val jsonLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.importTrainingDatabaseJson(context, it) }
    }

    val pdfLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.importTargetScanPdfForReview(context, it) }
    }

    Column {
        EntryContextCard(
            athletes = athletes,
            events = events,
            sessions = sessions,
            selectedAthlete = selectedAthlete,
            selectedEvent = selectedEvent,
            selectedSession = selectedSession,
            onContextChange = viewModel::selectContext
        )

        Spacer(modifier = Modifier.height(12.dp))
        IssfEntryStatusCard(selectedAthlete, selectedEvent, selectedSession, statusMessage)
        Spacer(modifier = Modifier.height(12.dp))

        TargetScanImportCard(
            onPickPdf = { pdfLauncher.launch("application/pdf") },
            onPickTrainingJson = { jsonLauncher.launch("*/*") }
        )

        Spacer(modifier = Modifier.height(18.dp))

        ManualShotEntryCard(
            prova = prova,
            onProvaChange = {
                prova = it
                selectedShotIndex = 0
                seriesShots.clear()
            },
            serie = serie,
            onSerieChange = {
                serie = it
                selectedShotIndex = 0
            },
            shots = shots,
            selectedShotIndex = selectedShotIndex,
            onShotSelect = { selectedShotIndex = it },
            selectedDirection = selectedShotDirection,
            directions = radialDirections,
            shotDirections = shotDirections,
            onDirectionSelect = { selectedShotDirection = it },
            appLanguage = appLanguage,
            rifleWhole = rifleWhole,
            rifleDecimal = rifleDecimal,
            onPistolScore = { value ->
                shots[selectedShotIndex] = value.toDouble()
                shotDirections["$serie:${selectedShotIndex + 1}"] = selectedShotDirection
                selectedShotIndex = (selectedShotIndex + 1).coerceAtMost(9)
            },
            onRifleWhole = { rifleWhole = it },
            onRifleDecimal = { rifleDecimal = it },
            onApplyRifle = {
                val value = (rifleWhole + rifleDecimal / 10.0).coerceAtMost(10.9)
                shots[selectedShotIndex] = value
                shotDirections["$serie:${selectedShotIndex + 1}"] = selectedShotDirection
                selectedShotIndex = (selectedShotIndex + 1).coerceAtMost(9)
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        IssfScoreSummaryCard(
            serie = serie,
            currentSeriesTotal = currentSeriesTotal,
            eventDraftTotal = eventDraftTotal,
            completedSeries = completedSeries
        )

        Spacer(modifier = Modifier.height(12.dp))

        IssfDirectionalAnalysisCard(
            appLanguage = appLanguage,
            shotDirections = shotDirections,
            selectedAthlete = selectedAthlete,
            selectedEvent = selectedEvent,
            selectedSession = selectedSession,
            submissions = submissions.filter {
                it.athlete == selectedAthlete && it.event == selectedEvent && it.session == selectedSession
            },
            targetSessions = targetSessions
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            label = { Text(stringResource(R.string.entry_notes)) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2
        )

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    val shotList = shots.mapNotNull { it }
                    if (shotList.size == 10) {
                        val directionNotes = seriesNames.joinToString(" | ") { seriesName ->
                            val values = (1..10).joinToString(",") { shotNumber ->
                                "T$shotNumber:${shotDirections["$seriesName:$shotNumber"] ?: "-"}"
                            }
                            "$seriesName=$values"
                        }
                        val notesWithDirections = listOf(
                            notes.trim(),
                            "DIRECTIONS: $directionNotes"
                        ).filter { it.isNotBlank() }.joinToString("\n")
                        viewModel.submitAthleteSeries(
                            prova = prova,
                            serie = serie,
                            shots = if (prova == "PISTOL") shotList.map { kotlin.math.floor(it) } else shotList,
                            notes = notesWithDirections
                        )
                    }
                },
                modifier = Modifier.weight(1f),
                enabled = shots.all { it != null },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF166534))
            ) {
                Text(stringResource(R.string.entry_submit_review))
            }
            OutlinedButton(
                onClick = {
                    csvExporter.exportAndShare(
                        ShotCsvPayload(
                            athlete = selectedAthlete,
                            event = selectedEvent,
                            session = selectedSession,
                            prova = prova,
                            notes = notes.trim(),
                            exportedAt = System.currentTimeMillis(),
                            series = exportableSeries
                        )
                    )
                },
                modifier = Modifier.weight(1f),
                enabled = exportableSeries.isNotEmpty()
            ) {
                Text("Exportar CSV")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        AthleteSubmissionStatusCard(visibleSubmissions)
    }
}

@Composable
private fun HciTargetEntryContent(viewModel: HciViewModel) {
    val context = LocalContext.current
    val selectedAthlete by viewModel.selectedAthlete.collectAsState()
    val displayAthleteName by viewModel.displayAthleteName.collectAsState()
    val appLanguage by viewModel.appLanguage.collectAsState()
    val currentRole by viewModel.currentRole.collectAsState()
    val subscriptionTier by viewModel.subscriptionTier.collectAsState()
    val canGenerateTargetReport = currentRole == UserRole.ADMIN ||
        currentRole == UserRole.COACH ||
        subscriptionTier == SubscriptionTier.GOLD
    val intelligenceEngine = remember(context) { TargetIntelligenceEngine(context) }
    val pdfExporter = remember(context) { TargetReportPdfExporter(context) }
    var targetTab by remember { mutableIntStateOf(0) }

    val humanoidHotspots = remember {
        listOf(
            TargetHotspot("HEAD", "Cabeça", 0.50f, 0.18f, Color(0xFFD97706)),
            TargetHotspot("CHEST", "Tórax central", 0.50f, 0.37f, Color(0xFFDC2626)),
            TargetHotspot("ABDOMEN", "Abdômen", 0.50f, 0.58f, Color(0xFF2563EB)),
            TargetHotspot("PELVIS", "Pélvis", 0.50f, 0.78f, Color(0xFF7C3AED)),
            TargetHotspot("LEFT_SHOULDER", "Ombro esquerdo", 0.28f, 0.34f, Color(0xFF0F766E)),
            TargetHotspot("RIGHT_SHOULDER", "Ombro direito", 0.72f, 0.34f, Color(0xFF0F766E)),
            TargetHotspot("LEFT_LOWER", "Quadrante esquerdo", 0.38f, 0.70f, Color(0xFFBE123C)),
            TargetHotspot("RIGHT_LOWER", "Quadrante direito", 0.62f, 0.70f, Color(0xFFBE123C))
        )
    }
    val colorHotspots = remember {
        listOf(
            TargetHotspot("YELLOW", "Amarelo", 0.27f, 0.27f, Color(0xFFFACC15)),
            TargetHotspot("GREEN", "Verde", 0.73f, 0.27f, Color(0xFF84CC16)),
            TargetHotspot("RED", "Vermelho", 0.27f, 0.73f, Color(0xFFEF4444)),
            TargetHotspot("BLUE", "Azul", 0.73f, 0.73f, Color(0xFF0EA5E9))
        )
    }
    val duelHotspots = remember {
        listOf(
            TargetHotspot("C", "Centro", 0.50f, 0.50f, Color(0xFF0F172A)),
            TargetHotspot("N", "Norte", 0.50f, 0.18f, Color(0xFFDC2626)),
            TargetHotspot("NE", "Nordeste", 0.72f, 0.28f, Color(0xFFF97316)),
            TargetHotspot("E", "Leste", 0.82f, 0.50f, Color(0xFFF59E0B)),
            TargetHotspot("SE", "Sudeste", 0.72f, 0.72f, Color(0xFF84CC16)),
            TargetHotspot("S", "Sul", 0.50f, 0.82f, Color(0xFF16A34A)),
            TargetHotspot("SW", "Sudoeste", 0.28f, 0.72f, Color(0xFF0EA5E9)),
            TargetHotspot("W", "Oeste", 0.18f, 0.50f, Color(0xFF2563EB)),
            TargetHotspot("NW", "Noroeste", 0.28f, 0.28f, Color(0xFF7C3AED))
        )
    }

    val athleteLabel = displayAthleteName.ifBlank { selectedAthlete }
    val eventLabel = if (appLanguage == AppLanguage.PT) "MVP Individual" else "Individual MVP"
    val sessionLabel = "Shot Fair"

    Column {
        HciTargetContextCard(
            athleteName = athleteLabel,
            eventName = eventLabel,
            sessionName = sessionLabel,
            appLanguage = appLanguage
        )
        Spacer(modifier = Modifier.height(12.dp))
        TabRow(selectedTabIndex = targetTab, containerColor = Color.White) {
            listOf(
                if (appLanguage == AppLanguage.PT) "Humanoide" else "Humanoid",
                if (appLanguage == AppLanguage.PT) "Colorido" else "Color",
                "Duelo 20"
            ).forEachIndexed { index, title ->
                Tab(
                    selected = targetTab == index,
                    onClick = { targetTab = index },
                    text = { Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))

        when (targetTab) {
            0 -> HciTargetCaptureTab(
                title = if (appLanguage == AppLanguage.PT) "Defesa tática - humanoide" else "Tactical defense - humanoid",
                subtitle = if (appLanguage == AppLanguage.PT) "Entrada por zonas de impacto com leitura independente." else "Zone-based entry with independent reading.",
                reportTitle = if (appLanguage == AppLanguage.PT) "Relatório - defesa tática" else "Report - tactical defense",
                targetType = "DEFENSE_HUMANOID",
                initialTotal = 20,
                hotspots = humanoidHotspots,
                appLanguage = appLanguage,
                athleteName = athleteLabel,
                eventLabel = eventLabel,
                sessionLabel = sessionLabel,
                viewModel = viewModel,
                intelligenceEngine = intelligenceEngine,
                pdfExporter = pdfExporter,
                canGenerateReport = canGenerateTargetReport,
                targetContent = { hotspots, counts, selectedZone, onSelectZone ->
                    PremiumHumanoidTarget(hotspots, counts, selectedZone, onSelectZone)
                }
            )
            1 -> HciTargetCaptureTab(
                title = if (appLanguage == AppLanguage.PT) "Pontaria - alvo colorido" else "Aiming - color target",
                subtitle = if (appLanguage == AppLanguage.PT) "Distribuição de acerto por quadrante com leitura de melhoria." else "Hit distribution by quadrant with improvement reading.",
                reportTitle = if (appLanguage == AppLanguage.PT) "Relatório - alvo colorido" else "Report - color target",
                targetType = "PRECISION_COLOR",
                initialTotal = 20,
                hotspots = colorHotspots,
                appLanguage = appLanguage,
                athleteName = athleteLabel,
                eventLabel = eventLabel,
                sessionLabel = sessionLabel,
                viewModel = viewModel,
                intelligenceEngine = intelligenceEngine,
                pdfExporter = pdfExporter,
                canGenerateReport = canGenerateTargetReport,
                targetContent = { hotspots, counts, selectedZone, onSelectZone ->
                    PremiumQuadTarget(hotspots, counts, selectedZone, onSelectZone)
                }
            )
            2 -> Duel20CaptureTab(
                title = "Duelo 20",
                subtitle = if (appLanguage == AppLanguage.PT) "Escolha uma das 8 direções radiais e atribua o valor." else "Choose one of 8 radial directions and assign the value.",
                reportTitle = if (appLanguage == AppLanguage.PT) "Relatório - Duelo 20" else "Report - Duel 20",
                directions = duelHotspots,
                appLanguage = appLanguage,
                athleteName = athleteLabel,
                eventLabel = eventLabel,
                sessionLabel = sessionLabel,
                viewModel = viewModel,
                intelligenceEngine = intelligenceEngine,
                pdfExporter = pdfExporter,
                canGenerateReport = canGenerateTargetReport
            )
        }
    }
}

@Composable
private fun HciTargetCaptureTab(
    title: String,
    subtitle: String,
    reportTitle: String,
    targetType: String,
    initialTotal: Int,
    hotspots: List<TargetHotspot>,
    appLanguage: AppLanguage,
    athleteName: String,
    eventLabel: String,
    sessionLabel: String,
    viewModel: HciViewModel,
    intelligenceEngine: TargetIntelligenceEngine,
    pdfExporter: TargetReportPdfExporter,
    canGenerateReport: Boolean,
    targetContent: @Composable (List<TargetHotspot>, Map<String, Int>, String, (String) -> Unit) -> Unit
) {
    var totalShots by remember(targetType) { mutableIntStateOf(initialTotal) }
    val counts = remember(targetType) { mutableStateMapOf<String, Int>() }
    var selectedZone by remember(targetType) { mutableStateOf(hotspots.first().id) }
    var draft by remember(targetType) { mutableStateOf<TargetAnalysis?>(null) }
    var confirm by remember(targetType) { mutableStateOf(false) }

    TargetEntryCard(
        title = title,
        subtitle = subtitle,
        tierUnlocked = true,
        totalShots = totalShots,
        onTotalShotsChange = { totalShots = it },
        hotspots = hotspots,
        counts = counts,
        selectedZoneId = selectedZone,
        onSelectZone = { selectedZone = it },
        onAdjustCount = { delta ->
            val current = counts[selectedZone] ?: 0
            val proposed = (current + delta).coerceAtLeast(0)
            val otherShots = counts.values.sum() - current
            if (otherShots + proposed <= totalShots) {
                counts[selectedZone] = proposed
            }
        },
        onFinalize = { confirm = true },
        remainingShots = totalShots - counts.values.sum(),
        targetContent = { targetContent(hotspots, counts, selectedZone) { selectedZone = it } },
        appLanguage = appLanguage
    )

    draft?.let {
        Spacer(modifier = Modifier.height(12.dp))
        TargetReportCard(
            title = reportTitle,
            analysis = it,
            onGeneratePdf = { pdfExporter.exportAndOpen(it.reportPayload) },
            canGeneratePdf = canGenerateReport,
            appLanguage = appLanguage
        )
    }

    if (confirm) {
        ConfirmSubmissionDialog(
            appLanguage = appLanguage,
            filled = counts.values.sum(),
            total = totalShots,
            onDismiss = { confirm = false },
            onConfirm = {
                confirm = false
                val analysis = analyzeTarget(
                    engine = intelligenceEngine,
                    targetType = targetType,
                    athleteName = athleteName,
                    eventLabel = eventLabel,
                    sessionLabel = sessionLabel,
                    appLanguage = appLanguage,
                    hotspots = hotspots,
                    counts = counts,
                    totalShots = totalShots
                )
                draft = analysis
                viewModel.saveTargetSession(
                    targetType = targetType,
                    totalShots = totalShots,
                    zoneLabels = hotspots.map { "${it.id}|${it.label}" },
                    zoneCounts = hotspots.map { counts[it.id] ?: 0 },
                    recommendedTraining = analysis.recommendedTraining
                )
            }
        )
    }
}
@Composable
private fun IssfEntryStatusCard(athlete: String, event: String, session: String, statusMessage: String) {
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_status_title), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text("$athlete | $event | $session", fontSize = 12.sp, color = Color.Gray)
            Spacer(modifier = Modifier.height(8.dp))
            AssistChip(
                onClick = {},
                label = { Text(stringResource(R.string.entry_status_pending)) },
                colors = AssistChipDefaults.assistChipColors(
                    labelColor = Color(0xFF854D0E),
                    containerColor = Color(0xFFFEF3C7)
                )
            )
            Text(statusMessage, fontSize = 12.sp, color = Color.Gray)
        }
    }
}

@Composable
private fun IssfDirectionalAnalysisCard(
    appLanguage: AppLanguage,
    shotDirections: Map<String, String>,
    selectedAthlete: String,
    selectedEvent: String,
    selectedSession: String,
    submissions: List<AthleteSubmission>,
    targetSessions: List<TargetSession>
) {
    val radialOrder = listOf("C", "N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val counts = remember(shotDirections, submissions) {
        buildIssfDirectionalCounts(shotDirections, submissions)
    }
    val vectorSession = remember(selectedAthlete, selectedEvent, selectedSession, targetSessions) {
        targetSessions.firstOrNull {
            it.targetType == "ISSF_PISTOL_VECTOR" &&
                it.athlete == selectedAthlete &&
                it.event == selectedEvent &&
                it.session == selectedSession
        } ?: targetSessions.firstOrNull {
            it.targetType == "ISSF_PISTOL_VECTOR" && it.athlete == selectedAthlete
        }
    }
    val vectorCounts = remember(vectorSession) {
        buildIssfDirectionalCountsFromTargetSession(vectorSession)
    }
    val effectiveCounts = if (counts.values.sum() > 0) counts else vectorCounts
    val totalDirectionalShots = effectiveCounts.values.sum()

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                if (appLanguage == AppLanguage.PT) "Análise direcional ISSF" else "ISSF directional analysis",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = HciTextPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "O radar abaixo usa direções manuais, direções já salvas nas submissões e, quando existir, a leitura vetorial do TargetScan."
                } else {
                    "The radar below uses manual directions, directions already saved in submissions, and, when available, the TargetScan vector reading."
                },
                fontSize = 12.sp,
                color = HciTextSecondary
            )

            if (totalDirectionalShots == 0) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    if (appLanguage == AppLanguage.PT) {
                        "Ainda não há direções suficientes para montar o gráfico neste contexto."
                    } else {
                        "There are not enough directions to build the chart in this context yet."
                    },
                    fontSize = 12.sp,
                    color = HciTextSecondary
                )
                return@Column
            }

            val sectors = buildIssfDirectionalSectors(effectiveCounts, appLanguage)
            Spacer(modifier = Modifier.height(12.dp))
            DirectionalTargetRadialChart(
                title = if (appLanguage == AppLanguage.PT) "Radar ISSF - análise de alvos" else "ISSF radar - target analysis",
                subtitle = if (appLanguage == AppLanguage.PT) {
                    "$totalDirectionalShots disparos com direção | manual, submissões e TargetScan vetorial"
                } else {
                    "$totalDirectionalShots shots with direction | manual, submissions and vector TargetScan"
                },
                sectors = sectors,
                maxRing = 100.0,
                ringStep = 20.0,
                color = HciAccentBlue,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            radialOrder.filter { effectiveCounts.getOrDefault(it, 0) > 0 }.forEach { direction ->
                Text(
                    text = "${direction}: ${effectiveCounts.getOrDefault(direction, 0)}",
                    fontSize = 11.sp,
                    color = HciTextSecondary
                )
            }
        }
    }
}

@Composable
private fun Duel20CaptureTab(
    title: String,
    subtitle: String,
    reportTitle: String,
    directions: List<TargetHotspot>,
    appLanguage: AppLanguage,
    athleteName: String,
    eventLabel: String,
    sessionLabel: String,
    viewModel: HciViewModel,
    intelligenceEngine: TargetIntelligenceEngine,
    pdfExporter: TargetReportPdfExporter,
    canGenerateReport: Boolean
) {
    var selectedDirection by remember { mutableStateOf(directions.first().id) }
    var selectedScore by remember { mutableIntStateOf(9) }
    var duelMode by remember { mutableStateOf(Duelo20Mode.DUELO_20_25M) }

    val scoreDirectionCounts = remember { mutableStateMapOf<String, Int>() }
    var draft by remember { mutableStateOf<TargetAnalysis?>(null) }
    var confirm by remember { mutableStateOf(false) }
    val totalShots = 20
    val maxScore = Duelo20Rules.maxScore(duelMode)
    val filled = scoreDirectionCounts.values.sum()
    val remaining = totalShots - filled
    val effectiveDirection = if (selectedScore == 12) {
        "C"
    } else {
        selectedDirection
    }

    val currentKey = if (selectedScore == 12) {
        "XC"
    } else {
        "$selectedScore$effectiveDirection"
    }
    fun duelScoreFromKey(key: String): Int {
        val isX = key.startsWith("X")
        val scoreValue = if (isX) 10 else key.takeWhile { it.isDigit() }.toIntOrNull() ?: 0
        return Duelo20Rules.computedScore(scoreValue, isX, duelMode)
    }

    val duelTotalScore = scoreDirectionCounts.entries.sumOf { entry ->
        duelScoreFromKey(entry.key) * entry.value
    }
    val duelDirectionalSectors = buildDuel20DirectionalSectors(
        counts = scoreDirectionCounts,
        appLanguage = appLanguage
    )
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x332B3340))
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(listOf(Color(0xFFFDFDFD), Color(0xFFF4F7FB), Color(0xFFEFF4FA))),
                    RoundedCornerShape(16.dp)
                )
                .padding(16.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                    Text(subtitle, fontSize = 11.sp, color = HciTextSecondary)
                }
                AssistChip(
                    onClick = {},
                    label = { Text(if (appLanguage == AppLanguage.PT) "Ativo" else "Active", fontSize = 10.sp) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = Color(0xFFDCFCE7),
                        labelColor = Color(0xFF166534)
                    )
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = duelMode == Duelo20Mode.DUELO_20_25M,
                    onClick = { duelMode = Duelo20Mode.DUELO_20_25M },
                    label = { Text("Duelo 20 - 25m") },
                    modifier = Modifier.weight(1f)
                )

                FilterChip(
                    selected = duelMode == Duelo20Mode.DUELO_20_10M,
                    onClick = { duelMode = Duelo20Mode.DUELO_20_10M },
                    label = { Text("Duelo 20 - 10m") },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Duel20TargetCanvas(
                directions = directions,
                counts = scoreDirectionCounts,
                selectedDirectionId = effectiveDirection,
                selectedScore = selectedScore,
                onSelectDirection = { selectedDirection = it }
            )
            Spacer(modifier = Modifier.height(12.dp))
            Duel20ScoreDirectionEditor(
                directions = directions,
                counts = scoreDirectionCounts,
                selectedDirectionId = effectiveDirection,
                selectedScore = selectedScore,
                remainingShots = remaining,
                appLanguage = appLanguage,
                onSelectDirection = { selectedDirection = it },
                onSelectScore = { selectedScore = it },
                onAdjustCount = { delta ->
                    val current = scoreDirectionCounts[currentKey] ?: 0
                    val proposed = (current + delta).coerceAtLeast(0)
                    val otherShots = scoreDirectionCounts.values.sum() - current
                    if (otherShots + proposed <= totalShots) {
                        scoreDirectionCounts[currentKey] = proposed
                    }
                }
            )
            Spacer(modifier = Modifier.height(12.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = if (appLanguage == AppLanguage.PT) "Resultado geral" else "Total score",
                            fontSize = 11.sp,
                            color = HciTextSecondary,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "$duelTotalScore / $maxScore",
                            fontSize = 24.sp,
                            color = HciTextPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    AssistChip(
                        onClick = {},
                        label = {
                            val xValue = if (duelMode == Duelo20Mode.DUELO_20_10M) "12" else "10"
                            Text(
                                text = "X = $xValue",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            DirectionalTargetRadialChart(
                title = "Radar Pistol - Duelo 20",
                subtitle = if (duelMode == Duelo20Mode.DUELO_20_10M) {
                    "Duelo 20 - 10m | 8 setores | X = centro"
                } else {
                    "Duelo 20 - 25m | 8 setores | X = centro"
                },
                sectors = duelDirectionalSectors,
                maxRing = 100.0,
                ringStep = 20.0,
                color = HciAccentBlue,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        scoreDirectionCounts.clear()
                        draft = null
                        confirm = false
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = if (appLanguage == AppLanguage.PT) {
                            "Limpar alvo"
                        } else {
                            "Clear target"
                        }
                    )
                }

                Button(
                    onClick = { confirm = true },
                    enabled = filled <= totalShots,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
                ) {
                    Text(
                        text = if (appLanguage == AppLanguage.PT) {
                            "Finalizar"
                        } else {
                            "Finish"
                        }
                    )
                }
            }
        }
    }

    draft?.let {
        Spacer(modifier = Modifier.height(12.dp))
        TargetReportCard(
            title = reportTitle,
            analysis = it,
            onGeneratePdf = { pdfExporter.exportAndOpen(it.reportPayload) },
            canGeneratePdf = canGenerateReport,
            appLanguage = appLanguage
        )
    }

    if (confirm) {
        ConfirmSubmissionDialog(
            appLanguage = appLanguage,
            filled = filled,
            total = totalShots,
            onDismiss = { confirm = false },
            onConfirm = {
                confirm = false
                val labels = scoreDirectionCounts.keys.sortedWith(
                    compareBy<String> { it.dropLastWhile { ch -> ch.isLetter() }.toIntOrNull() ?: 0 }
                        .thenBy { it.takeLastWhile { ch -> ch.isLetter() } }
                )
                val analysisHotspots = labels.map { key ->
                    TargetHotspot(
                        id = key,
                        label = key,
                        x = 0.5f,
                        y = 0.5f,
                        color = Color(0xFF0F172A)
                    )
                }
                val analysisCounts = labels.associateWith { scoreDirectionCounts[it] ?: 0 }
                val analysis = analyzeTarget(
                    engine = intelligenceEngine,
                    targetType = "DUEL_20",
                    athleteName = athleteName,
                    eventLabel = eventLabel,
                    sessionLabel = sessionLabel,
                    appLanguage = appLanguage,
                    hotspots = analysisHotspots,
                    counts = analysisCounts,
                    totalShots = totalShots
                )
                draft = analysis
                viewModel.saveTargetSession(
                    targetType = "DUEL_20",
                    totalShots = totalShots,
                    zoneLabels = labels,
                    zoneCounts = labels.map { scoreDirectionCounts[it] ?: 0 },
                    recommendedTraining = analysis.recommendedTraining
                )
            }
        )
    }
}

@Composable
private fun TargetScanImportCard(
    onPickPdf: () -> Unit,
    onPickTrainingJson: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_import_title), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(stringResource(R.string.entry_import_description), fontSize = 12.sp, color = Color.Gray)
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onPickPdf,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = HciAccentBlue)
            ) {
                Icon(Icons.Default.FileUpload, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.entry_load_android_pdf))
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = onPickTrainingJson,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.FileUpload, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Importar banco de treino")
            }
        }
    }
}

@Composable
private fun ManualShotEntryCard(
    prova: String,
    onProvaChange: (String) -> Unit,
    serie: String,
    onSerieChange: (String) -> Unit,
    shots: MutableList<Double?>,
    selectedShotIndex: Int,
    onShotSelect: (Int) -> Unit,
    selectedDirection: String,
    directions: List<String>,
    shotDirections: Map<String, String>,
    onDirectionSelect: (String) -> Unit,
    appLanguage: AppLanguage,
    rifleWhole: Int,
    rifleDecimal: Int,
    onPistolScore: (Int) -> Unit,
    onRifleWhole: (Int) -> Unit,
    onRifleDecimal: (Int) -> Unit,
    onApplyRifle: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_manual_title), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = prova == "PISTOL", onClick = { onProvaChange("PISTOL") }, label = { Text(stringResource(R.string.entry_pistol)) }, modifier = Modifier.weight(1f))
                FilterChip(selected = prova == "RIFLE", onClick = { onProvaChange("RIFLE") }, label = { Text(stringResource(R.string.entry_rifle)) }, modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(10.dp))
            IssfEntryChipRow("Série", listOf("SR1", "SR2", "SR3", "SR4", "SR5", "SR6"), serie, onSerieChange)
            Text(stringResource(R.string.entry_shot), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                shots.forEachIndexed { index, value ->
                    FilterChip(
                        selected = selectedShotIndex == index,
                        onClick = { onShotSelect(index) },
                        label = {
                            val direction = shotDirections["$serie:${index + 1}"] ?: "-"
                            Text("T${index + 1}: ${value?.let { "%.1f".format(it) } ?: "-"} | $direction", fontSize = 10.sp)
                        }
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(if (appLanguage == AppLanguage.PT) "Direção do disparo" else "Shot direction", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                directions.forEach { direction ->
                    FilterChip(
                        selected = selectedDirection == direction,
                        onClick = { onDirectionSelect(direction) },
                        label = { Text(direction, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            if (prova == "PISTOL") {
                ScoreButtonGrid(values = (0..10).toList(), onScore = onPistolScore)
            } else {
                RifleDecimalSelector(
                    whole = rifleWhole,
                    decimal = rifleDecimal,
                    onWhole = onRifleWhole,
                    onDecimal = onRifleDecimal,
                    onApply = onApplyRifle
                )
            }
        }
    }
}

@Composable
private fun ScoreButtonGrid(values: List<Int>, onScore: (Int) -> Unit) {
    values.chunked(4).forEach { rowValues ->
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            rowValues.forEach { value ->
                Button(onClick = { onScore(value) }, modifier = Modifier.weight(1f)) {
                    Text(value.toString())
                }
            }
            repeat(4 - rowValues.size) {
                Spacer(modifier = Modifier.weight(1f))
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun RifleDecimalSelector(
    whole: Int,
    decimal: Int,
    onWhole: (Int) -> Unit,
    onDecimal: (Int) -> Unit,
    onApply: () -> Unit
) {
    Text(stringResource(R.string.entry_integer), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        (0..10).forEach { value ->
            FilterChip(selected = whole == value, onClick = { onWhole(value) }, label = { Text(value.toString()) })
        }
    }
    Text(stringResource(R.string.entry_decimal), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        (0..9).forEach { value ->
            FilterChip(selected = decimal == value, onClick = { onDecimal(value) }, label = { Text(".$value") })
        }
    }
    Spacer(modifier = Modifier.height(8.dp))

    Button(onClick = onApply, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.entry_apply_score, "%.1f".format((whole + decimal / 10.0).coerceAtMost(10.9))))
    }
}

@Composable
private fun IssfScoreSummaryCard(
    serie: String,
    currentSeriesTotal: Double,
    eventDraftTotal: Double,
    completedSeries: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_score_panel), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                IssfScoreMetric(
                    label = stringResource(R.string.entry_series_label, serie),
                    value = "%.1f".format(currentSeriesTotal),
                    modifier = Modifier.weight(1f)
                )
                IssfScoreMetric(
                    label = stringResource(R.string.entry_event_label),
                    value = "%.1f".format(eventDraftTotal),
                    modifier = Modifier.weight(1f)
                )
                IssfScoreMetric(
                    label = stringResource(R.string.entry_series_count_label),
                    value = "$completedSeries/6",
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun IssfScoreMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
            .padding(10.dp)
    ) {
        Text(label, fontSize = 10.sp, color = HciTextSecondary, fontWeight = FontWeight.Bold)
        Text(value, fontSize = 18.sp, color = HciTextPrimary, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun EntryContextCard(
    athletes: List<String>,
    events: List<String>,
    sessions: List<String>,
    selectedAthlete: String,
    selectedEvent: String,
    selectedSession: String,
    onContextChange: (String, String, String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    )
    {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_context_title), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            IssfEntryChipRow("Atleta", athletes, selectedAthlete) { athlete ->
                val nextEvent = events.firstOrNull() ?: selectedEvent
                val nextSession = sessions.firstOrNull() ?: selectedSession
                onContextChange(athlete, nextEvent, nextSession)
            }
            IssfEntryChipRow("Evento", events, selectedEvent) { event ->
                val nextSession = sessions.firstOrNull() ?: selectedSession
                onContextChange(selectedAthlete, event, nextSession)
            }
            IssfEntryChipRow("Tipo", sessions, selectedSession) { session ->
                onContextChange(selectedAthlete, selectedEvent, session)
            }
        }
    }
}

@Composable
private fun IssfEntryChipRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit) {
    Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        values.distinct().forEach { value ->
            FilterChip(selected = value == selected, onClick = { onSelect(value) }, label = { Text(value, fontSize = 10.sp) })
        }
    }
    Spacer(modifier = Modifier.height(6.dp))
}

@Composable
private fun AthleteSubmissionStatusCard(submissions: List<AthleteSubmission>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.entry_my_entries), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            if (submissions.isEmpty()) {
                Text(stringResource(R.string.entry_no_entries), fontSize = 12.sp, color = HciTextSecondary)
            } else {
                submissions.forEachIndexed { index, submission ->
                    if (index > 0) HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = HciCardBorder)
                    AthleteSubmissionStatusRow(submission)
                }
            }
        }
    }
}

@Composable
private fun AthleteSubmissionStatusRow(submission: AthleteSubmission) {
    val dateText = remember(submission.submittedAt) {
        SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date(submission.submittedAt))
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column(modifier = Modifier.weight(1f)) {
            Text("${submission.serie} | ${submission.source}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(stringResource(R.string.entry_total_format, dateText, "%.1f".format(submission.total)), fontSize = 11.sp, color = HciTextSecondary)
        }
        SubmissionStatusChip(submission.status)
    }
}

@Composable
private fun SubmissionStatusChip(status: String) {
    val colors = when (status) {
        "APPROVED" -> Color(0xFFDCFCE7) to Color(0xFF166534)
        "REJECTED" -> Color(0xFFFEE2E2) to Color(0xFF991B1B)
        else -> Color(0xFFFEF3C7) to Color(0xFF854D0E)
    }
    AssistChip(
        onClick = {},
        label = { Text(status, fontSize = 10.sp) },
        colors = AssistChipDefaults.assistChipColors(containerColor = colors.first, labelColor = colors.second)
    )
}

@Composable
private fun TargetEntryCard(
    title: String,
    subtitle: String,
    tierUnlocked: Boolean,
    totalShots: Int,
    onTotalShotsChange: (Int) -> Unit,
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedZoneId: String,
    onSelectZone: (String) -> Unit,
    onAdjustCount: (Int) -> Unit,
    remainingShots: Int,
    onFinalize: () -> Unit,
    targetContent: @Composable () -> Unit,
    appLanguage: AppLanguage
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x332B3340))
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFFFDFDFD), Color(0xFFF4F7FB), Color(0xFFEFF4FA))
                    ),
                    RoundedCornerShape(16.dp)
                )
                .padding(16.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                    Text(subtitle, fontSize = 11.sp, color = HciTextSecondary)
                }
                AssistChip(
                    onClick = {},
                    label = {
                        Text(if (appLanguage == AppLanguage.PT) "Ativo" else "Active", fontSize = 10.sp)
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = Color(0xFFDCFCE7),
                        labelColor = Color(0xFF166534)
                    )
                )
            }
            Spacer(modifier = Modifier.height(12.dp))

            ShotsTotalControl(totalShots = totalShots, onChange = onTotalShotsChange, appLanguage = appLanguage)
            Spacer(modifier = Modifier.height(12.dp))
            targetContent()
            Spacer(modifier = Modifier.height(12.dp))

            ZoneCountEditor(
                hotspots = hotspots,
                counts = counts,
                selectedZoneId = selectedZoneId,
                onSelectZone = onSelectZone,
                onAdjustCount = onAdjustCount,
                remainingShots = remainingShots,
                appLanguage = appLanguage
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onFinalize,
                enabled = totalShots > 0 && counts.values.sum() <= totalShots,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
            ) {
                Text(if (appLanguage == AppLanguage.PT) "Finalizar entrada de dados" else "Finish data entry")
            }
        }
    }
}

@Composable
private fun ShotsTotalControl(totalShots: Int, onChange: (Int) -> Unit, appLanguage: AppLanguage) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33475569))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(if (appLanguage == AppLanguage.PT) "Total de disparos" else "Total shots", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))
                Text(totalShots.toString(), fontSize = 30.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AdjustButton(label = "-5") { onChange((totalShots - 5).coerceAtLeast(0)) }
                AdjustButton(label = "-1") { onChange((totalShots - 1).coerceAtLeast(0)) }
                AdjustButton(label = "+1") { onChange(totalShots + 1) }
                AdjustButton(label = "+5") { onChange(totalShots + 5) }
            }
        }
    }
}

@Composable
private fun AdjustButton(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2E8F0), contentColor = Color(0xFF0F172A)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ZoneCountEditor(
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedZoneId: String,
    onSelectZone: (String) -> Unit,
    onAdjustCount: (Int) -> Unit,
    remainingShots: Int,
    appLanguage: AppLanguage
) {
    val selected = hotspots.first { it.id == selectedZoneId }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33B45309))
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(listOf(Color(0xFFFFFBEB), Color(0xFFFFF7D6))),
                    RoundedCornerShape(12.dp)
                )
                .padding(12.dp)
        ) {
            Text(if (appLanguage == AppLanguage.PT) "Distribuição por ponto" else "Point distribution", fontWeight = FontWeight.Bold, color = Color(0xFF92400E), fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                hotspots.forEach { hotspot ->
                    FilterChip(
                        selected = hotspot.id == selectedZoneId,
                        onClick = { onSelectZone(hotspot.id) },
                        label = { Text("${hotspot.label}: ${counts[hotspot.id] ?: 0}", fontSize = 10.sp) }
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("${if (appLanguage == AppLanguage.PT) "Ponto selecionado" else "Selected point"}: ${selected.label}", fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text("${if (appLanguage == AppLanguage.PT) "Restantes para distribuir" else "Remaining"}: $remainingShots", fontSize = 11.sp, color = if (remainingShots == 0) Color(0xFF166534) else Color(0xFFB45309))
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AdjustButton(label = "-5") { onAdjustCount(-5) }
                AdjustButton(label = "-1") { onAdjustCount(-1) }
                Text((counts[selected.id] ?: 0).toString(), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                AdjustButton(label = "+1") { onAdjustCount(1) }
                AdjustButton(label = "+5") { onAdjustCount(5) }
            }
        }
    }
}

@Composable
private fun PremiumHumanoidTarget(
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedZoneId: String,
    onSelectZone: (String) -> Unit
) {
    TargetCanvasShell {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val body = Color(0xFF111827)
            val stroke = Color(0xFFCBD5E1)
            val center = width * 0.5f

            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFFF8FAFC), Color(0xFFE2E8F0))),
                cornerRadius = CornerRadius(24f, 24f),
                size = size
            )
            drawCircle(body, radius = width * 0.12f, center = Offset(center, height * 0.16f))
            drawRoundRect(
                color = body,
                topLeft = Offset(width * 0.34f, height * 0.24f),
                size = Size(width * 0.32f, height * 0.38f),
                cornerRadius = CornerRadius(48f, 48f)
            )
            drawRoundRect(
                color = body,
                topLeft = Offset(width * 0.18f, height * 0.28f),
                size = Size(width * 0.14f, height * 0.32f),
                cornerRadius = CornerRadius(40f, 40f)
            )
            drawRoundRect(
                color = body,
                topLeft = Offset(width * 0.68f, height * 0.28f),
                size = Size(width * 0.14f, height * 0.32f),
                cornerRadius = CornerRadius(40f, 40f)
            )
            drawRoundRect(
                color = body,
                topLeft = Offset(width * 0.40f, height * 0.60f),
                size = Size(width * 0.20f, height * 0.24f),
                cornerRadius = CornerRadius(40f, 40f)
            )

            repeat(4) { index ->
                drawCircle(
                    color = stroke,
                    radius = width * (0.05f + index * 0.03f),
                    center = Offset(center, height * 0.37f),
                    style = Stroke(width = 1.5f)
                )
            }
            drawCircle(
                color = stroke,
                radius = width * 0.08f,
                center = Offset(center, height * 0.58f),
                style = Stroke(width = 1.5f)
            )
            drawLine(stroke, Offset(center, height * 0.08f), Offset(center, height * 0.86f), strokeWidth = 1.5f)

            hotspots.forEach { hotspot ->
                val point = Offset(width * hotspot.x, height * hotspot.y)
                val selected = hotspot.id == selectedZoneId
                drawCircle(
                    color = hotspot.color.copy(alpha = if (selected) 1f else 0.82f),
                    radius = if (selected) 16f else 13f,
                    center = point
                )
                drawShotMarks(drawContext.canvas.nativeCanvas, point, counts[hotspot.id] ?: 0, hotspot.color)
            }
        }
        hotspots.forEach { hotspot ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(
                        start = (hotspot.x * 280).dp - 16.dp,
                        top = (hotspot.y * 400).dp - 16.dp
                    )
                    .size(36.dp)
                    .background(Color.Transparent, CircleShape)
                    .clickable { onSelectZone(hotspot.id) }
            )
        }
    }
}

@Composable
private fun PremiumQuadTarget(
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedZoneId: String,
    onSelectZone: (String) -> Unit
) {
    TargetCanvasShell {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF0F172A), Color(0xFF1E293B))),
                cornerRadius = CornerRadius(24f, 24f),
                size = size
            )
            val frameLeft = w * 0.08f
            val frameTop = h * 0.08f
            val frameWidth = w * 0.84f
            val frameHeight = h * 0.84f
            drawRoundRect(
                color = Color(0xFFF8FAFC),
                topLeft = Offset(frameLeft, frameTop),
                size = Size(frameWidth, frameHeight),
                cornerRadius = CornerRadius(18f, 18f)
            )
            val halfW = frameWidth / 2f
            val halfH = frameHeight / 2f
            val colors = mapOf(
                "YELLOW" to Color(0xFFFDE047),
                "GREEN" to Color(0xFF84CC16),
                "RED" to Color(0xFFEF4444),
                "BLUE" to Color(0xFF0EA5E9)
            )
            drawRect(colors.getValue("YELLOW"), Offset(frameLeft, frameTop), Size(halfW, halfH))
            drawRect(colors.getValue("GREEN"), Offset(frameLeft + halfW, frameTop), Size(halfW, halfH))
            drawRect(colors.getValue("RED"), Offset(frameLeft, frameTop + halfH), Size(halfW, halfH))
            drawRect(colors.getValue("BLUE"), Offset(frameLeft + halfW, frameTop + halfH), Size(halfW, halfH))

            hotspots.forEach { hotspot ->
                val center = Offset(w * hotspot.x, h * hotspot.y)
                repeat(4) { ring ->
                    drawCircle(
                        color = Color.White.copy(alpha = 0.55f),
                        radius = 18f + ring * 16f,
                        center = center,
                        style = Stroke(width = 2f)
                    )
                }
                val selected = hotspot.id == selectedZoneId
                drawCircle(Color.Black, radius = if (selected) 13f else 10f, center = center)
                drawShotMarks(drawContext.canvas.nativeCanvas, center, counts[hotspot.id] ?: 0, Color.White)
            }
        }
        hotspots.forEach { hotspot ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(
                        start = (hotspot.x * 280).dp - 18.dp,
                        top = (hotspot.y * 360).dp - 18.dp
                    )
                    .size(40.dp)
                    .background(Color.Transparent, CircleShape)
                    .clickable { onSelectZone(hotspot.id) }
            )
        }
    }
}

@Composable
private fun
        Duel20TargetCanvas(
    directions: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedDirectionId: String,
    selectedScore: Int,
    onSelectDirection: (String) -> Unit
) {
    TargetCanvasShell {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val center = Offset(w / 2f, h / 2f)
            val maxRadius = minOf(w, h) * 0.38f
            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF0F172A), Color(0xFF1E293B))),
                cornerRadius = CornerRadius(24f, 24f),
                size = size
            )
            (10 downTo 6).forEach { score ->
                val radius = maxRadius * ((11 - score) / 5f)
                drawCircle(
                    color = if (score == selectedScore) Color(0xFFFCD34D).copy(alpha = 0.18f) else Color.White.copy(alpha = 0.08f),
                    radius = radius,
                    center = center,
                    style = Fill
                )
                drawCircle(
                    color = Color.White.copy(alpha = 0.24f),
                    radius = radius,
                    center = center,
                    style = Stroke(width = 2f)
                )
            }
            directions.forEach { direction ->
                val angle = duelDirectionAngle(direction.id)
                val end = Offset(
                    center.x + cos(angle) * maxRadius,
                    center.y + sin(angle) * maxRadius
                )
                drawLine(
                    color = if (direction.id == selectedDirectionId) Color(0xFFFCD34D) else Color.White.copy(alpha = 0.22f),
                    start = center,
                    end = end,
                    strokeWidth = if (direction.id == selectedDirectionId) 4f else 2f
                )
            }
            counts.forEach { (key, count) ->
                if (count > 0) {
                    val isX = key.startsWith("X")
                    val score = if (isX) 10 else key.takeWhile { it.isDigit() }.toIntOrNull() ?: return@forEach
                    val directionId = if (isX) key.drop(1) else key.dropWhile { it.isDigit() }
                    val point = duelScoreDirectionPoint(center, maxRadius, score, directionId)
                    drawCircle(Color(0xFF0F172A), radius = 15f, center = point)
                    drawCircle(Color.White, radius = 12f, center = point)
                    drawShotMarks(drawContext.canvas.nativeCanvas, point, count, Color(0xFF0F172A))
                }
            }
            drawCircle(Color.White.copy(alpha = 0.96f), radius = 7f, center = center)
        }
        directions.forEach { direction ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(
                        start = (direction.x * 280).dp - 22.dp,
                        top = (direction.y * 360).dp - 22.dp
                    )
                    .size(48.dp)
                    .background(Color.Transparent, CircleShape)
                    .clickable { onSelectDirection(direction.id) }
            )
        }
    }
}

@Composable
private fun Duel20ScoreDirectionEditor(
    directions: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedDirectionId: String,
    selectedScore: Int,
    remainingShots: Int,
    appLanguage: AppLanguage,
    onSelectDirection: (String) -> Unit,
    onSelectScore: (Int) -> Unit,
    onAdjustCount: (Int) -> Unit
) {
    val selectedDirection = directions.first { it.id == selectedDirectionId }

    val selectedKey = if (selectedScore == 12) {
        "XC"
    } else {
        "$selectedScore$selectedDirectionId"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33B45309))
    ) {
        Column(
            modifier = Modifier
                .background(Brush.verticalGradient(listOf(Color(0xFFFFFBEB), Color(0xFFFFF7D6))), RoundedCornerShape(12.dp))
                .padding(12.dp)
        ) {
            Text(if (appLanguage == AppLanguage.PT) "Pontuação e direção" else "Score and direction", fontWeight = FontWeight.Bold, color = Color(0xFF92400E), fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(if (appLanguage == AppLanguage.PT) "Pontuação" else "Score", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                (0..10).forEach { score ->
                    FilterChip(
                        selected = selectedScore == score,
                        onClick = { onSelectScore(score) },
                        label = { Text(score.toString(), fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    )
                }

                FilterChip(
                    selected = selectedScore == 12,
                    onClick = { onSelectScore(12) },
                    label = { Text("X", fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(if (appLanguage == AppLanguage.PT) "Direção radial" else "Radial direction", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                directions.forEach { direction ->
                    FilterChip(
                        selected = selectedDirectionId == direction.id,
                        onClick = { onSelectDirection(direction.id) },
                        label = { Text(direction.id, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            val selectedScoreLabel = if (selectedScore == 12) "X" else selectedScore.toString()

            Text(
                "${if (appLanguage == AppLanguage.PT) "Selecionado" else "Selected"}: $selectedScoreLabel${selectedDirection.id} - ${selectedDirection.label}",
                fontWeight = FontWeight.Bold,
                color = HciTextPrimary
            )

            Text("${if (appLanguage == AppLanguage.PT) "Restantes para distribuir" else "Remaining"}: $remainingShots", fontSize = 11.sp, color = if (remainingShots == 0) Color(0xFF166534) else Color(0xFFB45309))
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AdjustButton(label = "-5") { onAdjustCount(-5) }
                AdjustButton(label = "-1") { onAdjustCount(-1) }
                Text((counts[selectedKey] ?: 0).toString(), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                AdjustButton(label = "+1") { onAdjustCount(1) }
                AdjustButton(label = "+5") { onAdjustCount(5) }
            }
        }
    }
}

private fun duelDirectionAngle(directionId: String): Float {
    val degrees = when (directionId) {
        "N" -> -90.0
        "NE" -> -45.0
        "E" -> 0.0
        "SE" -> 45.0
        "S" -> 90.0
        "SW" -> 135.0
        "W" -> 180.0
        "NW" -> -135.0
        else -> 0.0
    }
    return Math.toRadians(degrees).toFloat()
}

private fun duelScoreDirectionPoint(center: Offset, maxRadius: Float, score: Int, directionId: String): Offset {
    val normalized = ((10 - score).coerceIn(0, 10) / 10f)
    val radius = (maxRadius * normalized).coerceAtLeast(if (score == 10) 0f else maxRadius * 0.08f)
    val angle = duelDirectionAngle(directionId)
    return Offset(
        center.x + cos(angle) * radius,
        center.y + sin(angle) * radius
    )
}

@Composable
private fun PremiumDuel20Target(
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    selectedZoneId: String,
    onSelectZone: (String) -> Unit
) {
    TargetCanvasShell {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val center = Offset(w / 2f, h / 2f)
            val radius = minOf(w, h) * 0.34f
            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF0F172A), Color(0xFF1E293B))),
                cornerRadius = CornerRadius(24f, 24f),
                size = size
            )
            repeat(4) { ring ->
                drawCircle(
                    color = Color.White.copy(alpha = 0.14f),
                    radius = radius * ((ring + 1) / 4f),
                    center = center,
                    style = Stroke(width = 2f)
                )
            }
            hotspots.forEach { hotspot ->
                val point = Offset(w * hotspot.x, h * hotspot.y)
                drawLine(Color.White.copy(alpha = 0.22f), center, point, strokeWidth = 2f)
            }
            hotspots.forEach { hotspot ->
                val point = Offset(w * hotspot.x, h * hotspot.y)
                val selected = hotspot.id == selectedZoneId
                drawCircle(
                    color = hotspot.color.copy(alpha = if (selected) 1f else 0.78f),
                    radius = if (selected) 18f else 14f,
                    center = point
                )
                drawCircle(Color.White.copy(alpha = 0.88f), radius = if (selected) 7f else 5f, center = point)
                drawShotMarks(drawContext.canvas.nativeCanvas, point, counts[hotspot.id] ?: 0, hotspot.color)
            }
            drawCircle(Color.White.copy(alpha = 0.92f), radius = 7f, center = center)
        }
        hotspots.forEach { hotspot ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(
                        start = (hotspot.x * 280).dp - 20.dp,
                        top = (hotspot.y * 360).dp - 20.dp
                    )
                    .size(44.dp)
                    .background(Color.Transparent, CircleShape)
                    .clickable { onSelectZone(hotspot.id) }
            )
        }
    }
}
private fun drawShotMarks(
    canvas: android.graphics.Canvas,
    center: Offset,
    count: Int,
    accent: Color
) {
    if (count <= 0) return
    val paint = android.graphics.Paint().apply {
        color = android.graphics.Color.WHITE
        textAlign = android.graphics.Paint.Align.CENTER
        textSize = 18f
        isFakeBoldText = true
    }
    val ringPaint = android.graphics.Paint().apply {
        color = android.graphics.Color.argb(
            (accent.alpha * 255).toInt(),
            (accent.red * 255).toInt(),
            (accent.green * 255).toInt(),
            (accent.blue * 255).toInt()
        )
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 1.5f
    }
    val visibleCount = count.coerceAtMost(10)
    for (index in 0 until visibleCount) {
        val angle = (Math.PI * 2 * index / visibleCount.toDouble())
        val radius = if (visibleCount == 1) 0.0 else 8.0 + (index % 3) * 7.0
        val x = center.x + (cos(angle) * radius).toFloat()
        val y = center.y + (sin(angle) * radius).toFloat()
        canvas.drawCircle(x, y - 6f, 9f, ringPaint)
        canvas.drawText("X", x, y, paint)
    }
    if (count > visibleCount) {
        canvas.drawText("+${count - visibleCount}", center.x, center.y + 22f, paint.apply { textSize = 14f })
    }
}

@Composable
private fun TargetCanvasShell(content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.72f)
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF09111F), Color(0xFF172033), Color(0xFF101826))
                ),
                RoundedCornerShape(28.dp)
            )
            .padding(8.dp),
        content = content
    )
}

@Composable
private fun TargetReportCard(
    title: String,
    analysis: TargetAnalysis,
    onGeneratePdf: () -> Unit,
    canGeneratePdf: Boolean,
    appLanguage: AppLanguage
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33F59E0B))
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF0F172A), Color(0xFF172554), Color(0xFF1E293B))
                    ),
                    RoundedCornerShape(16.dp)
                )
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                    Text(
                        if (appLanguage == AppLanguage.PT) "Leitura comercial pronta para o atleta" else "Commercial-ready reading for the athlete",
                        fontSize = 11.sp,
                        color = Color(0xFFE2E8F0)
                    )
                }
                AssistChip(
                    onClick = {},
                    label = { Text("HCI", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    leadingIcon = {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp)
                        )
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = Color(0xFFF59E0B),
                        labelColor = Color(0xFF111827),
                        leadingIconContentColor = Color(0xFF111827)
                    )
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            analysis.percentages.forEach { (label, pct) ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(label, color = Color(0xFFE5E7EB), fontSize = 12.sp)
                    Text("$pct%", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Color(0x33475569))
            Spacer(modifier = Modifier.height(10.dp))
            analysis.insights.take(3).forEachIndexed { index, insight ->
                Text("${index + 1}. $insight", fontSize = 12.sp, color = Color(0xFFE2E8F0))
                Spacer(modifier = Modifier.height(4.dp))
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                if (appLanguage == AppLanguage.PT) "Treino recomendado: ${analysis.recommendedTraining}"
                else "Recommended training: ${analysis.recommendedTraining}",
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFCD34D)
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(analysis.reportPayload.trainingDescription, fontSize = 12.sp, color = Color(0xFFD1D5DB))
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onGeneratePdf,
                enabled = canGeneratePdf,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFF59E0B),
                    contentColor = Color(0xFF111827),
                    disabledContainerColor = Color(0xFF64748B),
                    disabledContentColor = Color(0xFFE2E8F0)
                )
            ) {
                Icon(Icons.Default.PictureAsPdf, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (canGeneratePdf) {
                        if (appLanguage == AppLanguage.PT) "Gerar PDF gift" else "Generate PDF gift"
                    } else {
                        if (appLanguage == AppLanguage.PT) "Relatorio: Coach ou GOLD" else "Report: Coach or GOLD"
                    },
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun HciTargetContextCard(
    athleteName: String,
    eventName: String,
    sessionName: String,
    appLanguage: AppLanguage
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x332563EB))
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.horizontalGradient(
                        listOf(Color(0xFFEFF6FF), Color(0xFFF8FAFC), Color(0xFFEEF2FF))
                    ),
                    RoundedCornerShape(12.dp)
                )
                .padding(16.dp)
        ) {
            Text(if (appLanguage == AppLanguage.PT) "Contexto da sessão" else "Session context", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            AssistChip(
                onClick = {},
                label = { Text("Shot Fair", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = Color(0xFF0F172A),
                    labelColor = Color.White
                )
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text("${if (appLanguage == AppLanguage.PT) "Atleta" else "Athlete"}: $athleteName", fontSize = 12.sp, color = HciTextPrimary, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Text("${if (appLanguage == AppLanguage.PT) "Evento" else "Event"}: $eventName", fontSize = 12.sp, color = HciTextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            Text("${if (appLanguage == AppLanguage.PT) "Ambiente" else "Environment"}: $sessionName", fontSize = 12.sp, color = HciTextPrimary)
        }
    }
}

@Composable
private fun ConfirmSubmissionDialog(
    appLanguage: AppLanguage,
    filled: Int,
    total: Int,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(if (appLanguage == AppLanguage.PT) "Confirmar envio" else "Confirm submission")
        },
        text = {
            Text(
                if (appLanguage == AppLanguage.PT) "$filled/$total confirma? Os disparos restantes entram como zero."
                else "$filled/$total confirm? Remaining shots will be recorded as zero."
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(if (appLanguage == AppLanguage.PT) "Confirmar" else "Confirm")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(if (appLanguage == AppLanguage.PT) "Voltar" else "Back")
            }
        }
    )
}

private fun analyzeTarget(
    engine: TargetIntelligenceEngine,
    targetType: String,
    athleteName: String,
    eventLabel: String,
    sessionLabel: String,
    appLanguage: AppLanguage,
    hotspots: List<TargetHotspot>,
    counts: Map<String, Int>,
    totalShots: Int
): TargetAnalysis {
    val payload = engine.analyze(
        targetType = targetType,
        athleteName = athleteName,
        eventLabel = eventLabel,
        sessionLabel = sessionLabel,
        appLanguage = appLanguage,
        hotspots = hotspots.map { "${it.id}|${it.label}" },
        counts = hotspots.map { counts[it.id] ?: 0 },
        totalShots = totalShots
    )
    return TargetAnalysis(
        percentages = payload.percentages,
        insights = payload.insights,
        recommendedTraining = payload.trainingTitle,
        reportPayload = payload
    )
}

private fun buildIssfDirectionalCounts(
    shotDirections: Map<String, String>,
    submissions: List<AthleteSubmission>
): Map<String, Int> {
    val validDirections = setOf("C", "N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val counts = linkedMapOf<String, Int>()

    fun addDirection(direction: String) {
        val normalized = direction.trim().uppercase(Locale.getDefault())
        if (normalized in validDirections) {
            counts[normalized] = counts.getOrDefault(normalized, 0) + 1
        }
    }

    shotDirections.values.forEach(::addDirection)
    submissions.forEach { submission ->
        parseDirectionsFromNotes(submission.notes).forEach(::addDirection)
    }
    return counts
}

private fun buildIssfDirectionalCountsFromTargetSession(session: TargetSession?): Map<String, Int> {
    if (session == null) return emptyMap()
    val labels = session.zoneLabels.map { it.substringBefore('|').trim().uppercase(Locale.getDefault()) }
    return labels.zip(session.zoneCounts).associate { (label, count) -> label to count }
}

private fun parseDirectionsFromNotes(notes: String): List<String> {
    val prefix = "DIRECTIONS:"
    val block = notes.lineSequence().firstOrNull { it.trim().startsWith(prefix) } ?: return emptyList()
    return Regex("""T\d+:(C|N|NE|E|SE|S|SW|W|NW)""")
        .findAll(block.uppercase(Locale.getDefault()))
        .map { it.groupValues[1] }
        .toList()
}

private fun buildIssfDirectionalSectors(
    counts: Map<String, Int>,
    appLanguage: AppLanguage
): List<DirectionalTargetSector> {
    val directionDefinitions = listOf(
        Triple(0, "E", if (appLanguage == AppLanguage.PT) "Direita" else "Right"),
        Triple(45, "NE", if (appLanguage == AppLanguage.PT) "Superior Direita" else "Upper right"),
        Triple(90, "N", if (appLanguage == AppLanguage.PT) "Acima" else "Up"),
        Triple(135, "NW", if (appLanguage == AppLanguage.PT) "Superior Esquerda" else "Upper left"),
        Triple(180, "W", if (appLanguage == AppLanguage.PT) "Esquerda" else "Left"),
        Triple(225, "SW", if (appLanguage == AppLanguage.PT) "Inferior Esquerda" else "Lower left"),
        Triple(270, "S", if (appLanguage == AppLanguage.PT) "Abaixo" else "Down"),
        Triple(315, "SE", if (appLanguage == AppLanguage.PT) "Inferior Direita" else "Lower right")
    )
    val directionalTotal = directionDefinitions.sumOf { (_, code, _) ->
        counts.getOrDefault(code, 0)
    }.coerceAtLeast(1)

    val sectors = directionDefinitions.map { (angle, code, label) ->
        val count = counts.getOrDefault(code, 0)
        val percent = count * 100.0 / directionalTotal
        DirectionalTargetSector(
            angle = angle,
            label = label,
            directionCode = code,
            weightPercent = percent,
            insight = if (appLanguage == AppLanguage.PT) {
                "$label representa ${percent.toInt()}% dos impactos direcionais."
            } else {
                "$label represents ${percent.toInt()}% of directional impacts."
            },
            likelyCause = if (appLanguage == AppLanguage.PT) {
                "Leitura direcional consolidada para a área ISSF."
            } else {
                "Directional reading consolidated for the ISSF area."
            },
            trainingCode = "ISSF_DIRECTIONAL"
        )
    }.toMutableList()

    val centerCount = counts.getOrDefault("C", 0)
    if (centerCount > 0) {
        val centerPercent = centerCount * 100.0 / counts.values.sum().coerceAtLeast(1)
        sectors += DirectionalTargetSector(
            angle = 90,
            label = if (appLanguage == AppLanguage.PT) "Centro" else "Center",
            directionCode = "C",
            weightPercent = centerPercent,
            insight = if (appLanguage == AppLanguage.PT) {
                "Centro representa ${centerPercent.toInt()}% dos impactos registrados."
            } else {
                "Center represents ${centerPercent.toInt()}% of recorded impacts."
            },
            likelyCause = if (appLanguage == AppLanguage.PT) {
                "Concentração central do agrupamento."
            } else {
                "Central grouping concentration."
            },
            trainingCode = "ISSF_DIRECTIONAL_CENTER"
        )
    }

    return sectors
}
private fun buildDuel20DirectionalSectors(
    counts: Map<String, Int>,
    appLanguage: AppLanguage
): List<DirectionalTargetSector> {

    fun directionFromKey(key: String): String? {
        return when {
            key == "XC" -> "C"
            key.startsWith("X") -> key.drop(1)
            else -> key.dropWhile { it.isDigit() }
        }.ifBlank {
            null
        }
    }

    fun countDirection(direction: String): Int {
        return counts.entries.sumOf { entry ->
            val keyDirection = directionFromKey(entry.key)
            if (keyDirection == direction) entry.value else 0
        }
    }

    val directionDefinitions = listOf(
        Triple(0, "E", if (appLanguage == AppLanguage.PT) "Direita" else "Right"),
        Triple(45, "NE", if (appLanguage == AppLanguage.PT) "Superior Direita" else "Upper right"),
        Triple(90, "N", if (appLanguage == AppLanguage.PT) "Acima" else "Up"),
        Triple(135, "NW", if (appLanguage == AppLanguage.PT) "Superior Esquerda" else "Upper left"),
        Triple(180, "W", if (appLanguage == AppLanguage.PT) "Esquerda" else "Left"),
        Triple(225, "SW", if (appLanguage == AppLanguage.PT) "Inferior Esquerda" else "Lower left"),
        Triple(270, "S", if (appLanguage == AppLanguage.PT) "Abaixo" else "Down"),
        Triple(315, "SE", if (appLanguage == AppLanguage.PT) "Inferior Direita" else "Lower right")
    )

    val directionalTotal = directionDefinitions.sumOf { (_, code, _) ->
        countDirection(code)
    }.coerceAtLeast(1)

    return directionDefinitions.map { (angle, code, label) ->
        val count = countDirection(code)
        val percent = (count * 100.0) / directionalTotal

        DirectionalTargetSector(
            angle = angle,
            label = label,
            directionCode = code,
            weightPercent = percent,
            insight = if (appLanguage == AppLanguage.PT) {
                "$label representa ${percent.toInt()}% dos impactos direcionais."
            } else {
                "$label represents ${percent.toInt()}% of directional impacts."
            },
            likelyCause = when (code) {
                "SE" -> if (appLanguage == AppLanguage.PT) {
                    "Possível antecipação, quebra de punho ou acionamento brusco."
                } else {
                    "Possible anticipation, wrist break, or abrupt triggering."
                }

                "S" -> if (appLanguage == AppLanguage.PT) {
                    "Possível queda de sustentação ou perda de follow-through."
                } else {
                    "Possible support drop or loss of follow-through."
                }

                "E", "W" -> if (appLanguage == AppLanguage.PT) {
                    "Possível lateralização de empunhadura ou alinhamento."
                } else {
                    "Possible grip or alignment lateralization."
                }

                "NE", "N", "NW" -> if (appLanguage == AppLanguage.PT) {
                    "Possível entrada visual alta ou compensação de mira."
                } else {
                    "Possible high visual entry or aiming compensation."
                }

                "SW" -> if (appLanguage == AppLanguage.PT) {
                    "Possível desequilíbrio de posição ou ajuste corporal baixo."
                } else {
                    "Possible stance imbalance or low body adjustment."
                }

                else -> if (appLanguage == AppLanguage.PT) {
                    "Padrão direcional residual."
                } else {
                    "Residual directional pattern."
                }
            },
            trainingCode = when (code) {
                "SE", "S" -> "TARGET_TRIGGERING"
                "E", "W" -> "TARGET_GRIP"
                "NE", "N", "NW" -> "TARGET_AIMING"
                "SW" -> "TARGET_POSITION"
                else -> "TARGET_AIMING"
            }
        )
    }
}




