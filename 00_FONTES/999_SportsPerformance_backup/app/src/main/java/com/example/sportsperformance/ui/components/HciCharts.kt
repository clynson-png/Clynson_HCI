package com.example.sportsperformance.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.data.model.ShotSeries
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciError
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

data class DirectionalTargetSector(
    val angle: Int,
    val label: String,
    val directionCode: String,
    val weightPercent: Double,
    val insight: String,
    val likelyCause: String,
    val trainingCode: String
)
@Composable
fun HciRadarChart(
    title: String,
    data: List<Pair<String, Double>>,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.padding(4.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = HciTextPrimary
            )
            
            Spacer(modifier = Modifier.height(8.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .padding(16.dp)
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2, size.height / 2)
                    val radius = size.width / 2
                    val numPoints = data.size
                    val angleStep = (2 * PI / numPoints).toFloat()

                    // 1. Desenhar a Grade (Pentágono/Hexágono de fundo)
                    for (i in 1..5) {
                        val currentRadius = radius * (i / 5f)
                        val path = Path()
                        for (j in 0 until numPoints) {
                            val angle = j * angleStep - (PI / 2).toFloat()
                            val x = center.x + currentRadius * cos(angle)
                            val y = center.y + currentRadius * sin(angle)
                            if (j == 0) path.moveTo(x, y) else path.lineTo(x, y)
                        }
                        path.close()
                        drawPath(path, color = Color.LightGray.copy(alpha = 0.3f), style = Stroke(width = 1.dp.toPx()))
                    }

                    // 2. Desenhar Eixos
                    val labelPaint = android.graphics.Paint().apply {
                        this.color = android.graphics.Color.rgb(15, 23, 42)
                        textAlign = android.graphics.Paint.Align.CENTER
                        textSize = 11.sp.toPx()
                        isFakeBoldText = true
                    }
                    for (j in 0 until numPoints) {
                        val angle = j * angleStep - (PI / 2).toFloat()
                        val x = center.x + radius * cos(angle)
                        val y = center.y + radius * sin(angle)
                        drawLine(Color.LightGray.copy(alpha = 0.5f), center, Offset(x, y), strokeWidth = 1.dp.toPx())

                        val labelRadius = radius + 12.dp.toPx()
                        val labelX = center.x + labelRadius * cos(angle)
                        val labelY = center.y + labelRadius * sin(angle) + 4.dp.toPx()
                        drawCircle(
                            color = Color.White,
                            radius = 9.dp.toPx(),
                            center = Offset(labelX, labelY - 3.dp.toPx())
                        )
                        drawCircle(
                            color = color.copy(alpha = 0.18f),
                            radius = 9.dp.toPx(),
                            center = Offset(labelX, labelY - 3.dp.toPx()),
                            style = Stroke(width = 1.dp.toPx())
                        )
                        drawContext.canvas.nativeCanvas.drawText(
                            (j + 1).toString(),
                            labelX,
                            labelY,
                            labelPaint
                        )
                    }

                    // 3. Desenhar Área de Dados (Preenchimento)
                    val dataPath = Path()
                    for (j in 0 until numPoints) {
                        val score = data[j].second.coerceIn(0.0, 10.0)
                        val currentRadius = radius * (score.toFloat() / 10f)
                        val angle = j * angleStep - (PI / 2).toFloat()
                        val x = center.x + currentRadius * cos(angle)
                        val y = center.y + currentRadius * sin(angle)
                        if (j == 0) dataPath.moveTo(x, y) else dataPath.lineTo(x, y)
                    }
                    dataPath.close()
                    drawPath(dataPath, color = color.copy(alpha = 0.2f), style = Fill)
                    drawPath(dataPath, color = color, style = Stroke(width = 2.dp.toPx()))
                }
            }
            
            Column(modifier = Modifier.fillMaxWidth()) {
                data.forEachIndexed { index, (label, score) ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("${index + 1}. $label", fontSize = 9.sp, color = HciTextSecondary)
                        Text(score.toString(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                    }
                }
            }
        }
    }
}

@Composable
fun RhythmPathChart(
    pathData: List<Double>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Ritmo", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(16.dp))
            
            Canvas(modifier = Modifier.fillMaxWidth().height(150.dp)) {
                if (pathData.isEmpty()) return@Canvas
                
                val width = size.width
                val height = size.height
                val maxVal = 10.9
                val minVal = 8.0
                val range = maxVal - minVal
                
                val xStep = width / (pathData.size - 1).coerceAtLeast(1)
                
                // Desenhar a linha do caminho
                val path = Path()
                pathData.forEachIndexed { index, value ->
                    val x = index * xStep
                    val y = (height - ((value - minVal) / range) * height).toFloat()
                    if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    
                    // Bolinha do ponto
                    drawCircle(
                        color = if (index % 3 == 0) HciAccentBlue else Color.LightGray,
                        radius = 3.dp.toPx(),
                        center = Offset(x, y)
                    )
                }
                drawPath(path, color = HciAccentBlue, style = Stroke(width = 1.5.dp.toPx()))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("P1: Início | P2: Meio | P3: Fim da Série", fontSize = 10.sp, color = HciTextSecondary)
        }
    }
}

@Composable
fun RhythmTimelineChart(
    seriesData: List<Double>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("LINHA DE RITMO (POR SÉRIE)", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(16.dp))
            
            Canvas(modifier = Modifier.fillMaxWidth().height(150.dp)) {
                if (seriesData.isEmpty()) return@Canvas
                
                val width = size.width
                val height = size.height
                val maxVal = 105.0 // Meta típica
                val minVal = 85.0
                val range = maxVal - minVal
                
                val xStep = width / (seriesData.size - 1).coerceAtLeast(1)
                
                // Desenhar Barras (Volume)
                seriesData.forEachIndexed { index, value ->
                    val barHeight = (value / maxVal) * height
                    drawRect(
                        color = HciAccentBlue.copy(alpha = 0.1f),
                        topLeft = Offset(index * xStep - 10.dp.toPx(), (height - barHeight).toFloat()),
                        size = androidx.compose.ui.geometry.Size(20.dp.toPx(), barHeight.toFloat())
                    )
                }

                // Desenhar Linha (Tendência)
                val path = Path()
                seriesData.forEachIndexed { index, value ->
                    val x = index * xStep
                    val y = (height - ((value - minVal) / range) * height).toFloat()
                    if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    
                    drawCircle(HciAccentBlue, radius = 4.dp.toPx(), center = Offset(x, y))
                }
                drawPath(path, color = HciAccentBlue, style = Stroke(width = 2.dp.toPx()))
            }
        }
    }
}

@Composable
fun AthleteEvolutionChart(
    series: List<ShotSeries>,
    selectedAthlete: String,
    modifier: Modifier = Modifier
) {
    val eventTotals = series
        .filter { it.atleta == selectedAthlete }
        .groupBy { "${it.evento} ${it.sessao}" }
        .mapValues { entry -> entry.value.groupBy { it.serie }.values.sumOf { rows -> rows.first().totalSerie } }
        .toList()

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("EVOLUCAO COMPARATIVA DO ATLETA", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(12.dp))
            Canvas(modifier = Modifier.fillMaxWidth().height(180.dp)) {
                if (eventTotals.isEmpty()) return@Canvas
                val left = 34.dp.toPx()
                val right = size.width - 10.dp.toPx()
                val top = 8.dp.toPx()
                val bottom = size.height - 28.dp.toPx()
                val minValue = (eventTotals.minOf { it.second } - 5.0).coerceAtLeast(0.0)
                val maxValue = eventTotals.maxOf { it.second } + 5.0
                val range = (maxValue - minValue).coerceAtLeast(1.0)
                val xStep = (right - left) / (eventTotals.size - 1).coerceAtLeast(1)

                fun yOf(value: Double): Float = bottom - (((value - minValue) / range).toFloat() * (bottom - top))
                drawLine(Color(0xFFE2E8F0), Offset(left, bottom), Offset(right, bottom), strokeWidth = 1.dp.toPx())
                drawLine(Color(0xFFE2E8F0), Offset(left, top), Offset(left, bottom), strokeWidth = 1.dp.toPx())

                val path = Path()
                eventTotals.forEachIndexed { index, (_, total) ->
                    val x = if (eventTotals.size == 1) (left + right) / 2f else left + index * xStep
                    val y = yOf(total)
                    if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    drawCircle(HciAccentBlue, radius = 4.dp.toPx(), center = Offset(x, y))
                    drawContext.canvas.nativeCanvas.drawText(
                        total.toInt().toString(),
                        x,
                        y - 8.dp.toPx(),
                        android.graphics.Paint().apply {
                            color = android.graphics.Color.rgb(15, 23, 42)
                            textAlign = android.graphics.Paint.Align.CENTER
                            textSize = 9.sp.toPx()
                        }
                    )
                }
                drawPath(path, color = HciAccentBlue, style = Stroke(width = 2.dp.toPx()))
            }
            Text(eventTotals.joinToString("  ") { it.first }, fontSize = 10.sp, color = HciTextSecondary)
        }
    }
}

@Composable
fun ExcelRhythmTimelineChart(
    series: List<ShotSeries>,
    modifier: Modifier = Modifier
) {
    val points = buildRhythmPathPoints(series)
    val mainDrop = points.mapNotNull { it.dropDepth }.maxOrNull()
    val isRifle = series.firstOrNull()?.prova?.uppercase()?.contains("RIFLE") == true

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("CHART_RHYTHM_OUTPUT", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = HciTextSecondary)
            Spacer(modifier = Modifier.height(8.dp))

            Canvas(modifier = Modifier.fillMaxWidth().height(260.dp)) {
                if (points.isEmpty()) return@Canvas

                val leftPad = 34.dp.toPx()
                val rightPad = 28.dp.toPx()
                val topPad = 12.dp.toPx()
                val bottomPad = 42.dp.toPx()
                val chartLeft = leftPad
                val chartRight = size.width - rightPad
                val chartTop = topPad
                val chartBottom = size.height - bottomPad
                val chartWidth = chartRight - chartLeft
                val chartHeight = chartBottom - chartTop
                val leftMin = 0.0
                val leftBaseMax = if (isRifle) 1.6 else 3.0
                val leftObservedMax = points.maxOfOrNull { point ->
                    max(
                        point.stdSerie,
                        max(point.breakCount.toDouble(), point.dropDepth ?: 0.0)
                    )
                } ?: leftBaseMax
                val leftMax = max(leftBaseMax, leftObservedMax * 1.1)
                val rightMin = if (isRifle) 9.6 else 8.0
                val rightMax = if (isRifle) 10.9 else 11.0
                val slot = chartWidth / points.size
                val barWidth = (slot * 0.28f).coerceAtMost(9.dp.toPx())

                fun xOf(index: Int): Float = chartLeft + slot * index + slot / 2f
                fun yLeft(value: Double): Float {
                    return chartBottom - (((value - leftMin) / (leftMax - leftMin)).toFloat() * chartHeight)
                }
                fun yRight(value: Double): Float {
                    return chartBottom - (((value - rightMin) / (rightMax - rightMin)).toFloat() * chartHeight)
                }

                drawRhythmAxes(chartLeft, chartRight, chartTop, chartBottom, leftMin, leftMax, rightMin, rightMax)

                points.forEachIndexed { index, point ->
                    val center = xOf(index)
                    drawRect(
                        color = Color(0xFF92D050),
                        topLeft = Offset(center - barWidth - 1.dp.toPx(), yLeft(point.stdSerie)),
                        size = Size(barWidth, chartBottom - yLeft(point.stdSerie))
                    )
                    drawRect(
                        color = Color.Red,
                        topLeft = Offset(center + 1.dp.toPx(), yLeft(point.breakCount.toDouble())),
                        size = Size(barWidth, chartBottom - yLeft(point.breakCount.toDouble()))
                    )
                }

                drawLineSeries(points.map { it.mediaSerie }, Color.Red.copy(alpha = 0.32f), ::xOf, ::yRight, stroke = 1.dp.toPx())
                drawLineSeries(points.map { it.partMedia }, Color.Red, ::xOf, ::yRight, stroke = 1.5.dp.toPx(), smooth = true)
                drawLineSeries(logTrend(points.map { it.partMedia }), Color.Red.copy(alpha = 0.72f), ::xOf, ::yRight, stroke = 1.dp.toPx())

                points.forEachIndexed { index, point ->
                    point.mainDropMarker?.let {
                        drawCircle(Color(0xFFFFC000), radius = 4.dp.toPx(), center = Offset(xOf(index), yRight(it)))
                    }
                    point.dropDepth?.let {
                        val isMain = mainDrop != null && it == mainDrop
                        drawCircle(
                            color = if (isMain) HciAccentBlue else Color(0xFF60A5FA),
                            radius = if (isMain) 4.dp.toPx() else 2.5.dp.toPx(),
                            center = Offset(xOf(index), yLeft(it))
                        )
                    }
                }

                points.forEachIndexed { index, point ->
                    if (point.partName == "P1") {
                        drawContext.canvas.nativeCanvas.drawText(
                            point.serie,
                            xOf(index + 1).coerceAtMost(chartRight),
                            chartBottom + 16.dp.toPx(),
                            android.graphics.Paint().apply {
                                color = android.graphics.Color.rgb(100, 116, 139)
                                textAlign = android.graphics.Paint.Align.CENTER
                                textSize = 8.sp.toPx()
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            RhythmLegend()
        }
    }
}

private data class RhythmPathPoint(
    val serie: String,
    val partName: String,
    val partMedia: Double,
    val mediaSerie: Double,
    val stdSerie: Double,
    val breakCount: Int,
    val dropDepth: Double?,
    val mainDropMarker: Double?
)

private fun buildRhythmPathPoints(series: List<ShotSeries>): List<RhythmPathPoint> {
    val sorted = series.sortedBy { it.hciSerieOrder }
    return sorted.flatMapIndexed { index, item ->
        val media = item.tiros.median()
        val previousMedia = sorted.getOrNull(index - 1)?.tiros?.median()
        val drop = previousMedia?.let { it - media }?.takeIf { it > 0.0 }?.roundChart()
        val breakCount = if (drop != null) 1 else 0
        val std = item.tiros.populationStd()
        val parts = listOf(
            "P1" to item.tiros.subList(0, 3).median(),
            "P2" to item.tiros.subList(3, 7).median(),
            "P3" to item.tiros.subList(7, 10).median()
        )
        parts.map { (part, partMedia) ->
            RhythmPathPoint(
                serie = item.serie,
                partName = part,
                partMedia = partMedia,
                mediaSerie = media,
                stdSerie = std,
                breakCount = breakCount,
                dropDepth = drop,
                mainDropMarker = if (drop != null) media else null
            )
        }
    }
}

private fun List<Double>.populationStd(): Double {
    if (isEmpty()) return 0.0
    val baseline = median()
    return sqrt(sumOf { (it - baseline).pow(2) } / size)
}

private fun List<Double>.median(): Double {
    if (isEmpty()) return 0.0
    val sorted = sorted()
    val middle = sorted.size / 2
    return if (sorted.size % 2 == 0) {
        (sorted[middle - 1] + sorted[middle]) / 2.0
    } else {
        sorted[middle]
    }
}

private fun Double.roundChart(): Double = kotlin.math.round(this * 100.0) / 100.0

private fun DrawScope.drawRhythmAxes(
    left: Float,
    right: Float,
    top: Float,
    bottom: Float,
    leftMin: Double,
    leftMax: Double,
    rightMin: Double,
    rightMax: Double
) {
    val gridPaint = android.graphics.Paint().apply {
        color = android.graphics.Color.rgb(226, 232, 240)
        strokeWidth = 1f
    }
    val textPaint = android.graphics.Paint().apply {
        color = android.graphics.Color.rgb(71, 85, 105)
        textSize = 8.sp.toPx()
    }
    for (i in 0..5) {
        val ratio = i / 5f
        val y = bottom - ratio * (bottom - top)
        drawContext.canvas.nativeCanvas.drawLine(left, y, right, y, gridPaint)
        val leftValue = leftMin + (leftMax - leftMin) * ratio
        drawContext.canvas.nativeCanvas.drawText(String.format("%.1f", leftValue).replace(".0", ""), 2.dp.toPx(), y + 3.dp.toPx(), textPaint)
        val rightValue = rightMin + (rightMax - rightMin) * ratio
        drawContext.canvas.nativeCanvas.drawText(String.format("%.1f", rightValue).replace(".0", ""), right + 5.dp.toPx(), y + 3.dp.toPx(), textPaint)
    }
}

private fun DrawScope.drawLineSeries(
    values: List<Double?>,
    color: Color,
    xOf: (Int) -> Float,
    yOf: (Double) -> Float,
    stroke: Float,
    smooth: Boolean = false
) {
    val path = Path()
    var started = false
    var lastX = 0f
    var lastY = 0f
    values.forEachIndexed { index, value ->
        if (value == null) {
            started = false
            return@forEachIndexed
        }
        val x = xOf(index)
        val y = yOf(value)
        when {
            !started -> {
                path.moveTo(x, y)
                started = true
            }
            smooth -> {
                val midX = (lastX + x) / 2f
                path.cubicTo(midX, lastY, midX, y, x, y)
            }
            else -> path.lineTo(x, y)
        }
        lastX = x
        lastY = y
    }
    drawPath(path, color = color, style = Stroke(width = stroke))
}

private fun logTrend(values: List<Double>): List<Double?> {
    if (values.size < 2) return values.map { it }
    val n = values.size.toDouble()
    val xs = values.indices.map { ln((it + 1).toDouble()) }
    val ys = values
    val sumX = xs.sum()
    val sumY = ys.sum()
    val sumXX = xs.sumOf { it * it }
    val sumXY = xs.zip(ys).sumOf { it.first * it.second }
    val denom = max(0.000001, n * sumXX - sumX * sumX)
    val b = (n * sumXY - sumX * sumY) / denom
    val a = (sumY - b * sumX) / n
    return xs.map { a + b * it }
}

@Composable
private fun RhythmLegend() {
    Text(
        "STD | BREAK | MEDIA | DROP | TREND",
        fontSize = 9.sp,
        color = HciTextSecondary
    )
}

@Composable
fun SeriesBarChart(
    seriesData: List<Double>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("BARRAS POR SERIE", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(16.dp))

            Canvas(modifier = Modifier.fillMaxWidth().height(170.dp)) {
                if (seriesData.isEmpty()) return@Canvas

                val maxValue = (seriesData.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
                val chartHeight = size.height - 24.dp.toPx()
                val slotWidth = size.width / seriesData.size
                val barWidth = (slotWidth * 0.55f).coerceAtMost(34.dp.toPx())
                val baseline = size.height

                seriesData.forEachIndexed { index, value ->
                    val barHeight = ((value / maxValue) * chartHeight).toFloat()
                    val left = index * slotWidth + (slotWidth - barWidth) / 2f
                    drawRect(
                        color = HciAccentBlue.copy(alpha = 0.82f),
                        topLeft = Offset(left, baseline - barHeight),
                        size = Size(barWidth, barHeight)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = seriesData.mapIndexed { index, value -> "SR${index + 1}: ${value.toInt()}" }.joinToString("  "),
                fontSize = 10.sp,
                color = HciTextSecondary
            )
        }
    }
}

@Composable
fun SeriesLineChart(
    seriesData: List<Double>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("LINHA POR SERIE", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(16.dp))

            Canvas(modifier = Modifier.fillMaxWidth().height(170.dp)) {
                if (seriesData.isEmpty()) return@Canvas

                val minValue = (seriesData.minOrNull() ?: 0.0) - 1.0
                val maxValue = (seriesData.maxOrNull() ?: 0.0) + 1.0
                val range = (maxValue - minValue).coerceAtLeast(1.0)
                val chartHeight = size.height - 20.dp.toPx()
                val topPadding = 4.dp.toPx()
                val xStep = size.width / (seriesData.size - 1).coerceAtLeast(1)

                val path = Path()
                seriesData.forEachIndexed { index, value ->
                    val x = if (seriesData.size == 1) size.width / 2f else index * xStep
                    val y = topPadding + (chartHeight - ((value - minValue) / range * chartHeight)).toFloat()
                    if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    drawCircle(HciAccentBlue, radius = 4.dp.toPx(), center = Offset(x, y))
                }
                drawPath(path, color = HciAccentBlue, style = Stroke(width = 2.dp.toPx()))
            }
        }
    }
}
@Composable
fun DirectionalTargetRadialChart(
    title: String,
    subtitle: String,
    sectors: List<DirectionalTargetSector>,
    maxRing: Double,
    ringStep: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(
                text = title,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = HciTextPrimary
            )

            Text(
                text = subtitle,
                fontSize = 15.sp,
                color = HciTextSecondary
            )

            Text(
                text = "Mapa direcional do alvo por setores",
                fontSize = 13.sp,
                color = HciTextSecondary
            )

            Spacer(modifier = Modifier.height(18.dp))

            Canvas(modifier = Modifier.fillMaxWidth().height(380.dp)) {
                val center = Offset(size.width / 2f, size.height / 2f)
                val radius = minOf(size.width, size.height) * 0.32f
                val gridColor = Color(0xFF8FA19A)
                val textColor = android.graphics.Color.rgb(30, 41, 59)
                val subtleText = android.graphics.Color.rgb(103, 116, 112)

                val labelPaint = android.graphics.Paint().apply {
                    this.color = textColor
                    textAlign = android.graphics.Paint.Align.CENTER
                    textSize = 13.sp.toPx()
                    isFakeBoldText = true
                    isAntiAlias = true
                }

                val ringPaint = android.graphics.Paint().apply {
                    this.color = subtleText
                    textAlign = android.graphics.Paint.Align.CENTER
                    textSize = 10.sp.toPx()
                    isAntiAlias = true
                }

                var ring = ringStep
                while (ring <= maxRing + 0.001) {
                    val rr = radius * (ring / maxRing).toFloat()

                    drawCircle(
                        color = gridColor.copy(alpha = 0.32f),
                        radius = rr,
                        center = center,
                        style = Stroke(width = 1.dp.toPx())
                    )

                    drawContext.canvas.nativeCanvas.drawText(
                        "${ring.toInt()}%",
                        center.x + 18.dp.toPx(),
                        center.y - rr + 4.dp.toPx(),
                        ringPaint
                    )

                    ring += ringStep
                }

                sectors.forEach { sector ->
                    val angleRad = Math.toRadians(sector.angle.toDouble())

                    val end = Offset(
                        center.x + radius * cos(angleRad).toFloat(),
                        center.y - radius * sin(angleRad).toFloat()
                    )

                    drawLine(
                        color = gridColor.copy(alpha = 0.65f),
                        start = center,
                        end = end,
                        strokeWidth = 1.dp.toPx()
                    )

                    val labelR = radius + 62.dp.toPx()
                    val labelX = center.x + labelR * cos(angleRad).toFloat()
                    val labelY = center.y - labelR * sin(angleRad).toFloat()

                    directionalAngleLabelLines(sector).forEachIndexed { lineIndex, line ->
                        drawContext.canvas.nativeCanvas.drawText(
                            line,
                            labelX,
                            labelY + (lineIndex * 15.sp.toPx()),
                            labelPaint
                        )
                    }
                }

                val orderedSectors = sectors.sortedBy { it.angle }

                val minVisualPercent = if (orderedSectors.any { it.weightPercent > 0.0 }) {
                    maxRing * 0.21
                } else {
                    0.0
                }

                val polygonPoints = orderedSectors.map { sector ->
                    val visualPercent = if (sector.weightPercent > 0.0) {
                        sector.weightPercent
                    } else {
                        minVisualPercent
                    }

                    val normalized = (visualPercent / maxRing).coerceIn(0.0, 1.0)
                    val pointRadius = radius * normalized.toFloat()
                    val angleRad = Math.toRadians(sector.angle.toDouble())

                    Offset(
                        center.x + pointRadius * cos(angleRad).toFloat(),
                        center.y - pointRadius * sin(angleRad).toFloat()
                    )
                }

                if (polygonPoints.size >= 3) {
                    val polygonPath = Path().apply {
                        polygonPoints.forEachIndexed { index, point ->
                            if (index == 0) {
                                moveTo(point.x, point.y)
                            } else {
                                lineTo(point.x, point.y)
                            }
                        }
                        close()
                    }

                    drawPath(
                        path = polygonPath,
                        color = color.copy(alpha = 0.28f),
                        style = Fill
                    )

                    drawPath(
                        path = polygonPath,
                        color = color,
                        style = Stroke(width = 3.dp.toPx())
                    )

                    polygonPoints.forEach { point ->
                        drawCircle(
                            color = Color.White,
                            radius = 5.dp.toPx(),
                            center = point
                        )

                        drawCircle(
                            color = color,
                            radius = 3.dp.toPx(),
                            center = point
                        )
                    }
                }

                drawCircle(
                    color = color,
                    radius = 4.dp.toPx(),
                    center = center
                )
            }
        }
    }
}
private fun directionalAngleLabelLines(
    sector: DirectionalTargetSector
): List<String> {
    return listOf(
        "${sector.angle}°",
        sector.directionCode
    )
}
