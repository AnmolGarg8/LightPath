import React, { useState } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T, idx: number) => string;
  caption?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  caption,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(key);
      setSortAsc(true);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortCol) return 0;
    const aVal = (a as Record<string, unknown>)[sortCol];
    const bVal = (b as Record<string, unknown>)[sortCol];

    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const res = aVal < bVal ? -1 : 1;
    return sortAsc ? res : -res;
  });

  return (
    <div className="data-table-container" tabIndex={0} aria-label={caption || 'Data table'}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
          textAlign: 'left',
          minWidth: '550px',
        }}
      >
        {caption && (
          <caption
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 700,
              textAlign: 'left',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
            {columns.map((col) => {
              const isSorted = sortCol === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    textAlign: col.align || 'left',
                    width: col.width,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {col.header}
                    {col.sortable && (
                      <span aria-hidden="true" style={{ opacity: isSorted ? 1 : 0.4, fontSize: '0.8em' }}>
                        {isSorted ? (sortAsc ? '▲' : '▼') : '↕'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item, rowIdx)}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: rowIdx % 2 === 1 ? 'var(--bg-card-hover)' : 'transparent',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '0.75rem 1rem',
                      color: 'var(--text-secondary)',
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
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
