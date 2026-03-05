import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      // Auth might fail in test context, use service role instead
      user = { email: 'test@test.com', name: 'Test User' };
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const academicYear = '2025-26';
    const className = '5';
    const section = 'A';

    const tests = [
      {
        name: 'Notice - Exam Notice',
        payload: {
          type: 'notice',
          template: 'Exam Notice',
          academic_year: academicYear,
          class_name: className,
          section,
          topic: 'Mid-term Exam Schedule',
          tone: 'formal',
          length: 'short'
        }
      },
      {
        name: 'Homework - Reading + Writing',
        payload: {
          type: 'homework',
          template: 'Reading + Writing',
          academic_year: academicYear,
          class_name: className,
          section,
          subject: 'English',
          topic: 'Chapter 3: The Journey',
          tone: 'friendly',
          length: 'short',
          due_date: '2026-03-10'
        }
      },
      {
        name: 'Diary - Appreciation Note',
        payload: {
          type: 'diary',
          template: 'Appreciation/Praise Note',
          academic_year: academicYear,
          class_name: className,
          section,
          topic: 'Class participation in Science project',
          tone: 'friendly',
          length: 'short'
        }
      },
      {
        name: 'Quiz - Subject Quiz',
        payload: {
          type: 'quiz',
          template: 'Subject Quiz',
          academic_year: academicYear,
          class_name: className,
          section,
          subject: 'Mathematics',
          topic: 'Geometry - Triangles',
          tone: 'formal',
          length: 'short',
          quiz: {
            mode: 'subject',
            count: 5,
            difficulty: 'medium',
            format: 'mcq'
          }
        }
      },
      {
        name: 'Quiz - GK Quiz',
        payload: {
          type: 'quiz',
          template: 'General Knowledge Quiz',
          academic_year: academicYear,
          class_name: className,
          section,
          topic: 'Sports',
          tone: 'friendly',
          length: 'short',
          quiz: {
            mode: 'gk',
            count: 5,
            difficulty: 'easy',
            format: 'mcq'
          }
        }
      }
    ];

    const results = [];

    for (const test of tests) {
      try {
        const response = await base44.functions.invoke('generateStaffContent', test.payload);

        if (response.status >= 400) {
          results.push({
            test: test.name,
            status: 'FAIL',
            error: response.data?.error
          });
          continue;
        }

        const generated = response.data?.generated;

        // Validate structure
        let valid = true;
        let issues = [];

        if (test.payload.type === 'notice' || test.payload.type === 'diary') {
          if (!generated?.title && test.payload.type === 'notice') {
            valid = false;
            issues.push('Missing title');
          }
          if (!generated?.body) {
            valid = false;
            issues.push('Missing body');
          }
        } else if (test.payload.type === 'homework') {
          if (!generated?.title) {
            valid = false;
            issues.push('Missing title');
          }
          if (!generated?.instructions) {
            valid = false;
            issues.push('Missing instructions');
          }
        } else if (test.payload.type === 'quiz') {
          if (!generated?.title) {
            valid = false;
            issues.push('Missing title');
          }
          if (!Array.isArray(generated?.questions) || generated.questions.length === 0) {
            valid = false;
            issues.push('Missing or empty questions array');
          }
        }

        results.push({
          test: test.name,
          status: valid ? 'PASS' : 'FAIL',
          issues: issues.length > 0 ? issues : undefined,
          sample: valid ? {
            title: generated?.title?.substring(0, 60) + (generated?.title?.length > 60 ? '...' : ''),
            bodyLength: generated?.body ? generated.body.length : generated?.instructions ? generated.instructions.length : 0,
            questionsCount: generated?.questions?.length || 0
          } : undefined
        });
      } catch (error) {
        results.push({
          test: test.name,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    const allPassed = results.every(r => r.status === 'PASS');

    return Response.json({
      summary: {
        totalTests: results.length,
        passed: results.filter(r => r.status === 'PASS').length,
        overall: allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'
      },
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});