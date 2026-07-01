package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.R
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import com.example.sportsperformance.data.model.UserRole
import com.example.sportsperformance.logic.TrainingPlanEngine
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciError
import com.example.sportsperformance.ui.theme.HciSuccess
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciViewModel

@Composable
fun TrainingPlanScreen(viewModel: HciViewModel) {
    val engine = remember { TrainingPlanEngine() }
    val currentRole by viewModel.currentRole.collectAsState()
    val allSeries by viewModel.allSeries.collectAsState(initial = emptyList())
    val selectedAthlete by viewModel.selectedAthlete.collectAsState()
    val selectedEvent by viewModel.selectedEvent.collectAsState()
    val selectedSession by viewModel.selectedSession.collectAsState()
    val trainingGoal by viewModel.trainingGoal.collectAsState()
    val savedConfig by viewModel.trainingPlanConfig.collectAsState(initial = null)
    val prescriptions by viewModel.trainingPlanPrescriptions.collectAsState(initial = emptyList())
    var activeDialog by remember { mutableStateOf<TrainingCellSelection?>(null) }
    val fundamentals = remember {
        mutableStateListOf(
            TrainingPlanEngine.Fundamental("AT", "Aiming & Triggering", 20),
            TrainingPlanEngine.Fundamental("PT", "Position & Triggering", 20),
            TrainingPlanEngine.Fundamental("P", "Precision", 20),
            TrainingPlanEngine.Fundamental("Q", "Quality", 20),
            TrainingPlanEngine.Fundamental("W", "Wrist", 20)
        )
    }
    val appLanguage by viewModel.appLanguage.collectAsState()
    val plan = engine.generate30Days(fundamentals, appLanguage)
    val totalPercent = fundamentals.sumOf { it.percent }

    LaunchedEffect(savedConfig) {
        savedConfig?.let { config ->
            val normalized = normalizeFundamentalPercentages(
                listOf(config.atPercent, config.ptPercent, config.pPercent, config.qPercent, config.wPercent)
            )
            fundamentals[0] = fundamentals[0].copy(percent = normalized[0])
            fundamentals[1] = fundamentals[1].copy(percent = normalized[1])
            fundamentals[2] = fundamentals[2].copy(percent = normalized[2])
            fundamentals[3] = fundamentals[3].copy(percent = normalized[3])
            fundamentals[4] = fundamentals[4].copy(percent = normalized[4])
            viewModel.setTrainingGoal(config.goal)
            if (normalized != listOf(config.atPercent, config.ptPercent, config.pPercent, config.qPercent, config.wPercent)) {
                viewModel.saveTrainingPlanConfig(
                    currentPlanConfig(config.athlete, config.event, config.session, config.goal, fundamentals)
                )
            }
        }
    }

    Scaffold(
        topBar = {
            HciScreenTopBar(title = stringResource(R.string.plan_screen_title), viewModel = viewModel)
        },
        bottomBar = { HciBottomNavigation(viewModel) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(HciBackground)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Text(stringResource(R.string.plan_header_title), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
            Text(stringResource(R.string.plan_header_subtitle), fontSize = 12.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(12.dp))
            PlanControlNotice(currentRole)
            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(stringResource(R.string.plan_fundamental_skills), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
                        Text("$totalPercent%", fontWeight = FontWeight.Bold, color = if (totalPercent == 100) HciSuccess else HciError)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    fundamentals.forEachIndexed { index, item ->
                        val usedByOthers = totalPercent - item.percent
                        val maxAllowed = (100 - usedByOthers).coerceIn(0, 100)
                        FundamentalSlider(
                            item = item,
                            maxAllowed = maxAllowed,
                            onChange = {}
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            TrainingCodeLegend()
            Spacer(modifier = Modifier.height(12.dp))
            ExtraPrescriptionsCard(prescriptions.filter { it.cellKey.startsWith("EXTRA_") })
            Spacer(modifier = Modifier.height(12.dp))
            TrainingPlanGrid(
                plan = plan,
                onCellClick = { selection -> activeDialog = selection }
            )
        }
    }

    activeDialog?.let { selection ->
        TrainingSelectionDialog(
            selection = selection,
            role = currentRole,
            options = engine.compatibleTrainings(selection.code, selection.block, appLanguage),
            defaultOption = engine.defaultTraining(selection.code, selection.block, appLanguage),
            prescribed = prescriptions.firstOrNull { it.cellKey == selection.cellKey },
            onSelect = { option ->
                viewModel.saveTrainingPlanPrescription(
                    TrainingPlanPrescription(
                        cellKey = selection.cellKey,
                        day = selection.day,
                        block = selection.block,
                        code = selection.code,
                        trainingId = option.id,
                        trainingTitle = option.title,
                        prescribedByRole = currentRole.name,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                activeDialog = null
            },
            onDismiss = { activeDialog = null }
        )
    }
}

@Composable
private fun ExtraPrescriptionsCard(extras: List<TrainingPlanPrescription>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("Treinos extras enviados pelo Coach/Admin", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            if (extras.isEmpty()) {
                Text("Nenhum treino extra enviado.", fontSize = 12.sp, color = HciTextSecondary)
            } else {
                extras.sortedByDescending { it.updatedAt }.forEach { item ->
                    Text(item.trainingTitle, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciTextPrimary)
                    Text("${item.block} | ${item.code} | ${item.prescribedByRole}", fontSize = 11.sp, color = HciTextSecondary)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

private fun currentPlanConfig(
    athlete: String,
    event: String,
    session: String,
    goal: Int,
    fundamentals: List<TrainingPlanEngine.Fundamental>
): TrainingPlanConfig {
    return TrainingPlanConfig(
        athlete = athlete,
        event = event,
        session = session,
        goal = goal,
        atPercent = fundamentals.getOrNull(0)?.percent ?: 0,
        ptPercent = fundamentals.getOrNull(1)?.percent ?: 0,
        pPercent = fundamentals.getOrNull(2)?.percent ?: 0,
        qPercent = fundamentals.getOrNull(3)?.percent ?: 0,
        wPercent = fundamentals.getOrNull(4)?.percent ?: 0
    )
}

private fun normalizeFundamentalPercentages(values: List<Int>): List<Int> {
    val sanitized = values.map { it.coerceIn(0, 100) }
    val total = sanitized.sum()
    if (total <= 100) return sanitized

    val scaled = sanitized.map { ((it / total.toFloat()) * 100).toInt() }.toMutableList()
    var remainder = 100 - scaled.sum()
    var index = 0
    while (remainder > 0 && scaled.isNotEmpty()) {
        if (sanitized[index] > 0) {
            scaled[index] += 1
            remainder -= 1
        }
        index = (index + 1) % scaled.size
    }
    return scaled
}

@Composable
private fun PlanControlNotice(currentRole: UserRole) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("Plano gerenciado pela plataforma Admin", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                "O atleta apenas visualiza. Coach/Admin aprovam e ajustam prescricoes na plataforma desktop externa.",
                fontSize = 12.sp,
                color = HciTextSecondary
            )
            if (currentRole != UserRole.ATHLETE) {
                Spacer(modifier = Modifier.height(6.dp))
                Text("Edicao movel bloqueada tambem para Coach/Admin.", fontSize = 11.sp, color = HciTextSecondary)
            }
        }
    }
}

@Composable
private fun ChipRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit) {
    Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        values.forEach { value ->
            FilterChip(
                selected = value == selected,
                onClick = { onSelect(value) },
                label = { Text(value, fontSize = 10.sp) }
            )
        }
    }
    Spacer(modifier = Modifier.height(6.dp))
}

private data class TrainingCellSelection(
    val day: Int,
    val block: String,
    val code: String
) {
    val cellKey: String = "${day}_${block}_${code}".replace(" ", "_")
}

@Composable
private fun FundamentalSlider(
    item: TrainingPlanEngine.Fundamental,
    maxAllowed: Int,
    onChange: (Int) -> Unit
) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("${item.code} - ${item.name}", fontSize = 12.sp, color = HciTextPrimary)
            Text("${item.percent}%", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HciAccentBlue)
        }
        LinearProgressIndicator(
            progress = { item.percent.coerceIn(0, 100) / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp),
            color = HciAccentBlue,
            trackColor = Color(0xFFE5E7EB)
        )
    }
}

@Composable
private fun TrainingCodeLegend() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(stringResource(R.string.plan_competition_skills), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
            Text(stringResource(R.string.plan_competition_legend), fontSize = 11.sp, color = HciTextSecondary)
        }
    }
}

@Composable
private fun TrainingPlanGrid(
    plan: List<TrainingPlanEngine.PlanDay>,
    onCellClick: (TrainingCellSelection) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(stringResource(R.string.plan_mesocycle_title), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))
            Column(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                PlanRow(
                    cells = listOf("DAY", "MICROCYCLE", "ROUT", "AER", "REV", "STR", "TECH AM", "TECH PM", "MENT", "NEURO").map { PlanCell("", it) },
                    header = true,
                    onCellClick = {}
                )
                plan.forEach { day ->
                    PlanRow(
                        cells = listOf(
                            PlanCell("DAY", day.day.toString(), clickable = false),
                            PlanCell("MICROCYCLE", day.microcycle, clickable = false),
                            PlanCell("ROUTINE", day.routine, day.day),
                            PlanCell("PHYSICAL - AEROBIC", day.aerobic, day.day),
                            PlanCell("REVIEW SESSIONS", day.review, day.day),
                            PlanCell("STRATEGIC TRAINING", day.strategic, day.day),
                            PlanCell("TECHNICAL TRAINING - MORNING", day.technicalMorning, day.day),
                            PlanCell("TECHNICAL TRAINING - AFTERNOON", day.technicalAfternoon, day.day),
                            PlanCell("MENTAL", day.mental, day.day),
                            PlanCell("PHYSICAL NEUROMUSCULAR", day.neuromuscular, day.day)
                        ),
                        onCellClick = { cell ->
                            if (cell.clickable && cell.value.isNotBlank()) {
                                onCellClick(TrainingCellSelection(cell.day, cell.block, cell.value))
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun PlanRow(
    cells: List<PlanCell>,
    header: Boolean = false,
    onCellClick: (PlanCell) -> Unit
) {
    Row {
        cells.forEachIndexed { index, cell ->
            val width = if (index == 1) 190.dp else 74.dp
            Text(
                text = cell.value,
                modifier = Modifier
                    .width(width)
                    .background(if (header) HciAccentBlue else codeColor(cell.value), RoundedCornerShape(2.dp))
                    .clickable(enabled = !header && cell.clickable && cell.value.isNotBlank()) { onCellClick(cell) }
                    .padding(6.dp),
                color = if (header) Color.White else HciTextPrimary,
                fontSize = 10.sp,
                fontWeight = if (header) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

private data class PlanCell(
    val block: String,
    val value: String,
    val day: Int = 0,
    val clickable: Boolean = true
)

@Composable
private fun TrainingSelectionDialog(
    selection: TrainingCellSelection,
    role: UserRole,
    options: List<TrainingPlanEngine.TrainingOption>,
    defaultOption: TrainingPlanEngine.TrainingOption?,
    prescribed: TrainingPlanPrescription?,
    onSelect: (TrainingPlanEngine.TrainingOption) -> Unit,
    onDismiss: () -> Unit
) {
    val canChoose = role == UserRole.ADMIN || role == UserRole.COACH
    val prescribedOption = prescribed?.let {
        TrainingPlanEngine.TrainingOption(
            id = it.trainingId,
            code = it.code,
            title = it.trainingTitle,
            family = "PRESCRIBED",
            prescription = "Treino escolhido pelo coach/admin.",
            duration = "-",
            volume = "-"
        )
    }
    val shownOptions = if (canChoose) options else listOfNotNull(prescribedOption ?: defaultOption)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.plan_day_block_title, selection.day, selection.block)) },
        text = {
            Column {
                Text(stringResource(R.string.plan_code_format, selection.code), color = HciAccentBlue, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    if (canChoose) "Treinos compativeis para prescricao:" else "Treino prescrito:",
                    fontSize = 12.sp,
                    color = HciTextSecondary
                )
                Spacer(modifier = Modifier.height(8.dp))
                shownOptions.ifEmpty {
                    listOf(TrainingPlanEngine.TrainingOption("NONE", selection.code, "Sem treino compativel", "REVIEW", "Revisar mapeamento deste codigo.", "-", "-"))
                }.forEach { option ->
                    TrainingOptionCard(option = option, canChoose = canChoose, onSelect = { onSelect(option) })
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(if (canChoose) stringResource(R.string.plan_close) else stringResource(R.string.plan_ok))
            }
        }
    )
}

@Composable
private fun TrainingOptionCard(option: TrainingPlanEngine.TrainingOption, canChoose: Boolean, onSelect: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(option.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = HciTextPrimary)
                Text(option.code, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = HciAccentBlue)
            }
            Text(option.family, fontSize = 10.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(4.dp))
            Text(option.prescription, fontSize = 12.sp, color = HciTextPrimary)
            Spacer(modifier = Modifier.height(4.dp))
            Text("${option.duration} | ${option.volume}", fontSize = 11.sp, color = HciTextSecondary)
            if (canChoose) {
                Spacer(modifier = Modifier.height(6.dp))
                AssistChip(onClick = onSelect, label = { Text(stringResource(R.string.plan_select_day)) })
            }
        }
    }
}

private fun codeColor(value: String): Color {
    return when (value) {
        "COMPET" -> Color(0xFFFFE4E6)
        "COM", "SC" -> Color(0xFFE0F2FE)
        "R" -> Color(0xFFF1F5F9)
        "Y" -> Color(0xFFDCFCE7)
        "AT", "PT", "P", "Q", "W", "D", "RT", "RIT" -> Color(0xFFFEF3C7)
        else -> Color.White
    }
}
