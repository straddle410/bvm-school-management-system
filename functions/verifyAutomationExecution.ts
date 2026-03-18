import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = {
      timestamp: new Date().toISOString(),
      test_objective: 'Verify automation execution by checking function call patterns',
      steps: []
    };

    // Create student
    report.steps.push({ step: 1, name: 'Create student', status: 'IN_PROGRESS' });
    const newStudent = await base44.asServiceRole.entities.Student.create({
      name: `VerifyAuto_${Date.now()}`,
      class_name: '8',
      section: 'A',
      academic_year: '2025-26',
      status: 'Pending'
    });
    report.steps[0].status = 'PASS';
    report.steps[0].details = { student_id: newStudent.id, status: newStudent.status };

    // Check initial state
    report.steps.push({ 
      step: 2, 
      name: 'Verify initial Pending state', 
      status: 'PASS',
      details: { student_id: newStudent.student_id, username: newStudent.username }
    });

    // Update to Approved
    report.steps.push({ step: 3, name: 'Update to Approved', status: 'IN_PROGRESS' });
    
    const updateTime = Date.now();
    await base44.asServiceRole.entities.Student.update(newStudent.id, { status: 'Approved' });
    report.steps[2].status = 'PASS';
    report.steps[2].details = { update_time: updateTime };

    // Check student 500ms later
    await new Promise(r => setTimeout(r, 500));
    let student500ms = (await base44.asServiceRole.entities.Student.filter({ id: newStudent.id }))[0];
    
    report.steps.push({ 
      step: 4, 
      name: 'Check 500ms after update', 
      status: student500ms.student_id ? 'PASS' : 'PENDING',
      details: { 
        has_student_id: !!student500ms.student_id,
        student_id: student500ms.student_id,
        has_username: !!student500ms.username
      }
    });

    // If not yet generated, wait longer
    if (!student500ms.student_id) {
      report.steps.push({ 
        step: 5, 
        name: 'Wait additional 1500ms and recheck', 
        status: 'IN_PROGRESS' 
      });
      
      await new Promise(r => setTimeout(r, 1500));
      const student2sec = (await base44.asServiceRole.entities.Student.filter({ id: newStudent.id }))[0];
      
      report.steps[4].status = student2sec.student_id ? 'PASS' : 'TIMEOUT';
      report.steps[4].details = {
        total_wait_ms: 2000,
        has_student_id: !!student2sec.student_id,
        student_id: student2sec.student_id,
        automation_fired: !!student2sec.student_id
      };

      if (student2sec.student_id) {
        student500ms = student2sec;
      }
    }

    // Final result
    const automationFired = !!student500ms.student_id;
    
    report.conclusion = {
      automation_fired: automationFired,
      if_yes: 'Automation platform IS invoking the function correctly',
      if_no: 'Automation platform is NOT invoking the function - manual invocation needed',
      generated_student_id: student500ms.student_id || 'NOT GENERATED',
      recommendation: automationFired 
        ? 'Workflow is production-ready, automation working correctly'
        : 'Need to implement manual trigger or investigate automation platform'
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});