import React from 'react'
import {cn} from '../../lib/utils'

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>

export function ScrollArea({className, children, ...props}: ScrollAreaProps) {
  return (
    <div className={cn('overflow-auto', className)} {...props}>
      {children}
    </div>
  )
}
