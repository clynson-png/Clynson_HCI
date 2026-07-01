package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import kotlinx.coroutines.flow.Flow

@Dao
interface TrainingPlanDao {
    @Query("SELECT * FROM training_plan_config WHERE id = 'CURRENT_PLAN' LIMIT 1")
    fun getConfig(): Flow<TrainingPlanConfig?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: TrainingPlanConfig)

    @Query("SELECT * FROM training_plan_prescription")
    fun getPrescriptions(): Flow<List<TrainingPlanPrescription>>

    @Query("SELECT * FROM training_plan_prescription WHERE cellKey = :cellKey LIMIT 1")
    suspend fun getPrescription(cellKey: String): TrainingPlanPrescription?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun savePrescription(prescription: TrainingPlanPrescription)
}
