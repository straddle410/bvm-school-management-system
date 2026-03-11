/**
 * READ-ONLY ANALYSIS: Why is Class 11 missing from Class Subjects?
 * Verify if hardcoded class list is the cause
 */

const analysis = {
  title: 'CLASS 11 MISSING FROM CLASS SUBJECTS TAB - ROOT CAUSE ANALYSIS',
  timestamp: new Date().toISOString(),

  // ===== QUESTION 1: What is the exact source of class tabs in Class Subjects? =====
  question1_class_tabs_source: {
    question: 'What is the exact source of class tabs in Class Subjects tab?',
    
    file: 'components/settings/ClassSubjectConfigTab.js',
    line: 11,
    code: 'const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];',
    
    source_type: '🔴 HARDCODED CONSTANT',
    
    rendering_location: {
      file: 'ClassSubjectConfigTab.js',
      line: 234,
      code: '{CLASSES.map(cls => (<button...> Class {cls} </button>))}',
      explanation: 'Creates tab buttons by iterating over the hardcoded CLASSES array'
    },

    verification: {
      description: 'The class tabs shown to user are ONLY from the CLASSES constant',
      fact: 'CLASSES is defined on line 11 and NEVER updated from SectionConfig or any database query',
      proof: [
        'No useQuery hook to fetch class list from SectionConfig',
        'No dynamic class loading in component',
        'CLASSES array is static and immutable',
        'ClassSubjectConfigTab is self-contained with no external class source'
      ]
    }
  },

  // ===== QUESTION 2: Is the class list hardcoded only up to 10? =====
  question2_hardcoded_limit: {
    question: 'Is the class list hardcoded only up to Class 10?',
    
    answer: '✅ YES - CONFIRMED',
    
    hardcoded_classes: {
      file: 'components/settings/ClassSubjectConfigTab.js',
      line: 11,
      values: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      highest_numeric_class: 10,
      includes_class_11: false
    },

    count: {
      total_classes: 13,
      special_classes: ['Nursery', 'LKG', 'UKG'],
      numeric_classes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      missing: ['11', '12', ...]
    },

    WHERE_CLASS_11_COULD_BE: {
      location: 'Would be between "10" and "]" on line 11',
      code_needed: '..., "10", "11", "12", ...] ',
      status: '❌ NOT PRESENT'
    }
  },

  // ===== QUESTION 3: Does Class-Section Config save Class 11 correctly? =====
  question3_sectionconfig_save: {
    question: 'Does Class-Section Config save Class 11 correctly in SectionConfig?',
    
    answer: '✅ YES - SectionConfig CAN save any class name',
    
    evidence: {
      file: 'components/settings/ClassSectionConfigTab.js',
      
      input_field: {
        line: 206,
        code: '<Input placeholder="e.g., Nursery, LKG, 1, 10" ... />',
        description: 'Input accepts ANY text, including "11"'
      },

      normalization: {
        line: 71,
        code: 'const cls = normalizeClassName(newClassName.trim());',
        input: 'If user enters "11"',
        processing: [
          'Step 1: "11".toLowerCase() = "11"',
          'Step 2: Check if === "nursery"? NO',
          'Step 3: Check if === "lkg"? NO',
          'Step 4: Check if === "ukg"? NO',
          'Step 5: parseInt("11", 10) = 11',
          'Step 6: isNaN(11) && 11 >= 1 && 11 <= 12? YES',
          'Step 7: Return String(11) = "11"'
        ],
        result: 'normalizeClassName("11") = "11" ✅ CORRECT'
      },

      creation: {
        line: 76,
        code: 'SectionConfig.create({ class_name: cls, ... })',
        input: 'cls = "11"',
        result: 'SectionConfig record created with class_name = "11" ✅ SUCCESS'
      },

      schema_check: {
        file: 'entities/SectionConfig.json',
        class_name_field: {
          type: 'string',
          description: 'Plain string — no enum restriction',
          note: 'Allows custom classes, can store any string including "11"'
        }
      },

      VERDICT: '✅ Class 11 IS saved correctly to SectionConfig'
    }
  },

  // ===== QUESTION 4: Why does Class 11 appear in one place but not the other? =====
  question4_why_mismatch: {
    question: 'Why does Class 11 appear in Class-Section Config but NOT in Class Subjects?',
    
    answer: '🔴 HARDCODED vs DYNAMIC MISMATCH',
    
    comparison: {
      class_section_config_tab: {
        file: 'ClassSectionConfigTab.js',
        class_source: 'SectionConfig database (dynamic)',
        how_classes_shown: [
          'Line 30: SectionConfig.filter({ academic_year })',
          'Fetches ALL records for current year',
          'Groups by class_name (line 49-66)',
          'Shows whatever classes exist in database'
        ],
        can_show_class_11: true,
        reason: 'Reads from database, not hardcoded'
      },

      class_subject_config_tab: {
        file: 'ClassSubjectConfigTab.js',
        class_source: 'Hardcoded CLASSES constant (static)',
        how_classes_shown: [
          'Line 11: const CLASSES = [...]',
          'Line 234: {CLASSES.map(cls => ...)}',
          'Only shows classes in hardcoded array'
        ],
        can_show_class_11: false,
        reason: 'List is hardcoded up to 10, not read from database'
      }
    },

    flow_diagram: `
      What Admin Sees:
      ================
      
      Settings → Class-Section Config
      ├─ Reads from: SectionConfig database (dynamic)
      ├─ Query: SectionConfig.filter({ academic_year: "2025-26" })
      ├─ Shows: Nursery, LKG, UKG, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ✅ 11
      └─ Class 11 appears because it's in the database
      
      Settings → Class Subjects
      ├─ Reads from: Hardcoded CLASSES array (line 11)
      ├─ Code: const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', ..., '10']
      ├─ Shows: Nursery, LKG, UKG, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ❌ NO 11
      └─ Class 11 missing because it's not in the hardcoded array
      
      Result: INCONSISTENT DATA SOURCE
      ClassSectionConfigTab: SectionConfig (dynamic)
      ClassSubjectConfigTab: CLASSES constant (static)
    `,

    root_cause: '🔴 CONFIRMED: Two tabs use different sources for class lists'
  },

  // ===== QUESTION 5: Which exact file and line defines the Class Subjects tab list? =====
  question5_exact_location: {
    question: 'Which exact file and line defines the Class Subjects tab list?',
    
    answer: '📍 components/settings/ClassSubjectConfigTab.js - Line 11',
    
    code_location: {
      file_path: 'components/settings/ClassSubjectConfigTab.js',
      line_number: 11,
      code: 'const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];',
      comment: '// Define all classes (hardcoded - Phase 2)'
    },

    where_used: {
      rendering: {
        file: 'ClassSubjectConfigTab.js',
        line: 234,
        code: '{CLASSES.map(cls => (<button...>))}',
        purpose: 'Renders tab buttons for each class in CLASSES'
      },

      initial_selection: {
        file: 'ClassSubjectConfigTab.js',
        line: 106,
        code: 'const [selectedClass, setSelectedClass] = useState(CLASSES[0]);',
        purpose: 'Sets first class ("Nursery") as default selection'
      }
    },

    how_to_find: [
      '1. Open: components/settings/ClassSubjectConfigTab.js',
      '2. Look at line 11',
      '3. See: const CLASSES = [...]',
      '4. Count elements: Nursery, LKG, UKG, 1-10 = 13 elements',
      '5. Notice: No "11", "12", etc.'
    ]
  },

  // ===== QUESTION 6: Safest long-term fix options =====
  question6_fix_options: {
    question: 'What is the safest long-term fix?',
    
    option_1: {
      name: 'EXTEND HARDCODED LIST to include 11, 12',
      risk_level: 'LOW',
      impact: 'MINIMAL - single line change',
      
      what_to_do: [
        'Edit line 11 of ClassSubjectConfigTab.js',
        'Change: ... "10"]',
        'To: ... "10", "11", "12"]'
      ],

      pros: [
        '✅ Quick fix (30 seconds)',
        '✅ No refactoring needed',
        '✅ No schema changes',
        '✅ No impact on other modules',
        '✅ Minimal code change'
      ],

      cons: [
        '❌ Not scalable - if user adds Class 13, 14, etc., will need to edit code again',
        '❌ Doesn\'t match SectionConfig dynamically',
        '❌ Admin could add Class 100 in SectionConfig, but ClassSubjectConfigTab won\'t show it',
        '❌ Creates ongoing maintenance burden'
      ],

      when_it_breaks: 'When user adds Class 12, 13, 14, ... via Class-Section Config, they won\'t appear in Class Subjects'
    },

    option_2: {
      name: 'MAKE CLASS SUBJECTS READ DYNAMICALLY FROM SectionConfig',
      risk_level: 'MEDIUM',
      impact: 'MODERATE - refactoring + behavioral change',
      
      what_to_do: [
        'Replace hardcoded CLASSES with useQuery hook',
        'Fetch unique class names from SectionConfig',
        'Sort and normalize fetched classes',
        'Update tab rendering logic to use dynamic data'
      ],

      pros: [
        '✅ SCALABLE - automatically shows any class added to SectionConfig',
        '✅ CONSISTENT - ClassSubjectConfigTab and ClassSectionConfigTab show same classes',
        '✅ FUTURE-PROOF - no code changes needed when adding new classes',
        '✅ Single source of truth (SectionConfig)'
      ],

      cons: [
        '❌ Requires refactoring ClassSubjectConfigTab component',
        '❌ Adds async data fetching (useQuery)',
        '❌ Adds loading state complexity',
        '❌ Could have timing issues if SectionConfig is empty',
        '❌ Needs fallback logic if SectionConfig is not populated'
      ],

      complexity: 'MEDIUM - ~30-50 lines of code change'
    },

    option_3: {
      name: 'HYBRID: Extend hardcoded list to 12, add a note',
      risk_level: 'LOW-MEDIUM',
      impact: 'MINIMAL - pragmatic middle ground',
      
      what_to_do: [
        'Extend CLASSES constant to include "11", "12"',
        'Add a comment: "Max 12 for now - extend if needed"',
        'Plan to migrate to dynamic loading in Phase 3'
      ],

      pros: [
        '✅ Solves immediate problem (Class 11 visible)',
        '✅ Minimal code change',
        '✅ Quick fix',
        '✅ Works for most schools (rarely need > 12 classes)'
      ],

      cons: [
        '❌ Same scalability issue as Option 1',
        '❌ Still hardcoded',
        '❌ Temporary solution, not long-term fix'
      ]
    }
  },

  // ===== QUESTION 7: Which option is safer without breaking current functionality? =====
  question7_safest_option: {
    question: 'Which option is safer without breaking current functionality?',
    
    answer: '🟢 OPTION 1 IS SAFEST FOR IMMEDIATE NEEDS',
    
    reasoning: {
      why_option_1_is_safest: [
        '✅ Single line change (line 11)',
        '✅ No refactoring required',
        '✅ No async complexity',
        '✅ No loading states to handle',
        '✅ No risk of SectionConfig not being populated',
        '✅ No behavioral changes',
        '✅ Works immediately',
        '✅ Can be rolled back instantly if needed',
        '✅ No impact on Marks, Timetable, or other modules'
      ],

      why_option_2_is_riskier: [
        '⚠️ Requires component refactoring',
        '⚠️ Adds useQuery complexity',
        '⚠️ Need loading state handling',
        '⚠️ Risk of breaking if SectionConfig is empty',
        '⚠️ Risk of timing issues during data load',
        '⚠️ Larger code footprint = more potential bugs',
        '⚠️ Harder to test and verify'
      ]
    },

    RECOMMENDATION: {
      immediate_fix: 'Option 1 (extend hardcoded list to 11, 12)',
      
      action_plan: [
        'Step 1: Edit ClassSubjectConfigTab.js line 11',
        'Step 2: Add "11" and "12" to CLASSES array',
        'Step 3: Test Class 11 appears in Class Subjects tab',
        'Step 4: Admin can now configure subjects for Class 11'
      ],

      future_plan: 'In Phase 3, consider migrating to dynamic class list from SectionConfig',
      
      why_defer_option_2: 'Option 2 requires architectural change and increased testing. Option 1 is sufficient for most use cases and can be extended later if needed.'
    }
  },

  // ===== SUMMARY =====
  summary: {
    root_cause: '🔴 ClassSubjectConfigTab uses HARDCODED class list (line 11) up to Class 10',
    
    why_class_11_missing: [
      'ClassSubjectConfigTab hardcoded CLASSES = [..., "10"] (no "11")',
      'ClassSectionConfigTab reads from SectionConfig (dynamic)',
      'Admin added Class 11 to SectionConfig',
      'Class 11 appears in ClassSectionConfigTab (reads from DB)',
      'Class 11 MISSING from ClassSubjectConfigTab (hardcoded only to 10)'
    ],

    affected_files: {
      file_1: {
        path: 'components/settings/ClassSubjectConfigTab.js',
        line: 11,
        issue: 'HARDCODED CLASSES array limited to Class 10'
      },
      file_2: {
        path: 'components/settings/ClassSectionConfigTab.js',
        line: 30,
        info: 'CORRECTLY reads from SectionConfig (dynamic)'
      }
    },

    safest_fix: 'EXTEND hardcoded CLASSES array on line 11 to include "11", "12", etc.',
    
    why_safest: 'Minimal change, no refactoring, no risk of breaking existing functionality'
  }
};

// Return as formatted response
export default analysis;