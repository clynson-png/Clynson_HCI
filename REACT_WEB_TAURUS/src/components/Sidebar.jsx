import { translations } from '../i18n/translations'

function Sidebar({ currentPage, onChangePage, lang, items: providedItems }) {
  const t = translations[lang] || translations.pt

  const items = providedItems || [
    { id: 'Resumo', label: t.sidebar.resumo },
    { id: 'Admin', label: t.sidebar.admin },
    { id: 'Taurus', label: t.sidebar.taurusTarget },
    { id: 'SmartChart', label: t.sidebar.smartChart },
    { id: 'Plano', label: t.sidebar.plano },
    { id: 'Library', label: t.sidebar.library },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <small>HCI</small>
        <strong>TAURUS</strong>
      </div>

      <nav className="sidebar-nav" aria-label={t.sidebar.ariaLabel}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-link ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onChangePage(item.id)}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
