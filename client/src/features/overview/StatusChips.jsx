// Status count chips: icon in the status color, bold count, word, e.g. "✓ 31 OK"; the border
// takes the status color on hover. Tapping one narrows the overview (both sections) to that
// status, like the Branch and Type filters; tapping it again clears it.

import { STATUS_META, STATUS_ORDER } from '../../shared/status/status.js';
import { Chip, ChipGroup } from '../../shared/ui/Chip.jsx';
import { Icon } from '../../shared/ui/Icon.jsx';

/**
 * @param {{ counts: Record<string, number>, selected: string | null,
 *   onToggle: (status: string) => void }} props
 */
export function StatusChips({ counts, selected, onToggle }) {
  return (
    <ChipGroup label="Filter by status">
      {STATUS_ORDER.map((status) => (
        <Chip
          key={status}
          pressed={selected === status}
          tone={STATUS_META[status].color}
          onClick={() => onToggle(status)}
        >
          <span style={{ color: STATUS_META[status].color, display: 'inline-flex' }}>
            <Icon name={STATUS_META[status].icon} size={16} />
          </span>
          <b>{counts[status] ?? 0}</b> {STATUS_META[status].label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
