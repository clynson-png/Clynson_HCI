package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.local.entities.QualifiedLead
import kotlinx.coroutines.flow.Flow

@Dao
interface QualifiedLeadDao {
    @Query("SELECT * FROM qualified_lead ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<QualifiedLead>>

    @Query("SELECT * FROM qualified_lead WHERE athleteEmail = :email LIMIT 1")
    suspend fun getByEmail(email: String): QualifiedLead?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(lead: QualifiedLead)
}
