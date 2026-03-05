import { base44 } from '@/api/base44Client';

// Normalize class name to match entity enum (same as backend)
const normalizeClassName = (cls) => cls?.toString().trim() || '';

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

    // Query ClassSubjectConfig
    const configs = await base44.entities.ClassSubjectConfig.filter({
      academic_year,
      class_name: normalizedClass
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

    // Fallback to global subjects
    console.log(`[SUBJECT_HELPER] No mapping found for ${academic_year}/${normalizedClass}, using global subjects`);
    const allSubjects = await base44.entities.Subject.list();
    const globalSubjects = allSubjects
      .filter(s => !s.is_optional) // Filter to required subjects, or adjust as needed
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(s => s.name);

    return {
      subjects: globalSubjects,
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
export const getSubjectSourceLabel = (source, academicYear) => {
  if (source === 'MAPPING') {
    return `Subjects loaded from Class Subject Mapping (${academicYear})`;
  }
  return 'Not configured — using global subjects';
};