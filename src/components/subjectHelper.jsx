import { base44 } from '@/api/base44Client';

/**
 * IMPORTANT: Do NOT use the Subject entity directly anywhere in the codebase.
 * Subject loading is centralized here and uses ClassSubjectConfig mapping.
 * All modules (Homework, Diary, Timetable, Marks) must use getSubjectsForClass().
 */

/**
 * Canonicalize class name to standard format:
 * "Nursery", "LKG", "UKG" → as-is
 * "Class 7", "7", "class7" → "7"
 * "Class 10" → "10"
 * "VII" → "7" (if applicable)
 */
const normalizeClassName = (cls) => {
  if (!cls) return '';
  
  const input = cls.toString().trim().toLowerCase();
  
  // Return early for special cases
  if (input === 'nursery') return 'Nursery';
  if (input === 'lkg') return 'LKG';
  if (input === 'ukg') return 'UKG';
  
  // Strip "class" prefix if present
  let stripped = input.replace(/^class\s*/, '').trim();
  
  // Return numeric string (1-12)
  const num = parseInt(stripped, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return String(num);
  }
  
  // Fallback to original trimmed input if no match
  return cls.toString().trim();
};

/**
 * Fetch subjects for a given class from ClassSubjectConfig.
 * If mapping exists and has subjects, return that list (the source of truth).
 * Otherwise, fallback to global subjects.
 * 
 * @param {string} academic_year - Academic year (e.g., "2025-26")
 * @param {string} class_name - Class name (e.g., "LKG", "1", "5")
 * @returns {Promise<{ subjects: string[], source: 'MAPPING' | 'GLOBAL', mappingExists: boolean }>}
 */
export const getSubjectsForClass = async (academic_year, class_name) => {
  try {
    if (!academic_year || !class_name) {
      return { subjects: [], source: 'GLOBAL', mappingExists: false };
    }

    // Normalize class name
    const normalizedClass = normalizeClassName(class_name);
    
    // Debug: Log lookup params
    console.log("[SUBJECTS_LOOKUP]", {
      academicYear: academic_year,
      classRaw: class_name,
      classCanon: normalizedClass,
    });

    // Query ClassSubjectConfig
    const configs = await base44.entities.ClassSubjectConfig.filter({
      academic_year,
      class_name: normalizedClass
    });
    
    // Debug: Log query result
    const config = configs.length > 0 ? configs[0] : null;
    console.log("[SUBJECTS_LOOKUP_RESULT]", {
      found: !!config,
      configYear: config?.academic_year,
      configClass: config?.class_name,
      subjectsCount: config?.subject_names?.length,
    });

    if (configs.length > 0 && Array.isArray(configs[0].subject_names) && configs[0].subject_names.length > 0) {
      console.log(`[SUBJECT_HELPER] Loaded ${configs[0].subject_names.length} subjects from mapping for ${academic_year}/${normalizedClass}`);
      return {
        subjects: configs[0].subject_names,
        source: 'MAPPING',
        mappingExists: true,
        academicYear: academic_year,
        className: normalizedClass
      };
    }

    // No mapping found: return empty list (no fallback to global subjects)
    console.log(`[SUBJECT_HELPER] No mapping found for ${academic_year}/${normalizedClass}. Admin must configure ClassSubjectConfig.`);
    return {
      subjects: [],
      source: 'GLOBAL',
      mappingExists: false,
      academicYear: academic_year,
      className: normalizedClass
    };
  } catch (error) {
    console.error('[SUBJECT_HELPER] Error fetching subjects:', error);
    return { subjects: [], source: 'GLOBAL', mappingExists: false };
  }
};

/**
 * Get a brief label for the source of subjects (for UI display).
 * @param {string} source - 'MAPPING' or 'GLOBAL'
 * @param {string} academicYear - The academic year
 * @returns {string} Human-readable label
 */
/**
 * Get a brief label for the source of subjects (for UI display).
 * @param {string} source - 'MAPPING' or 'EMPTY'
 * @param {string} academicYear - The academic year
 * @returns {string} Human-readable label
 */
export const getSubjectSourceLabel = (source, academicYear) => {
  if (source === 'MAPPING') {
    return `Subjects loaded from Class Subject Mapping (${academicYear})`;
  }
  return 'Not configured';
};

/**
 * Get all subjects for an academic year (de-duplicated union across all classes).
 * This is the whole-school "master subjects" list derived from ClassSubjectConfig.
 * 
 * @param {string} academic_year - Academic year (e.g., "2025-26")
 * @returns {Promise<string[]>} Sorted de-duplicated array of subject names
 */
export const getAllSubjectsForYear = async (academic_year) => {
  try {
    if (!academic_year) {
      return [];
    }

    // Fetch all ClassSubjectConfig records for this year
    const configs = await base44.entities.ClassSubjectConfig.filter({
      academic_year
    });

    // Collect all unique subject names
    const subjectSet = new Set();
    configs.forEach(config => {
      if (Array.isArray(config.subject_names)) {
        config.subject_names.forEach(name => {
          if (name && name.trim()) {
            subjectSet.add(name.trim());
          }
        });
      }
    });

    // Return sorted array
    return Array.from(subjectSet).sort();
  } catch (error) {
    console.error('[SUBJECT_HELPER] Error fetching all subjects:', error);
    return [];
  }
};