import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const PAGE_SIZES = [25, 50, 100];

export default function Pagination({ 
  totalItems, 
  currentPage, 
  pageSize, 
  onPageChange, 
  onPageSizeChange 
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (showEllipsisStart) {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
    }

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (showEllipsisEnd) {
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {startItem}-{endItem} of {totalItems}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '6px 10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.4 : 1,
            color: 'var(--text-primary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <FaChevronLeft style={{ fontSize: 10 }} /> Prev
        </button>

        {getPageNumbers().map((page, idx) => (
          page === '...' ? (
            <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)', fontSize: 12 }}>...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              style={{
                minWidth: 32,
                height: 32,
                padding: '0 8px',
                background: currentPage === page ? 'var(--accent)' : 'var(--bg-card)',
                color: currentPage === page ? '#0f172a' : 'var(--text-primary)',
                border: `1px solid ${currentPage === page ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: currentPage === page ? 700 : 400,
              }}
            >
              {page}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '6px 10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.4 : 1,
            color: 'var(--text-primary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Next <FaChevronRight style={{ fontSize: 10 }} />
        </button>
      </div>

      {onPageSizeChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {PAGE_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
