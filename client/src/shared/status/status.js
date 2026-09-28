// Status wording (docs/design/ui.md, "Status system"): never color alone, always icon + word +
// value. Order and thresholds come from @chilllog/shared, so the UI can't drift from detection.

import { STATUS_ORDER, THRESHOLDS } from '@chilllog/shared';
import { formatDurationShort, formatTemp, formatTempChange } from '../format/format.js';

export { STATUS_ORDER };

/**
 * Word, icon and color for each status. Icon names match shared/ui/Icon.jsx; color is the
 * strong status token from tokens.css, for marks drawn outside a pill (chip icons, chart dots).
 */
export const STATUS_META = Object.freeze({
  alert: { label: 'Alert', icon: 'alert', color: 'var(--alert)' },
  warming: { label: 'Warming', icon: 'warming', color: 'var(--warm)' },
  gap: { label: 'Gap', icon: 'gap', color: 'var(--gap)' },
  no_file: { label: 'No file', icon: 'nofile', color: 'var(--nofile)' },
  ok: { label: 'OK', icon: 'ok', color: 'var(--ok)' },
});

/**
 * The full pill text for one fridge from GET /api/overview, e.g. "Alert · 7.1°C · 2d 9h 15m".
 * @param {{ status: keyof typeof STATUS_META, noLogger: boolean,
 *   latest: { tempC: number } | null,
 *   alert: { peakC: number, totalMinutes: number } | null,
 *   warming: { latestC: number, riseC: number } | null,
 *   gap: { totalMinutes: number } | null }} fridge
 */
export function describeStatus(fridge) {
  switch (fridge.status) {
    case 'alert':
      return `Alert · ${formatTemp(fridge.alert.peakC)} · ${formatDurationShort(fridge.alert.totalMinutes)}`;
    case 'warming':
      return `Warming · ${formatTemp(fridge.warming.latestC)}, ${formatTempChange(fridge.warming.riseC)} in ${THRESHOLDS.warming.windowHours}h`;
    case 'gap':
      return `Gap · ${formatDurationShort(fridge.gap.totalMinutes)} missing`;
    case 'no_file':
      return fridge.noLogger ? 'No file · no logger yet' : 'No file this week';
    default:
      return fridge.latest ? `OK · ${formatTemp(fridge.latest.tempC)}` : 'OK';
  }
}
