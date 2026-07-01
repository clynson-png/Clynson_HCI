package com.example.sportsperformance.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.sportsperformance.data.local.entities.AthleteSubmission
import kotlinx.coroutines.flow.Flow

@Dao
interface AthleteSubmissionDao {
    @Query("SELECT * FROM athlete_submission ORDER BY submittedAt DESC")
    fun getAllSubmissions(): Flow<List<AthleteSubmission>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSubmission(submission: AthleteSubmission)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSubmissions(submissions: List<AthleteSubmission>)

    @Query(
        """
        UPDATE athlete_submission
        SET status = :status, reviewedAt = :reviewedAt, reviewerRole = :reviewerRole
        WHERE submissionId = :submissionId
        """
    )
    suspend fun updateStatus(
        submissionId: String,
        status: String,
        reviewedAt: Long,
        reviewerRole: String
    )
}
