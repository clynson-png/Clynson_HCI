package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.local.entities.AdminAthleteInput
import kotlinx.coroutines.flow.Flow

@Dao
interface AdminAthleteInputDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(input: AdminAthleteInput)

    @Query("SELECT * FROM admin_athlete_input WHERE contextKey = :contextKey LIMIT 1")
    suspend fun getByContext(contextKey: String): AdminAthleteInput?

    @Query("SELECT * FROM admin_athlete_input ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<AdminAthleteInput>>
}
