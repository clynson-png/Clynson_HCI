package com.example.sportsperformance

import android.app.Application
import com.example.sportsperformance.data.local.AppDatabase
import com.example.sportsperformance.data.repository.HciRepository

class SportsPerformanceApplication : Application() {
    val database by lazy { AppDatabase.getDatabase(this) }
    val repository by lazy { 
        HciRepository(
            database.shotSeriesDao(),
            database.trainingLibraryDao(),
            database.periodizationDao(),
            database.trainingPlanDao(),
            database.athleteSubmissionDao(),
            database.adminAthleteInputDao(),
            database.targetSessionDao(),
            database.qualifiedLeadDao()
        )
    }
}
