package com.example.sportsperformance.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.sportsperformance.data.local.dao.AthleteSubmissionDao
import com.example.sportsperformance.data.local.dao.AdminAthleteInputDao
import com.example.sportsperformance.data.local.dao.PeriodizationDao
import com.example.sportsperformance.data.local.dao.QualifiedLeadDao
import com.example.sportsperformance.data.local.dao.ShotSeriesDao
import com.example.sportsperformance.data.local.dao.TargetSessionDao
import com.example.sportsperformance.data.local.dao.TrainingLibraryDao
import com.example.sportsperformance.data.local.dao.TrainingPlanDao
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import com.example.sportsperformance.data.local.entities.AdminAthleteInput
import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.PeriodizationSchedule
import com.example.sportsperformance.data.local.entities.QualifiedLead
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.model.ShotSeries

@Database(
    entities = [
        ShotSeries::class,
        TrainingLibrary::class,
        PeriodizationConfig::class,
        PeriodizationSchedule::class,
        TrainingPlanConfig::class,
        TrainingPlanPrescription::class,
        AthleteSubmission::class,
        AdminAthleteInput::class,
        TargetSession::class,
        QualifiedLead::class
    ],
    version = 12,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun shotSeriesDao(): ShotSeriesDao
    abstract fun trainingLibraryDao(): TrainingLibraryDao
    abstract fun periodizationDao(): PeriodizationDao
    abstract fun trainingPlanDao(): TrainingPlanDao
    abstract fun athleteSubmissionDao(): AthleteSubmissionDao
    abstract fun adminAthleteInputDao(): AdminAthleteInputDao
    abstract fun targetSessionDao(): TargetSessionDao
    abstract fun qualifiedLeadDao(): QualifiedLeadDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sports_performance_db"
                )
                .addMigrations(*PRESERVE_DATA_MIGRATIONS)
                .build()
                INSTANCE = instance
                instance
            }
        }

        private val PRESERVE_DATA_MIGRATIONS: Array<Migration> =
            (1 until 12).map { startVersion ->
                object : Migration(startVersion, 12) {
                    override fun migrate(db: SupportSQLiteDatabase) {
                        ensureVersion12Schema(db)
                    }
                }
            }.toTypedArray()

        private fun ensureVersion12Schema(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `shot_series` (
                    `chaveSerie` TEXT NOT NULL,
                    `dataColeta` INTEGER NOT NULL,
                    `prova` TEXT NOT NULL,
                    `atleta` TEXT NOT NULL,
                    `evento` TEXT NOT NULL,
                    `sessao` TEXT NOT NULL,
                    `idBloco` TEXT NOT NULL,
                    `statusEvento` TEXT NOT NULL,
                    `serie` TEXT NOT NULL,
                    `tiros` TEXT NOT NULL,
                    `hciSerieOrder` INTEGER NOT NULL DEFAULT 0,
                    `hciEventRowValid` INTEGER NOT NULL DEFAULT 1,
                    PRIMARY KEY(`chaveSerie`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `training_library` (
                    `trainingId` TEXT NOT NULL,
                    `parameter` TEXT NOT NULL,
                    `name` TEXT NOT NULL,
                    `objective` TEXT NOT NULL,
                    `description` TEXT NOT NULL,
                    `defaultTime` INTEGER NOT NULL,
                    `defaultShots` INTEGER NOT NULL,
                    `category` TEXT NOT NULL,
                    `language` TEXT NOT NULL DEFAULT 'pt-BR',
                    PRIMARY KEY(`trainingId`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `periodization_config` (
                    `id` TEXT NOT NULL,
                    `phaseName` TEXT NOT NULL,
                    `volumePercentage` REAL NOT NULL,
                    `intensityPercentage` REAL NOT NULL,
                    `technicalFocus` REAL NOT NULL,
                    `physicalFocus` REAL NOT NULL,
                    PRIMARY KEY(`id`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `periodization_schedule` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    `phaseName` TEXT NOT NULL,
                    `startDate` INTEGER NOT NULL,
                    `endDate` INTEGER NOT NULL,
                    `volumePercentage` REAL NOT NULL,
                    `intensityPercentage` REAL NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `training_plan_config` (
                    `id` TEXT NOT NULL,
                    `athlete` TEXT NOT NULL,
                    `event` TEXT NOT NULL,
                    `session` TEXT NOT NULL,
                    `goal` INTEGER NOT NULL,
                    `atPercent` INTEGER NOT NULL,
                    `ptPercent` INTEGER NOT NULL,
                    `pPercent` INTEGER NOT NULL,
                    `qPercent` INTEGER NOT NULL,
                    `wPercent` INTEGER NOT NULL,
                    PRIMARY KEY(`id`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `training_plan_prescription` (
                    `cellKey` TEXT NOT NULL,
                    `day` INTEGER NOT NULL,
                    `block` TEXT NOT NULL,
                    `code` TEXT NOT NULL,
                    `trainingId` TEXT NOT NULL,
                    `trainingTitle` TEXT NOT NULL,
                    `prescribedByRole` TEXT NOT NULL,
                    `updatedAt` INTEGER NOT NULL,
                    PRIMARY KEY(`cellKey`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `athlete_submission` (
                    `submissionId` TEXT NOT NULL,
                    `athlete` TEXT NOT NULL,
                    `event` TEXT NOT NULL,
                    `session` TEXT NOT NULL,
                    `prova` TEXT NOT NULL,
                    `serie` TEXT NOT NULL,
                    `shots` TEXT NOT NULL,
                    `source` TEXT NOT NULL,
                    `notes` TEXT NOT NULL,
                    `status` TEXT NOT NULL,
                    `submittedAt` INTEGER NOT NULL,
                    `reviewedAt` INTEGER,
                    `reviewerRole` TEXT,
                    PRIMARY KEY(`submissionId`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `admin_athlete_input` (
                    `contextKey` TEXT NOT NULL,
                    `athlete` TEXT NOT NULL,
                    `event` TEXT NOT NULL,
                    `session` TEXT NOT NULL,
                    `prova` TEXT NOT NULL,
                    `sr1` REAL NOT NULL,
                    `sr2` REAL NOT NULL,
                    `sr3` REAL NOT NULL,
                    `sr4` REAL NOT NULL,
                    `sr5` REAL NOT NULL,
                    `sr6` REAL NOT NULL,
                    `totalEvento` REAL NOT NULL,
                    `mediaTiro` REAL NOT NULL,
                    `technicalVolumePct` INTEGER NOT NULL,
                    `technicalIntensityPct` INTEGER NOT NULL,
                    `technicalDurationMin` INTEGER NOT NULL,
                    `technicalShots` INTEGER NOT NULL,
                    `technicalSeries` INTEGER NOT NULL,
                    `technicalFocus` TEXT NOT NULL,
                    `technicalStatus` TEXT NOT NULL,
                    `technicalNotes` TEXT NOT NULL,
                    `physicalLoadPct` INTEGER NOT NULL,
                    `physicalIntensityPct` INTEGER NOT NULL,
                    `physicalFrequency` TEXT NOT NULL,
                    `physicalBlock` TEXT NOT NULL,
                    `physicalModule` TEXT NOT NULL,
                    `physicalNotes` TEXT NOT NULL,
                    `predictionMqs` INTEGER NOT NULL DEFAULT 0,
                    `predictionTop15` INTEGER NOT NULL DEFAULT 0,
                    `predictionTop8` INTEGER NOT NULL DEFAULT 0,
                    `updatedAt` INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(`contextKey`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `target_session` (
                    `sessionId` TEXT NOT NULL,
                    `athlete` TEXT NOT NULL,
                    `event` TEXT NOT NULL,
                    `session` TEXT NOT NULL,
                    `targetType` TEXT NOT NULL,
                    `totalShots` INTEGER NOT NULL,
                    `zoneLabels` TEXT NOT NULL,
                    `zoneCounts` TEXT NOT NULL,
                    `recommendedTraining` TEXT NOT NULL,
                    `submittedAt` INTEGER NOT NULL,
                    PRIMARY KEY(`sessionId`)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `qualified_lead` (
                    `leadId` TEXT NOT NULL,
                    `athleteName` TEXT NOT NULL,
                    `athleteEmail` TEXT NOT NULL,
                    `source` TEXT NOT NULL,
                    `createdAt` INTEGER NOT NULL,
                    `updatedAt` INTEGER NOT NULL,
                    PRIMARY KEY(`leadId`)
                )
                """.trimIndent()
            )

            addColumnIfMissing(db, "shot_series", "hciSerieOrder", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "shot_series", "hciEventRowValid", "INTEGER NOT NULL DEFAULT 1")
            addColumnIfMissing(db, "training_library", "language", "TEXT NOT NULL DEFAULT 'pt-BR'")
            addColumnIfMissing(db, "athlete_submission", "reviewedAt", "INTEGER")
            addColumnIfMissing(db, "athlete_submission", "reviewerRole", "TEXT")
            addColumnIfMissing(db, "admin_athlete_input", "predictionMqs", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "admin_athlete_input", "predictionTop15", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "admin_athlete_input", "predictionTop8", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "admin_athlete_input", "updatedAt", "INTEGER NOT NULL DEFAULT 0")
        }

        private fun addColumnIfMissing(
            db: SupportSQLiteDatabase,
            tableName: String,
            columnName: String,
            definition: String
        ) {
            db.query("PRAGMA table_info(`$tableName`)").use { cursor ->
                val nameIndex = cursor.getColumnIndex("name")
                while (cursor.moveToNext()) {
                    if (cursor.getString(nameIndex) == columnName) return
                }
            }
            db.execSQL("ALTER TABLE `$tableName` ADD COLUMN `$columnName` $definition")
        }
    }
}
