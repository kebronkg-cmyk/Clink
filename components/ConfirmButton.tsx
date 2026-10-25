"use client";

/** Submit-Button mit Rückfrage, für endgültige Aktionen. */
export function ConfirmButton({ children, message, style, className = "btn btn-ghost" }: { children: React.ReactNode; message: string; style?: React.CSSProperties; className?: string }) {
  return (
    <button
      className={className}
      style={style}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
