import { base44 } from '@/api/base44Client';

/**
 * CRITICAL: Do NOT use SectionConfig entity directly in module pages.
 * All class/section loading is centralized here.
 * All modules that need class lists or section lists must use these functions.
 *
 * Each SectionConfig record represents ONE class+section combination for ONE academic year.
 * e.g. { academic_year: '2025-26', class_name: '5', section: 'B', class_display_order: 8, section_display_order: 2 }
 */

/**
 * Canonicalize class name — same normalizer used across subjectHelper and ClassSubjectConfig.
 */
export const normalizeClassName = (cls) => {
  if (!cls) return '';
  const input = cls.toString().trim().toLowerCase();
  if (input === 'nursery') return 'Nursery';
  if (input === 'lkg') return 'LKG';
  if (input === 'ukg') return 'UKG';
  const stripped = input.replace(/^class\s*/, '').trim();
  const num = parseInt(stripped, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return String(num);
  return cls.toString().trim();
};

/**
 * Default class list (fallback only — used when SectionConfig has no records for the year).
 * Phase 3 will remove reliance on this.
 */
const DEFAULT_CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const DEFAULT_SECTIONS = ['A'];

/**
 * Fetch all active SectionConfig records for a given academic year.
 * Sorted by class_display_order, then section_display_order.
 * Internal — used by all public functions below.
 */
const fetchSectionConfigs = async (academic_year) => {
  if (!academic_year) return [];
  const records = await base44.entities.SectionConfig.filter({ academic_year, is_active: true });
  return records.sort((a, b) => {
    const co = (a.class_display_order ?? 999) - (b.class_display_order ?? 999);
    if (co !== 0) return co;
    return (a.section_display_order ?? 999) - (b.section_display_order ?? 999);
  });
};

/**
 * Get the ordered, deduplicated list of active class names for a given academic year.
 * Falls back to DEFAULT_CLASSES if no SectionConfig records exist for the year.
 *
 * @param {string} academic_year - e.g. "2025-26"
 * @returns {Promise<{ classes: string[], source: 'SECTION_CONFIG' | 'DEFAULT', hasConfig: boolean }>}
 */
export const getClassesForYear = async (academic_year) => {
  try {
    const records = await fetchSectionConfigs(academic_year);
    if (records.length === 0) {
      return { classes: DEFAULT_CLASSES, source: 'DEFAULT', hasConfig: false };
    }
    // Deduplicate while preserving class_display_order (already sorted)
    const seen = new Set();
    const classes = [];
    for (const r of records) {
      const cls = normalizeClassName(r.class_name);
      if (cls && !seen.has(cls)) {
        seen.add(cls);
        classes.push(cls);
      }
    }
    return { classes, source: 'SECTION_CONFIG', hasConfig: true };
  } catch (err) {
    console.error('[CLASS_SECTION_HELPER] getClassesForYear error:', err);
    return { classes: DEFAULT_CLASSES, source: 'DEFAULT', hasConfig: false };
  }
};

/**
 * Get the ordered list of active sections for a given class in a given academic year.
 * Falls back to DEFAULT_SECTIONS if no SectionConfig records exist for the year/class.
 *
 * @param {string} academic_year - e.g. "2025-26"
 * @param {string} class_name - e.g. "5"
 * @returns {Promise<{ sections: string[], source: 'SECTION_CONFIG' | 'DEFAULT', hasConfig: boolean }>}
 */
export const getSectionsForClass = async (academic_year, class_name) => {
  try {
    if (!academic_year || !class_name) {
      return { sections: DEFAULT_SECTIONS, source: 'DEFAULT', hasConfig: false };
    }
    const normalized = normalizeClassName(class_name);
    const records = await fetchSectionConfigs(academic_year);
    const classRecords = records.filter(r => normalizeClassName(r.class_name) === normalized);
    if (classRecords.length === 0) {
      // If nothing configured at all for year → DEFAULT; if year exists but not this class → empty
      const anyForYear = records.length > 0;
      return {
        sections: anyForYear ? [] : DEFAULT_SECTIONS,
        source: 'DEFAULT',
        hasConfig: false
      };
    }
    return {
      sections: classRecords.map(r => r.section).filter(Boolean),
      source: 'SECTION_CONFIG',
      hasConfig: true
    };
  } catch (err) {
    console.error('[CLASS_SECTION_HELPER] getSectionsForClass error:', err);
    return { sections: DEFAULT_SECTIONS, source: 'DEFAULT', hasConfig: false };
  }
};

/**
 * Get the full class→sections map for a given academic year in one call.
 * Useful for pages that need to populate both class and section dropdowns.
 *
 * @param {string} academic_year - e.g. "2025-26"
 * @returns {Promise<{ map: Record<string, string[]>, source: 'SECTION_CONFIG' | 'DEFAULT', hasConfig: boolean }>}
 *   e.g. { map: { 'Nursery': ['A'], '5': ['A','B'], '10': ['A'] }, source: 'SECTION_CONFIG', hasConfig: true }
 */
export const getClassSectionMap = async (academic_year) => {
  try {
    const records = await fetchSectionConfigs(academic_year);
    if (records.length === 0) {
      // Build default map
      const map = {};
      DEFAULT_CLASSES.forEach(cls => { map[cls] = [...DEFAULT_SECTIONS]; });
      return { map, source: 'DEFAULT', hasConfig: false };
    }
    const map = {};
    for (const r of records) {
      const cls = normalizeClassName(r.class_name);
      if (!cls) continue;
      if (!map[cls]) map[cls] = [];
      if (r.section) map[cls].push(r.section);
    }
    return { map, source: 'SECTION_CONFIG', hasConfig: true };
  } catch (err) {
    console.error('[CLASS_SECTION_HELPER] getClassSectionMap error:', err);
    const map = {};
    DEFAULT_CLASSES.forEach(cls => { map[cls] = [...DEFAULT_SECTIONS]; });
    return { map, source: 'DEFAULT', hasConfig: false };
  }
};