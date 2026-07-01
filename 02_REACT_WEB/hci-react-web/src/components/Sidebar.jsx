import { translations } from '../i18n/translations'

function Sidebar({ currentPage, onChangePage, lang }) {
  const t = translations[lang]

  const items = [
    { id: 'Resumo', label: t.sidebar.resumo },
    { id: 'Athlete', label: t.sidebar.athlete },
    { id: 'CrossAnalysis', label: t.sidebar.crossAnalysis },
    { id: 'Admin', label: t.sidebar.admin },
    { id: 'Relatorio', label: t.sidebar.relatorio },
    { id: 'Indices', label: t.sidebar.indices },
    { id: 'Ritmo', label: t.sidebar.ritmo },
    { id: 'Plano', label: t.sidebar.plano },
    { id: 'Library', label: t.sidebar.library },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <small>HCI</small>
        <strong>React Web</strong>
      </div>

      <nav>
        {items.map((item) => (
          <button
            key={item.id}
            className={currentPage === item.id ? 'active' : ''}
            onClick={() => onChangePage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
