package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.R
import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult
import com.example.sportsperformance.data.model.ShotSeries
import com.example.sportsperformance.logic.DiagnosticEngine
import com.example.sportsperformance.logic.PhysicalEngine
import com.example.sportsperformance.ui.components.ExcelRhythmTimelineChart
import com.example.sportsperformance.ui.components.AthleteEvolutionChart
import com.example.sportsperformance.ui.components.HciRadarChart
import com.example.sportsperformance.ui.components.RhythmPathChart
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciError
import com.example.sportsperformance.ui.theme.HciPrimaryDark
import com.example.sportsperformance.ui.theme.HciPrimaryLight
import com.example.sportsperformance.ui.theme.HciSuccess
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciUiState
import com.example.sportsperformance.ui.viewmodel.HciViewModel
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

@Composable
fun HciDashboardScreen(viewModel: HciViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()
    val lastUpdate by viewModel.lastUpdate.collectAsState()
    val trainingGoal by viewModel.trainingGoal.collectAsState()
    val allSeries by viewModel.allSeries.collectAsState(initial = emptyList())
    val selectedAthlete by viewModel.selectedAthlete.collectAsState()
    val selectedEvent by viewModel.selectedEvent.collectAsState()
    val selectedSession by viewModel.selectedSession.collectAsState()
    val selectedAvatarRes by viewModel.selectedAvatarRes.collectAsState()
    val displayAthleteName by viewModel.displayAthleteName.collectAsState()
    val appLanguage by viewModel.appLanguage.collectAsState()
    val targetSessions by viewModel.targetSessions.collectAsState(initial = emptyList())
    val predictionTargets = viewModel.getPredictionTargetsForCurrentContext(
        prova = (uiState as? HciUiState.Success)?.result?.prova ?: "PISTOL",
        trainingGoal = trainingGoal,
    )

    LaunchedEffect(uiState) {
        if (uiState is HciUiState.Idle) {
            viewModel.atualizarDashboard()
        }
    }

    Scaffold(
        bottomBar = {HciBottomNavigation(viewModel) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(HciBackground)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            HeaderSection(
                status = statusMessage,
                lastUpdate = lastUpdate,
                currentLanguage = appLanguage,
                onLanguageToggle = viewModel::setAppLanguage,
                onLogoClick = { viewModel.navigateTo("DASHBOARD") },
                onLogoutClick = viewModel::logout
            )

            Spacer(modifier = Modifier.height(16.dp))

            when (val state = uiState) {
                is HciUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = HciAccentBlue)
                    }
                }
                is HciUiState.Success -> {
                    DashboardContent(
                        result = state.result,
                        diagnostics = state.diagnostics,
                        training = state.trainingPlan,
                        physical = state.physicalPlan,
                        trainingGoal = trainingGoal,
                        predictionTargets = predictionTargets,
                        allSeries = allSeries,
                        selectedAthlete = selectedAthlete,
                        selectedEvent = selectedEvent,
                        selectedSession = selectedSession,
                        selectedAvatarRes = selectedAvatarRes,
                        displayAthleteName = displayAthleteName,
                        appLanguage = appLanguage,
                        targetSessions = targetSessions,
                        onSelectContext = viewModel::selectContext,
                        onNavigateToEntry = { viewModel.navigateTo("ENTRY") }
                    )
                }
                else -> {
                    Button(
                        onClick = { viewModel.atualizarDashboard() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = HciAccentBlue)
                    ) {
                        Text(stringResource(R.string.dashboard_load_button))
                    }
                }
            }
        }
    }
}

@Composable
fun HeaderSection(
    status: String,
    lastUpdate: String,
    currentLanguage: AppLanguage,
    onLanguageToggle: (AppLanguage) -> Unit,
    onLogoClick: () -> Unit,
    onLogoutClick: () -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clickable(onClick = onLogoClick)
                .background(Color.White, RoundedCornerShape(8.dp))
                .padding(4.dp),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.ic_hci_app),
                contentDescription = "HCI",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("HCI PERFORMANCE", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text(status, fontSize = 12.sp, color = HciTextSecondary)
            if (lastUpdate.isNotEmpty()) {
                Text(lastUpdate, fontSize = 10.sp, color = HciTextSecondary)
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = {
                    val next = if (currentLanguage == AppLanguage.PT) {
                        AppLanguage.EN
                    } else {
                        AppLanguage.PT
                    }
                    onLanguageToggle(next)
                },
                modifier = Modifier.size(40.dp)
            ) {
                Text(
                    text = if (currentLanguage == AppLanguage.PT) "PT" else "EN",
                    fontWeight = FontWeight.Bold,
                    color = HciAccentBlue,
                    fontSize = 14.sp
                )
            }

            IconButton(
                onClick = onLogoutClick,
                modifier = Modifier.size(40.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.imgout),
                    contentDescription = if (currentLanguage == AppLanguage.PT) "Sair" else "Logout",
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
fun DashboardContent(
    result: HciEventResult,
    diagnostics: List<DiagnosticEngine.Diagnostic>,
    training: TrainingLibrary,
    physical: PhysicalEngine.PhysicalPackage,
    trainingGoal: Int,
    predictionTargets: Triple<Int, Int, Int>,
    allSeries: List<ShotSeries>,
    selectedAthlete: String,
    selectedEvent: String,
    selectedSession: String,
    selectedAvatarRes: Int,
    displayAthleteName: String,
    appLanguage: AppLanguage,
    targetSessions: List<TargetSession>,
    onSelectContext: (String, String, String) -> Unit,
    onNavigateToEntry: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = if (appLanguage == AppLanguage.PT) {
        listOf("Resumo", "Índices", "Ritmo", "Target", "Plano")
    } else {
        listOf("Overview", "Indexes", "Rhythm", "Target", "Plan")
    }
    val events = allSeries.filter { it.atleta == selectedAthlete }.map { it.evento }.distinct().sorted()
    val sessions = allSeries
        .filter { it.atleta == selectedAthlete && it.evento == selectedEvent }
        .map { it.sessao }
        .distinct()
        .sorted()

    Column {
        AthleteContextCard(result, selectedSession, selectedAvatarRes, displayAthleteName, appLanguage)
        Spacer(modifier = Modifier.height(10.dp))
        DataEntryHeroButton(onNavigateToEntry, appLanguage)
        Spacer(modifier = Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            events.forEach { event ->
                FilterChip(
                    selected = event == selectedEvent,
                    onClick = {
                        val nextSession = allSeries
                            .asSequence()
                            .filter { it.atleta == selectedAthlete && it.evento == event }
                            .map { it.sessao }
                            .distinct().minOrNull() ?: selectedSession
                        onSelectContext(selectedAthlete, event, nextSession)
                    },
                    label = { Text(event, fontSize = 10.sp) }
                )
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            sessions.forEach { session ->
                FilterChip(
                    selected = session == selectedSession,
                    onClick = { onSelectContext(selectedAthlete, selectedEvent, session) },
                    label = { Text(session, fontSize = 10.sp) }
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color.White,
            contentColor = HciAccentBlue,
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title, fontSize = 11.sp, maxLines = 1, softWrap = false) }
                )
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        when (selectedTab) {
            0 -> OverviewTab(result, diagnostics, trainingGoal, predictionTargets, appLanguage)
            1 -> IndexTab(result, appLanguage)
            2 -> RhythmTab(result, allSeries, selectedAthlete)
            3 -> TargetTab(result, targetSessions, selectedAthlete, appLanguage)
            4 -> PlanTab(diagnostics, training, physical, appLanguage)
        }
    }
}

@Composable
fun AthleteContextCard(
    result: HciEventResult,
    selectedSession: String,
    avatarRes: Int,
    displayAthleteName: String,
    appLanguage: AppLanguage,
) {
    val safeAvatarRes = if (avatarRes != 0) avatarRes else R.drawable.avatar_chateaubrian
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(
            modifier = Modifier
                .background(Brush.horizontalGradient(listOf(HciPrimaryDark, HciPrimaryLight)))
                .padding(18.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = safeAvatarRes),
                    contentDescription = if (appLanguage == AppLanguage.PT) "Avatar do atleta" else "Athlete avatar",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                )
                Spacer(modifier = Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.dashboard_athlete_panel), color = Color(0xDDFFFFFF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(displayAthleteName.ifBlank { result.athleteName }, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("${result.prova} | $selectedSession", color = Color(0xCCFFFFFF), fontSize = 12.sp)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                val mpv = if (result.rawSeries.isNotEmpty()) {
                    val totalShots = result.rawSeries.sumOf { it.tiros.size }
                    if (totalShots > 0) result.totalEvento / totalShots else 0.0
                } else 0.0
                
                HeaderMetric("TOTAL", result.totalEvento.toInt().toString())
                HeaderMetric("MPV", "%.2f".format(mpv))
                HeaderMetric("HCI", if (result.totalEvento <= 0.0) "0.0" else result.overallScore.toString())
                HeaderMetric("STATUS", if (appLanguage == AppLanguage.PT) "ATIVO" else "ACTIVE")
            }
        }
    }
}

@Composable
fun HeaderMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = Color(0xCCFFFFFF), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Text(value, color = HciSuccess, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun OverviewTab(
    result: HciEventResult,
    diagnostics: List<DiagnosticEngine.Diagnostic>,
    trainingGoal: Int,
    predictionTargets: Triple<Int, Int, Int>,
    appLanguage: AppLanguage
) {
    Column {
        SummaryCard(result, trainingGoal, appLanguage)
        Spacer(modifier = Modifier.height(12.dp))
        val primaryDiag = diagnostics.firstOrNull()
        if (result.rawSeries.isEmpty()) {
            RealDataRequiredCard(appLanguage)
            Spacer(modifier = Modifier.height(12.dp))
            OutputCard(
                title = stringResource(R.string.dashboard_insights_recommendations),
                header = primaryDiag?.title ?: if (appLanguage == AppLanguage.PT) "Aguardando diagnóstico" else "Waiting for diagnosis",
                content = primaryDiag?.insight ?: if (appLanguage == AppLanguage.PT) "Ainda não há diagnóstico gerado para este atleta." else "No diagnosis has been generated for this athlete yet.",
                footer = if (appLanguage == AppLanguage.PT) {
                    "Ação sugerida: ${primaryDiag?.action ?: "Registrar dados reais"}"
                } else {
                    "Suggested action: ${primaryDiag?.action ?: "Enter real data"}"
                },
                color = HciError
            )
            return@Column
        }
        PredictionCard(result, predictionTargets, appLanguage)
        Spacer(modifier = Modifier.height(12.dp))
        ProbabilityCard(result, predictionTargets, appLanguage)
        Spacer(modifier = Modifier.height(12.dp))
        OutputCard(
            title = stringResource(R.string.dashboard_priority_title),
            header = primaryDiag?.title ?: "",
            content = primaryDiag?.insight ?: "",
            footer = if (appLanguage == AppLanguage.PT) "Ação: ${primaryDiag?.action ?: ""}" else "Action: ${primaryDiag?.action ?: ""}",
            color = HciError
        )
        Spacer(modifier = Modifier.height(12.dp))
        InsightCard(result, predictionTargets.first)
    }
}

@Composable
private fun RealDataRequiredCard(appLanguage: AppLanguage) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                if (appLanguage == AppLanguage.PT) "Aguardando dados reais" else "Waiting for real data",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = HciAccentBlue
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "Projeção competitiva, probabilidade e metas só aparecem depois de importar ou lançar séries reais."
                } else {
                    "Competitive projection, probability and targets only appear after real series are imported or entered."
                },
                fontSize = 12.sp,
                color = HciTextSecondary
            )
        }
    }
}

@Composable
fun IndexTab(result: HciEventResult, appLanguage: AppLanguage) {
    val parameters = result.getParameters()
    val targets = parameters.filter { it.profile == "TARGETS" }
    val structure = parameters.filter { it.profile == "STRUCTURE" }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            if (appLanguage == AppLanguage.PT) "Indicadores de Performance (MPValue)" else "Performance Indicators (MPValue)",
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = HciAccentBlue
        )
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                targets.chunked(2).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        row.forEach { param ->
                            KpiValueCard(
                                title = param.name,
                                value = "%.1f".format(param.score),
                                subtitle = param.level(appLanguage),
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        Text(
            if (appLanguage == AppLanguage.PT) "Estrutura e Resiliência" else "Structure and Resilience",
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = Color(0xFF7C3AED)
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                structure.chunked(2).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        row.forEach { param ->
                            KpiValueCard(
                                title = param.name,
                                value = "%.1f".format(param.score),
                                subtitle = param.level(appLanguage),
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            HciRadarChart(
                title = if (appLanguage == AppLanguage.PT) "Metas" else "Targets",
                data = targets.map { it.name to it.score },
                color = HciAccentBlue,
                modifier = Modifier.weight(1f)
            )
            HciRadarChart(
                title = if (appLanguage == AppLanguage.PT) "Estrutura" else "Structure",
                data = structure.map { it.name to it.score },
                color = Color(0xFF7C3AED),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun RhythmTab(
    result: HciEventResult,
    allSeries: List<ShotSeries>,
    selectedAthlete: String
) {
    Column {
        AthleteEvolutionChart(series = allSeries, selectedAthlete = selectedAthlete)
        Spacer(modifier = Modifier.height(12.dp))
        ExcelRhythmTimelineChart(series = result.rawSeries)
        Spacer(modifier = Modifier.height(12.dp))
        RhythmPathChart(pathData = result.rhythmPath)
    }
}

@Composable
fun TargetTab(
    result: HciEventResult,
    targetSessions: List<TargetSession>,
    selectedAthlete: String,
    appLanguage: AppLanguage,
) {
    val isRifle = result.prova.uppercase().contains("RIFLE")
    val athleteSessions = targetSessions
        .filter { it.athlete == selectedAthlete }
        .sortedByDescending { it.submittedAt }
    val latestHumanoid = athleteSessions.firstOrNull { it.targetType == "DEFENSE_HUMANOID" }
    val latestColor = athleteSessions.firstOrNull { it.targetType == "PRECISION_COLOR" }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (athleteSessions.isNotEmpty()) {
            latestHumanoid?.let {
                BasicTargetSessionCard(
                    title = if (appLanguage == AppLanguage.PT) "Defesa tática - última sessão" else "Tactical defense - latest session",
                    session = it,
                    accent = Color(0xFFDC2626),
                    appLanguage = appLanguage
                )
            }
            latestColor?.let {
                BasicTargetSessionCard(
                    title = if (appLanguage == AppLanguage.PT) "Pontaria - última sessão" else "Aiming - latest session",
                    session = it,
                    accent = Color(0xFF0EA5E9),
                    appLanguage = appLanguage
                )
            }
            BasicTargetHistoryCard(athleteSessions, appLanguage)
            Spacer(modifier = Modifier.height(12.dp))
        }

        val sectors = if (isRifle) {
            listOf(
                TargetSector(45, "Q1 Superior Direita", "SD", 31.5, "CG a frente", "Short stock. Ombros tensos. Mao a frente no palm rest.", "PT | P"),
                TargetSector(135, "Q2 Superior Esquerda", "ID", 23.2, "CG arma a direita", "Corpo para tras. Bochecha baixa. Butt plate muito baixo.", "PT | Q"),
                TargetSector(225, "Q3 Inferior Esquerda", "IE", 14.6, "CG arma a esquerda", "Stock longo. Pressao na mao que atira. Butt plate muito alto.", "AT | P"),
                TargetSector(315, "Q4 Inferior Direita", "SE", 30.8, "CG arma a esquerda", "Stock curto. Pressao na mao que atira. Butt plate muito alto.", "AT | Q")
            )
        } else {
            listOf(
                TargetSector(0, "Direita", "AC", 9.4, "Follow through", "Area de visada. Travar pulso. Respiracao abdominal.", "PT | W"),
                TargetSector(45, "Superior Direita", "SD", 6.6, "Ajustar empunhadura", "Sentir a posicao. Soltar o polegar. Menos pressao na empunhadura.", "AT | PT"),
                TargetSector(90, "Acima", "D", 13.6, "Ativacao muscular", "Gatilho. Posicao da cabeca. Menos pressao na empunhadura.", "PT | W"),
                TargetSector(135, "Superior Esquerda", "ID", 6.6, "Alinhamento de miras", "Follow through. Area de visada. Acionamento gradual.", "PT | AT"),
                TargetSector(180, "Esquerda", "AB", 16.5, "Ajustar empunhadura", "Alinhamento de miras. Posicao do gatilho.", "AT | W"),
                TargetSector(225, "Inferior Esquerda", "IE", 14.6, "Controle de gatilho", "Acionamento gradual. Alinhamento de miras.", "PT | AT"),
                TargetSector(270, "Abaixo", "E", 13.9, "Posicao dos pes", "Posicao interna. Follow through.", "PT | W"),
                TargetSector(315, "Inferior Direita", "SE", 18.7, "Follow through", "Acalmar a mente. Respiracao abdominal. Punho estavel apos o disparo.", "AT | PT")
            )
        }
        val rankedSectors = sectors.sortedWith(compareByDescending<TargetSector> { it.weightPercent }.thenBy { it.angle })
        val dominant = rankedSectors.first()
        val secondary = rankedSectors.drop(1).firstOrNull() ?: dominant

        TargetReferenceRadialChart(
            title = if (isRifle) stringResource(R.string.dashboard_radial_rifle_title) else stringResource(R.string.dashboard_radial_pistol_title),
            subtitle = if (isRifle) stringResource(R.string.dashboard_radial_rifle_subtitle) else stringResource(R.string.dashboard_radial_pistol_subtitle),
            sectors = sectors,
            maxRing = if (isRifle) 35.0 else 20.0,
            ringStep = if (isRifle) 7.0 else 4.0,
            color = if (isRifle) Color(0xFF1F7A55) else Color(0xFF1F8AAF),
            appLanguage = appLanguage,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))
        TargetInsightCard(dominant = dominant, secondary = secondary, hasDirectionalData = false, appLanguage = appLanguage)
        Spacer(modifier = Modifier.height(12.dp))
        TargetTrainingCard()
    }
}

private data class TargetSector(
    val angle: Int,
    val label: String,
    val directionCode: String,
    val weightPercent: Double,
    val insight: String,
    val likelyCause: String,
    val trainingCode: String
)

@Composable
private fun TargetReferenceRadialChart(
    title: String,
    subtitle: String,
    sectors: List<TargetSector>,
    maxRing: Double,
    ringStep: Double,
    color: Color,
    appLanguage: AppLanguage,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text(subtitle, fontSize = 15.sp, color = HciTextSecondary)
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "Diagrama de fundo para preenchimento por dados reais"
                } else {
                    "Background diagram for real data plotting"
                },
                fontSize = 13.sp,
                color = HciTextSecondary
            )
            Spacer(modifier = Modifier.height(18.dp))
            Canvas(modifier = Modifier.fillMaxWidth().height(380.dp)) {
                val center = androidx.compose.ui.geometry.Offset(size.width / 2f, size.height / 2f)
                val radius = minOf(size.width, size.height) * 0.32f
                val gridColor = Color(0xFF8FA19A)
                val textColor = android.graphics.Color.rgb(30, 41, 59)
                val subtleText = android.graphics.Color.rgb(103, 116, 112)
                val labelPaint = android.graphics.Paint().apply {
                    this.color = textColor
                    textAlign = android.graphics.Paint.Align.CENTER
                    textSize = 13.sp.toPx()
                    isFakeBoldText = true
                }
                val ringPaint = android.graphics.Paint().apply {
                    this.color = subtleText
                    textAlign = android.graphics.Paint.Align.CENTER
                    textSize = 10.sp.toPx()
                }

                var ring = ringStep
                while (ring <= maxRing + 0.001) {
                    val rr = radius * (ring / maxRing).toFloat()
                    drawCircle(gridColor.copy(alpha = 0.32f), rr, center, style = Stroke(width = 1.dp.toPx()))
                    drawContext.canvas.nativeCanvas.drawText(
                        "${ring.toInt()}%",
                        center.x + 18.dp.toPx(),
                        center.y - rr + 4.dp.toPx(),
                        ringPaint
                    )
                    ring += ringStep
                }

                sectors.forEach { sector ->
                    val angleRad = Math.toRadians(sector.angle.toDouble())
                    val end = androidx.compose.ui.geometry.Offset(
                        center.x + radius * cos(angleRad).toFloat(),
                        center.y - radius * sin(angleRad).toFloat()
                    )
                    drawLine(gridColor.copy(alpha = 0.65f), center, end, strokeWidth = 1.dp.toPx())

                    val labelR = radius + 62.dp.toPx()
                    val labelX = center.x + labelR * cos(angleRad).toFloat()
                    val labelY = center.y - labelR * sin(angleRad).toFloat()
                    targetAngleLabelLines(sector).forEachIndexed { lineIndex, line ->
                        drawContext.canvas.nativeCanvas.drawText(
                            line,
                            labelX,
                            labelY + (lineIndex * 15.sp.toPx()),
                            labelPaint
                        )
                    }
                }

                drawCircle(color, 4.dp.toPx(), center)
            }
        }
    }
}

private fun targetAngleLabelLines(sector: TargetSector): List<String> {
    return listOf("${sector.angle}°", sector.directionCode)
}
@Composable
private fun TargetInsightCard(
    dominant: TargetSector,
    secondary: TargetSector,
    hasDirectionalData: Boolean,
    appLanguage: AppLanguage
) {
    OutputCard(
        title = stringResource(R.string.dashboard_target_insights),
        header = if (appLanguage == AppLanguage.PT) "Prioridade direcional" else "Directional priority",
        content = if (hasDirectionalData) {
            "1) ${dominant.insight}\n2) ${secondary.likelyCause}"
        } else {
            if (appLanguage == AppLanguage.PT) {
                "Aguardando dados reais do alvo para preencher a leitura direcional."
            } else {
                "Waiting for real target data to fill the directional reading."
            }
        },
        footer = "",
        color = HciAccentBlue
    )
}

@Composable
private fun TargetTrainingCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.dashboard_target_training_title), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            Text(stringResource(R.string.dashboard_target_training_name), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciTextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            Text(stringResource(R.string.dashboard_target_training_description), fontSize = 12.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(6.dp))
            Text(stringResource(R.string.dashboard_target_training_meta), fontSize = 11.sp, color = HciTextSecondary)
        }
    }
}


@Composable
fun PlanTab(
    diagnostics: List<DiagnosticEngine.Diagnostic>,
    training: TrainingLibrary,
    physical: PhysicalEngine.PhysicalPackage,
    appLanguage: AppLanguage
) {
    Column {
        val primaryDiag = diagnostics.firstOrNull()
        OutputCard(
            title = stringResource(R.string.dashboard_insights_recommendations),
            header = primaryDiag?.title ?: "",
            content = primaryDiag?.insight ?: "",
            footer = if (appLanguage == AppLanguage.PT) "Ação sugerida: ${primaryDiag?.action ?: ""}" else "Suggested action: ${primaryDiag?.action ?: ""}",
            color = HciError
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutputCard(
            title = stringResource(R.string.dashboard_technical_training),
            header = training.name,
            content = training.description,
            footer = if (appLanguage == AppLanguage.PT) "Volume: ${training.defaultShots} tiros | Tempo: ${training.defaultTime} min" else "Volume: ${training.defaultShots} shots | Time: ${training.defaultTime} min",
            color = HciSuccess
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutputCard(
            title = stringResource(R.string.dashboard_physical_training),
            header = physical.name,
            content = physical.exercises.joinToString("\n"),
            footer = if (appLanguage == AppLanguage.PT) "Carga: ${(physical.loadPercentage * 100).toInt()}% | Frequência: ${physical.frequency}" else "Load: ${(physical.loadPercentage * 100).toInt()}% | Frequency: ${physical.frequency}",
            color = Color(0xFF7C3AED)
        )
    }
}

@Composable
fun SummaryCard(result: HciEventResult, trainingGoal: Int, appLanguage: AppLanguage) {
    val progressRatio = if (trainingGoal <= 0) 0f else (result.totalEvento / trainingGoal).toFloat().coerceIn(0f, 1f)
    val selectionPct = (progressRatio * 100f).coerceIn(0f, 100f)
    val outcomePct = (result.outcomeScore * 10.0).coerceIn(0.0, 100.0)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.dashboard_performance_summary), color = HciTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(result.overallLevel(appLanguage), color = HciSuccess, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (result.rawSeries.isEmpty()) {
                        if (appLanguage == AppLanguage.PT) "Sem dados" else "No data"
                    } else {
                        stringResource(R.string.dashboard_goal_format, trainingGoal.toString())
                    },
                    color = HciTextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progressRatio },
                modifier = Modifier.fillMaxWidth().height(8.dp),
                color = HciSuccess,
                trackColor = Color(0xFFE2E8F0)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "Meta do ciclo: ${"%.1f".format(selectionPct)}% | Fase: ${"%.1f".format(outcomePct)}%"
                } else {
                    "Cycle target: ${"%.1f".format(selectionPct)}% | Phase: ${"%.1f".format(outcomePct)}%"
                },
                fontSize = 11.sp,
                color = HciTextSecondary
            )
        }
    }
}

@Composable
fun PredictionCard(result: HciEventResult, predictionTargets: Triple<Int, Int, Int>, appLanguage: AppLanguage) {
    val mean = result.rawSeries.map { it.totalSerie }.average().takeIf { !it.isNaN() } ?: 0.0
    val std = calculateStd(result.rawSeries.map { it.totalSerie })
    val (selectionTarget, top15Target, top8Target) = predictionTargets
    fun predictedRank(score: Double): Double {
        val isRifle = selectionTarget >= 620
        val baselineAtMqs = when {
            isRifle -> 69.0
            selectionTarget <= 565 -> 61.0
            else -> 48.0
        }
        val anchorScore = if (isRifle) 627.4 else 576.0
        val anchorRank = if (isRifle) 29.0 else 36.0
        return when {
            score >= top8Target -> 8.0 - ((score - top8Target) * 1.0)
            score >= top15Target -> 15.0 - ((score - top15Target) / (top8Target - top15Target).coerceAtLeast(1) * 7.0)
            score >= anchorScore -> anchorRank - ((score - anchorScore) / (top15Target - anchorScore).coerceAtLeast(1.0) * (anchorRank - 15.0))
            score >= selectionTarget -> baselineAtMqs - ((score - selectionTarget) / (anchorScore - selectionTarget).coerceAtLeast(1.0) * (baselineAtMqs - anchorRank))
            else -> baselineAtMqs + ((selectionTarget - score) * (if (isRifle) 3.0 else 2.2))
        }.coerceIn(1.0, 150.0)
    }
    val rank = predictedRank(result.totalEvento)
    val rankBand = when {
        rank <= 8 -> stringResource(R.string.dashboard_rank_top8)
        rank <= 15 -> stringResource(R.string.dashboard_rank_top15)
        rank <= 20 -> stringResource(R.string.dashboard_rank_top20)
        rank <= 40 -> stringResource(R.string.dashboard_rank_top40)
        rank <= 80 -> stringResource(R.string.dashboard_rank_top80)
        else -> stringResource(R.string.dashboard_rank_above_top80)
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(stringResource(R.string.dashboard_competitive_projection), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Rank ${rank.toInt()}º | $rankBand", color = HciSuccess, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "Classificação projetada: ${rank.toInt()}º | Média série: ${"%.1f".format(mean)} | Desvio: ~${"%.2f".format(std)}"
                } else {
                    "Projected rank: ${rank.toInt()}º | Series mean: ${"%.1f".format(mean)} | Deviation: ~${"%.2f".format(std)}"
                },
                color = Color(0xCCFFFFFF),
                fontSize = 11.sp
            )
        }
    }
}

@Composable
fun ProbabilityCard(result: HciEventResult, predictionTargets: Triple<Int, Int, Int>, appLanguage: AppLanguage) {
    val (selectionTarget, top15Target, top8Target) = predictionTargets
    val mu = result.totalEvento
    val sigma = ((mu * 0.0064) * 100.0).roundToInt() / 100.0
    val correlationR = (((result.overallScore / 10.0) * 0.85) * 100.0).roundToInt() / 100.0

    fun erfApprox(x: Double): Double {
        val sign = if (x < 0) -1 else 1
        val ax = abs(x)
        val t = 1.0 / (1.0 + 0.3275911 * ax)
        val y = 1.0 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-ax * ax))
        return sign * y
    }

    fun normCdf(x: Double, mean: Double, sd: Double): Double {
        val safeSd = if (sd <= 1e-9) 1e-9 else sd
        val z = (x - mean) / (safeSd * sqrt(2.0))
        return 0.5 * (1.0 + erfApprox(z))
    }

    fun smoothedProbability(target: Int, scenarioWeight: Double = 0.0): Double {
        val base = 1.0 - normCdf(target.toDouble(), mu, sigma)
        val smooth = base * (1.0 + (correlationR * scenarioWeight))
        return (smooth * 100.0).coerceIn(0.0, 100.0)
    }

    fun predictedRank(score: Double): Double {
        val isRifle = selectionTarget >= 620
        val baselineAtMqs = when {
            isRifle -> 69.0
            selectionTarget <= 565 -> 61.0
            else -> 48.0
        }
        val anchorScore = if (isRifle) 627.4 else 576.0
        val anchorRank = if (isRifle) 29.0 else 36.0
        return when {
            score >= top8Target -> 8.0 - ((score - top8Target) * 1.0)
            score >= top15Target -> 15.0 - ((score - top15Target) / (top8Target - top15Target).coerceAtLeast(1) * 7.0)
            score >= anchorScore -> anchorRank - ((score - anchorScore) / (top15Target - anchorScore).coerceAtLeast(1.0) * (anchorRank - 15.0))
            score >= selectionTarget -> baselineAtMqs - ((score - selectionTarget) / (anchorScore - selectionTarget).coerceAtLeast(1.0) * (baselineAtMqs - anchorRank))
            else -> baselineAtMqs + ((selectionTarget - score) * (if (isRifle) 3.0 else 2.2))
        }.coerceIn(1.0, 150.0)
    }

    val rank = predictedRank(result.totalEvento)
    val rankLo = (rank - 4.0).coerceAtLeast(1.0)
    val rankHi = (rank + 4.0).coerceAtMost(150.0)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.dashboard_probability_targets), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                if (appLanguage == AppLanguage.PT) {
                    "Classificação provável: ${rank.toInt()}º  (faixa ${rankLo.toInt()}º-${rankHi.toInt()}º)"
                } else {
                    "Probable rank: ${rank.toInt()}º  (range ${rankLo.toInt()}º-${rankHi.toInt()}º)"
                },
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = HciTextPrimary
            )
            Spacer(modifier = Modifier.height(8.dp))
            ScenarioHeaderRow()
            ScenarioGoalRow(stringResource(R.string.dashboard_selection), selectionTarget.toString(), smoothedProbability(selectionTarget, -0.15), smoothedProbability(selectionTarget), smoothedProbability(selectionTarget, 0.15))
            ScenarioGoalRow(stringResource(R.string.dashboard_top15_world), top15Target.toString(), smoothedProbability(top15Target, -0.15), smoothedProbability(top15Target), smoothedProbability(top15Target, 0.15))
            ScenarioGoalRow(stringResource(R.string.dashboard_top8_final), top8Target.toString(), smoothedProbability(top8Target, -0.15), smoothedProbability(top8Target), smoothedProbability(top8Target, 0.15))
        }
    }
}

@Composable
fun DataEntryHeroButton(onNavigateToEntry: () -> Unit, appLanguage: AppLanguage) {
    Button(
        onClick = onNavigateToEntry,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = HciAccentBlue)
    ) {
        Text(if (appLanguage == AppLanguage.PT) "Entrada de dados" else "Data entry", fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

@Composable
fun BasicTargetSessionCard(
    title: String,
    session: TargetSession,
    accent: Color,
    appLanguage: AppLanguage
) {
    val rows = session.zoneLabels.zip(session.zoneCounts).sortedByDescending { it.second }
    val topRows = rows.take(3)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                if (appLanguage == AppLanguage.PT) "Total de tiros: ${session.totalShots} | Treino sugerido: ${session.recommendedTraining}"
                else "Total shots: ${session.totalShots} | Suggested training: ${session.recommendedTraining}",
                fontSize = 11.sp,
                color = HciTextSecondary
            )
            Spacer(modifier = Modifier.height(12.dp))
            topRows.forEach { (label, count) ->
                val pct = if (session.totalShots <= 0) 0 else (count * 100 / session.totalShots)
                Column {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = HciTextPrimary)
                        Text(if (appLanguage == AppLanguage.PT) "$count tiros | $pct%" else "$count shots | $pct%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = accent)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { if (session.totalShots <= 0) 0f else count.toFloat() / session.totalShots.toFloat() },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = accent,
                        trackColor = Color(0xFFE2E8F0)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
fun BasicTargetHistoryCard(sessions: List<TargetSession>, appLanguage: AppLanguage) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x3322C55E))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(if (appLanguage == AppLanguage.PT) "Histórico Target BASIC" else "BASIC Target history", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
            sessions.take(4).forEach { session ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(session.targetType.replace('_', ' '), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Text(if (appLanguage == AppLanguage.PT) "${session.totalShots} tiros | ${session.recommendedTraining}" else "${session.totalShots} shots | ${session.recommendedTraining}", color = Color(0xCCFFFFFF), fontSize = 10.sp)
                    }
                    Text(
                        session.zoneCounts.sum().toString(),
                        color = Color(0xFF22C55E),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun ScenarioHeaderRow() {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(stringResource(R.string.dashboard_table_goal), modifier = Modifier.weight(1.25f), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
        Text(stringResource(R.string.dashboard_table_pessimistic), modifier = Modifier.weight(0.7f), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
        Text(stringResource(R.string.dashboard_table_realistic), modifier = Modifier.weight(0.7f), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
        Text(stringResource(R.string.dashboard_table_optimistic), modifier = Modifier.weight(0.7f), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    }
}

@Composable
fun ScenarioGoalRow(label: String, target: String, pessimist: Double, realistic: Double, optimistic: Double) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1.25f)) {
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text(target, fontSize = 10.sp, color = HciTextSecondary)
        }
        Text("${"%.1f".format(pessimist)}%", modifier = Modifier.weight(0.7f), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
        Text("${"%.1f".format(realistic)}%", modifier = Modifier.weight(0.7f), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HciAccentBlue)
        Text("${"%.1f".format(optimistic)}%", modifier = Modifier.weight(0.7f), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HciSuccess)
    }
}

@Composable
fun InsightCard(result: HciEventResult, selectionTarget: Int) {
    val mean = result.rawSeries.map { it.totalSerie }.average().takeIf { !it.isNaN() } ?: 0.0
    val std = calculateStd(result.rawSeries.map { it.totalSerie })
    val gap = selectionTarget - result.totalEvento
    OutputCard(
            title = stringResource(R.string.dashboard_insights_recommendations),
        header = stringResource(R.string.dashboard_insight_header, result.athleteName, result.eventId, result.prova),
        content = stringResource(R.string.dashboard_insight_content, mean, std, gap),
        footer = stringResource(R.string.dashboard_priority_focus, if (result.consistencyScore < result.pressureScore) stringResource(R.string.dashboard_focus_consistency) else stringResource(R.string.dashboard_focus_pressure)),
        color = HciAccentBlue
    )
}

@Composable
fun KpiValueCard(title: String, value: String, subtitle: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.padding(4.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
            Text(value, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text(subtitle, fontSize = 9.sp, color = HciTextSecondary)
        }
    }
}

@Composable
fun OutputCard(title: String, header: String, content: String, footer: String, color: Color) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = color, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(header, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = HciTextPrimary)
            Spacer(modifier = Modifier.height(4.dp))
            Text(content, fontSize = 13.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = HciCardBorder)
            Spacer(modifier = Modifier.height(8.dp))
            Text(footer, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = HciTextPrimary)
        }
    }
}

@Composable
fun HciBottomNavigation(viewModel: HciViewModel) {
    val currentScreen by viewModel.currentScreen.collectAsState()
    NavigationBar(containerColor = Color.White) {
        NavigationBarItem(selected = currentScreen == "DASHBOARD", onClick = { viewModel.navigateTo("DASHBOARD") }, icon = { Icon(Icons.Default.Dashboard, null) }, label = { Text(stringResource(R.string.nav_dash)) })
        NavigationBarItem(selected = currentScreen == "PLAN", onClick = { viewModel.navigateTo("PLAN") }, icon = { Icon(Icons.AutoMirrored.Filled.EventNote, null) }, label = { Text(stringResource(R.string.nav_plan)) })
        NavigationBarItem(selected = currentScreen == "REPORT", onClick = { viewModel.navigateTo("REPORT") }, icon = { Icon(Icons.Default.BarChart, null) }, label = { Text(stringResource(R.string.nav_report)) })
        NavigationBarItem(selected = currentScreen == "ENTRY", onClick = { viewModel.navigateTo("ENTRY") }, icon = { Icon(Icons.Default.Add, null) }, label = { Text(stringResource(R.string.nav_entry)) })
    }
}
