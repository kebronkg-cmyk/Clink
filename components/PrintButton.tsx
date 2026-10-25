"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-pink" onClick={() => window.print()}>
      Drucken
    </button>
  );
}
