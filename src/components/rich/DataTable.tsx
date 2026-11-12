import React, { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
}

export const DataTable: React.FC<DataTableProps> = ({ children, className = '', ...props }) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyCSV = async () => {
    if (!tableRef.current) return;
    try {
      const rows = Array.from(tableRef.current.querySelectorAll('tr'));
      const csvLines = rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells
          .map((cell) => {
            const raw = (cell.textContent || '').trim();
            if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
              return `"${raw.replace(/"/g, '""')}"`;
            }
            return raw;
          })
          .join(',');
      });

      const csvData = csvLines.join('\n');
      await navigator.clipboard.writeText(csvData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy CSV:', err);
    }
  };

  return (
    <div
      data-testid="table-container"
      className="table-container group/table relative my-4 overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-low shadow-sm"
      style={{ overflowX: 'auto' }}
    >
      {/* Floating Copy CSV Action on Hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/table:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        <button
          type="button"
          data-testid="copy-table-csv-btn"
          aria-label="Copy table as CSV"
          onClick={handleCopyCSV}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-container-highest/95 hover:bg-surface-container-highest text-on-surface shadow-md backdrop-blur border border-outline-variant/40 transition-all select-none"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Copied CSV</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-outline" />
              <span>Copy as CSV</span>
            </>
          )}
        </button>
      </div>

      <table
        data-testid="data-table"
        ref={tableRef}
        className={`w-full border-collapse text-left text-sm ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};
