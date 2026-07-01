package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult
import com.example.sportsperformance.data.model.ShotSeries
import com.example.sportsperformance.data.model.UserRole
import com.example.sportsperformance.logic.DiagnosticEngine
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciError
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciUiState
import com.example.sportsperformance.ui.viewmodel.HciViewModel
import kotlin.math.pow
import kotlin.math.sqrt

private data class SubmissionBatch(
    val athlete: String,
    val event: String,
    val session: String,
    val prova: String,
    val source: String,
    val submissions: List<AthleteSubmission>
) {
    val total: Double get() = submissions.sumOf { it.total }
    val shotCount: Int get() = submissions.sumOf { it.shots.size }
    val isComplete: Boolean get() = submissions.size == 6 && shotCount == 60 && requiredSeries.all { serie -> submissions.any { it.serie == serie } }

    companion object {
        private val requiredSeries = listOf("SR1", "SR2", "SR3", "SR4", "SR5", "SR6")
    }
}

private fun buildSubmissionBatches(submissions: List<AthleteSubmission>): List<SubmissionBatch> {
    val contextGroups = submissions.groupBy { "${it.athlete}|${it.event}|${it.session}|${it.prova}|${it.source}" }
    val batches = mutableListOf<SubmissionBatch>()
    contextGroups.values.forEach { group ->
        val ordered = group.sortedBy { it.submittedAt }
        var current = mutableListOf<AthleteSubmission>()
        var lastTs = -1L
        ordered.forEach { s ->
            val isNewBatch = current.isNotEmpty() && (
                (s.submittedAt - lastTs) > (20 * 60 * 1000L) ||
                    current.any { it.serie == s.serie }
                )
            if (isNewBatch) {
                val first = current.first()
                batches += SubmissionBatch(first.athlete, first.event, first.session, first.prova, first.source, current.toList())
                current = mutableListOf()
            }
            current += s
            lastTs = s.submittedAt
        }
        if (current.isNotEmpty()) {
            val first = current.first()
            batches += SubmissionBatch(first.athlete, first.event, first.session, first.prova, first.source, current.toList())
        }
    }
    return batches.sortedByDescending { it.submissions.maxOfOrNull { s -> s.submittedAt } ?: 0L }
}

private fun labelFor(language: AppLanguage, pt: String, en: String): String {
    return if (language == AppLanguage.PT) pt else en
}

@Composable
fun CoachReportScreen(viewModel: HciViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val role by viewModel.currentRole.collectAsState()
    val submissions by viewModel.athleteSubmissions.collectAsState(initial = emptyList())
    val appLanguage by viewModel.appLanguage.collectAsState()
    val canReview = role == UserRole.ADMIN || role == UserRole.COACH
    val allLabel = labelFor(appLanguage, "TODOS", "ALL")

    var athleteFilter by remember(appLanguage) { mutableStateOf(allLabel) }
    var eventFilter by remember(appLanguage) { mutableStateOf(allLabel) }
    var sessionFilter by remember(appLanguage) { mutableStateOf(allLabel) }

    val pendingSubmissions = submissions.filter { it.status == "PENDING_COACH_REVIEW" }
    val athletes = listOf(allLabel) + pendingSubmissions.map { it.athlete }.distinct().sorted()
    val events = listOf(allLabel) + pendingSubmissions.map { it.event }.distinct().sorted()
    val sessions = listOf(allLabel) + pendingSubmissions.map { it.session }.distinct().sorted()
    val filteredPending = pendingSubmissions.filter {
        (athleteFilter == allLabel || it.athlete == athleteFilter) &&
            (eventFilter == allLabel || it.event == eventFilter) &&
            (sessionFilter == allLabel || it.session == sessionFilter)
    }
    val groupedPending = buildSubmissionBatches(filteredPending)

    Scaffold(
        topBar = { HciScreenTopBar(title = labelFor(appLanguage, "Relatorio Tecnico (Coach)", "Technical Report (Coach)"), viewModel = viewModel) },
        bottomBar = {HciBottomNavigation(viewModel) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(HciBackground)
                .padding(16.dp)
        ) {
            if (canReview) {
                item {
                    Text(labelFor(appLanguage, "ENTRADAS PENDENTES (PROVA COMPLETA)", "PENDING ENTRIES (FULL EVENT)"), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
                    Spacer(modifier = Modifier.height(8.dp))
                    FilterRow(labelFor(appLanguage, "Atleta", "Athlete"), athletes, athleteFilter) { athleteFilter = it }
                    FilterRow(labelFor(appLanguage, "Evento", "Event"), events, eventFilter) { eventFilter = it }
                    FilterRow(labelFor(appLanguage, "Sessao", "Session"), sessions, sessionFilter) { sessionFilter = it }
                    Spacer(modifier = Modifier.height(10.dp))
                }
                items(groupedPending) { batch ->
                    AthleteSubmissionBatchReviewCard(
                        batch = batch,
                        appLanguage = appLanguage,
                        onApprove = { viewModel.approveAthleteSubmissionGroup(batch.submissions) },
                        onReject = { viewModel.rejectAthleteSubmissionGroup(batch.submissions) }
                    )
                }
                item { Spacer(modifier = Modifier.height(24.dp)) }
            }

            when (val state = uiState) {
                is HciUiState.Success -> {
                    val visibleSeries = state.result.rawSeries
                        .filter { it.prova.equals(state.result.prova, ignoreCase = true) }
                        .sortedBy { it.hciSerieOrder }
                        .distinctBy { it.serie }
                    item {
                        ReportHeader(state.result, appLanguage)
                        Spacer(modifier = Modifier.height(24.dp))
                        Text(labelFor(appLanguage, "TABELA DE DISPAROS", "SHOT TABLE"), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    items(visibleSeries) { series -> ShotSeriesRow(series, appLanguage) }
                    item {
                        Spacer(modifier = Modifier.height(24.dp))
                        Text(labelFor(appLanguage, "DIAGNOSTICOS COMPLETOS", "FULL DIAGNOSTICS"), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    items(state.diagnostics) { diag -> DiagnosticItem(diag, appLanguage) }
                }
                else -> {
                    if (!canReview || groupedPending.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(labelFor(appLanguage, "Carregue o dashboard para gerar o relatorio.", "Load the dashboard to generate the report."))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterRow(label: String, options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Text(label, fontSize = 10.sp, color = HciTextSecondary, fontWeight = FontWeight.Bold)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        options.forEach { option ->
            FilterChip(selected = selected == option, onClick = { onSelect(option) }, label = { Text(option, fontSize = 10.sp) })
        }
    }
    Spacer(modifier = Modifier.height(6.dp))
}

@Composable
private fun AthleteSubmissionBatchReviewCard(
    batch: SubmissionBatch,
    appLanguage: AppLanguage,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("${batch.athlete} | ${batch.event} | ${batch.session}", fontWeight = FontWeight.Bold)
                    Text("${batch.prova} | ${batch.source}", fontSize = 12.sp, color = HciTextSecondary)
                }
                AssistChip(
                    onClick = {},
                    label = { Text(if (batch.isComplete) labelFor(appLanguage, "60/60 PRONTO", "60/60 READY") else labelFor(appLanguage, "INCOMPLETO", "INCOMPLETE"), fontSize = 10.sp) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = if (batch.isComplete) Color(0xFFDCFCE7) else Color(0xFFFEE2E2),
                        labelColor = if (batch.isComplete) Color(0xFF166534) else Color(0xFF991B1B)
                    )
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("${labelFor(appLanguage, "Series", "Series")}: ${batch.submissions.joinToString(" | ") { "${it.serie}:${"%.1f".format(it.total)}" }}", fontSize = 12.sp, color = HciTextSecondary)
            Text("${labelFor(appLanguage, "Total da prova", "Event total")}: ${"%.1f".format(batch.total)} (${batch.shotCount} ${labelFor(appLanguage, "disparos", "shots")})", fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onApprove,
                    enabled = batch.isComplete,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF166534)),
                    modifier = Modifier.weight(1f)
                ) { Text(labelFor(appLanguage, "APROVAR PROVA", "APPROVE EVENT")) }
                OutlinedButton(
                    onClick = onReject,
                    enabled = batch.isComplete,
                    modifier = Modifier.weight(1f)
                ) { Text(labelFor(appLanguage, "REJEITAR PROVA", "REJECT EVENT")) }
            }
        }
    }
}

@Composable
fun ReportHeader(result: HciEventResult, appLanguage: AppLanguage) {
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("${labelFor(appLanguage, "Atleta", "Athlete")}: ${result.athleteName}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text("${labelFor(appLanguage, "Evento", "Event")}: ${result.eventId} | ${labelFor(appLanguage, "Prova", "Proof")}: ${result.prova}", color = HciTextSecondary)
            Divider(modifier = Modifier.padding(vertical = 8.dp), color = HciCardBorder)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(labelFor(appLanguage, "PONTUACAO TOTAL", "TOTAL SCORE"), fontSize = 10.sp, color = Color.Gray)
                    Text(result.totalEvento.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp)
                }
                Column {
                    Text("HCI OVERALL", fontSize = 10.sp, color = Color.Gray)
                    Text("${result.overallScore} (${result.overallLevel})", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = HciAccentBlue)
                }
            }
        }
    }
}

@Composable
fun ShotSeriesRow(series: ShotSeries, appLanguage: AppLanguage) {
    val std = calculateStd(series.tiros)
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(series.serie, fontWeight = FontWeight.Bold, color = HciAccentBlue)
                Text("${labelFor(appLanguage, "Total", "Total")}: ${series.totalSerie} | STD: ${"%.2f".format(std)}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                series.tiros.forEach { shot -> Text(shot.toString(), fontSize = 10.sp, modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
fun DiagnosticItem(diag: DiagnosticEngine.Diagnostic, appLanguage: AppLanguage) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row {
                Badge(containerColor = if (diag.slot == "PRIMARY") HciError else HciAccentBlue) {
                    Text(diag.slot, color = Color.White, modifier = Modifier.padding(4.dp))
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(diag.title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(diag.insight, fontSize = 13.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(4.dp))
            Text("${labelFor(appLanguage, "Acao sugerida", "Suggested action")}: ${diag.action}", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = HciTextPrimary)
        }
    }
}

fun calculateStd(data: List<Double>): Double {
    if (data.isEmpty()) return 0.0
    val mean = data.average()
    return sqrt(data.map { (it - mean).pow(2) }.sum() / data.size)
}
