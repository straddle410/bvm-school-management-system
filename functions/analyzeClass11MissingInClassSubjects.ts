/**
 * READ-ONLY ANALYSIS: Why is Class 11 missing from Class Subjects?
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const analysis = {
      title: 'CLASS 11 MISSING FROM CLASS SUBJECTS - ROOT CAUSE ANALYSIS',
      timestamp: new Date().toISOString(),

      question_1: {
        question: 'What is the exact source of class tabs in Class Subjects tab?',
        answer: 'HARDCODED CONSTANT',
        file: 'components/settings/ClassSubjectConfigTab.js',
        line: 11,
        code: 'const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];',
        used_at_line: 234,
        render_code: '{CLASSES.map(cls => (<button...> Class {cls} </button>))}',
        verdict: 'HARDCODED - NOT READ FROM SECTIONCONFIG'
      },

      question_2: {
        question: 'Is the class list hardcoded only up to 10?',
        answer: 'YES - CONFIRMED',
        classes: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        highest_numeric: 10,
        includes_class_11: false,
        missing_classes: ['11', '12', 'and higher']
      },

      question_3: {
        question: 'Does Class-Section Config save Class 11 correctly?',
        answer: 'YES - SECTIONCONFIG CAN SAVE ANY CLASS NAME',
        file: 'components/settings/ClassSectionConfigTab.js',
        normalization_logic: {
          line: 71,
          code: 'const cls = normalizeClassName(newClassName.trim());',
          for_input_11: {
            step1: 'parseInt("11", 10) = 11',
            step2: 'isNaN(11)? NO',
            step3: '11 >= 1 && 11 <= 12? YES',
            step4: 'return String(11) = "11"',
            result: 'Class 11 normalized correctly'
          }
        },
        create_line: 76,
        create_code: 'SectionConfig.create({ class_name: cls, ... })',
        result: 'Class 11 IS saved to SectionConfig correctly'
      },

      question_4: {
        question: 'Why does Class 11 appear in one place but not the other?',
        answer: 'TWO DIFFERENT DATA SOURCES',
        
        class_section_config: {
          tab_name: 'Settings → Class-Section Config',
          file: 'ClassSectionConfigTab.js',
          source: 'SectionConfig database (DYNAMIC)',
          query_line: 30,
          query: 'SectionConfig.filter({ academic_year })',
          shows_class_11: true,
          reason: 'Fetches all records from database'
        },

        class_subject_config: {
          tab_name: 'Settings → Class Subjects',
          file: 'ClassSubjectConfigTab.js',
          source: 'Hardcoded CLASSES constant (STATIC)',
          source_line: 11,
          shows_class_11: false,
          reason: 'Hardcoded list only goes to 10'
        }
      },

      question_5: {
        question: 'Which exact file and line defines the Class Subjects tab list?',
        answer_file: 'components/settings/ClassSubjectConfigTab.js',
        answer_line: 11,
        code: 'const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];',
        rendering_line: 234,
        initial_selection_line: 106
      },

      question_6: {
        question: 'What is the safest long-term fix?',
        
        option_1_extend_hardcoded: {
          name: 'Extend hardcoded CLASSES to include 11, 12',
          change_line: 11,
          change_from: '... "10"];',
          change_to: '... "10", "11", "12"];',
          risk: 'LOW',
          effort: 'MINIMAL - one line',
          pros: [
            'Quick fix',
            'No refactoring',
            'No async complexity',
            'No impact on other modules'
          ],
          cons: [
            'Not scalable - if user adds Class 13, 14, won\'t appear',
            'Hardcoded list not read from database',
            'Maintenance burden for future classes'
          ]
        },

        option_2_dynamic_from_sectionconfig: {
          name: 'Make Class Subjects read dynamically from SectionConfig',
          change_scope: 'Refactor ClassSubjectConfigTab',
          changes_needed: [
            'Add useQuery to fetch classes from SectionConfig',
            'Replace hardcoded CLASSES with fetched data',
            'Handle loading state',
            'Add fallback if SectionConfig empty'
          ],
          risk: 'MEDIUM',
          effort: 'MODERATE - 30-50 lines',
          pros: [
            'Scalable - shows any class in database',
            'Consistent - matches ClassSectionConfigTab',
            'Future-proof',
            'Single source of truth'
          ],
          cons: [
            'Requires refactoring',
            'Adds async complexity',
            'Loading states to handle',
            'Risk if SectionConfig not populated'
          ]
        },

        option_3_hybrid: {
          name: 'Extend to 12 with note, plan Phase 3 migration',
          change_line: 11,
          change_to: '... "10", "11", "12"]; // Max 12 - extend if needed',
          risk: 'LOW',
          effort: 'MINIMAL',
          pros: [
            'Quick pragmatic fix',
            'Works for most schools'
          ],
          cons: [
            'Still hardcoded',
            'Still not scalable'
          ]
        }
      },

      question_7: {
        question: 'Which option is safer without breaking current functionality?',
        recommended: 'OPTION 1 - EXTEND HARDCODED LIST',
        
        why_option_1_safest: [
          'Single line change on line 11',
          'No refactoring required',
          'No async complexity or loading states',
          'No behavioral changes',
          'Immediate effect',
          'Easy to rollback if needed',
          'No impact on Marks, Timetable, or other modules',
          'Proven to work (no risk of timing issues)'
        ],

        why_option_2_riskier: [
          'Requires significant refactoring',
          'Adds useQuery complexity',
          'Need to handle loading states',
          'Risk if SectionConfig is empty',
          'Risk of timing/async issues',
          'Larger code footprint = more bugs possible',
          'Harder to test and verify'
        ],

        action_plan: [
          'Step 1: Edit ClassSubjectConfigTab.js line 11',
          'Step 2: Add "11" and "12" to CLASSES array',
          'Step 3: Test Class 11 appears in Class Subjects',
          'Step 4: Admin can now configure subjects for Class 11'
        ]
      },

      root_cause_summary: {
        issue: 'Class 11 appears in Class-Section Config but NOT in Class Subjects',
        
        cause: 'ClassSubjectConfigTab uses HARDCODED class list (line 11) limited to Class 10',
        
        why_happens: [
          '1. Admin adds Class 11 via Settings → Class-Section Config',
          '2. Class 11 is saved to SectionConfig (database)',
          '3. ClassSectionConfigTab reads from SectionConfig (dynamic) → shows Class 11',
          '4. ClassSubjectConfigTab reads from hardcoded CLASSES constant (static) → does NOT show Class 11',
          '5. Result: Class 11 appears in one tab but not the other'
        ],

        affected_files: [
          {
            path: 'components/settings/ClassSubjectConfigTab.js',
            line: 11,
            issue: 'HARDCODED CLASSES array only goes to 10'
          },
          {
            path: 'components/settings/ClassSectionConfigTab.js',
            line: 30,
            note: 'Correctly reads from SectionConfig (no issue here)'
          }
        ],

        safest_immediate_fix: 'Extend CLASSES constant on line 11 to include "11", "12"',
        
        long_term_recommendation: 'In Phase 3, migrate to dynamic loading from SectionConfig to eliminate hardcoding'
      }
    };

    return Response.json(analysis, { status: 200 });

  } catch (error) {
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});