package com.example.sportsperformance.logic

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ShotCsvExporter(private val context: Context) {
    fun exportAndShare(payload: ShotCsvPayload) {
        val file = writeCsv(payload)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "SportsPerformance CSV - ${payload.athlete}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(
            Intent.createChooser(intent, "Exportar CSV").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    private fun writeCsv(payload: ShotCsvPayload): File {
        val exportsDir = File(context.cacheDir, "csv_exports").apply { mkdirs() }
        val safeAthlete = payload.athlete.replace(Regex("[^A-Za-z0-9_-]+"), "_").ifBlank { "atleta" }
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date(payload.exportedAt))
        val file = File(exportsDir, "sportsperformance_${safeAthlete}_$timestamp.csv")
        file.writeText(payload.toCsv(), Charsets.UTF_8)
        return file
    }
}

data class ShotCsvPayload(
    val athlete: String,
    val event: String,
    val session: String,
    val prova: String,
    val notes: String,
    val exportedAt: Long,
    val series: List<ShotCsvSeries>
) {
    fun toCsv(): String {
        val header = listOf(
            "athlete",
            "event",
            "session",
            "prova",
            "serie",
            "shot_number",
            "score",
            "direction",
            "notes",
            "exported_at"
        ).joinToString(",")
        val rows = series.flatMap { serie ->
            serie.shots.mapIndexed { index, score ->
                listOf(
                    athlete,
                    event,
                    session,
                    prova,
                    serie.name,
                    (index + 1).toString(),
                    formatScore(score),
                    serie.directions.getOrNull(index).orEmpty(),
                    notes,
                    exportedAt.toString()
                ).joinToString(",") { csvEscape(it) }
            }
        }
        return (listOf(header) + rows).joinToString("\n") + "\n"
    }

    private fun formatScore(value: Double): String {
        val rounded = String.format(Locale.US, "%.1f", value)
        return rounded.removeSuffix(".0")
    }

    private fun csvEscape(value: String): String {
        val escaped = value.replace("\"", "\"\"")
        return "\"$escaped\""
    }
}

data class ShotCsvSeries(
    val name: String,
    val shots: List<Double>,
    val directions: List<String>
)
