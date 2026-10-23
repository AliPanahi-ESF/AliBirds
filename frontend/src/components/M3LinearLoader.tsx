import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/**
 * Google Material Design 3 Indeterminate Linear Progress Indicator
 *
 * Anchored to the top edge of the viewport (fixed top-0 left-0 right-0 z-[9999]).
 * Automatically activates during React Query background fetching or active mutations,
 * adhering to Material Design 3 motion timing and two-phase easing curves.
 */
export default function M3LinearLoader() {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const active = isFetching > 0 || isMutating > 0

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (active) {
      setVisible(true)
    } else {
      // Graceful M3 exit fade to avoid harsh flicker
      timeout = setTimeout(() => {
        setVisible(false)
      }, 200)
    }
    return () => clearTimeout(timeout)
  }, [active])

  if (!visible) return null

  return (
    <div
      role="progressbar"
      aria-label="Gegevens synchroniseren / Loading data..."
      aria-valuemin={0}
      aria-valuemax={100}
      className="m3-linear-loader transition-opacity duration-200"
      style={{ opacity: active ? 1 : 0 }}
    >
      <div className="m3-linear-bar-primary" />
      <div className="m3-linear-bar-secondary" />
    </div>
  )
}
