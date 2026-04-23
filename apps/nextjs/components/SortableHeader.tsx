import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface SortableHeaderProps<T extends string> {
  field: T
  sortBy: T
  sortOrder: 'asc' | 'desc'
  onSortChange: (field: T) => void
  children: React.ReactNode
}

export function SortableHeader<T extends string>({
  field,
  sortBy,
  sortOrder,
  onSortChange,
  children,
}: SortableHeaderProps<T>) {
  const isActive = sortBy === field

  const handleClick = () => {
    onSortChange(field)
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className="h-auto p-0 font-medium hover:bg-transparent"
    >
      {children}
      {isActive && (
        <span className="ml-1">
          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      )}
    </Button>
  )
}