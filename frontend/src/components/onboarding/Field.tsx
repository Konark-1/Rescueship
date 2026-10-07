import React from 'react';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ob-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Done({ provider }: { provider: string }) {
  return (
    <div className="ob-done">
      <svg viewBox="0 0 24 24" className="ob-done__check">
        <path d="M5 13l4 4L19 7" />
      </svg>
      <p>{provider}</p>
    </div>
  );
}
