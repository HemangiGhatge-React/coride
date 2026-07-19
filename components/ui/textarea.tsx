import React from 'react'
import {cn} from '../../lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({className, ...props}: TextareaProps) {
  return (
    <textarea
      className={cn('w-full min-h-[80px] rounded-md border px-3 py-2 bg-white text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-zinc-800 dark:text-zinc-50 dark:border-zinc-700', className)}
      {...props}
    />
  )
}
