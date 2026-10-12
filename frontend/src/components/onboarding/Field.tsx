import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ob-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Done({ provider, subtitle }: { provider: string; subtitle?: string }) {
  return (
    <div className="ob-done">
      <div className="ob-done__left">
        <CheckCircle2 size={22} className="ob-done__check" aria-hidden="true" />
        <div>
          <p>{provider}</p>
          {subtitle ? <small>{subtitle}</small> : <small>Connected and verified</small>}
        </div>
      </div>
    </div>
  );
}
