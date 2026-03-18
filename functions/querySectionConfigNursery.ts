/**
 * READ-ONLY: Query SectionConfig to confirm actual stored spelling
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query SectionConfig for 2025-26
    const allConfigs = await base44.asServiceRole.entities.SectionConfig.filter({
      academic_year: '2025-26'
    });

    // Find Nursery-like entries
    const nurseryLike = allConfigs.filter(r => 
      r.class_name && r.class_name.toLowerCase().includes('nurs')
    );

    // Get unique class names
    const uniqueClasses = new Set(allConfigs.map(r => r.class_name).filter(Boolean));

    return Response.json({
      title: 'SECTIONCONFIG SPELLING VERIFICATION',
      total_records: allConfigs.length,
      
      unique_class_names_in_2025_26: Array.from(uniqueClasses).sort(),
      
      nursery_records: nurseryLike.map(r => ({
        id: r.id,
        class_name: r.class_name,
        class_name_exact_spelling: r.class_name,
        section: r.section,
        is_active: r.is_active,
        class_display_order: r.class_display_order,
        section_display_order: r.section_display_order
      })),

      spelling_check: {
        found_nursery_correct: nurseryLike.some(r => r.class_name === 'Nursery'),
        found_nursary_misspelled: nurseryLike.some(r => r.class_name === 'NURSARY'),
        found_nursary_lowercase: nurseryLike.some(r => r.class_name === 'nursary'),
        found_nursery_uppercase: nurseryLike.some(r => r.class_name === 'NURSERY'),
        other_variants: nurseryLike
          .map(r => r.class_name)
          .filter((c, i, a) => a.indexOf(c) === i && !['Nursery', 'NURSARY', 'nursary', 'NURSERY'].includes(c))
      },

      verdict: nurseryLike.some(r => r.class_name === 'NURSARY') 
        ? '🔴 CONFIRMED: SectionConfig contains "NURSARY" (misspelled)' 
        : nurseryLike.some(r => r.class_name === 'Nursery')
        ? '🟢 OK: SectionConfig contains "Nursery" (correct)'
        : '🟡 WARNING: No Nursery-like records found at all'
    });

  } catch (error) {
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});