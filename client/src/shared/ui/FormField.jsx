// A labelled form field (docs/design/ui.md, "Form field"): label, the control, an optional hint
// and the error, tied together for screen readers with aria-describedby.

import field from './field.module.css';

/** The ids a control should list in aria-describedby. */
export function describedBy(id, { hint, error }) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

/**
 * @param {{ id: string, label: string, hint?: string, error?: string, className?: string,
 *   children: React.ReactNode }} props children is the input or select, with this id
 */
export function FormField({ id, label, hint, error, className = '', children }) {
  return (
    <div className={`${field.field} ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={field.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={field.error}>
          {error}
        </p>
      )}
    </div>
  );
}
