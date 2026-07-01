import Sidebar from '../components/Sidebar'
import { translations } from '../i18n/translations'

function MainLayout({ children, currentPage, onChangePage, lang, onToggleLang }) {
  const t = translations[lang]

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        onChangePage={onChangePage}
        lang={lang}
      />

      <div className="app-main">
        <div className="global-topbar">
          <div>
            <small>{t.system}</small>
            <strong>{t.appName}</strong>
          </div>

          <button className="language-button" onClick={onToggleLang}>
            {t.languageButton}
          </button>
        </div>

        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}

export default MainLayout