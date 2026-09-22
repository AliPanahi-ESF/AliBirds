import React from 'react'

export function TableRowSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse border-b border-slate-800/40">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3.5">
              <div
                className="h-3.5 bg-slate-800/70 rounded"
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
    <div className="space-y-2.5 animate-pulse" role="status" aria-label="Gegevens laden...">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card p-3.5 space-y-3 bg-slate-900 border border-slate-800/60 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 w-2/3">
              <div className="h-3.5 bg-slate-800 rounded w-1/3" />
              <div className="h-4 bg-slate-800/80 rounded w-3/4" />
            </div>
            <div className="h-5 w-16 bg-slate-800 rounded-full" />
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <div className="h-3 bg-slate-800/60 rounded w-1/4" />
            <div className="h-4 bg-slate-800 rounded w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
