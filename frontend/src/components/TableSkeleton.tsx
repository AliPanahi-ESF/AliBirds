import React from 'react'

export function TableRowSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-slate-800/40">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3.5">
              <div
                className="h-3.5 m3-skeleton-shimmer rounded-lg"
                style={{
                  width: cIdx === 0 ? '60%' : cIdx === cols - 1 ? '40%' : `${45 + ((rIdx * 17 + cIdx * 23) % 40)}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Gegevens laden...">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card p-3.5 space-y-3 bg-slate-900 border border-slate-800/60 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 w-2/3">
              <div className="h-3.5 m3-skeleton-shimmer rounded-md w-1/3" />
              <div className="h-4 m3-skeleton-shimmer rounded-md w-3/4" />
            </div>
            <div className="h-5 w-16 m3-skeleton-shimmer rounded-full" />
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <div className="h-3 m3-skeleton-shimmer rounded-md w-1/4" />
            <div className="h-4 m3-skeleton-shimmer rounded-md w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

