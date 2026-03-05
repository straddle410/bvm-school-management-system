import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse payload
    const payload = await req.json();
    const {
      type, // notice | homework | diary | quiz
      template,
      academic_year,
      class_name,
      section,
      subject,
      topic,
      tone = 'friendly',
      length = 'short',
      due_date,
      quiz,
    } = payload;

    // Validate required fields
    if (!type || !template || !academic_year || !class_name || !section) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build detailed prompt based on type and template
    const prompt = buildPrompt(type, template, {
      class_name,
      section,
      academic_year,
      topic,
      tone,
      length,
      subject,
      due_date,
      quiz,
    });

    // Call LLM to generate content
    const schema = buildSchema(type);
    
    const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
      add_context_from_internet: false,
    });

    // Validate generated content
    if (!generated) {
      return Response.json(
        { error: 'Failed to generate content' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      generated,
    });
  } catch (error) {
    console.error('[generateStaffContent]', error);
    return Response.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    );
  }
});

function buildPrompt(type, template, config) {
  const { class_name, topic, tone, length, subject, due_date, quiz } = config;
  const classLevel = getClassLevel(class_name);
  const toneDesc = getToneDescription(tone);
  const lengthDesc = length === 'short' ? 'concise and brief' : 'detailed and comprehensive';

  const baseContext = `You are a helpful school content generator. Create age-appropriate content for ${classLevel} (Class ${class_name}). Tone: ${toneDesc}. Length: ${lengthDesc}. Always format clearly with proper structure.`;

  if (type === 'notice') {
    const noticeType = {
      'General Notice': 'a general school announcement',
      'Exam Notice': 'an exam schedule/notification',
      'PTM Notice': 'a parent-teacher meeting announcement',
      'Fee Reminder': 'a fee payment reminder',
      'Holiday Notice': 'a holiday schedule announcement',
      'Event/Trip Notice': 'an event or trip announcement',
    }[template] || 'an announcement';

    return `${baseContext}

Generate ${noticeType} for Class ${class_name}.
${topic ? `Topic: ${topic}` : 'Topic: Important school matter'}

Return a JSON object with:
- title: A clear, attention-grabbing title
- body: The notice content (use bullet points, clear formatting, and age-appropriate language)

Make it professional yet easy to understand.`;
  }

  if (type === 'homework') {
    const hwType = {
      'Simple Homework': 'basic assignment',
      'Reading + Writing': 'reading comprehension and writing task',
      'Worksheet style': 'worksheet-style assignment',
      'Project/Activity': 'project or hands-on activity',
      'Revision/Practice': 'revision and practice assignment',
    }[template] || 'assignment';

    return `${baseContext}

Generate a ${hwType} for ${subject || 'General'} class.
${topic ? `Topic: ${topic}` : `Topic: Chapter from ${subject || 'subject'}`}
${due_date ? `Due Date: ${due_date}` : 'No specific due date'}

Return a JSON object with:
- title: Assignment title
- instructions: Clear step-by-step instructions
- materials (optional): Materials needed (if applicable)
- submission_note (optional): How to submit

Make instructions clear so students understand exactly what to do.`;
  }

  if (type === 'diary') {
    const diaryType = {
      'Daily Summary': 'a summary of today\'s class activities',
      'Behavior/Discipline Note': 'a polite note about student behavior/discipline',
      'Appreciation/Praise Note': 'an appreciation and praise note for students',
      'Reminder Note': 'a reminder or follow-up note',
    }[template] || 'a diary entry';

    return `${baseContext}

Generate ${diaryType} for Class ${class_name}.
${subject ? `Subject: ${subject}` : 'Subject: General class activities'}
${topic ? `Focus: ${topic}` : 'Focus: Today\'s class'}

Return a JSON object with:
- title (optional): A short title or heading
- body: The diary entry content (be warm, encouraging, and constructive)

Use simple, clear language appropriate for ${classLevel} students.`;
  }

  if (type === 'quiz') {
    const quizInfo = quiz || {};
    const count = quizInfo.count || 5;
    const difficulty = quizInfo.difficulty || 'medium';
    const mode = quizInfo.mode || 'subject';

    let quizFocus = '';
    if (mode === 'subject') {
      quizFocus = `Subject: ${subject || 'General'}\nTopic: ${topic || subject || 'Chapter'}`;
    } else if (mode === 'gk') {
      quizFocus = `General Knowledge\nCategory: ${quizInfo.gk_category || 'General'}`;
    } else {
      quizFocus = `Mixed Quiz\nSubject: ${subject || 'General'}\nGK Category: ${quizInfo.gk_category || 'General'}`;
    }

    return `${baseContext}

Generate a ${count}-question quiz for Class ${class_name}.
${quizFocus}
Difficulty: ${difficulty}

IMPORTANT INSTRUCTIONS:
1. Generate exactly ${count} MCQ questions
2. Each question must have exactly 4 options (A, B, C, D)
3. Clearly mark the correct answer
4. Make questions age-appropriate and clear
5. Avoid tricky or ambiguous questions

Return a JSON object with:
- title: Quiz title
- questions: Array of ${count} questions, each with:
  - question: The question text
  - options: Array of 4 options
  - answer: The correct answer (just the option text, not A/B/C/D)

Format: {"title": "...", "questions": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "correct_option"}, ...]}`;
  }

  return baseContext;
}

function buildSchema(type) {
  if (type === 'notice' || type === 'diary') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['body'],
    };
  }

  if (type === 'homework') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        instructions: { type: 'string' },
        materials: { type: 'string' },
        submission_note: { type: 'string' },
      },
      required: ['title', 'instructions'],
    };
  }

  if (type === 'quiz') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              options: {
                type: 'array',
                items: { type: 'string' },
                minItems: 4,
                maxItems: 4,
              },
              answer: { type: 'string' },
            },
            required: ['question', 'options', 'answer'],
          },
        },
      },
      required: ['title', 'questions'],
    };
  }

  return { type: 'object' };
}

function getClassLevel(className) {
  if (!className) return 'Primary';
  const classNum = parseInt(className);
  if (isNaN(classNum)) return 'Primary';
  if (classNum <= 2) return 'Early Primary (Class 1-2)';
  if (classNum <= 5) return 'Middle Primary (Class 3-5)';
  if (classNum <= 8) return 'Upper Primary (Class 6-8)';
  if (classNum <= 10) return 'Secondary (Class 9-10)';
  return 'Higher Secondary (Class 11-12)';
}

function getToneDescription(tone) {
  const tones = {
    friendly: 'warm, encouraging, and conversational',
    formal: 'professional and official',
    strict: 'authoritative and firm',
  };
  return tones[tone] || tones.friendly;
}