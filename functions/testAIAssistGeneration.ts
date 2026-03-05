import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = [];

    const testCases = [
      {
        name: 'Notice - Exam Notice',
        payload: {
          type: 'notice',
          template: 'Exam Notice',
          academic_year: '2025-26',
          class_name: '5',
          section: 'A',
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
          academic_year: '2025-26',
          class_name: '5',
          section: 'A',
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
          academic_year: '2025-26',
          class_name: '5',
          section: 'A',
          subject: 'Science',
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
          academic_year: '2025-26',
          class_name: '5',
          section: 'A',
          subject: 'Mathematics',
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
          academic_year: '2025-26',
          class_name: '5',
          section: 'A',
          tone: 'friendly',
          length: 'short',
          quiz: {
            mode: 'gk',
            count: 5,
            difficulty: 'easy',
            format: 'mcq',
            gk_category: 'Sports'
          }
        }
      }
    ];

    for (const test of testCases) {
      try {
        const response = await base44.asServiceRole.functions.invoke('generateStaffContent', test.payload);

        if (response.status >= 400) {
          results.push({
            test: test.name,
            status: 'FAIL',
            error: response.data?.error || 'HTTP error'
          });
          continue;
        }

        const generated = response.data?.generated;
        if (!generated) {
          results.push({
            test: test.name,
            status: 'FAIL',
            error: 'No generated content returned'
          });
          continue;
        }

        // Validate structure based on type
        let valid = true;
        let issues = [];

        const type = test.payload.type;
        if (type === 'notice' || type === 'diary') {
          if (!generated.body) {
            valid = false;
            issues.push('Missing body');
          }
        } else if (type === 'homework') {
          if (!generated.title) {
            valid = false;
            issues.push('Missing title');
          }
          if (!generated.instructions) {
            valid = false;
            issues.push('Missing instructions');
          }
        } else if (type === 'quiz') {
          if (!generated.title) {
            valid = false;
            issues.push('Missing title');
          }
          if (!Array.isArray(generated.questions) || generated.questions.length === 0) {
            valid = false;
            issues.push('Missing or empty questions array');
          } else {
            const q = generated.questions[0];
            if (!q.question || !Array.isArray(q.options) || q.options.length === 0 || !q.answer) {
              valid = false;
              issues.push('Invalid question structure');
            }
          }
        }

        results.push({
          test: test.name,
          status: valid ? 'PASS' : 'FAIL',
          issues: issues.length > 0 ? issues : undefined,
          sample: {
            type,
            title: generated.title?.substring(0, 60),
            bodyLength: generated.body?.length || generated.instructions?.length || 0,
            questionsCount: generated.questions?.length || 0
          }
        });
      } catch (error) {
        results.push({
          test: test.name,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const allPassed = passed === results.length;

    return Response.json({
      summary: {
        totalTests: results.length,
        passed,
        overall: allPassed ? 'ALL TESTS PASSED ✅' : `${passed}/${results.length} tests passed`
      },
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});