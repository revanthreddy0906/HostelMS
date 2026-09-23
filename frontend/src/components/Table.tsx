import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState, LoadingState } from './Feedback';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Right-align numeric columns (header and cells). */
  align?: 'left' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, rowKey, loading, emptyMessage = 'No records found.' }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                scope="col"
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-600 transition-colors duration-150 ease-out ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                } ${
                  col.sortValue ? 'cursor-pointer select-none hover:text-neutral-900' : ''
                }`}
              >
                {col.header}
                {sortKey === col.key && <span className="ml-1" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <LoadingState />
              </td>
            </tr>
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState title={emptyMessage} />
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors duration-150 ease-out hover:bg-neutral-50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle text-neutral-700 ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
