'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  header?: ReactNode
  label?: ReactNode
  cell?: (row: T) => ReactNode
  render?: (row: T) => ReactNode
  accessor?: (row: T) => unknown
  sortValue?: (row: T) => string | number
  searchValue?: (row: T) => string
  sortable?: boolean
  className?: string
}

interface CursorPagination {
  nextCursor?: string | null
  previousCursor?: string | null
  hasMore?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data?: T[]
  rows?: T[]
  loading?: boolean
  getRowKey?: (row: T, index: number) => string
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearch?: (query: string) => void
  onSearchChange?: (query: string) => void
  pagination?: CursorPagination
  onNextPage?: () => void
  onPreviousPage?: () => void
}

type SortDirection = 'asc' | 'desc'

function getColumnValue<T>(column: DataTableColumn<T>, row: T) {
  if (column.accessor) return column.accessor(row)

  const key = column.key as keyof T
  return row[key]
}

function normalizeSortValue(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value.toLowerCase()
  if (value instanceof Date) return value.getTime()
  if (value == null) return ''
  return String(value).toLowerCase()
}

export function DataTable<T>({
  columns,
  data,
  rows,
  loading = false,
  getRowKey,
  emptyState,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearch,
  onSearchChange,
  pagination,
  onNextPage,
  onPreviousPage,
}: DataTableProps<T>) {
  const dataset = data ?? rows ?? []
  const [internalSearch, setInternalSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const activeSearch = searchValue ?? internalSearch

  function handleSearchChange(value: string) {
    if (searchValue === undefined) {
      setInternalSearch(value)
    }

    onSearchChange?.(value)
    onSearch?.(value)
  }

  function handleSort(columnKey: string) {
    if (sortKey === columnKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(columnKey)
    setSortDirection('asc')
  }

  const filteredRows = useMemo(() => {
    const search = activeSearch.trim().toLowerCase()
    let nextRows = dataset

    if (search) {
      nextRows = nextRows.filter((row) =>
        columns.some((column) => {
          const rawValue = column.searchValue
            ? column.searchValue(row)
            : getColumnValue(column, row)

          return String(rawValue ?? '').toLowerCase().includes(search)
        }),
      )
    }

    if (sortKey) {
      const sortColumn = columns.find((column) => column.key === sortKey)

      if (sortColumn) {
        nextRows = [...nextRows].sort((left, right) => {
          const leftValue = sortColumn.sortValue
            ? sortColumn.sortValue(left)
            : normalizeSortValue(getColumnValue(sortColumn, left))
          const rightValue = sortColumn.sortValue
            ? sortColumn.sortValue(right)
            : normalizeSortValue(getColumnValue(sortColumn, right))

          if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1
          if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1
          return 0
        })
      }
    }

    return nextRows
  }, [activeSearch, columns, dataset, sortDirection, sortKey])

  const showPagination = Boolean(pagination || onNextPage || onPreviousPage)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {searchable ? (
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={activeSearch}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow className="hover:bg-slate-50/80">
            {columns.map((column) => (
              <TableHead key={column.key} className={cn('px-4 py-3', column.className)}>
                {column.sortable ? (
                  <button
                    className="inline-flex items-center gap-2 text-left font-medium text-slate-700 transition hover:text-slate-950"
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label ?? column.header ?? column.key}
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                ) : (
                  <span>{column.label ?? column.header ?? column.key}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading
            ? Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={`loading-${rowIndex}`}>
                  {columns.map((column) => (
                    <TableCell key={`${column.key}-${rowIndex}`} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[12rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : filteredRows.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                    {emptyState ?? 'No data available.'}
                  </TableCell>
                </TableRow>
                )
              : filteredRows.map((row, index) => (
                <TableRow
                  key={getRowKey ? getRowKey(row, index) : String((row as any)?.id ?? index)}
                  className={cn(onRowClick ? 'cursor-pointer' : '')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn('px-4 py-3', column.className)}>
                      {column.cell
                        ? column.cell(row)
                        : column.render
                          ? column.render(row)
                          : String(getColumnValue(column, row) ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {showPagination ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing {filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={!onPreviousPage || !pagination?.previousCursor}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={!onNextPage || !pagination?.hasMore}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
