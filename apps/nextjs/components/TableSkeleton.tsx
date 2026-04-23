import { TableRow, TableCell } from '@/components/ui/table'

interface TableSkeletonProps {
  rows?: number
  columns: number
}

export function TableSkeleton({ rows = 10, columns }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`skeleton-${rowIndex}`}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
              <div className="h-4 bg-muted rounded" style={{ width: getColumnWidth(colIndex, columns) }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function getColumnWidth(colIndex: number, totalColumns: number): string {
  // Define different widths based on column position
  if (colIndex === 0) return '3rem' // Rank column
  if (colIndex === 1) return '8rem' // User column
  if (colIndex === totalColumns - 1) return '6rem' // Last column (usually actions)
  return '5rem' // Default width
}