import React from 'react'
import {cn} from '../../lib/utils'

export type TabsProps = React.HTMLAttributes<HTMLDivElement>

export function Tabs({className, children, ...props}: TabsProps) {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      {children}
    </div>
  )
}
