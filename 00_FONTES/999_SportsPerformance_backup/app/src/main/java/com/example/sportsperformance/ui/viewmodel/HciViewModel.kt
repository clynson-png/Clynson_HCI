package com.example.sportsperformance.ui.viewmodel

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult
import com.example.sportsperformance.data.model.ShotSeries
import com.example.sportsperformance.data.model.SubscriptionTier
import com.example.sportsperformance.data.model.UserRole
import com.example.sportsperformance.R
import com.example.sportsperformance.data.repository.HciRepository
import com.example.sportsperformance.logic.DiagnosticEngine
import com.example.sportsperformance.logic.HciEngine
import com.example.sportsperformance.logic.PhysicalEngine
import com.example.sportsperformance.logic.TrainingEngine
import com.example.sportsperformance.logic.TrainingDatabaseJsonImporter
import com.example.sportsperformance.logic.parser.TargetScanParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

/**
 * ViewModel que orquestra o Dashboard HCI.
 */
class HciViewModel(val repository: HciRepository) : ViewModel() {
    data class LoginAthlete(
        val avatarRes: Int,
        val defaultTier: SubscriptionTier,
        val role: UserRole,
    )

    private val hciEngine = HciEngine()
    private val diagnosticEngine = DiagnosticEngine()
    private val trainingEngine = TrainingEngine()
    private val physicalEngine = PhysicalEngine()

    private val _uiState = MutableStateFlow<HciUiState>(HciUiState.Idle)
    val uiState: StateFlow<HciUiState> = _uiState.asStateFlow()

    private val _lastUpdate = MutableStateFlow("")
    val lastUpdate: StateFlow<String> = _lastUpdate.asStateFlow()

    private val _statusMessage = MutableStateFlow("Pronto")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private val _currentScreen = MutableStateFlow("LOGIN")
    val currentScreen: StateFlow<String> = _currentScreen.asStateFlow()

    private val _currentRole = MutableStateFlow(UserRole.ATHLETE)
    val currentRole: StateFlow<UserRole> = _currentRole.asStateFlow()

    private val _subscriptionTier = MutableStateFlow(SubscriptionTier.GOLD)
    val subscriptionTier: StateFlow<SubscriptionTier> = _subscriptionTier.asStateFlow()
    
    private val _appLanguage = MutableStateFlow(AppLanguage.PT)
    val appLanguage: StateFlow<AppLanguage> = _appLanguage.asStateFlow()

    private val athleteDirectory = listOf(
        LoginAthlete(R.drawable.avatar_chateaubrian, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_1, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_2, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_3, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_4, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_6, SubscriptionTier.GOLD, UserRole.ATHLETE),
        LoginAthlete(R.drawable.avatar_athlete_7, SubscriptionTier.GOLD, UserRole.ATHLETE),
    )
    val availableLoginAthletes: List<LoginAthlete> = athleteDirectory

    private val _isLoggedIn = MutableStateFlow(value = false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _selectedAvatarRes = MutableStateFlow(R.drawable.avatar_chateaubrian)
    val selectedAvatarRes: StateFlow<Int> = _selectedAvatarRes.asStateFlow()

    private val _displayAthleteName = MutableStateFlow("")
    val displayAthleteName: StateFlow<String> = _displayAthleteName.asStateFlow()

    private val _athleteEmail = MutableStateFlow("")
    val athleteEmail: StateFlow<String> = _athleteEmail.asStateFlow()

    private val _selectedAthlete = MutableStateFlow("")
    val selectedAthlete: StateFlow<String> = _selectedAthlete.asStateFlow()

    private val _selectedEvent = MutableStateFlow("EV2")
    val selectedEvent: StateFlow<String> = _selectedEvent.asStateFlow()

    private val _selectedSession = MutableStateFlow("COMPETICAO")
    val selectedSession: StateFlow<String> = _selectedSession.asStateFlow()

    private val _trainingGoal = MutableStateFlow(0)
    val trainingGoal: StateFlow<Int> = _trainingGoal.asStateFlow()
    
    private val _predictionOverrides = MutableStateFlow<Map<String, Triple<Int, Int, Int>>>(emptyMap())
    
    val periodizationConfig: Flow<PeriodizationConfig?> = repository.periodizationConfig
    val allSeries: Flow<List<ShotSeries>> = repository.allSeries
    val allTrainings: Flow<List<TrainingLibrary>> = repository.allTrainings
    val trainingPlanConfig: Flow<TrainingPlanConfig?> = repository.trainingPlanConfig
    val trainingPlanPrescriptions: Flow<List<TrainingPlanPrescription>> = repository.trainingPlanPrescriptions
    val athleteSubmissions: Flow<List<AthleteSubmission>> = repository.athleteSubmissions
    val targetSessions: Flow<List<TargetSession>> = repository.targetSessions

    fun atualizarDashboard() {
        if (_selectedAthlete.value.isBlank()) {
            _uiState.value = HciUiState.Idle
            return
        }

        viewModelScope.launch {
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "ATUALIZANDO DASHBOARD HCI..." else "UPDATING HCI DASHBOARD..."
            _uiState.value = HciUiState.Loading

            var inputData = withContext(Dispatchers.IO) {
                repository.getSeriesForEventSession(_selectedAthlete.value, _selectedEvent.value, _selectedSession.value)
            }
            
            if (inputData.isEmpty()) {
                val athleteSeries = withContext(Dispatchers.IO) {
                    repository.allSeries.first().filter { it.atleta == _selectedAthlete.value }
                }
                if (athleteSeries.isNotEmpty()) {
                    val firstSeries = athleteSeries.first()
                    _selectedEvent.value = firstSeries.evento
                    _selectedSession.value = firstSeries.sessao
                    inputData = withContext(Dispatchers.IO) {
                        repository.getSeriesForEventSession(_selectedAthlete.value, _selectedEvent.value, _selectedSession.value)
                    }
                }
            }

            if (inputData.isEmpty()) {
                val blankResult = buildBlankResult()
                _lastUpdate.value = ""
                _uiState.value = HciUiState.Success(
                    result = blankResult,
                    diagnostics = blankDiagnostics(),
                    trainingPlan = blankTraining(),
                    physicalPlan = blankPhysicalPackage()
                )
                _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Visão Geral" else "Performance Overview"
                return@launch
            }
            
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "PROCESSANDO MOTOR CENTRAL..." else "PROCESSING CENTRAL ENGINE..."
            
            // Cálculo do Contexto Histórico a partir do banco (TB_BASELINE)
            val athleteSeries = withContext(Dispatchers.IO) {
                repository.allSeries.first().filter { it.atleta == _selectedAthlete.value }
            }
            val historicalCompetitions = athleteSeries.filter { it.sessao.uppercase() == "COMPETICAO" }
            val historicalSimulated = athleteSeries.filter { it.sessao.uppercase() == "SIMULADO" }
            
            val medCompeticoes = if (historicalCompetitions.isNotEmpty()) {
                historicalCompetitions.groupBy { "${it.evento}|${it.atleta}" }
                    .values.map { evt -> evt.sumOf { it.totalSerie } }.medianOrNull()
            } else null
            
            val medSimulados = if (historicalSimulated.isNotEmpty()) {
                historicalSimulated.groupBy { "${it.evento}|${it.atleta}" }
                    .values.map { evt -> evt.sumOf { it.totalSerie } }.medianOrNull()
            } else null

            val context = HciEngine.HistoricalContext(
                medCompeticoes = medCompeticoes,
                medSimulados = medSimulados,
                pressureLoadReferencia = 1.2, // Referência de estabilidade rítmica
                medTiroSimTreino = if (inputData.isNotEmpty()) inputData.flatMap { it.tiros }.medianOrNull() ?: 9.4 else 9.4
            )

            val result = withContext(Dispatchers.Default) {
                hciEngine.processEvent(inputData, context)
            }
            
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "GERANDO DIAGNÓSTICO..." else "GENERATING DIAGNOSTICS..."
            val diagnostics = withContext(Dispatchers.Default) {
                diagnosticEngine.generateDiagnostics(result, _appLanguage.value)
            }
            
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "DEFININDO PLANO DE TREINO..." else "DEFINING TRAINING PLAN..."
            val allTrainingOptions = withContext(Dispatchers.IO) {
                repository.allTrainings.first()
            }

            val periodization = withContext(Dispatchers.IO) {
                repository.getPeriodizationSnapshot()
            }

            val training = withContext(Dispatchers.Default) {
                trainingEngine.suggestTraining(
                    diagnostic = diagnostics.first(),
                    availableTrainings = allTrainingOptions,
                    periodization = periodization,
                    result = result,
                    language = _appLanguage.value
                )
            }
            
            val physicalPack = withContext(Dispatchers.Default) {
                physicalEngine.generatePackage(result, periodization, _appLanguage.value)
            }
            
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "RENDERIZANDO DASHBOARD..." else "RENDERING DASHBOARD..."
            
            val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault())
            val dateLabel = if (_appLanguage.value == AppLanguage.PT) "Última atualização" else "Last update"
            _lastUpdate.value = "$dateLabel: ${sdf.format(Date())}"
            
            _uiState.value = HciUiState.Success(
                result = result,
                diagnostics = diagnostics,
                trainingPlan = training,
                physicalPlan = physicalPack
            )
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "CONCLUÍDO" else "DONE"
            
            delay(timeMillis = 600)
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Pronto" else "Ready"
        }
    }


    fun importTrainingDatabaseJson(context: Context, uri: Uri) {
        viewModelScope.launch {
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Importando banco de treino..." else "Importing training database..."
            runCatching {
                val text = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                        ?: error("Nao foi possivel abrir o arquivo JSON.")
                }
                val result = TrainingDatabaseJsonImporter.parse(text)
                withContext(Dispatchers.IO) {
                    result.config?.let {
                        repository.saveTrainingPlanConfig(it)
                    }

                    result.prescriptions.forEach {
                        repository.saveTrainingPlanPrescription(it)
                    }

                    if (result.series.isNotEmpty()) {
                        repository.saveSeries(result.series)
                    }

                    result.targetSessions.forEach {
                        repository.saveTargetSession(it)
                    }
                }

                val firstSeries = result.series.firstOrNull()

                if (firstSeries != null) {
                    _selectedAthlete.value = firstSeries.atleta
                    _displayAthleteName.value = firstSeries.atleta
                    _selectedEvent.value = firstSeries.evento
                    _selectedSession.value = firstSeries.sessao
                    _trainingGoal.value = goalForAthlete(firstSeries.atleta)
                } else if (result.athlete.isNotBlank()) {
                    _selectedAthlete.value = result.athlete
                    _displayAthleteName.value = result.athlete
                    _trainingGoal.value = goalForAthlete(result.athlete)
                }

                atualizarDashboard()
                _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) {
                    "Banco de treino importado: ${result.prescriptions.size} treinos para ${result.athlete}."
                } else {
                    "Training database imported: ${result.prescriptions.size} trainings for ${result.athlete}."
                }
            }.onFailure { error ->
                _statusMessage.value = error.message ?: if (_appLanguage.value == AppLanguage.PT) "Falha ao importar banco de treino." else "Failed to import training database."
            }
        }
    }

    fun saveTrainingPlanConfig(config: TrainingPlanConfig) {
        viewModelScope.launch {
            repository.saveTrainingPlanConfig(config)
        }
    }

    fun saveTrainingPlanPrescription(prescription: TrainingPlanPrescription) {
        viewModelScope.launch {
            repository.saveTrainingPlanPrescription(prescription)
        }
    }

    fun setRole(role: UserRole) {
        _currentRole.value = role
    }
    fun savePeriodizationConfig(config: PeriodizationConfig) {
        viewModelScope.launch {
            repository.savePeriodizationConfig(config)
        }
    }
    fun updateTraining(training: TrainingLibrary) {
        viewModelScope.launch {
            repository.updateTraining(training)
        }
    }

    fun navigateTo(screen: String) {
        _currentScreen.value = screen
    }

    fun logout() {
        _isLoggedIn.value = false
        _currentScreen.value = "LOGIN"
        _currentRole.value = UserRole.ATHLETE
        _subscriptionTier.value = SubscriptionTier.GOLD
        _selectedAthlete.value = ""
        _displayAthleteName.value = ""
        _athleteEmail.value = ""
        _selectedAvatarRes.value = R.drawable.avatar_chateaubrian
        _selectedEvent.value = "EV2"
        _selectedSession.value = "COMPETICAO"
        _trainingGoal.value = 0
        _uiState.value = HciUiState.Idle
        _lastUpdate.value = ""
        _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Pronto" else "Ready"
    }

    fun completeLogin(
        athleteDisplayName: String,
        athleteEmail: String,
        avatarRes: Int,
        tier: SubscriptionTier,
        appLanguage: AppLanguage,
    ) {
        val displayNameForLogin = athleteDisplayName.trim().ifBlank { "ATLETA" }
        val emailForLogin = athleteEmail.trim().lowercase(Locale.getDefault())
        val athleteKey = displayNameForLogin.uppercase(Locale.getDefault())

        _appLanguage.value = appLanguage
        _selectedAthlete.value = athleteKey
        _selectedAvatarRes.value = avatarRes
        _displayAthleteName.value = displayNameForLogin
        _athleteEmail.value = emailForLogin
        
        _subscriptionTier.value = tier
        _isLoggedIn.value = true

        val profile = athleteDirectory.firstOrNull { it.avatarRes == avatarRes }
        _currentRole.value = profile?.role ?: UserRole.ATHLETE

        _trainingGoal.value = goalForAthlete(athleteKey)
        _currentScreen.value = "ENTRY"
        _uiState.value = HciUiState.Idle

        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                repository.saveQualifiedLead(
                    athleteName = displayNameForLogin,
                    athleteEmail = emailForLogin,
                    source = "LOGIN_APP"
                )
            }

            val contexts = withContext(Dispatchers.IO) {
                repository.allSeries.first()
                    .filter { it.atleta == athleteKey }
                    .sortedWith(
                        compareBy(
                            { it.evento },
                            { it.sessao },
                            { it.hciSerieOrder }
                        )
                    )
            }

            if (contexts.isNotEmpty()) {
                _selectedEvent.value = contexts.first().evento
                _selectedSession.value = contexts.first().sessao
            }
        }
    }

    fun setAppLanguage(language: AppLanguage) {
        _appLanguage.value = language
        atualizarDashboard()
    }

    fun setTrainingGoal(goal: Int) {
        _trainingGoal.value = goal
    }

    fun goalForAthlete(athlete: String): Int {
        return _predictionOverrides.value
            .filterKeys { it.startsWith("$athlete|") }
            .values
            .firstOrNull()
            ?.first
            ?: 0
    }

    private fun currentContextKey(): String = "${_selectedAthlete.value}|${_selectedEvent.value}|${_selectedSession.value}"

    fun setPredictionTargetsForCurrentContext(selectionTarget: Int, top15: Int, top8: Int) {
        val key = currentContextKey()
        _predictionOverrides.value = _predictionOverrides.value.toMutableMap().apply {
            this[key] = Triple(selectionTarget, top15, top8)
        }
        viewModelScope.launch {
            repository.savePredictionTargets(
                athlete = _selectedAthlete.value,
                event = _selectedEvent.value,
                session = _selectedSession.value,
                prova = if (selectionTarget >= 620) "RIFLE" else "PISTOL",
                mqs = selectionTarget,
                top15 = top15,
                top8 = top8
            )
        }
    }

    fun getPredictionTargetsForCurrentContext(prova: String, trainingGoal: Int): Triple<Int, Int, Int> {
        val defaultSelection = if (trainingGoal > 0) trainingGoal else if (prova.uppercase().contains("RIFLE")) 625 else 572
        val defaults = if (prova.uppercase().contains("RIFLE")) {
            631 to 633
        } else {
            580 to 583
        }
        val override = _predictionOverrides.value[currentContextKey()]
        val selection = override?.first ?: defaultSelection
        val top15 = override?.second ?: defaults.first
        val top8 = override?.third ?: defaults.second
        return Triple(selection, top15, top8)
    }

    fun selectContext(athlete: String, event: String, session: String) {
        _selectedAthlete.value = athlete
        _selectedEvent.value = event
        _selectedSession.value = session
        _trainingGoal.value = goalForAthlete(athlete)
        viewModelScope.launch {
            repository.getAdminAthleteInput(currentContextKey())?.let { saved ->
                if ((saved.predictionMqs > 0) && (saved.predictionTop15 > 0) && (saved.predictionTop8 > 0)) {
                    _predictionOverrides.value = _predictionOverrides.value.toMutableMap().apply {
                        this[currentContextKey()] = Triple(saved.predictionMqs, saved.predictionTop15, saved.predictionTop8)
                    }
                    _trainingGoal.value = saved.predictionMqs
                }
            }
            atualizarDashboard()
        }
    }

    fun submitAthleteSeries(
        prova: String,
        serie: String,
        shots: List<Double>,
        notes: String = "",
        source: String = "MANUAL"
    ) {
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            val submission = AthleteSubmission(
                submissionId = "${_selectedAthlete.value}_${_selectedEvent.value}_${_selectedSession.value}_${serie}_$now",
                athlete = _selectedAthlete.value,
                event = _selectedEvent.value,
                session = _selectedSession.value,
                prova = prova,
                serie = serie,
                shots = shots,
                source = source,
                notes = notes,
                status = "PENDING_COACH_REVIEW",
                submittedAt = now
            )
            repository.saveAthleteSubmission(submission)
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Série enviada para revisão" else "Series sent for review"
            _currentScreen.value = "REPORT"
        }
    }

    fun approveAthleteSubmissionGroup(submissions: List<AthleteSubmission>) {
        viewModelScope.launch {
            if (submissions.isEmpty()) return@launch
            val sorted = submissions.sortedBy { it.serie.filter { ch -> ch.isDigit() }.toIntOrNull() ?: Int.MAX_VALUE }
            val first = sorted.first()
            val blockId = "${first.athlete}_${first.event}_${first.session}"
            val seriesBatch = sorted.map { submission ->
                val seriesOrder = submission.serie.filter { it.isDigit() }.toIntOrNull() ?: 1
                ShotSeries(
                    chaveSerie = ShotSeries.createChave(
                        submission.athlete,
                        submission.prova,
                        submission.event,
                        submission.session,
                        blockId,
                        submission.serie
                    ),
                    dataColeta = Date(submission.submittedAt),
                    prova = submission.prova,
                    atleta = submission.athlete,
                    evento = submission.event,
                    sessao = submission.session,
                    idBloco = blockId,
                    statusEvento = if (submission.serie == "SR6") "FINAL" else "PARCIAL",
                    serie = submission.serie,
                    tiros = submission.shots,
                    hciSerieOrder = seriesOrder
                )
            }
            repository.saveSeries(seriesBatch)
            sorted.forEach { submission ->
                repository.updateAthleteSubmissionStatus(submission.submissionId, "APPROVED", _currentRole.value.name)
            }
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Aprovado" else "Approved"
            atualizarDashboard()
        }
    }

    fun rejectAthleteSubmissionGroup(submissions: List<AthleteSubmission>) {
        viewModelScope.launch {
            submissions.forEach { submission ->
                repository.updateAthleteSubmissionStatus(submission.submissionId, "REJECTED", _currentRole.value.name)
            }
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Rejeitado" else "Rejected"
        }
    }

    fun importTargetScanPdfForReview(context: Context, uri: Uri) {
        viewModelScope.launch {
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "IMPORTANDO PDF..." else "IMPORTING PDF..."

            val result = withContext(Dispatchers.IO) {
                TargetScanParser(context).parsePdf(uri)
            }

            if ((result != null) && result.series.isNotEmpty()) {
                val baseTimestamp = result.date.time.takeIf { it > 0L } ?: System.currentTimeMillis()
                val directionNotes = result.vectorReading
                    ?.directionalCounts
                    ?.filterValues { it > 0 }
                    ?.entries
                    ?.joinToString(", ") { (direction, count) -> "$direction=$count" }
                val importNote = buildString {
                    append("Importado do TargetScan em ")
                    append(result.date)
                    append(".")
                    if (!directionNotes.isNullOrBlank()) {
                        append(" DIRECTIONS: ")
                        append(directionNotes)
                    }
                }
                val submissions = result.series.mapIndexed { index, series ->
                    AthleteSubmission(
                        submissionId = "${_selectedAthlete.value}_${_selectedEvent.value}_${_selectedSession.value}_${series.serie}_${baseTimestamp + index}",
                        athlete = _selectedAthlete.value,
                        event = _selectedEvent.value,
                        session = _selectedSession.value,
                        prova = series.prova,
                        serie = series.serie,
                        shots = series.tiros,
                        source = "TARGETSCAN_PDF",
                        notes = importNote,
                        status = "PENDING_COACH_REVIEW",
                        submittedAt = baseTimestamp + index
                    )
                }
                repository.saveAthleteSubmissions(submissions)
                _statusMessage.value = "${submissions.size} " + (if (_appLanguage.value == AppLanguage.PT) "séries enviadas" else "series sent")
                _currentScreen.value = "REPORT"
            } else {
                _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "ERRO AO IMPORTAR" else "IMPORT ERROR"
            }
        }
    }

    fun saveTargetSession(
        targetType: String,
        totalShots: Int,
        zoneLabels: List<String>,
        zoneCounts: List<Int>,
        recommendedTraining: String
    ) {
        viewModelScope.launch {
            repository.saveTargetSession(
                TargetSession(
                    sessionId = "${_selectedAthlete.value}_${_selectedEvent.value}_${_selectedSession.value}_${targetType}_${System.currentTimeMillis()}",
                    athlete = _selectedAthlete.value,
                    event = _selectedEvent.value,
                    session = _selectedSession.value,
                    targetType = targetType,
                    totalShots = totalShots,
                    zoneLabels = zoneLabels,
                    zoneCounts = zoneCounts,
                    recommendedTraining = recommendedTraining,
                    submittedAt = System.currentTimeMillis()
                )
            )
            _statusMessage.value = if (_appLanguage.value == AppLanguage.PT) "Sessão salva" else "Session saved"
        }
    }

    private fun buildBlankResult(): HciEventResult {
        return HciEventResult(
            athleteName = _selectedAthlete.value,
            eventId = "EV0",
            prova = if (_appLanguage.value == AppLanguage.PT) "SEM DADOS" else "NO DATA",
            totalEvento = 0.0,
            outcomeScore = 0.0,
            processScore = 0.0,
            rhythmScore = 0.0,
            deepeningScore = 0.0,
            consistencyScore = 0.0,
            transferScore = 0.0,
            resilienceScore = 0.0,
            pressureScore = 0.0,
            emotionalScore = 0.0,
            physicalScore = 0.0,
            overallLevel = if (_appLanguage.value == AppLanguage.PT) "INICIANTE" else "BEGINNER",
            overallScore = 0.0,
            stdAjustadoRhythm = 0.0,
            dropCount = 0,
            olympicRank = "N/A",
            rawSeries = emptyList()
        )
    }

    private fun blankDiagnostics(): List<DiagnosticEngine.Diagnostic> {
        return listOf(
            DiagnosticEngine.Diagnostic(
                rank = 1,
                slot = "PRIMARY",
                title = if (_appLanguage.value == AppLanguage.PT) "Aguardando coleta" else "Waiting for data",
                insight = if (_appLanguage.value == AppLanguage.PT) "Registre dados para gerar análise." else "Register data to generate analysis.",
                action = if (_appLanguage.value == AppLanguage.PT) "Fazer entrada de dados." else "Data entry required.",
                parameter1 = "PROCESS",
                parameter2 = "RHYTHM"
            )
        )
    }

    private fun blankTraining(): TrainingLibrary {
        return TrainingLibrary(
            trainingId = "BLANK",
            parameter = "PROCESS",
            name = if (_appLanguage.value == AppLanguage.PT) "Sem treino" else "No training",
            objective = "-",
            description = "-",
            defaultTime = 0,
            defaultShots = 0,
            category = "TECHNICAL"
        )
    }

    private fun blankPhysicalPackage(): PhysicalEngine.PhysicalPackage {
        return PhysicalEngine.PhysicalPackage(
            name = if (_appLanguage.value == AppLanguage.PT) "Sem pacote físico" else "No physical package",
            exercises = emptyList(),
            loadPercentage = 0.0,
            frequency = "-",
            safetyNote = "-"
        )
    }
}

sealed class HciUiState {
    object Idle : HciUiState()
    object Loading : HciUiState()
    data class Success(
        val result: HciEventResult,
        val diagnostics: List<DiagnosticEngine.Diagnostic>,
        val trainingPlan: TrainingLibrary,
        val physicalPlan: PhysicalEngine.PhysicalPackage
    ) : HciUiState()
}

class HciViewModelFactory(private val repository: HciRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(HciViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return HciViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

private fun List<Double>.medianOrNull(): Double? {
    if (isEmpty()) return null
    val sorted = sorted()
    val middle = sorted.size / 2
    return if (sorted.size % 2 == 0) {
        (sorted[middle - 1] + sorted[middle]) / 2.0
    } else {
        sorted[middle]
    }
}

