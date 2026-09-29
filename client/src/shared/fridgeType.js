/**
 * A fridge's type, from its name: numbered fridges are one type ("Display 1", "Display 2" →
 * "Display"); every other name is its own type. There's no stored type, so a new fridge name
 * becomes a new type by itself. Used by the Overview and the Loggers table filters.
 * @param {string} name
 */
export function fridgeType(name) {
  return name.trim().replace(/\s+\d+$/, '');
}
