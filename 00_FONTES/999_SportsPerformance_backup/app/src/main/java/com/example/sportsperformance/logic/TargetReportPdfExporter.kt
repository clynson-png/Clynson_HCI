package com.example.sportsperformance.logic

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color as AndroidColor
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.example.sportsperformance.R
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.ui.screen.TargetReportPayload
import java.io.File
import kotlin.math.cos
import kotlin.math.sin

class TargetReportPdfExporter(private val context: Context) {

    fun exportAndOpen(payload: TargetReportPayload) {
        val file = writePdf(payload)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(
            Intent.createChooser(
                intent,
                if (payload.language == AppLanguage.PT) "Abrir relatório em PDF" else "Open PDF report"
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    private fun writePdf(payload: TargetReportPayload): File {
        val document = PdfDocument()
        val isPt = payload.language == AppLanguage.PT

        val headlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = 22f
            isFakeBoldText = true
        }
        val sectionTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(15, 23, 42)
            textSize = 14f
            isFakeBoldText = true
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(51, 65, 85)
            textSize = 10.5f
        }
        val bodyStrongPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(15, 23, 42)
            textSize = 10.5f
            isFakeBoldText = true
        }
        val whiteBodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(226, 232, 240)
            textSize = 10.5f
        }
        val whiteOverlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(245, 158, 11)
            textSize = 10f
            isFakeBoldText = true
        }
        val goldFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(245, 158, 11)
            style = Paint.Style.FILL
        }
        val goldStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(245, 158, 11)
            style = Paint.Style.STROKE
            strokeWidth = 2f
        }
        val panelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(248, 250, 252)
            style = Paint.Style.FILL
        }
        val darkPanelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(15, 23, 42)
            style = Paint.Style.FILL
        }
        val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.argb(60, 71, 85, 105)
            strokeWidth = 1f
        }
        val radarFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.argb(120, 245, 158, 11)
            style = Paint.Style.FILL
        }
        val radarStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(180, 83, 9)
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }

        fun newPage(pageNumber: Int): PdfDocument.Page {
            return document.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNumber).create())
        }

        val page1 = newPage(1)
        val canvas1 = page1.canvas
        drawPremiumBackground(canvas1, 595f, 842f)
        drawHeader(canvas1, payload, isPt, headlinePaint, whiteBodyPaint, whiteOverlinePaint)
        drawSummaryPage(
            canvas = canvas1,
            payload = payload,
            isPt = isPt,
            sectionTitlePaint = sectionTitlePaint,
            bodyPaint = bodyPaint,
            bodyStrongPaint = bodyStrongPaint,
            panelPaint = panelPaint,
            goldFillPaint = goldFillPaint,
            dividerPaint = dividerPaint
        )
        document.finishPage(page1)

        val page2 = newPage(2)
        val canvas2 = page2.canvas
        drawPremiumBackground(canvas2, 595f, 842f)
        drawSectionBanner(
            canvas = canvas2,
            title = if (isPt) "Leitura inteligente" else "Intelligence reading",
            subtitle = if (isPt) "Insight e treino recomendado para o atleta" else "Insight and recommended practice for the athlete",
            headlinePaint = headlinePaint,
            bodyPaint = whiteBodyPaint
        )
        drawInsightsPage(
            canvas = canvas2,
            payload = payload,
            isPt = isPt,
            sectionTitlePaint = sectionTitlePaint,
            bodyPaint = bodyPaint,
            bodyStrongPaint = bodyStrongPaint,
            panelPaint = panelPaint,
            goldStrokePaint = goldStrokePaint
        )
        document.finishPage(page2)

        val page3 = newPage(3)
        val canvas3 = page3.canvas
        drawPremiumBackground(canvas3, 595f, 842f)
        drawSectionBanner(
            canvas = canvas3,
            title = if (isPt) "Radar de impacto" else "Impact radar",
            subtitle = if (isPt) "Distribuição radial igual a leitura visual do app" else "Radial distribution matching the app visual reading",
            headlinePaint = headlinePaint,
            bodyPaint = whiteBodyPaint
        )
        drawRadarPage(
            canvas = canvas3,
            payload = payload,
            isPt = isPt,
            sectionTitlePaint = sectionTitlePaint,
            bodyPaint = bodyPaint,
            panelPaint = panelPaint,
            darkPanelPaint = darkPanelPaint,
            dividerPaint = dividerPaint,
            radarFillPaint = radarFillPaint,
            radarStrokePaint = radarStrokePaint
        )
        document.finishPage(page3)

        val reportsDir = File(context.cacheDir, "mvp_reports").apply { mkdirs() }
        val file = File(reportsDir, "hci_target_report_${System.currentTimeMillis()}.pdf")
        file.outputStream().use { document.writeTo(it) }
        document.close()
        return file
    }

    private fun drawPremiumBackground(
        canvas: android.graphics.Canvas,
        pageWidth: Float,
        pageHeight: Float
    ) {
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(239, 244, 250)
        }
        canvas.drawRect(0f, 0f, pageWidth, pageHeight, bgPaint)
        val topBand = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(11, 18, 32)
        }
        canvas.drawRect(0f, 0f, pageWidth, 128f, topBand)
        val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.argb(28, 245, 158, 11)
        }
        canvas.drawCircle(pageWidth - 44f, 60f, 120f, accentPaint)
        canvas.drawCircle(pageWidth - 12f, pageHeight - 8f, 150f, accentPaint)
    }

    private fun drawHeader(
        canvas: android.graphics.Canvas,
        payload: TargetReportPayload,
        isPt: Boolean,
        headlinePaint: Paint,
        bodyPaint: Paint,
        overlinePaint: Paint
    ) {
        BitmapFactory.decodeResource(context.resources, R.drawable.ic_hci_app)?.let { logo ->
            canvas.drawBitmap(logo, null, android.graphics.Rect(36, 28, 104, 96), null)
        }
        canvas.drawText("HCI Performance Intelligence", 120f, 52f, headlinePaint)
        canvas.drawText(
            if (isPt) "RELATÓRIO PREMIUM DO MVP" else "MVP PREMIUM REPORT",
            120f,
            76f,
            overlinePaint
        )
        canvas.drawText(
            if (isPt) "Leitura comercial pronta para o atleta" else "Commercial-ready reading for the athlete",
            120f,
            98f,
            bodyPaint
        )
        val badgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(245, 158, 11)
        }
        val badgeRect = RectF(420f, 32f, 548f, 70f)
        canvas.drawRoundRect(badgeRect, 18f, 18f, badgePaint)
        val badgeText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(17, 24, 39)
            textSize = 11f
            isFakeBoldText = true
        }
        canvas.drawText(if (isPt) "PDF GIFT HCI" else "HCI PDF GIFT", 434f, 55f, badgeText)
        canvas.drawText(payload.reportTitle, 36f, 154f, Paint(headlinePaint).apply {
            color = AndroidColor.rgb(15, 23, 42)
            textSize = 18f
        })
    }

    private fun drawSummaryPage(
        canvas: android.graphics.Canvas,
        payload: TargetReportPayload,
        isPt: Boolean,
        sectionTitlePaint: Paint,
        bodyPaint: Paint,
        bodyStrongPaint: Paint,
        panelPaint: Paint,
        goldFillPaint: Paint,
        dividerPaint: Paint
    ) {
        val leftPanel = RectF(36f, 184f, 280f, 382f)
        val rightPanel = RectF(298f, 184f, 559f, 382f)
        val bottomPanel = RectF(36f, 404f, 559f, 760f)
        canvas.drawRoundRect(leftPanel, 24f, 24f, panelPaint)
        canvas.drawRoundRect(rightPanel, 24f, 24f, panelPaint)
        canvas.drawRoundRect(bottomPanel, 24f, 24f, panelPaint)

        canvas.drawText(if (isPt) "Resumo da coleta" else "Session summary", 56f, 220f, sectionTitlePaint)
        var y = 248f
        listOf(
            (if (isPt) "Atleta" else "Athlete") to payload.athleteName,
            (if (isPt) "Evento" else "Event") to payload.eventLabel,
            (if (isPt) "Ambiente" else "Environment") to payload.sessionLabel,
            (if (isPt) "Disparos previstos" else "Planned shots") to payload.totalShots.toString()
        ).forEach { (label, value) ->
            canvas.drawText("$label:", 56f, y, bodyStrongPaint)
            canvas.drawText(value, 152f, y, bodyPaint)
            y += 24f
        }

        canvas.drawText(if (isPt) "Entrega premium" else "Premium delivery", 318f, 220f, sectionTitlePaint)
        canvas.drawRoundRect(RectF(318f, 240f, 539f, 276f), 18f, 18f, goldFillPaint)
        val badgeTextPaint = Paint(bodyStrongPaint).apply {
            color = AndroidColor.rgb(17, 24, 39)
            textSize = 11f
        }
        canvas.drawText(if (isPt) "Análise visual + treino + PDF" else "Visual analysis + training + PDF", 334f, 262f, badgeTextPaint)

        var statY = 308f
        payload.officialMetrics.take(4).forEach { (label, value) ->
            canvas.drawText(label, 318f, statY, bodyStrongPaint)
            canvas.drawText(value, 460f, statY, bodyPaint)
            statY += 22f
        }

        canvas.drawText(if (isPt) "Radar direcional" else "Directional radar", 56f, 440f, sectionTitlePaint)
        canvas.drawText(
            if (isPt) "As linhas abaixo resumem o padrão principal encontrado." else "The rows below summarize the main pattern found.",
            56f,
            460f,
            bodyPaint
        )
        canvas.drawLine(56f, 476f, 539f, 476f, dividerPaint)
        canvas.drawText(if (isPt) "Zona" else "Zone", 56f, 500f, bodyStrongPaint)
        canvas.drawText(if (isPt) "Percentual" else "Percentage", 206f, 500f, bodyStrongPaint)
        canvas.drawText(if (isPt) "Leitura" else "Reading", 336f, 500f, bodyStrongPaint)
        canvas.drawLine(56f, 508f, 539f, 508f, dividerPaint)

        var rowY = 534f
        payload.percentages.take(6).forEachIndexed { index, (label, value) ->
            canvas.drawText(label, 56f, rowY, bodyPaint)
            canvas.drawText("$value%", 206f, rowY, bodyStrongPaint)
            val reading = payload.directionalRows.getOrNull(index)?.getOrNull(4) ?: "-"
            drawParagraph(canvas, reading, 336f, rowY, 185f, bodyPaint)
            rowY += 34f
        }
    }

    private fun drawInsightsPage(
        canvas: android.graphics.Canvas,
        payload: TargetReportPayload,
        isPt: Boolean,
        sectionTitlePaint: Paint,
        bodyPaint: Paint,
        bodyStrongPaint: Paint,
        panelPaint: Paint,
        goldStrokePaint: Paint
    ) {
        val insightPanel = RectF(36f, 176f, 559f, 468f)
        val trainingPanel = RectF(36f, 492f, 559f, 760f)
        canvas.drawRoundRect(insightPanel, 24f, 24f, panelPaint)
        canvas.drawRoundRect(trainingPanel, 24f, 24f, panelPaint)
        canvas.drawRoundRect(RectF(58f, 202f, 210f, 236f), 16f, 16f, goldStrokePaint)
        canvas.drawText(if (isPt) "Insight central" else "Core insight", 74f, 224f, bodyStrongPaint)
        var y = 266f
        payload.insights.take(4).forEachIndexed { index, insight ->
            canvas.drawText("${index + 1}.", 60f, y, bodyStrongPaint)
            y = drawParagraph(canvas, insight, 82f, y, 440f, bodyPaint) + 18f
        }

        canvas.drawText(if (isPt) "Treino premium sugerido" else "Suggested premium training", 56f, 530f, sectionTitlePaint)
        canvas.drawText(payload.trainingTitle, 56f, 558f, bodyStrongPaint)
        y = drawParagraph(canvas, payload.trainingDescription, 56f, 584f, 468f, bodyPaint) + 24f
        canvas.drawText(
            if (isPt) "Frase-chave para o atleta" else "Key phrase for the athlete",
            56f,
            y,
            sectionTitlePaint
        )
        y += 24f
        drawParagraph(canvas, payload.keyPhrase, 56f, y, 468f, bodyPaint)
    }

    private fun drawRadarPage(
        canvas: android.graphics.Canvas,
        payload: TargetReportPayload,
        isPt: Boolean,
        sectionTitlePaint: Paint,
        bodyPaint: Paint,
        panelPaint: Paint,
        darkPanelPaint: Paint,
        dividerPaint: Paint,
        radarFillPaint: Paint,
        radarStrokePaint: Paint
    ) {
        val radarPanel = RectF(36f, 176f, 380f, 760f)
        val legendPanel = RectF(400f, 176f, 559f, 760f)
        canvas.drawRoundRect(radarPanel, 24f, 24f, panelPaint)
        canvas.drawRoundRect(legendPanel, 24f, 24f, darkPanelPaint)
        canvas.drawText(if (isPt) "Gráfico radial" else "Radial chart", 56f, 214f, sectionTitlePaint)
        canvas.drawText(
            if (isPt) "Mesmo eixo visual usado no app." else "Same visual axis used inside the app.",
            56f,
            236f,
            bodyPaint
        )
        drawRadar(
            canvas = canvas,
            payload = payload,
            cx = 208f,
            cy = 466f,
            radius = 150f,
            bodyPaint = bodyPaint,
            dividerPaint = dividerPaint,
            fillPaint = radarFillPaint,
            strokePaint = radarStrokePaint
        )

        val whiteTitle = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = 13f
            isFakeBoldText = true
        }
        val whiteBody = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.rgb(226, 232, 240)
            textSize = 10f
        }
        canvas.drawText(if (isPt) "Legenda executiva" else "Executive legend", 420f, 214f, whiteTitle)
        var y = 246f
        payload.percentages.take(6).forEach { (label, value) ->
            canvas.drawText(label, 420f, y, whiteTitle)
            canvas.drawText("$value%", 510f, y, whiteBody)
            y += 26f
        }
        y += 18f
        canvas.drawText(if (isPt) "Uso comercial" else "Commercial use", 420f, y, whiteTitle)
        y += 24f
        drawParagraph(
            canvas,
            if (isPt) {
                "Use este PDF como entrega premium do plano MVP para reforçar percepção de valor, clareza técnica e próximo passo de treino."
            } else {
                "Use this PDF as a premium MVP delivery to reinforce perceived value, technical clarity, and the next training step."
            },
            420f,
            y,
            116f,
            whiteBody
        )
    }

    private fun drawSectionBanner(
        canvas: android.graphics.Canvas,
        title: String,
        subtitle: String,
        headlinePaint: Paint,
        bodyPaint: Paint
    ) {
        canvas.drawText(title, 36f, 102f, headlinePaint)
        canvas.drawText(subtitle, 36f, 124f, bodyPaint)
    }

    private fun drawRadar(
        canvas: android.graphics.Canvas,
        payload: TargetReportPayload,
        cx: Float,
        cy: Float,
        radius: Float,
        bodyPaint: Paint,
        dividerPaint: Paint,
        fillPaint: Paint,
        strokePaint: Paint
    ) {
        val gridPaint = Paint(dividerPaint).apply {
            pathEffect = DashPathEffect(floatArrayOf(8f, 6f), 0f)
        }
        repeat(4) { index ->
            canvas.drawCircle(cx, cy, radius * (index + 1) / 4f, gridPaint)
        }
        val points = payload.directionalRows.take(8)
        val polygon = Path()
        points.forEachIndexed { index, row ->
            val angleDeg = row.getOrNull(1)
                ?.replace("Â°", "")
                ?.replace("Ã‚", "")
                ?.trim()
                ?.toFloatOrNull()
                ?: (index * 45f)
            val pct = row.getOrNull(3)?.replace("%", "")?.trim()?.toFloatOrNull() ?: 0f
            val angleRad = Math.toRadians(angleDeg.toDouble())
            val r = radius * (pct / 100f)
            val x = cx + (cos(angleRad) * r).toFloat()
            val y = cy - (sin(angleRad) * r).toFloat()
            if (index == 0) polygon.moveTo(x, y) else polygon.lineTo(x, y)
            canvas.drawLine(
                cx,
                cy,
                cx + (cos(angleRad) * radius).toFloat(),
                cy - (sin(angleRad) * radius).toFloat(),
                gridPaint
            )
            val labelX = cx + (cos(angleRad) * (radius + 24f)).toFloat()
            val labelY = cy - (sin(angleRad) * (radius + 24f)).toFloat()
            canvas.drawText(row.getOrNull(2) ?: "", labelX, labelY, bodyPaint)
        }
        polygon.close()
        canvas.drawPath(polygon, fillPaint)
        canvas.drawPath(polygon, strokePaint)
        canvas.drawCircle(cx, cy, 4f, strokePaint)
    }

    private fun drawParagraph(
        canvas: android.graphics.Canvas,
        text: String,
        x: Float,
        startY: Float,
        width: Float,
        paint: Paint
    ): Float {
        val words = text.split(" ")
        var line = ""
        var y = startY
        for (word in words) {
            val test = if (line.isEmpty()) word else "$line $word"
            if (paint.measureText(test) > width) {
                canvas.drawText(line, x, y, paint)
                y += 15f
                line = word
            } else {
                line = test
            }
        }
        if (line.isNotEmpty()) {
            canvas.drawText(line, x, y, paint)
        }
        return y
    }
}
