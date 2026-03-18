/**
 * POST-FIX ANALYSIS: Where did NURSARY come from?
 * Trace the source and prevention strategy
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const analysis = {
      title: 'POST-FIX ANALYSIS: NURSARY ORIGIN & PREVENTION',
      timestamp: new Date().toISOString(),
    };

    // ===== PART 1: WHERE DID NURSARY COME FROM? =====
    analysis.part1_origin = {
      question: 'Where did NURSARY originally come from?',
      
      source_investigation: {
        possibility_1: {
          name: 'Manual Entry in Settings → Class-Section Config Tab',
          file: 'components/settings/ClassSectionConfigTab.js',
          evidence: [
            {
              line: 206,
              code: '<Input placeholder="e.g., Nursery, LKG, 1, 10" ... />',
              description: 'Input field accepts ANY text, no validation'
            },
            {
              line: 71,
              code: 'const cls = normalizeClassName(newClassName.trim());',
              description: 'Input is normalized via normalizeClassName()'
            },
            {
              line: 76,
              code: 'await base44.entities.SectionConfig.create({ class_name: cls, ... })',
              description: 'Normalized value is stored in SectionConfig'
            }
          ],
          how_misspelling_happened: [
            'Admin opens Settings → Class-Section Config',
            'Admin types "NURSARY" instead of "Nursery" in input field',
            'Clicks "Add Class" button',
            'normalizeClassName("NURSARY") is called',
            'normalizer receives "NURSARY" → lowercases to "nursary" → checks if === "nursery"',
            'CHECK FAILS because "nursary" ≠ "nursery"',
            'Falls back to line 77: return cls.toString().trim()',
            'Returns "NURSARY" UNCHANGED',
            'SectionConfig.create stores: class_name = "NURSARY"'
          ],
          conclusion: '⚠️ MOST LIKELY SOURCE',
          risk: 'HIGH - No input validation, normalizer fails on misspelling, misspelled value gets persisted'
        },

        possibility_2: {
          name: 'Data Seed/Initial Setup (Database Seeding)',
          description: 'If SectionConfig was populated via database seeding or data import, misspelled data could have been imported',
          code_location: 'functions folder - potential import/seed functions',
          evidence_needed: 'Check if any seed scripts exist that populate SectionConfig',
          likelihood: 'MEDIUM - Possible if data came from CSV import or old database migration'
        },

        possibility_3: {
          name: 'Copy-Paste Error (From another system)',
          description: 'Class name copied from old system where it was spelled "NURSARY"',
          likelihood: 'LOW - Would need external evidence'
        },

        possibility_4: {
          name: 'Typo in ClassSubjectConfig Flow',
          description: 'Admin might have tried to create ClassSubjectConfig entry manually',
          code_location: 'components/settings/ClassSubjectConfigTab.js line 11',
          evidence: 'const CLASSES = ["Nursery", "LKG", "UKG", ...]',
          notes: 'ClassSubjectConfigTab has hardcoded correct spelling "Nursery", so it could NOT have caused the misspelling'
        }
      },

      VERDICT: '🔴 ROOT SOURCE: Manual typo in Settings → Class-Section Config → "Add New Class" input field',
      CHAIN_OF_EVENTS: [
        '1. Admin enters "NURSARY" in input field',
        '2. normalizeClassName("NURSARY") fails to catch misspelling',
        '3. Falls back to returning "NURSARY" unchanged',
        '4. SectionConfig.create({ class_name: "NURSARY" }) persists misspelling',
        '5. getClassesForYear() retrieves "NURSARY" from SectionConfig',
        '6. Timetable dropdown shows "NURSARY"',
        '7. When selected, query ClassSubjectConfig.filter({ class_name: "NURSARY" })',
        '8. NO MATCH because ClassSubjectConfig has "Nursery"',
        '9. Empty subjects array → empty dropdown'
      ]
    };

    // ===== PART 2: HOW ARE CLASSES POPULATED IN CLASS SUBJECTS TAB? =====
    analysis.part2_class_population = {
      question: 'How are the class tabs populated in the Class Subjects tab?',
      
      source_analysis: {
        file: 'components/settings/ClassSubjectConfigTab.js',
        
        class_list_source: {
          line: 11,
          code: 'const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];',
          description: 'HARDCODED list of correct class names',
          characteristic: 'IMMUTABLE - Cannot be changed by admin input'
        },

        rendering: {
          line: 234,
          code: '{CLASSES.map(cls => (<button...> Class {cls} </button>))}',
          description: 'Creates tab buttons for each class in CLASSES array'
        },

        normalization_during_tab_switch: {
          line: 238,
          code: 'const normalized = normalizeClassName(cls);',
          description: 'When user clicks on a tab, the class name is normalized',
          note: 'CLASSES values are already correct ("Nursery", "LKG", etc.) so normalization is redundant but harmless'
        },

        tab_label_display: {
          line: 248,
          code: '<> Class {cls} </>',
          description: 'Shows hardcoded class name from CLASSES array'
        },

        data_loading_when_tab_selected: {
          line: 126,
          code: 'const normalized = normalizeClassName(selectedClass);',
          description: 'Selected class is normalized before querying ClassSubjectConfig'
        },

        database_query: {
          line: 128,
          code: 'base44.entities.ClassSubjectConfig.filter({ academic_year, class_name: normalized })',
          description: 'Queries with normalized class name'
        }
      },

      VERDICT: '✅ Class Subjects tabs are hardcoded from CLASSES constant',
      WHY_THIS_IS_SAFE: 'ClassSubjectConfigTab uses hardcoded CLASSES array, so it will ALWAYS show correct "Nursery" spelling regardless of what is stored in SectionConfig or ClassSubjectConfig',

      FLOW_DIAGRAM: `
        ClassSubjectConfigTab.js
        ├─ const CLASSES = ["Nursery", "LKG", ...] (line 11 - HARDCODED)
        ├─ Rendering (line 234)
        │  ├─ Tab buttons: {CLASSES.map(cls => ...)} 
        │  └─ Display: "Class Nursery", "Class LKG", etc. (correct spelling shown)
        └─ When user clicks tab
           ├─ normalizeClassName(cls) (line 238)
           ├─ Query: ClassSubjectConfig.filter({ class_name: normalized })
           └─ Load subjects for that class
      `
    };

    // ===== PART 3: WHY ONLY NURSERY GOT MISSPELLED? =====
    analysis.part3_why_only_nursery = {
      question: 'Why did only Nursery become NURSARY, while LKG, UKG, 1, 2, 3 appear correctly?',

      hypothesis_analysis: [
        {
          hypothesis: 'Typo during data entry',
          likelihood: 'HIGH',
          explanation: 'Admin likely entered "NURSARY" instead of "Nursery" when creating SectionConfig',
          why_others_correct: [
            'LKG, UKG, 1-10 were probably entered correctly',
            'Only Nursery was mistyped',
            'Each class is added separately via "Add Class" button'
          ]
        },

        {
          hypothesis: 'Normalization failure specific to Nursery',
          code: 'components/classSectionHelper.js line 18: if (input === "nursery") return "Nursery";',
          explanation: 'This is an EXACT string match check. If misspelled as "nursary", the check fails.',
          why_others_ok: [
            'Numbers 1-10 have numeric parsing fallback (lines 22-23): isNaN check converts "1" → "1"',
            'LKG, UKG would match if correctly spelled (lines 19-20)',
            'But "nursary" does not match "nursery" → falls through to line 24 (returns unchanged)'
          ]
        },

        {
          hypothesis: 'Normalization asymmetry in normalizer',
          analysis: `
            Normalizer logic:
            Line 17: const input = cls.toString().trim().toLowerCase();
            Line 18: if (input === 'nursery') return 'Nursery';  // Only exact match
            Line 19: if (input === 'lkg') return 'LKG';
            Line 20: if (input === 'ukg') return 'UKG';
            Lines 21-23: Numeric parsing for 1-10
            Line 24: return cls.toString().trim();  // Fallback for anything else
            
            If input is "NURSARY":
            Step 1: "NURSARY".toLowerCase() = "nursary"
            Step 2: "nursary" === "nursery"? NO → skip line 18
            Step 3: "nursary" === "lkg"? NO → skip line 19
            Step 4: "nursary" === "ukg"? NO → skip line 20
            Step 5: parseInt("nursary", 10) = NaN → skip lines 22-23
            Step 6: Fall through to line 24: return "NURSARY"
            
            Result: Misspelled "nursary" returns as "NURSARY" UNCHANGED
          `
        }
      ],

      VERDICT: '✅ No special reason Nursery was targeted - simple typo during data entry + normalizer failure to catch misspelling'
    };

    // ===== PART 4: TRACE CLASS FLOW IN CLASS SUBJECTS TAB =====
    analysis.part4_class_subjects_flow = {
      question: 'Complete flow trace for Class Subjects tab',

      flow_steps: [
        {
          step: 1,
          action: 'User opens Settings → Class Subjects tab',
          file: 'pages/Settings.js (tab routing)',
          component: 'ClassSubjectConfigTab'
        },
        {
          step: 2,
          action: 'Component initializes',
          code: 'const { academicYear } = useAcademicYear(); (line 104)',
          value: 'academicYear = "2025-26"'
        },
        {
          step: 3,
          action: 'Class tabs rendered',
          file: 'ClassSubjectConfigTab.js line 234',
          code: 'const CLASSES = ["Nursery", "LKG", "UKG", ...] (line 11 - HARDCODED)',
          display: 'Shows tabs: Class Nursery | Class LKG | Class UKG | ...'
        },
        {
          step: 4,
          action: 'User clicks on "Class Nursery" tab',
          event: 'onClick handler (line 237)',
          code: 'const normalized = normalizeClassName(cls);',
          input: 'cls = "Nursery"',
          normalization: '"Nursery" → lowercase → "nursery" → matches line 18 → returns "Nursery"',
          stored: 'setSelectedClass("Nursery")'
        },
        {
          step: 5,
          action: 'React Query fetches config',
          file: 'line 123-140',
          trigger: 'selectedClass changes (line 139 enabled)',
          queryKey: '["class-subject-config", "2025-26", "Nursery"]'
        },
        {
          step: 6,
          action: 'Query function executes',
          code: 'const normalized = normalizeClassName(selectedClass); (line 126)',
          input: 'selectedClass = "Nursery"',
          output: 'normalized = "Nursery"'
        },
        {
          step: 7,
          action: 'Database query',
          code: 'ClassSubjectConfig.filter({ academic_year: "2025-26", class_name: "Nursery" })',
          database_check: 'ClassSubjectConfig HAS: class_name = "Nursery"',
          result: '✅ MATCH - subjects found: ["English", "Mathematics", "Science", "TEST"]'
        },
        {
          step: 8,
          action: 'UI updates',
          code: 'config = { exists: true, subject_names: [...] }',
          display: 'Shows subject checkboxes'
        },
        {
          step: 9,
          action: 'Admin selects subjects and saves',
          code: 'handleSave() (line 178)',
          function: 'setSubjectsForClass("2025-26", "Nursery", selected)',
          persistence: 'Updates ClassSubjectConfig.class_name = "Nursery"'
        }
      ],

      CRITICAL_INSIGHT: 'ClassSubjectConfigTab NEVER READS FROM SectionConfig. It uses HARDCODED CLASSES array. Therefore, even if SectionConfig has "NURSARY", ClassSubjectConfigTab will still show and use "Nursery" correctly.',

      flow_diagram_ascii: `
        ClassSubjectConfigTab.js
        ├─ const CLASSES = [..., "Nursery", ...] (HARDCODED - line 11)
        ├─ Tab rendering: Show "Class Nursery" button (from CLASSES)
        ├─ User clicks "Class Nursery"
        ├─ setSelectedClass("Nursery") (line 240)
        ├─ useQuery triggers: queryKey = ["class-subject-config", "2025-26", "Nursery"]
        ├─ queryFn executes:
        │  ├─ normalized = normalizeClassName("Nursery") = "Nursery"
        │  ├─ ClassSubjectConfig.filter({ academic_year: "2025-26", class_name: "Nursery" })
        │  └─ Returns: { exists: true, subject_names: [...] }
        ├─ UI renders subject list
        └─ Admin saves with normalized class_name = "Nursery"
      `
    };

    // ===== PART 5: EXACT FILES & SOURCES =====
    analysis.part5_exact_sources = {
      question: 'Identify exact files and helpers',

      affected_files: {
        file_1: {
          path: 'components/settings/ClassSectionConfigTab.js',
          role: 'WHERE MISSPELLING ENTERED SYSTEM',
          lines: {
            206: 'User input: <Input placeholder="e.g., Nursery, LKG, 1, 10" ... />',
            71: 'normalizeClassName(newClassName.trim())',
            76: 'SectionConfig.create({ class_name: cls, ... })'
          },
          issue: 'Input field accepts ANY text with NO VALIDATION. normalizeClassName() fails to catch misspellings. Misspelled value persists to SectionConfig.',
          risk: 'CRITICAL'
        },

        file_2: {
          path: 'components/classSectionHelper.js',
          role: 'NORMALIZER - FAILS TO CATCH MISSPELLING',
          lines: {
            15: 'export const normalizeClassName = (cls) => {',
            17: 'const input = cls.toString().trim().toLowerCase();',
            18: 'if (input === "nursery") return "Nursery";  // EXACT MATCH ONLY',
            24: 'return cls.toString().trim();  // FALLBACK - returns misspelling unchanged'
          },
          issue: 'Line 18 uses === for exact string match. Misspelling "nursary" ≠ "nursery" → falls through to fallback.',
          vulnerable_to: 'Any typo in "nursery": "NURSARY", "nursary", "Nursery" (capital N works), "nurserie", etc.'
        },

        file_3: {
          path: 'components/settings/ClassSubjectConfigTab.js',
          role: 'UNAFFECTED - Uses hardcoded CLASSES array',
          lines: {
            11: 'const CLASSES = ["Nursery", "LKG", "UKG", ...];  // HARDCODED - SAFE'
          },
          why_safe: 'Reads from hardcoded constant, not SectionConfig. Will always show correct "Nursery".'
        },

        file_4: {
          path: 'entities/SectionConfig.json',
          role: 'STORAGE - Contains misspelled data',
          description: 'Database schema allows any string for class_name (no enum restriction)',
          vulnerability: 'No constraint to enforce correct spelling. accepts "NURSARY"'
        },

        file_5: {
          path: 'entities/ClassSubjectConfig.json',
          role: 'REFERENCE - Has correct enum',
          schema: 'class_name enum: ["Nursery", "LKG", ...]',
          note: 'HAS an enum restriction, but ClassSubjectConfig only matches if query provides correct spelling.'
        }
      },

      helpers_involved: {
        helper_1: {
          function: 'normalizeClassName()',
          location: 'components/classSectionHelper.js line 15',
          purpose: 'Canonicalize class names',
          failure_point: 'Does not handle misspellings like "NURSARY"'
        },

        helper_2: {
          function: 'getClassesForYear()',
          location: 'components/classSectionHelper.js line 56',
          purpose: 'Retrieve active classes from SectionConfig',
          flow: 'Fetches SectionConfig → normalizes class names → returns to dropdown',
          failure_chain: 'If SectionConfig has "NURSARY", normalizeClassName returns it unchanged, dropdown shows "NURSARY"'
        }
      }
    };

    // ===== PART 6: SAFEST PREVENTION PLAN =====
    analysis.part6_prevention = {
      title: 'Safest Long-Term Prevention Strategy',

      prevention_options: [
        {
          priority: 1,
          name: 'INPUT VALIDATION in ClassSectionConfigTab',
          scope: 'components/settings/ClassSectionConfigTab.js',
          
          what_to_do: 'Add client-side validation before creating SectionConfig record',
          
          changes_needed: [
            {
              location: 'line 70-72 (addClassMutation.mutationFn)',
              current: `const cls = normalizeClassName(newClassName.trim());
                         if (!cls) throw new Error('Enter a valid class name');`,
              add: `const normalized = normalizeClassName(newClassName.trim());
                    if (!normalized) throw new Error('Enter a valid class name');
                    
                    // Validate: normalized value must equal one of known classes or follow pattern
                    const VALID_CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                    if (!VALID_CLASSES.includes(normalized)) {
                      throw new Error(\`Invalid class name. Must be one of: \${VALID_CLASSES.join(', ')}\`);
                    }`,
              risk: 'LOW - Pure validation, no logic change'
            }
          ],

          result: 'User types "NURSARY" → normalizer returns "NURSARY" → validation fails → toast error → SectionConfig NOT created',
          
          safeguard: 'Prevents invalid class names from entering system at input point'
        },

        {
          priority: 2,
          name: 'HARDENING normalizeClassName()',
          scope: 'components/classSectionHelper.js',
          
          what_to_do: 'Add fuzzy matching for common typos (optional hardening)',
          
          changes_needed: [
            {
              location: 'line 18 (after first check)',
              add: `// Handle common misspellings of Nursery
                    if (input === 'nursery' || input === 'nursary' || input === 'nursry') return 'Nursery';`,
              risk: 'LOW - Defensive coding',
              notes: 'Makes normalizer more robust against typos'
            }
          ],

          result: 'Even if "NURSARY" bypasses validation, normalizer catches it',
          limitation: 'Does not prevent all possible typos (e.g., "NURSREY", "NURSRIE")'
        },

        {
          priority: 3,
          name: 'ADD CONSTRAINTS to SectionConfig schema',
          scope: 'entities/SectionConfig.json',
          
          what_to_do: 'Add enum restriction to class_name field',
          
          changes_needed: [
            {
              location: 'SectionConfig entity schema',
              current: 'class_name: { type: "string" }',
              change_to: `class_name: { 
                type: "string",
                enum: ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
              }`,
              risk: 'MEDIUM - Schema change, requires consideration of custom classes',
              notes: 'ClassSubjectConfig already has this enum. Would enforce at database level.'
            }
          ],

          result: 'Database rejects "NURSARY" at creation time',
          limitation: 'Blocks custom classes if needed in future. Current design allows flexibility.'
        }
      ],

      RECOMMENDED_APPROACH: 'Implement Priority 1 (validation) + Priority 2 (fuzzy matching) together',
      
      implementation_steps: [
        '1. Add VALID_CLASSES list to ClassSectionConfigTab',
        '2. Validate normalized class against VALID_CLASSES before create()',
        '3. Add fuzzy matching for "nursary" → "Nursery" in normalizeClassName()',
        '4. Test with typos: "NURSARY", "nursary", "Nursry", etc.',
        '5. Monitor admin feedback'
      ],

      why_this_is_safest: [
        '✅ No schema changes',
        '✅ No refactoring of existing code',
        '✅ No impact on other modules',
        '✅ Pure validation layer at input point',
        '✅ Prevents misspellings from entering system',
        '✅ Defensive coding in normalizer as backup'
      ]
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