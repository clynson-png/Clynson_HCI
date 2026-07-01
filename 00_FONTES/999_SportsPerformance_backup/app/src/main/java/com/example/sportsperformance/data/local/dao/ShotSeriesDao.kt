package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.model.ShotSeries
import kotlinx.coroutines.flow.Flow

@Dao
interface ShotSeriesDao {
    @Query("SELECT * FROM shot_series ORDER BY dataColeta DESC")
    fun getAllSeries(): Flow<List<ShotSeries>>

    @Query("SELECT * FROM shot_series WHERE evento = :eventId AND atleta = :athleteName ORDER BY hciSerieOrder ASC")
    suspend fun getSeriesForEvent(athleteName: String, eventId: String): List<ShotSeries>

    @Query("SELECT * FROM shot_series WHERE evento = :eventId AND atleta = :athleteName AND sessao = :session ORDER BY hciSerieOrder ASC")
    suspend fun getSeriesForEventSession(athleteName: String, eventId: String, session: String): List<ShotSeries>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSeries(series: List<ShotSeries>)

    @Query("DELETE FROM shot_series")
    suspend fun deleteAll()
}
