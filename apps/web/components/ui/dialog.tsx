import React from 'react'
import {cn} from '../../lib/utils'

export type DialogProps = React.HTMLAttributes<HTMLDivElement> & {open?: boolean}

export function Dialog({open, className, children, ...props}: DialogProps) {
  if (!open) return null
  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', className)} {...props}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative z-10 max-w-lg w-full p-6">
        <div className="rounded-lg bg-white p-4 shadow-lg dark:bg-zinc-900">
          {children}
        </div>
      </div>
    </div>
  )
}
