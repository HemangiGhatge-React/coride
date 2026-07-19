import React from 'react'
import {cn} from '../../lib/utils'

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({className, children, ...props}: CardProps) {
  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-700', className)} {...props}>
      {children}
    </div>
  )
}
