// Range chips (Last 24h · 7 days · 30 days · Custom); Custom opens two native date inputs, which
// bring up the phone's own date picker. The range lives in the URL.

import { toIsraelLocal } from '../../shared/format/format.js';
import { Chip, ChipGroup } from '../../shared/ui/Chip.jsx';
import { RANGE_PRESETS } from './rangeModel.js';
import styles from './RangePicker.module.css';

const DAY_MS = 86_400_000;
const israelDate = (date) => toIsraelLocal(date).slice(0, 10);

/**
 * @param {{ range: import('./rangeModel.js').Range,
 *   onChange: (range: import('./rangeModel.js').Range, options?: { replace?: boolean }) => void }} props
 */
export function RangePicker({ range, onChange }) {
  const today = israelDate(new Date());

  function chooseCustom() {
    if (range.kind === 'custom') return;
    onChange({
      kind: 'custom',
      from: israelDate(new Date(Date.now() - 6 * DAY_MS)),
      to: today,
    });
  }

  return (
    <div className={styles.picker}>
      <ChipGroup label="Date range">
        {RANGE_PRESETS.map((preset) => (
          <Chip
            key={preset.key}
            pressed={range.kind === 'preset' && range.key === preset.key}
            onClick={() => onChange({ kind: 'preset', key: preset.key })}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip pressed={range.kind === 'custom'} onClick={chooseCustom}>
          Custom
        </Chip>
      </ChipGroup>

      {range.kind === 'custom' && (
        <div className={styles.custom}>
          <div className={styles.field}>
            <label htmlFor="range-from">From</label>
            <input
              id="range-from"
              type="date"
              value={range.from}
              max={today}
              onChange={(e) => onChange({ ...range, from: e.target.value }, { replace: true })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="range-to">To</label>
            <input
              id="range-to"
              type="date"
              value={range.to}
              max={today}
              onChange={(e) => onChange({ ...range, to: e.target.value }, { replace: true })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
