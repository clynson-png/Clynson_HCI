package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.local.entities.TargetSession
import kotlinx.coroutines.flow.Flow

@Dao
interface TargetSessionDao {
    @Query("SELECT * FROM target_session ORDER BY submittedAt DESC")
    fun getAllSessions(): Flow<List<TargetSession>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(session: TargetSession)
}
