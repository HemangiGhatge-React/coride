import React from 'react'
import {cn} from '../../lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary = the one accent colour; secondary = quiet, for everything else. */
  variant?: 'primary' | 'secondary'
}

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-transparent',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
} as const

export function Button({className, children, variant = 'primary', ...props}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
