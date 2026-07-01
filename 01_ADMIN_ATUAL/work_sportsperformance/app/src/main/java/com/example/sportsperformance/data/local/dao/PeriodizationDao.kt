package com.example.sportsperformance.data.local.dao

import androidx.room.*
import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.PeriodizationSchedule
import kotlinx.coroutines.flow.Flow

@Dao
interface PeriodizationDao {
    @Query("SELECT * FROM periodization_config WHERE id = 'CURRENT_CONFIG' LIMIT 1")
    fun getConfig(): Flow<PeriodizationConfig?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: PeriodizationConfig)

    // Cronograma (Schedule)
    @Query("SELECT * FROM periodization_schedule ORDER BY startDate ASC")
    fun getAllSchedule(): Flow<List<PeriodizationSchedule>>

    @Insert
    suspend fun addSchedulePhase(schedule: PeriodizationSchedule)

    @Delete
    suspend fun deleteSchedulePhase(schedule: PeriodizationSchedule)
}
