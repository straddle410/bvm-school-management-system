import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !['admin', 'principal'].includes(user.role?.toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }

    // Fetch all subjects from Subject Management
    const allSubjects = await base44.entities.Subject.list();
    const subjectNames = new Set(allSubjects.map(s => s.name));
    
    console.log(`[VERIFY] Found ${subjectNames.size} subjects in Subject Management:`, Array.from(subjectNames));

    // Fetch all ClassSubjectConfig records
    const allConfigs = await base44.entities.ClassSubjectConfig.list();
    
    let orphanedCount = 0;
    const orphanedSubjects = {};
    const configsToUpdate = [];

    // Check each config for orphaned subjects
    for (const config of allConfigs) {
      if (!config.subject_names || config.subject_names.length === 0) continue;
      
      const validSubjects = [];
      const removedSubjects = [];
      
      for (const subjectName of config.subject_names) {
        if (subjectNames.has(subjectName)) {
          validSubjects.push(subjectName);
        } else {
          removedSubjects.push(subjectName);
          orphanedCount++;
        }
      }
      
      if (removedSubjects.length > 0) {
        console.log(`[ORPHAN] Class ${config.class_name} (${config.academic_year}): removing ${removedSubjects.join(', ')}`);
        orphanedSubjects[`${config.class_name}-${config.academic_year}`] = removedSubjects;
        configsToUpdate.push({
          id: config.id,
          class_name: config.class_name,
          academic_year: config.academic_year,
          valid_subjects: validSubjects
        });
      }
    }

    // Update configs with cleaned subjects
    for (const update of configsToUpdate) {
      await base44.entities.ClassSubjectConfig.update(update.id, {
        subject_names: update.valid_subjects
      });
      console.log(`[CLEANED] ${update.class_name}: updated to ${update.valid_subjects.join(', ')}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Verification complete. Removed ${orphanedCount} orphaned subjects.`,
      all_subjects: Array.from(subjectNames).sort(),
      orphaned_details: orphanedSubjects,
      cleaned_configs: configsToUpdate.length
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});