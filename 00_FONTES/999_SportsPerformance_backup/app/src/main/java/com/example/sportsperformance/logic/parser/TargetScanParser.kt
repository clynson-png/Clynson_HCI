package com.example.sportsperformance.logic.parser

import android.content.Context
import android.net.Uri
import com.example.sportsperformance.data.model.ShotSeries
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.Inflater
import java.util.regex.Pattern
import kotlin.math.atan2
import kotlin.math.roundToInt
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

class TargetScanParser(private val context: Context) {

    data class VectorTargetReading(
        val directionalCounts: Map<String, Int>,
        val totalShots: Int
    )

    data class ExtractionResult(
        val athlete: String,
        val prova: String,
        val date: Date,
        val eventId: String,
        val series: List<ShotSeries>,
        val vectorReading: VectorTargetReading? = null
    )

    fun parsePdf(uri: Uri): ExtractionResult? {
        return try {
            PDFBoxResourceLoader.init(context)
            context.contentResolver.openInputStream(uri)?.use { parsePdfStream(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun parseAsset(assetName: String): ExtractionResult? {
        return try {
            PDFBoxResourceLoader.init(context)
            context.assets.open(assetName).use { parsePdfStream(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun parsePdfStream(inputStream: InputStream): ExtractionResult {
        val pdfBytes = inputStream.readBytes()
        val document = PDDocument.load(pdfBytes)
        val text = PDFTextStripper().getText(document)
        document.close()
        return parseText(text, pdfBytes)
    }

    private fun parseText(text: String, pdfBytes: ByteArray): ExtractionResult {
        val athlete = extractValue(text, "Athlete:\\s*(.+)") ?: inferAthlete(text) ?: "Atleta Desconhecido"
        val rawDate = extractValue(text, "Date:\\s*(.+)") ?: extractValue(text, "Data do evento\\s*(.+)")
        val sessionName = inferSession(text) ?: extractValue(text, "Session:\\s*(.+)") ?: "EV_PDF"

        val upper = text.uppercase(Locale.getDefault()).replace('\uFB02', 'F')
        val isRifle = upper.contains("RIFLE") || upper.contains("CARABINA")
        val prova = if (isRifle) "RIFLE" else "PISTOL"
        val date = parseTargetScanDate(rawDate) ?: Date()

        val parsedSeries = parseTargetScanSeriesTable(text, isRifle)
        val chunks = if (parsedSeries.isNotEmpty()) {
            parsedSeries
        } else {
            parseColonShotPattern(text, isRifle).chunked(10)
        }

        val seriesList = chunks.take(6).mapIndexed { index, shots ->
            val serieName = "SR${index + 1}"
            ShotSeries(
                chaveSerie = ShotSeries.createChave(athlete, prova, sessionName, "TREINO", "B1", serieName),
                dataColeta = date,
                prova = prova,
                atleta = athlete,
                evento = sessionName,
                sessao = "TREINO",
                idBloco = "B1",
                statusEvento = if (index == chunks.lastIndex) "FINAL" else "PARCIAL",
                serie = serieName,
                tiros = shots,
                hciSerieOrder = index + 1
            )
        }

        val vectorReading = if (!isRifle) extractVectorReading(pdfBytes) else null

        return ExtractionResult(
            athlete = athlete,
            prova = prova,
            date = date,
            eventId = sessionName,
            series = seriesList,
            vectorReading = vectorReading
        )
    }

    private fun extractVectorReading(pdfBytes: ByteArray): VectorTargetReading? {
        val streamPattern = Regex("stream\\r?\\n".toByteArray().decodeToString())
        val pdfText = pdfBytes.toString(Charsets.ISO_8859_1)
        val targetCenters = mutableListOf<Point>()
        val shots = mutableListOf<Point>()

        streamPattern.findAll(pdfText).forEach { match ->
            val streamStart = match.range.last + 1
            val endstreamIndex = pdfText.indexOf("endstream", startIndex = streamStart)
            if (endstreamIndex == -1) return@forEach

            val rawChunk = pdfBytes.copyOfRange(streamStart, endstreamIndex)
                .dropWhile { it == '\r'.code.toByte() || it == '\n'.code.toByte() }
                .dropLastWhile { it == '\r'.code.toByte() || it == '\n'.code.toByte() }
                .toByteArray()

            val decoded = inflateStream(rawChunk) ?: return@forEach
            val content = decoded.toString(Charsets.ISO_8859_1)
            if (!content.contains(" rg") && !content.contains(" RG")) return@forEach

            targetCenters += extractTargetCenters(content)
            shots += extractShotCenters(content)
        }

        if (targetCenters.isEmpty() || shots.isEmpty()) return null

        val uniqueCenters = targetCenters.distinctBy { "${it.x.roundToInt()}_${it.y.roundToInt()}" }
        if (uniqueCenters.isEmpty()) return null

        val counts = linkedMapOf(
            "C" to 0,
            "N" to 0,
            "NE" to 0,
            "E" to 0,
            "SE" to 0,
            "S" to 0,
            "SW" to 0,
            "W" to 0,
            "NW" to 0
        )

        shots.forEach { shot ->
            val nearestCenter = uniqueCenters.minByOrNull { center ->
                squaredDistance(shot, center)
            } ?: return@forEach

            val dx = shot.x - nearestCenter.x
            val dy = nearestCenter.y - shot.y
            val direction = classifyDirection(dx, dy)
            counts[direction] = counts.getValue(direction) + 1
        }

        val totalShots = counts.values.sum()
        return if (totalShots > 0) VectorTargetReading(counts, totalShots) else null
    }

    private fun inflateStream(rawChunk: ByteArray): ByteArray? {
        return try {
            val inflater = Inflater()
            inflater.setInput(rawChunk)
            val output = ByteArray(rawChunk.size * 20 + 1024)
            val length = inflater.inflate(output)
            inflater.end()
            if (length > 0) output.copyOf(length) else null
        } catch (_: Exception) {
            null
        }
    }

    private fun extractTargetCenters(content: String): List<Point> {
        val results = mutableListOf<Point>()
        val pattern = Regex(
            """(?s)(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) m\s+(?:.*?\n){20,120}?h\s+S"""
        )
        pattern.findAll(content).forEach { match ->
            val block = match.value
            val numbers = Regex("""-?\d+(?:\.\d+)?""").findAll(block).map { it.value.toDouble() }.toList()
            val points = numbers.chunked(2).filter { it.size == 2 }.map { Point(it[0], it[1]) }
            if (points.isEmpty()) return@forEach
            val minX = points.minOf { it.x }
            val maxX = points.maxOf { it.x }
            val minY = points.minOf { it.y }
            val maxY = points.maxOf { it.y }
            val rx = (maxX - minX) / 2.0
            val ry = (maxY - minY) / 2.0
            if (rx in 70.0..100.0 && ry in 70.0..100.0) {
                results += Point((minX + maxX) / 2.0, (minY + maxY) / 2.0)
            }
        }
        return results
    }

    private fun extractShotCenters(content: String): List<Point> {
        val results = mutableListOf<Point>()
        val shotPattern = Regex(
            """(?s)\.1725 \.7412 \.9137 RG \.1725 \.7412 \.9137 rg\s+/G3 gs\s+((?:.*?\n){1,14}?)h\s+f"""
        )
        shotPattern.findAll(content).forEach { match ->
            val numbers = Regex("""-?\d+(?:\.\d+)?""").findAll(match.groupValues[1]).map { it.value.toDouble() }.toList()
            val points = numbers.chunked(2).filter { it.size == 2 }.map { Point(it[0], it[1]) }
            if (points.isEmpty()) return@forEach
            val minX = points.minOf { it.x }
            val maxX = points.maxOf { it.x }
            val minY = points.minOf { it.y }
            val maxY = points.maxOf { it.y }
            val radius = max(maxX - minX, maxY - minY) / 2.0
            if (radius in 0.5..10.0) {
                results += Point((minX + maxX) / 2.0, (minY + maxY) / 2.0)
            }
        }
        return results
    }

    private fun classifyDirection(dx: Double, dy: Double): String {
        val radius = kotlin.math.sqrt((dx * dx) + (dy * dy))
        if (radius <= 2.5) return "C"
        val angle = (Math.toDegrees(atan2(dy, dx)) + 360.0) % 360.0
        return when (((angle + 22.5) % 360.0 / 45.0).toInt()) {
            0 -> "E"
            1 -> "NE"
            2 -> "N"
            3 -> "NW"
            4 -> "W"
            5 -> "SW"
            6 -> "S"
            else -> "SE"
        }
    }

    private fun squaredDistance(a: Point, b: Point): Double {
        val dx = a.x - b.x
        val dy = a.y - b.y
        return (dx * dx) + (dy * dy)
    }

    private fun parseTargetScanSeriesTable(text: String, isRifle: Boolean): List<List<Double>> {
        val lines = cleanLines(text)
        val sixtyIndex = lines.indexOfFirst { it == "60" }
        val start = lines.withIndex().firstOrNull { (index, line) ->
            index > sixtyIndex && isSeriesHeader(line)
        }?.index ?: return emptyList()
        val end = lines.withIndex().firstOrNull { (index, line) ->
            index > start && line.equals("Targets", ignoreCase = true)
        }?.index ?: lines.size
        val section = lines.subList(start + 1, end)
        val result = mutableListOf<List<Double>>()

        section.forEachIndexed { index, line ->
            if (!isSeriesTotalLine(line)) return@forEachIndexed
            val shots = mutableListOf<Double>()
            var cursor = index - 1
            while (cursor >= 0 && shots.size < 10) {
                scoreFromTargetScanLine(section[cursor], isRifle)?.let { shots.add(it) }
                cursor--
            }
            if (shots.size == 10) result.add(shots.asReversed())
        }
        return result.take(6)
    }

    private fun parseColonShotPattern(text: String, isRifle: Boolean): List<Double> {
        val matcher = Pattern.compile("(\\d+):\\s*(\\d+[\\.,]?\\d*)").matcher(text)
        val shots = mutableListOf<Double>()
        while (matcher.find()) {
            val value = matcher.group(2)?.replace(',', '.')?.toDoubleOrNull() ?: 0.0
            shots.add(if (isRifle) value else floor(value))
        }
        return shots
    }

    private fun cleanLines(text: String): List<String> {
        return text
            .replace('\uFB02', 'f')
            .lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }
    }

    private fun inferAthlete(text: String): String? {
        val lines = cleanLines(text)
        val disciplineIndex = lines.indexOfFirst {
            it.contains("Air Ri", ignoreCase = true) || it.contains("Pistola", ignoreCase = true)
        }
        return lines.getOrNull(disciplineIndex + 1)?.takeIf {
            !it.startsWith("Session", ignoreCase = true) &&
                !isSeriesHeader(it)
        }
    }

    private fun isSeriesHeader(line: String): Boolean {
        val normalized = line
            .replace("Ã©", "e")
            .replace("é", "e")
            .trim()
            .removeSuffix(":")
        return normalized.equals("Series", ignoreCase = true) ||
            normalized.equals("Serie", ignoreCase = true)
    }

    private fun inferSession(text: String): String? {
        val session = extractValue(text, "Session\\s*(\\d+)")
        return session?.let { "Session $it" }
    }

    private fun isSeriesTotalLine(line: String): Boolean {
        val match = Regex("""^(\d{2,3})(?:-\d+x)?(?:\s*\(\d{2,3}[,.]\d\))?$""").matchEntire(line.trim()) ?: return false
        val total = match.groupValues[1].toIntOrNull() ?: return false
        return total in 30..109
    }

    private fun scoreFromTargetScanLine(line: String, isRifle: Boolean): Double? {
        val token = line
            .replace("*", "")
            .split(Regex("""\s+"""))
            .lastOrNull { it.matches(Regex("""\d{1,2}(?:[,.]\d)?""")) }
            ?: return null
        val value = token.replace(',', '.').toDoubleOrNull() ?: return null
        if (value !in 0.0..10.9) return null
        return if (isRifle) value else floor(value)
    }

    private fun extractValue(text: String, regex: String): String? {
        val matcher = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text)
        return if (matcher.find()) matcher.group(1)?.trim() else null
    }

    private fun parseTargetScanDate(dateStr: String?): Date? {
        if (dateStr == null) return null
        val formats = listOf(
            SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()),
            SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()),
            SimpleDateFormat("MM/dd/yyyy HH:mm:ss", Locale.US),
            SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()),
            SimpleDateFormat("dd MMM yyyy", Locale.getDefault()),
            SimpleDateFormat("dd 'de' MMM. 'de' yyyy", Locale("pt", "BR"))
        )
        return formats.firstNotNullOfOrNull { format ->
            try {
                format.parse(dateStr)
            } catch (e: Exception) {
                null
            }
        }
    }

    private data class Point(val x: Double, val y: Double)
}
