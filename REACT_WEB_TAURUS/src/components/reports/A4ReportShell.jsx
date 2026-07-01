function A4ReportShell({
  title,
  subtitle,
  athleteName,
  metaItems = [],
  metrics = [],
  diagnosis,
  recommendation,
  insights = [],
  footer,
  labels = {},
  children,
}) {
  const reportLabels = {
    kicker: 'HCI Performance',
    athlete: 'Atleta',
    context: 'Contexto',
    metrics: 'Metricas',
    diagnosis: 'Diagnostico',
    prescription: 'Prescricao',
    technicalReadings: 'Leituras tecnicas',
    reading: 'Leitura',
    fallbackFooter: 'Relatorio tecnico compacto para impressao A4.',
    ...labels,
  }

  return (
    <article className="a4-report-shell a4-report-print-root" aria-label={title}>
      <header className="a4-report-header">
        <div>
          <span className="a4-report-kicker">{reportLabels.kicker}</span>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="a4-report-athlete">
          <span>{reportLabels.athlete}</span>
          <strong>{athleteName || '-'}</strong>
        </div>
      </header>

      {metaItems.length > 0 && (
        <section className="a4-report-meta" aria-label={reportLabels.context}>
          {metaItems.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value || '-'}</strong>
            </div>
          ))}
        </section>
      )}

      {metrics.length > 0 && (
        <section className="a4-report-metrics" aria-label={reportLabels.metrics}>
          {metrics.slice(0, 6).map((metric) => (
            <div key={metric.label} className="a4-report-metric">
              <span>{metric.label}</span>
              <strong>{metric.value || '-'}</strong>
            </div>
          ))}
        </section>
      )}

      <main className="a4-report-main">
        {children && <section className="a4-report-visual">{children}</section>}

        <section className="a4-report-reading">
          {diagnosis && (
            <div className="a4-report-block a4-report-diagnosis">
              <span>{reportLabels.diagnosis}</span>
              <strong>{diagnosis.title || '-'}</strong>
              {diagnosis.body && <p>{diagnosis.body}</p>}
            </div>
          )}

          {recommendation && (
            <div className="a4-report-block">
              <span>{reportLabels.prescription}</span>
              <strong>{recommendation.title || '-'}</strong>
              {recommendation.body && <p>{recommendation.body}</p>}
            </div>
          )}
        </section>
      </main>

      {insights.length > 0 && (
        <section className="a4-report-insights" aria-label={reportLabels.technicalReadings}>
          {insights.slice(0, 3).map((insight, index) => (
            <div key={`${index}-${insight}`}>
              <span>{`${reportLabels.reading} ${index + 1}`}</span>
              <p>{insight}</p>
            </div>
          ))}
        </section>
      )}

      <footer className="a4-report-footer">
        <span>{footer || reportLabels.fallbackFooter}</span>
      </footer>
    </article>
  )
}

export default A4ReportShell
