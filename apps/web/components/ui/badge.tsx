import React from 'react'
import {cn} from '../../lib/utils'

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** accent = the one highlight colour (e.g. Admin); neutral = everything else. */
  tone?: 'accent' | 'neutral'
}

const tones = {
  accent: 'bg-blue-50 text-blue-800 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
} as const

export function Badge({className, tone = 'neutral', children, ...props}: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}
      {...props}
    >
      {children}
    </span>
  )
}
