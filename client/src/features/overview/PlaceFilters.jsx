// Branch and Type filters for the overview (native selects, so phones open their own picker).
// Both live in the URL (?branch=4&type=Display) like the status filter.

import button from '../../shared/ui/button.module.css';
import { FormField } from '../../shared/ui/FormField.jsx';
import styles from './PlaceFilters.module.css';

/**
 * @param {{ branches: { id: number, name: string }[], types: string[],
 *   branchId: number | null, type: string | null,
 *   onChange: (name: 'branch' | 'type', value: string | null) => void,
 *   onClear: () => void }} props
 */
export function PlaceFilters({ branches, types, branchId, type, onChange, onClear }) {
  return (
    <div className={styles.row}>
      <FormField id="overview-branch" label="Branch" className={styles.field}>
        <select
          id="overview-branch"
          value={branchId ?? ''}
          onChange={(e) => onChange('branch', e.target.value || null)}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="overview-type" label="Type of fridge" className={styles.field}>
        <select
          id="overview-type"
          value={type ?? ''}
          onChange={(e) => onChange('type', e.target.value || null)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>
      {(branchId !== null || type !== null) && (
        <button
          type="button"
          className={`${button.button} ${button.link} ${styles.clear}`}
          onClick={onClear}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
