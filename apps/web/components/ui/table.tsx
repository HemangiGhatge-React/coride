import React from 'react'
import {cn} from '../../lib/utils'

// Thin styled wrappers around real table elements, so the semantics (caption, th scope, rows)
// stay native. The wrapper scrolls horizontally on narrow screens instead of squashing columns.

export function Table({className, children, wrapperClassName, ...props}: React.TableHTMLAttributes<HTMLTableElement> & {wrapperClassName?: string}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-slate-200', wrapperClassName)}>
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableCaption({className, ...props}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('border-b border-slate-200 px-4 py-3 text-left text-sm text-slate-600', className)} {...props} />
}

export function TableHead({className, scope = 'col', ...props}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope={scope} className={cn('bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500', className)} {...props} />
  )
}

export function TableRow({className, ...props}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-t border-slate-200 first:border-t-0', className)} {...props} />
}

export function TableCell({className, ...props}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-slate-800', className)} {...props} />
}
