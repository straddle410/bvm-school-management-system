import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use service role for testing
    const results = [];

    // Test 1: Notice
    try {
      const notice = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: 'Generate a school notice for Class 5. Template: Exam Notice. Topic: Mid-term Exam Schedule. Tone: professional and official. Length: concise and brief. Return as JSON with "title" and "body" fields.',
        response_json_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] },
        add_context_from_internet: false
      });
      results.push({
        test: 'Notice - Exam Notice',
        status: notice?.title && notice?.body ? 'PASS' : 'FAIL',
        sample: { title: notice?.title?.substring(0, 50), bodyLength: notice?.body?.length }
      });
    } catch (e) {
      results.push({ test: 'Notice - Exam Notice', status: 'ERROR', error: e.message });
    }

    // Test 2: Homework
    try {
      const hw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: 'Generate homework assignment for Class 5, English. Template: Reading + Writing. Topic: Chapter 3: The Journey. Tone: friendly and warm. Length: concise and brief. Due by 2026-03-10. Return as JSON with "title", "instructions", optional "materials" and "submission_note".',
        response_json_schema: { type: 'object', properties: { title: { type: 'string' }, instructions: { type: 'string' }, materials: { type: 'string' }, submission_note: { type: 'string' } }, required: ['title', 'instructions'] },
        add_context_from_internet: false
      });
      results.push({
        test: 'Homework - Reading + Writing',
        status: hw?.title && hw?.instructions ? 'PASS' : 'FAIL',
        sample: { title: hw?.title?.substring(0, 50), instructionsLength: hw?.instructions?.length }
      });
    } catch (e) {
      results.push({ test: 'Homework - Reading + Writing', status: 'ERROR', error: e.message });
    }

    // Test 3: Diary
    try {
      const diary = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: 'Write a classroom diary entry for Class 5. Template: Appreciation/Praise Note. Focus: Class participation in Science project. Tone: friendly and warm. Length: concise and brief. Return as JSON with optional "title" and required "body".',
        response_json_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['body'] },
        add_context_from_internet: false
      });
      results.push({
        test: 'Diary - Appreciation Note',
        status: diary?.body ? 'PASS' : 'FAIL',
        sample: { title: diary?.title?.substring(0, 50), bodyLength: diary?.body?.length }
      });
    } catch (e) {
      results.push({ test: 'Diary - Appreciation Note', status: 'ERROR', error: e.message });
    }

    // Test 4: Quiz - Subject
    try {
      const quiz = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: 'Generate a 5-question quiz for Class 5, Mathematics. Template: Subject Quiz. Type: Subject (Mathematics). Difficulty: medium. Format: mcq. Guidelines: 5 clear MCQ questions with correct answers. Return as JSON with "title" and "questions" array containing {question, options (4 items), answer}.',
        response_json_schema: { type: 'object', properties: { title: { type: 'string' }, questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' } } } } }, required: ['title', 'questions'] },
        add_context_from_internet: false
      });
      results.push({
        test: 'Quiz - Subject Quiz',
        status: quiz?.title && Array.isArray(quiz?.questions) && quiz.questions.length > 0 ? 'PASS' : 'FAIL',
        sample: { title: quiz?.title?.substring(0, 50), questionsCount: quiz?.questions?.length }
      });
    } catch (e) {
      results.push({ test: 'Quiz - Subject Quiz', status: 'ERROR', error: e.message });
    }

    // Test 5: Quiz - GK
    try {
      const quiz = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: 'Generate a 5-question quiz for Class 5. Template: General Knowledge Quiz. Type: General Knowledge (Sports category). Difficulty: easy. Format: mcq. Guidelines: 5 clear MCQ questions with correct answers. Return as JSON with "title" and "questions" array containing {question, options (4 items), answer}.',
        response_json_schema: { type: 'object', properties: { title: { type: 'string' }, questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' } } } } }, required: ['title', 'questions'] },
        add_context_from_internet: false
      });
      results.push({
        test: 'Quiz - GK Quiz',
        status: quiz?.title && Array.isArray(quiz?.questions) && quiz.questions.length > 0 ? 'PASS' : 'FAIL',
        sample: { title: quiz?.title?.substring(0, 50), questionsCount: quiz?.questions?.length }
      });
    } catch (e) {
      results.push({ test: 'Quiz - GK Quiz', status: 'ERROR', error: e.message });
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const allPassed = passed === results.length;

    return Response.json({
      summary: {
        totalTests: results.length,
        passed,
        overall: allPassed ? 'ALL TESTS PASSED ✅' : `${passed}/${results.length} PASSED`
      },
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});