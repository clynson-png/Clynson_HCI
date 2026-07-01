import Sidebar from '../components/Sidebar'
import { translations } from '../i18n/translations'

function MainLayout({ children, currentPage, onChangePage, lang, onToggleLang, authSession, onLogout, navigationItems, mobileMode = false }) {
  const t = translations[lang]

  return (
    <div className={`app-shell ${mobileMode ? 'app-shell-mobile' : ''}`}>
      <Sidebar
        currentPage={currentPage}
        onChangePage={onChangePage}
        lang={lang}
        items={navigationItems}
      />

      <div className="app-main">
        <div className="app-language-dock">
          {authSession && (
            <div className="app-user-chip">
              <span>{authSession.displayName}</span>
              <strong>{authSession.subscriptionTier}</strong>
            </div>
          )}
          <button className="language-button" onClick={onToggleLang}>
            {t.languageButton}
          </button>
          <button className="language-button logout-button" onClick={onLogout}>
            Sair
          </button>
        </div>

        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}

export default MainLayout
