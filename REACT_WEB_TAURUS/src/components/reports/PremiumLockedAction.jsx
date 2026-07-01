function PremiumLockedAction({
  label = 'PDF Premium',
  lockedLabel = 'PDF Premium',
  description = 'Recurso disponivel para assinantes premium.',
  allowed = false,
  disabled = false,
  onClick,
  className = '',
}) {
  if (allowed) {
    return (
      <button
        type="button"
        className={`taurus-pdf-button ${className}`.trim()}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`taurus-pdf-button premium-locked-action ${className}`.trim()}
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.alert(description)
        }
      }}
      aria-label={description}
      title={description}
    >
      <span>{lockedLabel}</span>
      <small>Premium</small>
    </button>
  )
}

export default PremiumLockedAction
