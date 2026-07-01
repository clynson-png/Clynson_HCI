package com.example.sportsperformance.ui.screen.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.R
import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.model.UserRole
import com.example.sportsperformance.ui.screen.HciBottomNavigation
import com.example.sportsperformance.ui.screen.HciScreenTopBar
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrainingAdminScreen(viewModel: HciViewModel) {
    var showEditDialog by remember { mutableStateOf(false) }
    var showConfigDialog by remember { mutableStateOf(false) }
    var selectedTraining by remember { mutableStateOf<TrainingLibrary?>(null) }

    val periodization by viewModel.periodizationConfig.collectAsState(initial = PeriodizationConfig())
    val allSeries by viewModel.allSeries.collectAsState(initial = emptyList())
    val allTrainings by viewModel.allTrainings.collectAsState(initial = emptyList())
    val role by viewModel.currentRole.collectAsState()
    val selectedAthlete by viewModel.selectedAthlete.collectAsState()
    val selectedEvent by viewModel.selectedEvent.collectAsState()
    val selectedSession by viewModel.selectedSession.collectAsState()
    val canAdmin = role == UserRole.ADMIN || role == UserRole.COACH
    var goalText by remember(selectedAthlete) { mutableStateOf(viewModel.goalForAthlete(selectedAthlete).toString()) }
    var selectedCategory by remember { mutableStateOf("ALL") }
    var selectedParameter by remember { mutableStateOf("ALL") }

    val availableCategories = remember(allTrainings) {
        listOf("ALL") + allTrainings.map { it.category }.distinct().sorted()
    }
    val availableParameters = remember(allTrainings) {
        listOf("ALL") + allTrainings.map { it.parameter }.distinct().sorted()
    }
    val filteredTrainings = remember(allTrainings, selectedCategory, selectedParameter) {
        allTrainings.filter { training ->
            (selectedCategory == "ALL" || training.category == selectedCategory) &&
                (selectedParameter == "ALL" || training.parameter == selectedParameter)
        }.sortedWith(compareBy<TrainingLibrary> { it.category }.thenBy { it.parameter }.thenBy { it.name })
    }

    Scaffold(
        topBar = {
            HciScreenTopBar(
                title = stringResource(R.string.admin_screen_title),
                viewModel = viewModel,
                actions = {
                    IconButton(onClick = { showConfigDialog = true }) {
                        Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.admin_periodization_settings))
                    }
                }
            )
        },
        bottomBar = { HciBottomNavigation(viewModel) }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            if (canAdmin) {
                AthleteAdminContextCard(
                    allSeries = allSeries,
                    selectedAthlete = selectedAthlete,
                    selectedEvent = selectedEvent,
                    selectedSession = selectedSession,
                    goalText = goalText,
                    onGoalChange = { goalText = it },
                    onApplyGoal = {
                        goalText.toIntOrNull()?.let { goal ->
                            viewModel.setTrainingGoal(goal.coerceIn(0, 700))
                        }
                    },
                    onSelectContext = { athlete, event, session -> viewModel.selectContext(athlete, event, session) }
                )
                Spacer(modifier = Modifier.height(16.dp))
                AthleteExplorerCard(allSeries = allSeries)
                Spacer(modifier = Modifier.height(16.dp))
                InputBasePanel(
                    viewModel = viewModel,
                    allSeries = allSeries,
                    selectedAthlete = selectedAthlete,
                    selectedEvent = selectedEvent,
                    selectedSession = selectedSession
                )
                Spacer(modifier = Modifier.height(16.dp))
                TechnicalTrainingPanel()
                Spacer(modifier = Modifier.height(16.dp))
                PhysicalTrainingPanel()
                Spacer(modifier = Modifier.height(16.dp))
            }

            PeriodizationSummary(periodization ?: PeriodizationConfig())

            Spacer(modifier = Modifier.height(24.dp))

            Text(stringResource(R.string.admin_library_title), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = HciAccentBlue)
            Spacer(modifier = Modifier.height(8.dp))

            ChipRow("Categoria", availableCategories, selectedCategory) { selectedCategory = it }
            ChipRow("Parametro", availableParameters, selectedParameter) { selectedParameter = it }
            Spacer(modifier = Modifier.height(8.dp))

            if (filteredTrainings.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC))
                ) {
                    Text(
                        text = "Nenhum treino encontrado para este filtro.",
                        modifier = Modifier.padding(16.dp),
                        color = HciTextSecondary
                    )
                }
            } else {
                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(filteredTrainings, key = { it.trainingId }) { training ->
                        TrainingEditItem(training) {
                            selectedTraining = training
                            showEditDialog = true
                        }
                    }
                }
            }
        }

        if (showConfigDialog) {
            PeriodizationConfigDialog(
                config = periodization ?: PeriodizationConfig(),
                onDismiss = { showConfigDialog = false },
                onSave = { updated ->
                    viewModel.savePeriodizationConfig(updated)
                    showConfigDialog = false
                }
            )
        }

        if (showEditDialog && selectedTraining != null) {
            EditTrainingDialog(
                training = selectedTraining!!,
                onDismiss = { showEditDialog = false },
                onSave = { updated ->
                    viewModel.updateTraining(updated)
                    showEditDialog = false
                }
            )
        }
    }
}

@Composable
private fun TechnicalTrainingPanel() {
    var volumePct by remember { mutableFloatStateOf(60f) }
    var intensityPct by remember { mutableFloatStateOf(70f) }
    var durationMin by remember { mutableStateOf("60") }
    var totalShots by remember { mutableStateOf("120") }
    var seriesCount by remember { mutableStateOf("12") }
    var selectedFocus by remember { mutableStateOf("RHYTHM") }
    var technicalNotes by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("PLANEJADO") }
    val focusOptions = listOf("RHYTHM", "PROCESS", "CONSISTENCY", "PRESSURE", "OUTCOME")
    val statusOptions = listOf("PLANEJADO", "EM EXECUÇÃO", "CONCLUÍDO")

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.admin_technical_panel_title), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(10.dp))
            Text(stringResource(R.string.admin_technical_volume, volumePct.toInt()), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Slider(value = volumePct, onValueChange = { volumePct = it.coerceIn(0f, 100f) }, valueRange = 0f..100f)
            Text(stringResource(R.string.admin_technical_intensity, intensityPct.toInt()), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Slider(value = intensityPct, onValueChange = { intensityPct = it.coerceIn(0f, 100f) }, valueRange = 0f..100f)
            Spacer(modifier = Modifier.height(6.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = durationMin,
                    onValueChange = { durationMin = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_duration_minutes)) },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = totalShots,
                    onValueChange = { totalShots = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_shots)) },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = seriesCount,
                    onValueChange = { seriesCount = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_series)) },
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            ChipRow("Foco HCI", focusOptions, selectedFocus) { selectedFocus = it }
            ChipRow("Status", statusOptions, status) { status = it }
            OutlinedTextField(
                value = technicalNotes,
                onValueChange = { technicalNotes = it },
                label = { Text(stringResource(R.string.admin_technical_note)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
        }
    }
}

@Composable
private fun PhysicalTrainingPanel() {
    var loadPct by remember { mutableFloatStateOf(55f) }
    var physicalIntensityPct by remember { mutableFloatStateOf(65f) }
    var frequency by remember { mutableStateOf("3x por semana") }
    var blockType by remember { mutableStateOf("BASE") }
    var selectedModule by remember { mutableStateOf("CORE_STABILITY") }
    var physicalNotes by remember { mutableStateOf("") }
    val blockOptions = listOf("BASE", "FORÇA", "RESISTÊNCIA", "RECUPERAÇÃO")
    val moduleOptions = listOf("CORE_STABILITY", "POSTURA", "RESPIRAÇÃO", "MOBILIDADE", "RECUPERAÇÃO")

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.admin_physical_panel_title), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(10.dp))
            Text(stringResource(R.string.admin_physical_load, loadPct.toInt()), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Slider(value = loadPct, onValueChange = { loadPct = it.coerceIn(0f, 100f) }, valueRange = 0f..100f)
            Text(stringResource(R.string.admin_physical_intensity, physicalIntensityPct.toInt()), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Slider(value = physicalIntensityPct, onValueChange = { physicalIntensityPct = it.coerceIn(0f, 100f) }, valueRange = 0f..100f)
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = frequency,
                onValueChange = { frequency = it },
                label = { Text(stringResource(R.string.admin_frequency)) },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            ChipRow("Bloco", blockOptions, blockType) { blockType = it }
            ChipRow("Módulo", moduleOptions, selectedModule) { selectedModule = it }
            OutlinedTextField(
                value = physicalNotes,
                onValueChange = { physicalNotes = it },
                label = { Text(stringResource(R.string.admin_physical_note)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
        }
    }
}

@Composable
private fun AthleteAdminContextCard(
    allSeries: List<com.example.sportsperformance.data.model.ShotSeries>,
    selectedAthlete: String,
    selectedEvent: String,
    selectedSession: String,
    goalText: String,
    onGoalChange: (String) -> Unit,
    onApplyGoal: () -> Unit,
    onSelectContext: (String, String, String) -> Unit
) {
    val athletes = allSeries.map { it.atleta }.distinct().sorted().ifEmpty { listOf(selectedAthlete) }
    val events = allSeries.filter { it.atleta == selectedAthlete }.map { it.evento }.distinct().sorted().ifEmpty { listOf(selectedEvent) }
    val sessions = allSeries.filter { it.atleta == selectedAthlete && it.evento == selectedEvent }.map { it.sessao }.distinct().sorted().ifEmpty { listOf(selectedSession) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.admin_context_manager), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
            ChipRow("Atleta", athletes, selectedAthlete) { onSelectContext(it, events.firstOrNull() ?: selectedEvent, sessions.firstOrNull() ?: selectedSession) }
            ChipRow("Evento", events, selectedEvent) { onSelectContext(selectedAthlete, it, sessions.firstOrNull() ?: selectedSession) }
            ChipRow("Sessão", sessions, selectedSession) { onSelectContext(selectedAthlete, selectedEvent, it) }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = goalText,
                    onValueChange = onGoalChange,
                    label = { Text(stringResource(R.string.admin_training_goal)) },
                    modifier = Modifier.weight(1f)
                )
                Button(onClick = onApplyGoal, modifier = Modifier.padding(top = 8.dp)) { Text(stringResource(R.string.admin_apply)) }
            }
        }
    }
}

@Composable
private fun AthleteExplorerCard(allSeries: List<com.example.sportsperformance.data.model.ShotSeries>) {
    val byAthlete = allSeries.groupBy { it.atleta }.toSortedMap()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.admin_athlete_explorer), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 14.sp)
            Text(stringResource(R.string.admin_athlete_explorer_description), fontSize = 12.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(10.dp))
            byAthlete.forEach { (athlete, series) ->
                val events = series.map { it.evento }.distinct().sorted()
                val sessions = series.map { it.sessao }.distinct().sorted()
                val totalShots = series.sumOf { it.tiros.size }
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(athlete, fontWeight = FontWeight.Bold)
                        Text(stringResource(R.string.admin_events_format, events.joinToString(", ")), fontSize = 11.sp, color = HciTextSecondary)
                        Text("SESSÕES: ${sessions.joinToString(", ")}", fontSize = 11.sp, color = HciTextSecondary)
                        Text("SÉRIES: ${series.size} | TIROS: $totalShots", fontSize = 11.sp, color = HciTextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChipRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit) {
    Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HciTextSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
        values.forEach { value ->
            FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(value, fontSize = 10.sp) })
        }
    }
    Spacer(modifier = Modifier.height(6.dp))
}

@Composable
private fun InputBasePanel(
    viewModel: HciViewModel,
    allSeries: List<com.example.sportsperformance.data.model.ShotSeries>,
    selectedAthlete: String,
    selectedEvent: String,
    selectedSession: String
) {
    val series = allSeries
        .filter { it.atleta == selectedAthlete && it.evento == selectedEvent && it.sessao == selectedSession }
        .sortedBy { it.hciSerieOrder }
    val totalsBySerie = series.associate { it.serie to it.totalSerie }
    val totalShots = series.sumOf { it.tiros.size }
    val totalScore = series.sumOf { it.totalSerie }
    val avgShot = if (totalShots > 0) totalScore / totalShots else 0.0
    val prova = series.firstOrNull()?.prova ?: "-"
    val status = if (series.size == 6 && totalShots == 60) stringResource(R.string.admin_complete) else stringResource(R.string.admin_incomplete)
    val predictionTargets = viewModel.getPredictionTargetsForCurrentContext(prova = prova, trainingGoal = viewModel.goalForAthlete(selectedAthlete))
    var selectionText by remember(selectedAthlete, selectedEvent, selectedSession, prova) { mutableStateOf(predictionTargets.first.toString()) }
    var top15Text by remember(selectedAthlete, selectedEvent, selectedSession, prova) { mutableStateOf(predictionTargets.second.toString()) }
    var top8Text by remember(selectedAthlete, selectedEvent, selectedSession, prova) { mutableStateOf(predictionTargets.third.toString()) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(R.string.admin_input_base), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(stringResource(R.string.admin_athlete_format, selectedAthlete), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text("EVENTO: $selectedEvent | SESSÃO: $selectedSession | PROVA: $prova", fontSize = 11.sp, color = HciTextSecondary)
            Text(stringResource(R.string.admin_status_format, status), fontSize = 11.sp, color = if (status == stringResource(R.string.admin_complete)) Color(0xFF166534) else Color(0xFFB45309), fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InputMetric("SR1", totalsBySerie["SR1"] ?: 0.0, Modifier.weight(1f))
                InputMetric("SR2", totalsBySerie["SR2"] ?: 0.0, Modifier.weight(1f))
                InputMetric("SR3", totalsBySerie["SR3"] ?: 0.0, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InputMetric("SR4", totalsBySerie["SR4"] ?: 0.0, Modifier.weight(1f))
                InputMetric("SR5", totalsBySerie["SR5"] ?: 0.0, Modifier.weight(1f))
                InputMetric("SR6", totalsBySerie["SR6"] ?: 0.0, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(stringResource(R.string.admin_event_total, "%.1f".format(totalScore)), fontWeight = FontWeight.Bold)
                Text("MÉDIA/TIRO: ${"%.3f".format(avgShot)}", color = HciTextSecondary)
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(stringResource(R.string.admin_prediction_targets_caps), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HciAccentBlue)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = selectionText,
                    onValueChange = { selectionText = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_mqs)) },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = top15Text,
                    onValueChange = { top15Text = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_top15)) },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = top8Text,
                    onValueChange = { top8Text = it.filter { c -> c.isDigit() } },
                    label = { Text(stringResource(R.string.admin_top8)) },
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        val selection = selectionText.toIntOrNull() ?: predictionTargets.first
                        val top15 = top15Text.toIntOrNull() ?: predictionTargets.second
                        val top8 = top8Text.toIntOrNull() ?: predictionTargets.third
                        viewModel.setPredictionTargetsForCurrentContext(selection, top15, top8)
                        viewModel.setTrainingGoal(selection)
                        viewModel.atualizarDashboard()
                    },
                    modifier = Modifier.padding(top = 8.dp)
                ) { Text(stringResource(R.string.admin_apply)) }
            }
        }
    }
}

@Composable
private fun InputMetric(label: String, value: Double, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC))) {
        Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, fontSize = 10.sp, color = HciTextSecondary, fontWeight = FontWeight.Bold)
            Text("%.1f".format(value), fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun PeriodizationSummary(config: PeriodizationConfig) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("FASE DE PERIODIZAÇÃO:", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(config.phaseName, color = HciAccentBlue, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.admin_volume), fontSize = 10.sp, color = Color.Gray)
                    Text("${(config.volumePercentage * 100).toInt()}%", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.admin_intensity), fontSize = 10.sp, color = Color.Gray)
                    Text("${(config.intensityPercentage * 100).toInt()}%", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("TÉCNICO", fontSize = 10.sp, color = Color.Gray)
                    Text("${(config.technicalFocus * 100).toInt()}%", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PeriodizationConfigDialog(
    config: PeriodizationConfig,
    onDismiss: () -> Unit,
    onSave: (PeriodizationConfig) -> Unit
) {
    var phaseName by remember(config) { mutableStateOf(config.phaseName) }
    var volume by remember(config) { mutableIntStateOf((config.volumePercentage * 100).toInt()) }
    var intensity by remember(config) { mutableIntStateOf((config.intensityPercentage * 100).toInt()) }
    var technicalFocus by remember(config) { mutableIntStateOf((config.technicalFocus * 100).toInt()) }

    val phases = listOf("PREPARO GERAL", "PREPARO ESPECÍFICO", "PRÉ-COMPETIÇÃO", "COMPETIÇÃO")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Configurar Periodização", style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column {
                    Text(stringResource(R.string.admin_cycle_phase), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        phases.forEach { phase ->
                            FilterChip(
                                selected = phaseName == phase,
                                onClick = { phaseName = phase },
                                label = { Text(phase, fontSize = 11.sp) }
                            )
                        }
                    }
                }

                ConfigSliderItem(
                    label = stringResource(R.string.admin_cycle_volume),
                    description = "Volume de disparos e carga horária.",
                    value = volume,
                    onValueChange = { volume = it }
                )

                ConfigSliderItem(
                    label = stringResource(R.string.admin_cycle_intensity),
                    description = "Pressão e exigência técnica.",
                    value = intensity,
                    onValueChange = { intensity = it }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                Column {
                    Text("Equilíbrio de Foco", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Técnico: $technicalFocus%", fontSize = 11.sp, color = HciAccentBlue, fontWeight = FontWeight.Bold)
                        Text("Físico: ${100 - technicalFocus}%", fontSize = 11.sp, color = Color.Gray)
                    }
                    Slider(
                        value = technicalFocus.toFloat(),
                        onValueChange = { technicalFocus = it.toInt() },
                        valueRange = 0f..100f
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        config.copy(
                            phaseName = phaseName,
                            volumePercentage = volume / 100.0,
                            intensityPercentage = intensity / 100.0,
                            technicalFocus = technicalFocus / 100.0,
                            physicalFocus = (100 - technicalFocus) / 100.0
                        )
                    )
                }
            ) {
                Text("Salvar Configuração")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.admin_cancel)) }
        }
    )
}

@Composable
private fun ConfigSliderItem(
    label: String,
    description: String,
    value: Int,
    onValueChange: (Int) -> Unit
) {
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        Text(description, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.toInt().coerceIn(0, 100)) },
            valueRange = 0f..100f,
            steps = 9
        )
        Text(stringResource(R.string.admin_value_format, value), fontWeight = FontWeight.Bold, color = HciAccentBlue, fontSize = 12.sp)
    }
}


@Composable
fun TrainingEditItem(training: TrainingLibrary, onEdit: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        onClick = onEdit
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text(training.name, fontWeight = FontWeight.Bold)
                Text("Parâmetro HCI: ${training.parameter}", fontSize = 12.sp, color = Color.Gray)
            }
            Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.admin_edit))
        }
    }
}

@Composable
fun EditTrainingDialog(training: TrainingLibrary, onDismiss: () -> Unit, onSave: (TrainingLibrary) -> Unit) {
    var name by remember { mutableStateOf(training.name) }
    var desc by remember { mutableStateOf(training.description) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.admin_edit_training)) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(stringResource(R.string.admin_training_name)) }, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Descrição") }, modifier = Modifier.fillMaxWidth().height(150.dp))
            }
        },
        confirmButton = {
            Button(onClick = { onSave(training.copy(name = name, description = desc)) }) {
                Text(stringResource(R.string.admin_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.admin_cancel)) }
        }
    )
}
