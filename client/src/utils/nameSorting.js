/**
 * Utility functions for sorting and formatting employee names by surname (last name).
 */

/**
 * Extract surname (last word) and given name (all preceding words) from a full name.
 * Handles single names, multi-word names, whitespace, and empty strings.
 *
 * Examples:
 * - "Rahul Sharma" -> { surname: "Sharma", givenName: "Rahul" }
 * - "John Michael Doe" -> { surname: "Doe", givenName: "John Michael" }
 * - "Cher" -> { surname: "Cher", givenName: "" }
 * - "" -> { surname: "", givenName: "" }
 */
export const getSurnameAndGivenName = (fullName = '') => {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { surname: '', givenName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { surname: parts[0], givenName: '' };
  }
  const surname = parts[parts.length - 1];
  const givenName = parts.slice(0, -1).join(' ');
  return { surname, givenName };
};

export const getSurname = (fullName = '') => {
  return getSurnameAndGivenName(fullName).surname;
};

/**
 * Compare two objects or strings alphabetically by surname (last name).
 * If surnames match, falls back to given name(s).
 * Case-insensitive comparison using base sensitivity.
 */
export const compareBySurname = (a, b) => {
  const nameA = typeof a === 'string'
    ? a
    : (a?.name || a?.user?.name || a?.userName || a?.employeeName || '');
  const nameB = typeof b === 'string'
    ? b
    : (b?.name || b?.user?.name || b?.userName || b?.employeeName || '');

  const { surname: sA, givenName: gA } = getSurnameAndGivenName(nameA);
  const { surname: sB, givenName: gB } = getSurnameAndGivenName(nameB);

  const cmp = sA.localeCompare(sB, undefined, { sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  return gA.localeCompare(gB, undefined, { sensitivity: 'base' });
};

/**
 * Sorts an array of employee items alphabetically by surname (last name).
 * Non-mutating (returns a new array).
 */
export const sortBySurname = (array = []) => {
  if (!Array.isArray(array)) return [];
  return [...array].sort(compareBySurname);
};

/**
 * Formats name as "Surname, Given Name" if surname is available, otherwise the original name.
 */
export const formatSurnameFirst = (fullName = '') => {
  const { surname, givenName } = getSurnameAndGivenName(fullName);
  if (surname && givenName) {
    return `${surname}, ${givenName}`;
  }
  return fullName || '';
};
