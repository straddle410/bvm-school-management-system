import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, template, academic_year, class_name, section, subject, topic, tone = 'friendly', length = 'short', due_date, quiz } = await req.json();

    if (!type || !template) {
      return Response.json({ error: 'type and template required' }, { status: 400 });
    }

    const lengthHint = length === 'medium' ? 'medium length (2-3 sentences per section)' : 'concise and brief';
    const toneHint = tone === 'strict' ? 'stern but not rude' : tone === 'formal' ? 'professional and official' : 'friendly and warm';

    let prompt = '';
    let responseSchema = {};

    if (type === 'notice') {
      responseSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['title', 'body']
      };

      const topicInput = topic || 'general school update';
      const classLevel = getClassLevel(class_name);

      prompt = `Generate a school notice for Class ${class_name}.
Template: ${template}
Topic: ${topicInput}
Tone: ${toneHint}
Length: ${lengthHint}

Guidelines:
- Use bullet points where appropriate
- Keep language ${classLevel}
- No personal student data
- Format for easy reading
- Include action items if relevant

Return as JSON with 'title' and 'body' fields.`;
    }

    else if (type === 'homework') {
      responseSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          instructions: { type: 'string' },
          materials: { type: 'string' },
          submission_note: { type: 'string' }
        },
        required: ['title', 'instructions']
      };

      const topicInput = topic || 'chapter learning';
      const classLevel = getClassLevel(class_name);
      const dueHint = due_date ? ` Due by ${due_date}.` : '';

      prompt = `Generate homework assignment for Class ${class_name}, ${subject || 'General'}.
Template: ${template}
Topic/Chapter: ${topicInput}
Tone: ${toneHint}
Length: ${lengthHint}
${dueHint}

Guidelines:
- Clear step-by-step instructions
- Age-appropriate for ${classLevel}
- Specify any materials needed
- Include submission expectations
- Keep it engaging and achievable

Return as JSON with 'title', 'instructions', 'materials' (optional), and 'submission_note' (optional).`;
    }

    else if (type === 'diary') {
      responseSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['body']
      };

      const topicInput = topic || 'today\'s class activities';
      const classLevel = getClassLevel(class_name);
      const templateHint = template === 'Behavior/Discipline Note' ? ' Address behavior constructively and positively.' : template === 'Appreciation/Praise Note' ? ' Highlight specific strengths.' : '';

      prompt = `Write a classroom diary entry for Class ${class_name}.
Template: ${template}
Focus: ${topicInput}
Tone: ${toneHint}
Length: ${lengthHint}
${templateHint}

Guidelines:
- Professional yet warm
- Age-appropriate for ${classLevel}
- Specific and meaningful
- No personal criticisms
- Constructive feedback only

Return as JSON with optional 'title' and required 'body'.`;
    }

    else if (type === 'quiz') {
      responseSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                answer: { type: 'string' }
              }
            }
          }
        },
        required: ['title', 'questions']
      };

      const mode = quiz?.mode || 'subject';
      const count = quiz?.count || 5;
      const difficulty = quiz?.difficulty || 'medium';
      const format = quiz?.format || 'mcq';
      const classLevel = getClassLevel(class_name);
      const subjectHint = subject ? `Subject: ${subject}` : 'General Knowledge';

      const modeDescription = mode === 'gk' ? 'General Knowledge' : mode === 'mixed' ? 'Mix of Subject and GK' : subjectHint;

      prompt = `Generate a ${count}-question quiz for Class ${class_name}.
Template: ${template}
Type: ${modeDescription}
Difficulty: ${difficulty}
Format: ${format}
${mode === 'gk' ? `Category: ${topic || 'Mixed'}\n` : ''}

Guidelines:
- ${count} clear questions with correct answers
- ${format === 'mcq' ? '4 options per question, randomized correct answer position' : 'Short answer or essay questions'}
- Age-appropriate for ${classLevel}
- No exam leakage or real exam questions
- Balanced difficulty
- Numbered questions, separate answer key

Return as JSON with 'title' and 'questions' array containing {question, options (if MCQ), answer}.`;
    }

    else {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    const content = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema,
      add_context_from_internet: false
    });

    return Response.json({
      success: true,
      type,
      template,
      generated: content
    });
  } catch (error) {
    console.error('[AI_ASSIST]', error);
    return Response.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
});

function getClassLevel(className) {
  const classNum = parseInt(className);
  if (className === 'Nursery' || className === 'LKG' || className === 'UKG') return 'preschool level';
  if (classNum <= 2) return 'primary school';
  if (classNum <= 5) return 'lower primary';
  if (classNum <= 8) return 'middle school';
  return 'high school';
}