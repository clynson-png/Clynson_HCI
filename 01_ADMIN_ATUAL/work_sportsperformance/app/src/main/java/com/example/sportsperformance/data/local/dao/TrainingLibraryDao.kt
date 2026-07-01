package com.example.sportsperformance.data.local.dao

import androidx.room.*
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import kotlinx.coroutines.flow.Flow

@Dao
interface TrainingLibraryDao {
    @Query("SELECT * FROM training_library")
    fun getAllTrainings(): Flow<List<TrainingLibrary>>

    @Query("SELECT * FROM training_library WHERE parameter = :parameter LIMIT 1")
    suspend fun getTrainingForParameter(parameter: String): TrainingLibrary?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTraining(training: TrainingLibrary)

    @Update
    suspend fun updateTraining(training: TrainingLibrary)

    @Delete
    suspend fun deleteTraining(training: TrainingLibrary)
}
