package com.example.sportsperformance.data.repository

import com.example.sportsperformance.data.local.dao.PeriodizationDao
import com.example.sportsperformance.data.local.dao.QualifiedLeadDao
import com.example.sportsperformance.data.local.dao.ShotSeriesDao
import com.example.sportsperformance.data.local.dao.TargetSessionDao
import com.example.sportsperformance.data.local.dao.TrainingLibraryDao
import com.example.sportsperformance.data.local.dao.TrainingPlanDao
import com.example.sportsperformance.data.local.dao.AthleteSubmissionDao
import com.example.sportsperformance.data.local.dao.AdminAthleteInputDao
import com.example.sportsperformance.data.local.entities.AdminAthleteInput
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.QualifiedLead
import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import com.example.sportsperformance.data.model.ShotSeries
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import java.util.*

/**
 * Repositório que gerencia a entrada de dados (INPUT).
 * Agora integra com o Room Database.
 */
class HciRepository(
    private val shotSeriesDao: ShotSeriesDao,
    private val trainingDao: TrainingLibraryDao,
    private val periodizationDao: PeriodizationDao,
    private val trainingPlanDao: TrainingPlanDao,
    private val athleteSubmissionDao: AthleteSubmissionDao,
    private val adminAthleteInputDao: AdminAthleteInputDao,
    private val targetSessionDao: TargetSessionDao,
    private val qualifiedLeadDao: QualifiedLeadDao
) {

    val allSeries: Flow<List<ShotSeries>> = shotSeriesDao.getAllSeries()
    val allTrainings: Flow<List<TrainingLibrary>> = trainingDao.getAllTrainings()
    val periodizationConfig: Flow<PeriodizationConfig?> = periodizationDao.getConfig()
    val trainingPlanConfig: Flow<TrainingPlanConfig?> = trainingPlanDao.getConfig()
    val trainingPlanPrescriptions: Flow<List<TrainingPlanPrescription>> = trainingPlanDao.getPrescriptions()
    val athleteSubmissions: Flow<List<AthleteSubmission>> = athleteSubmissionDao.getAllSubmissions()
    val adminAthleteInputs: Flow<List<AdminAthleteInput>> = adminAthleteInputDao.getAll()
    val targetSessions: Flow<List<TargetSession>> = targetSessionDao.getAllSessions()
    val qualifiedLeads: Flow<List<QualifiedLead>> = qualifiedLeadDao.getAll()

    suspend fun getSeriesForEvent(athleteName: String, eventId: String): List<ShotSeries> {
        return shotSeriesDao.getSeriesForEvent(athleteName, eventId)
    }

    suspend fun getSeriesForEventSession(athleteName: String, eventId: String, session: String): List<ShotSeries> {
        return shotSeriesDao.getSeriesForEventSession(athleteName, eventId, session)
    }

    suspend fun saveSeries(series: List<ShotSeries>) {
        shotSeriesDao.insertSeries(series)
    }

    suspend fun getTrainingForParameter(parameter: String): TrainingLibrary? {
        return trainingDao.getTrainingForParameter(parameter)
    }

    suspend fun updateTraining(training: TrainingLibrary) {
        trainingDao.updateTraining(training)
    }

    suspend fun savePeriodizationConfig(config: PeriodizationConfig) {
        periodizationDao.saveConfig(config)
    }

    suspend fun getPeriodizationSnapshot(): PeriodizationConfig? {
        return periodizationDao.getConfig().first()
    }

    suspend fun saveTrainingPlanConfig(config: TrainingPlanConfig) {
        trainingPlanDao.saveConfig(config)
    }

    suspend fun saveTrainingPlanPrescription(prescription: TrainingPlanPrescription) {
        trainingPlanDao.savePrescription(prescription)
    }

    suspend fun saveAthleteSubmission(submission: AthleteSubmission) {
        athleteSubmissionDao.saveSubmission(submission)
    }

    suspend fun saveAthleteSubmissions(submissions: List<AthleteSubmission>) {
        athleteSubmissionDao.saveSubmissions(submissions)
    }

    suspend fun updateAthleteSubmissionStatus(submissionId: String, status: String, reviewerRole: String) {
        athleteSubmissionDao.updateStatus(submissionId, status, System.currentTimeMillis(), reviewerRole)
    }

    suspend fun saveAdminAthleteInput(input: AdminAthleteInput) {
        adminAthleteInputDao.save(input)
    }

    suspend fun getAdminAthleteInput(contextKey: String): AdminAthleteInput? {
        return adminAthleteInputDao.getByContext(contextKey)
    }

    suspend fun saveTargetSession(session: TargetSession) {
        targetSessionDao.save(session)
    }

    suspend fun saveQualifiedLead(athleteName: String, athleteEmail: String, source: String = "HCI_MVP_LOGIN") {
        val normalizedEmail = athleteEmail.trim().lowercase(Locale.getDefault())
        val existing = qualifiedLeadDao.getByEmail(normalizedEmail)
        val now = System.currentTimeMillis()
        val lead = existing?.copy(
            athleteName = athleteName,
            athleteEmail = normalizedEmail,
            source = source,
            updatedAt = now
        ) ?: QualifiedLead(
            leadId = normalizedEmail,
            athleteName = athleteName,
            athleteEmail = normalizedEmail,
            source = source,
            createdAt = now,
            updatedAt = now
        )
        qualifiedLeadDao.save(lead)
    }

    suspend fun savePredictionTargets(
        athlete: String,
        event: String,
        session: String,
        prova: String,
        mqs: Int,
        top15: Int,
        top8: Int
    ) {
        val contextKey = "${athlete}|${event}|${session}"
        val existing = adminAthleteInputDao.getByContext(contextKey)
        val base = existing ?: AdminAthleteInput(
            contextKey = contextKey,
            athlete = athlete,
            event = event,
            session = session,
            prova = if (mqs >= 620) "RIFLE" else "PISTOL",
            sr1 = 0.0,
            sr2 = 0.0,
            sr3 = 0.0,
            sr4 = 0.0,
            sr5 = 0.0,
            sr6 = 0.0,
            totalEvento = 0.0,
            mediaTiro = 0.0,
            technicalVolumePct = 0,
            technicalIntensityPct = 0,
            technicalDurationMin = 0,
            technicalShots = 0,
            technicalSeries = 0,
            technicalFocus = "",
            technicalStatus = "",
            technicalNotes = "",
            physicalLoadPct = 0,
            physicalIntensityPct = 0,
            physicalFrequency = "",
            physicalBlock = "",
            physicalModule = "",
            physicalNotes = ""
        )
        adminAthleteInputDao.save(
            base.copy(
                athlete = athlete,
                event = event,
                session = session,
                prova = if (mqs >= 620) "RIFLE" else "PISTOL",
                predictionMqs = mqs,
                predictionTop15 = top15,
                predictionTop8 = top8,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    fun ensureAdditionalAthletes() = Unit
}
