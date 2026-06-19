/**
 * Color blindness filter matrices
 * These CSS filter matrices simulate different types of color vision deficiencies
 */

export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';

/**
 * CSS filter matrix for Protanopia (red-blind)
 */
export const PROTANOPIA_FILTER =
  '0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0';

/**
 * CSS filter matrix for Deuteranopia (green-blind)
 */
export const DEUTERANOPIA_FILTER =
  '0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0';

/**
 * CSS filter matrix for Tritanopia (blue-blind)
 */
export const TRITANOPIA_FILTER =
  '0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0';

/**
 * Get CSS filter string for color blindness type
 */
export function getColorBlindnessFilter(type: ColorBlindnessType): string {
  switch (type) {
    case 'protanopia':
      return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="protanopia"><feColorMatrix type="matrix" values="${PROTANOPIA_FILTER}"/></filter></svg>#protanopia')`;
    case 'deuteranopia':
      return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="deuteranopia"><feColorMatrix type="matrix" values="${DEUTERANOPIA_FILTER}"/></filter></svg>#deuteranopia')`;
    case 'tritanopia':
      return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="tritanopia"><feColorMatrix type="matrix" values="${TRITANOPIA_FILTER}"/></filter></svg>#tritanopia')`;
    case 'none':
    default:
      return 'none';
  }
}

/**
 * Alternative filter approach using CSS matrix syntax
 * NOTE: CSS filter property doesn't support matrix() function directly.
 * This function is kept for potential future use or alternative implementations.
 * Currently, getColorBlindnessFilter() using SVG URL filters is the recommended approach.
 * 
 * @deprecated This function may not work as CSS filters don't support matrix() syntax.
 * Use getColorBlindnessFilter() instead.
 */
export function getColorBlindnessFilterMatrix(type: ColorBlindnessType): string {
  switch (type) {
    case 'protanopia':
      return `matrix(${PROTANOPIA_FILTER})`;
    case 'deuteranopia':
      return `matrix(${DEUTERANOPIA_FILTER})`;
    case 'tritanopia':
      return `matrix(${TRITANOPIA_FILTER})`;
    case 'none':
    default:
      return 'none';
  }
}
