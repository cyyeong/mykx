"use client";

// Opens the browser's print dialog ("Save as PDF" is one of its printers). The document title becomes the
// suggested file name while the dialog is open.
export function PrintButton({ filename }: { filename: string }) {
  return (
    <button
      type="button"
      className="mk-btn mk-btn--primary pp-print"
      onClick={() => {
        const before = document.title;
        document.title = filename;
        window.print();
        document.title = before;
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z"
        />
      </svg>
      Print or save as PDF
    </button>
  );
}
