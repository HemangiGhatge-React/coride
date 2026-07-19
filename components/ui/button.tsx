import React from 'react'
import {cn} from '../../lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({className, children, ...props}: ButtonProps) {
  return (
    <button
      className={cn('px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-50 dark:text-zinc-900', className)}
      {...props}
    >
      {children}
    </button>
  )
}
