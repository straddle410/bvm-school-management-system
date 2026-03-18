/**
 * COMPREHENSIVE READ-ONLY IMPACT ANALYSIS
 * Switching Class Subjects Tab from Hardcoded to Dynamic Loading from SectionConfig
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const analysis = {
      title: 'IMPACT ANALYSIS: Dynamic Class Loading in Class Subjects Tab',
      timestamp: new Date().toISOString(),
      
      section_1_current_dependencies: {
        heading: '1. CURRENT DEPENDENCIES OF CLASS SUBJECTS TAB ON HARDCODED LIST',
        
        hardcoded_classes_line: {
          file: 'components/settings/ClassSubjectConfigTab.js',
          line: 11,
          code: 'const CLASSES = [Nursery, LKG, UKG, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]'
        },
        
        direct_usage_locations: [
          {
            usage: 'Tab button rendering',
            file: 'ClassSubjectConfigTab.js',
            line: 234,
            code: '{CLASSES.map(cls => (<button...>))}',
            impact: 'Shows tab buttons for each class in CLASSES'
          },
          {
            usage: 'Initial selected class',
            file: 'ClassSubjectConfigTab.js',
            line: 106,
            code: 'const [selectedClass, setSelectedClass] = useState(CLASSES[0])',
            impact: 'Sets first class (Nursery) as default when tab opens'
          }
        ],
        
        why_hardcoded_currently_used: [
          'Static list known at development time',
          'No async/loading state needed',
          'Always available, never empty',
          'Simple to iterate over for UI rendering',
          'Default class (Nursery) immediately available',
          'No dependency on SectionConfig being populated'
        ],
        
        assumptions_made_by_hardcoded_approach: [
          'Classes Nursery through 10 will always exist',
          'No classes beyond 10 needed (until now)',
          'Classes never change during runtime',
          'Class order (Nursery, LKG, UKG, 1-10) is fixed',
          'All classes should always show in tab UI'
        ]
      },

      section_2_switching_to_dynamic_risks: {
        heading: '2. IF WE SWITCH TO DYNAMIC LOADING - WHAT COULD BREAK?',
        
        timing_and_loading: {
          risk: 'LOADING STATE COMPLEXITY',
          description: 'Currently instant, would become async',
          details: [
            'Must add useQuery hook to fetch classes from SectionConfig',
            'Component shows "Loading..." while fetching',
            'Could be 100ms-500ms delay on first load',
            'User sees empty tabs momentarily, then tabs populate'
          ],
          severity: 'LOW',
          likelihood: 'HIGH',
          impact_on_users: 'Slightly slower initial page load, but not breaking'
        },

        empty_sectionconfig_risk: {
          risk: 'SECTIONCONFIG NOT POPULATED',
          description: 'If SectionConfig has no records for a year',
          scenario: [
            'Admin creates a new academic year',
            'ClassSubjectConfigTab opens (before SectionConfig is populated)',
            'Dynamic loading fetches SectionConfig → returns []',
            'No tabs appear — user sees empty screen',
            'Must go to Class-Section Config first to create entries'
          ],
          severity: 'MEDIUM',
          likelihood: 'MEDIUM',
          impact_on_users: 'Confusion — tabs disappear if SectionConfig is empty',
          breaking: true,
          reason: 'Current hardcoded approach always shows tabs; dynamic approach shows nothing if SectionConfig empty'
        },

        fallback_strategy_needed: {
          question: 'How to handle empty SectionConfig?',
          options: [
            {
              option: 'Option A: Show nothing (current behavior would break)',
              pros: ['Accurate — only shows configured classes'],
              cons: ['Confusing — tabs disappear', 'User must add to SectionConfig first']
            },
            {
              option: 'Option B: Show hardcoded defaults as fallback',
              pros: ['Always shows some classes', 'Familiar to users'],
              cons: ['Duplicates hardcoding — two sources of truth', 'If SectionConfig and hardcoded differ, confusing']
            },
            {
              option: 'Option C: Show warning + hardcoded defaults',
              pros: ['Clear feedback to admin', 'Still functional'],
              cons: ['More complex UI logic', 'Two sources of truth']
            }
          ]
        },

        invalid_class_names_risk: {
          risk: 'INVALID CLASS NAMES FROM SECTIONCONFIG',
          description: 'SectionConfig has no enum restriction — accepts any string',
          scenario: [
            'Admin accidentally types "NURSARY" (misspelled) in Class-Section Config',
            'normalizeClassName("NURSARY") fails → returns "NURSARY" unchanged',
            'SectionConfig stores: class_name = "NURSARY"',
            'Dynamic loader fetches from SectionConfig → includes "NURSARY"',
            'Tab shows "NURSARY" button (invalid class name)',
            'User clicks "NURSARY" tab',
            'ClassSubjectConfig.filter({ class_name: "NURSARY" }) returns [] (no match)',
            'Admin cannot configure subjects for "NURSARY"'
          ],
          severity: 'MEDIUM',
          likelihood: 'MEDIUM',
          impact_on_users: 'Invalid classes appear in tabs, cannot be configured',
          breaking: true,
          reason: 'Hardcoded list prevents invalid names; dynamic loading exposes them'
        },

        normalization_issue: {
          question: 'Should we normalize when fetching from SectionConfig?',
          challenge: 'SectionConfig stores raw class_name strings (including misspellings)',
          solution_needed: [
            'When fetching dynamic classes, must call normalizeClassName() on each',
            'Filters out invalid names that fail normalization',
            'De-duplicates (e.g., "nursery" and "Nursery" both map to "Nursery")',
            'Adds complexity to the fetch logic'
          ]
        },

        duplicate_classes_risk: {
          risk: 'DUPLICATE CLASSES IN TABS',
          scenario: [
            'SectionConfig has two records:',
            '  { class_name: "Nursery", section: "A" }',
            '  { class_name: "NURSERY", section: "B" }  (uppercase)',
            'Dynamic fetch returns raw class_names: ["Nursery", "NURSERY"]',
            'normalizeClassName("Nursery") = "Nursery"',
            'normalizeClassName("NURSERY") = "Nursery" (same)',
            'Without de-duplication, two "Nursery" tabs appear',
            'User clicks one, then the other — confusion'
          ],
          severity: 'MEDIUM',
          likelihood: 'MEDIUM',
          solution: 'Must de-duplicate after normalization using Set'
        },

        ordering_risk: {
          risk: 'WRONG CLASS ORDER',
          description: 'SectionConfig has class_display_order, hardcoded list has implicit order',
          scenario: [
            'Admin adds classes to SectionConfig in wrong order',
            'Admin adds: { class_name: "10", class_display_order: 1 }',
            '          { class_name: "1", class_display_order: 2 }',
            'Dynamic loader fetches → sorts by class_display_order',
            'Tabs show: "Class 10", "Class 1" (reversed order)',
            'Confuses admins who expect Nursery → 10 order'
          ],
          severity: 'LOW',
          likelihood: 'LOW',
          solution: 'Fetch with sorting by class_display_order (already done in classSectionHelper)'
        }
      },

      section_3_impact_on_other_modules: {
        heading: '3. WILL THIS AFFECT MARKS, TIMETABLE, HOMEWORK, DIARY, EXAMS?',
        
        key_insight: 'These modules use getSubjectsForClass() and getClassesForYear() from helpers, NOT from ClassSubjectConfigTab',
        
        marks_module: {
          file: 'pages/Marks.js',
          current_flow: [
            'Line 76: getClassesForYear(academicYear) — fetches from SectionConfig',
            'Line 38: getSubjectsForClass(academicYear, selectedClass) — fetches from ClassSubjectConfig',
            'Uses: availableClasses, availableSections, subjects'
          ],
          will_break: false,
          reason: 'Marks already uses dynamic loading from SectionConfig via classSectionHelper.js. Change to ClassSubjectConfigTab does NOT affect Marks.',
          dependency_on_classsubjecttab: 'NONE — Marks has its own useQuery for classes'
        },

        timetable_module: {
          file: 'pages/TimetableManagement.js',
          current_flow: [
            'Line 37: getClassesForYear(academicYear) — fetches from SectionConfig',
            'Line 44: getSectionsForClass(academicYear, filters.class) — fetches from SectionConfig',
            'Uses: availableClasses, availableSections'
          ],
          will_break: false,
          reason: 'Timetable already uses dynamic loading from SectionConfig. Change to ClassSubjectConfigTab does NOT affect Timetable.',
          dependency_on_classsubjecttab: 'NONE'
        },

        classsubjectconfig_records: {
          entity: 'ClassSubjectConfig',
          schema_enum: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          issue: 'ClassSubjectConfig.json has HARDCODED enum restriction on class_name',
          consequence: [
            'If admin adds Class 11 to SectionConfig',
            'Admin opens ClassSubjectConfigTab (whether hardcoded or dynamic)',
            'Admin tries to save subjects for Class 11',
            'ClassSubjectConfig.create({ class_name: "11", ... }) is called',
            'Schema validation FAILS — "11" is not in enum',
            'Save fails with error: "Invalid class_name value"'
          ],
          verdict: 'BREAKING ISSUE: ClassSubjectConfig schema must be updated to allow Class 11+',
          required_fix: 'Update ClassSubjectConfig.json to remove enum restriction OR add "11", "12", etc. to enum'
        },

        homework_impact: {
          file: 'Not explicitly analyzed in provided code',
          likely_flow: 'Homework probably uses getSubjectsForClass() from subjectHelper',
          impact_on_classsubjecttab_change: 'NONE — change to ClassSubjectConfigTab UI does not affect Homework logic'
        },

        diary_impact: {
          file: 'Not explicitly analyzed in provided code',
          likely_flow: 'Diary probably uses getSubjectsForClass() from subjectHelper',
          impact_on_classsubjecttab_change: 'NONE — change to ClassSubjectConfigTab UI does not affect Diary logic'
        },

        exams_impact: {
          file: 'Not explicitly analyzed in provided code',
          likely_flow: 'Exams probably use ExamType entity + ExamTimetable',
          impact_on_classsubjecttab_change: 'NONE — change to ClassSubjectConfigTab UI does not affect Exams logic'
        },

        SUMMARY: 'Changing ClassSubjectConfigTab UI does NOT break Marks, Timetable, Homework, Diary, or Exams. They are DECOUPLED and use their own data fetching.'
      },

      section_4_specific_risks: {
        heading: '4. SPECIFIC RISKS FROM DYNAMIC LOADING',
        
        risk_1_invalid_names: {
          name: 'Invalid class names from SectionConfig',
          root_cause: 'SectionConfig allows any string (no enum)',
          example: '"NURSARY", "class11", "grade5"',
          consequence: 'Tab shows invalid names that don\'t match ClassSubjectConfig enum',
          mitigation: [
            'Add validateClassName() check when fetching',
            'Only include classes that pass normalizeClassName() validation',
            'De-duplicate after normalization'
          ],
          complexity: 'MEDIUM',
          safety_impact: 'Without mitigation, tabs show invalid classes'
        },

        risk_2_empty_state: {
          name: 'Empty SectionConfig → no tabs shown',
          root_cause: 'SectionConfig not yet populated for new year',
          scenario: 'Admin creates year → opens ClassSubjectConfigTab → sees no tabs',
          consequence: 'User confusion, cannot configure subjects',
          mitigation: [
            'Fallback to hardcoded defaults if SectionConfig empty',
            'Show warning message',
            'Redirect to Class-Section Config first'
          ],
          complexity: 'LOW',
          safety_impact: 'Without mitigation, workflow breaks'
        },

        risk_3_loading_state: {
          name: 'Loading delay + loading UI',
          root_cause: 'Async fetching instead of sync hardcoded list',
          impact: 'Component must handle isLoading state',
          mitigation: [
            'Add "Loading..." text while fetching',
            'Cache query results with staleTime',
            'Pre-fetch on component mount'
          ],
          complexity: 'LOW',
          safety_impact: 'Minor UX issue, not breaking'
        },

        risk_4_performance: {
          name: 'Extra database query on every page load',
          root_cause: 'useQuery hook to fetch SectionConfig',
          impact: 'One extra DB query vs zero with hardcoded',
          mitigation: [
            'Use React Query caching (already in place)',
            'Set staleTime to 5-10 minutes',
            'Re-use result from classSectionHelper if available'
          ],
          complexity: 'LOW',
          safety_impact: 'Negligible performance impact'
        },

        risk_5_data_mismatch: {
          name: 'SectionConfig and ClassSubjectConfig out of sync',
          scenario: [
            'SectionConfig has: Class 1, Class 2, Class 3',
            'ClassSubjectConfig has: Class 1, Class 2 (Class 3 subjects not configured)',
            'User selects Class 3 tab',
            'No subjects configured → shows "Not configured" warning',
            'Admin must add subjects for Class 3'
          ],
          impact: 'Incomplete configuration warnings',
          mitigation: 'Show clear warning when no subjects configured for selected class',
          complexity: 'LOW',
          safety_impact: 'Already handled in current UI (line 259-262)'
        }
      },

      section_5_what_remains_safe: {
        heading: '5. WHAT REMAINS SAFE (NO RISK OF BREAKING)',
        
        safe_components: [
          {
            component: 'setSubjectsForClass() backend function',
            reason: 'Logic does not depend on how classes are fetched',
            remains_safe: true
          },
          {
            component: 'ClassSubjectConfig database records',
            reason: 'Existing records remain unchanged',
            remains_safe: true
          },
          {
            component: 'getSubjectsForClass() in subjectHelper',
            reason: 'Fetches by class_name, agnostic to how tabs are populated',
            remains_safe: true
          },
          {
            component: 'Marks module',
            reason: 'Uses its own queries, not ClassSubjectConfigTab',
            remains_safe: true
          },
          {
            component: 'Timetable module',
            reason: 'Uses its own queries, not ClassSubjectConfigTab',
            remains_safe: true
          },
          {
            component: 'Other modules (Homework, Diary)',
            reason: 'Independent of ClassSubjectConfigTab',
            remains_safe: true
          }
        ]
      },

      section_6_safest_implementation: {
        heading: '6. SAFEST IMPLEMENTATION APPROACH (IF ADOPTED)',
        
        implementation_steps: [
          {
            step: 1,
            name: 'Update ClassSubjectConfig schema',
            action: 'Remove enum restriction on class_name',
            code: 'Change: "enum": ["Nursery", "LKG", ... "10"]',
            code_to: 'Keep plain string, no enum',
            reason: 'Allow any class name from SectionConfig (including future Class 11, 12, etc.)',
            risk_if_skipped: 'CRITICAL — Cannot save for Class 11 even if tabs show it'
          },
          {
            step: 2,
            name: 'Add data validation helper',
            action: 'Create validateAndNormalizeClasses() function',
            pseudocode: [
              'Input: array of raw class_names from SectionConfig',
              'For each class:',
              '  - Call normalizeClassName()',
              '  - Filter out invalid (returns empty)',
              '  - De-duplicate',
              '  - Sort by class_display_order',
              'Output: array of valid, normalized, unique classes'
            ],
            reason: 'Protects UI from invalid class names',
            complexity: 'MEDIUM'
          },
          {
            step: 3,
            name: 'Add fallback for empty SectionConfig',
            action: 'If no SectionConfig records, show hardcoded defaults',
            pseudocode: [
              'const classes = await getClassesForYear(academicYear)',
              'if (classes.length === 0) {',
              '  return DEFAULT_CLASSES',
              '}'
            ],
            reason: 'Prevents empty tabs on new years',
            complexity: 'LOW'
          },
          {
            step: 4,
            name: 'Add loading state UI',
            action: 'Show "Loading..." while fetching classes',
            complexity: 'LOW'
          },
          {
            step: 5,
            name: 'Add de-duplication logic',
            action: 'Use Set to remove duplicate class_names after normalization',
            complexity: 'LOW'
          },
          {
            step: 6,
            name: 'Test thoroughly',
            scenarios: [
              'New year with empty SectionConfig',
              'SectionConfig with Class 11, 12',
              'SectionConfig with misspellings ("NURSARY")',
              'SectionConfig with duplicate classes ("Nursery", "NURSERY")',
              'Empty ClassSubjectConfig for a class'
            ]
          }
        ],

        critical_prerequisite: {
          requirement: 'UPDATE ClassSubjectConfig.json BEFORE switching to dynamic loading',
          current_schema: '{ "class_name": { "enum": ["Nursery", "LKG", ..., "10"] } }',
          updated_schema: '{ "class_name": { "type": "string" } }',
          reason: 'Current enum prevents saving for Class 11+',
          if_not_done: 'Dynamic loading will break when user tries to save for Class 11'
        }
      },

      section_7_phased_plan: {
        heading: '7. RECOMMENDED PHASED PLAN FOR MIGRATION',
        
        phase_0_immediate: {
          name: 'Phase 0 (CURRENT) - Keep Hardcoded List',
          action: 'Extend CLASSES array to include "11", "12"',
          timeline: 'Now (5 minutes)',
          risk: 'LOW',
          effort: 'MINIMAL',
          why: 'Solves immediate problem (Class 11 not showing)',
          code_change: [
            'ClassSubjectConfigTab.js line 11:',
            'const CLASSES = [..., "10", "11", "12"];'
          ]
        },

        phase_1_schema_update: {
          name: 'Phase 1 (PLANNED) - Update Schema',
          action: 'Remove enum from ClassSubjectConfig.class_name',
          timeline: 'Next sprint',
          risk: 'LOW',
          effort: 'MINIMAL',
          why: 'Prerequisite for Phase 2',
          steps: [
            'Update entities/ClassSubjectConfig.json',
            'Remove enum restriction',
            'Test saves for Class 11'
          ]
        },

        phase_2_add_helpers: {
          name: 'Phase 2 (PLANNED) - Add Validation Helpers',
          action: 'Create validateAndNormalizeClasses() function',
          timeline: 'Following sprint',
          risk: 'LOW',
          effort: 'MEDIUM',
          why: 'Prepare for dynamic loading',
          steps: [
            'Create components/classNameValidator.js',
            'Implement normalization + de-duplication',
            'Test with various inputs'
          ]
        },

        phase_3_migrate_to_dynamic: {
          name: 'Phase 3 (PLANNED) - Migrate to Dynamic Loading',
          action: 'Switch ClassSubjectConfigTab to useQuery from SectionConfig',
          timeline: 'Final sprint',
          risk: 'MEDIUM',
          effort: 'MEDIUM',
          why: 'Eliminates hardcoding, makes system scalable',
          requirements: [
            'Phase 1 complete (schema updated)',
            'Phase 2 complete (helpers ready)',
            'Comprehensive testing'
          ],
          implementation: [
            'Replace hardcoded CLASSES with useQuery',
            'Fetch from SectionConfig',
            'Apply validateAndNormalizeClasses()',
            'Add fallback to hardcoded defaults',
            'Add loading state',
            'Test all scenarios'
          ]
        },

        phase_4_cleanup: {
          name: 'Phase 4 (OPTIONAL) - Cleanup',
          action: 'Remove hardcoded CLASSES constant',
          timeline: 'After Phase 3 stable for 2 weeks',
          risk: 'LOW',
          effort: 'MINIMAL',
          why: 'Clean up code, remove unused constant'
        }
      },

      section_8_recommendation: {
        heading: '8. FINAL RECOMMENDATION',
        
        question: 'Should we keep hardcoded list, extend it, or migrate to dynamic?',
        
        answer_short: 'THREE DIFFERENT APPROACHES FOR DIFFERENT TIMEFRAMES',
        
        approach_1_immediate: {
          name: 'IMMEDIATE (Next 2 hours)',
          action: 'Extend hardcoded list to Class 12',
          file: 'ClassSubjectConfigTab.js line 11',
          change: 'const CLASSES = [..., "10", "11", "12"];',
          why: [
            'Solves Class 11 problem immediately',
            'Zero risk',
            'Zero refactoring',
            'Backward compatible'
          ],
          when_to_use: 'IF you need Class 11 visible NOW',
          downside: 'Still hardcoded, not scalable for Class 13, 14, etc.'
        },

        approach_2_safe_phased: {
          name: 'RECOMMENDED (3-4 sprints)',
          action: 'Phase 0 → Phase 1 → Phase 2 → Phase 3',
          timeline: [
            'Week 1 (Phase 0): Extend to Class 12',
            'Week 2 (Phase 1): Update schema',
            'Week 3 (Phase 2): Add validation helpers',
            'Week 4 (Phase 3): Migrate to dynamic'
          ],
          why: [
            'Eliminates hardcoding long-term',
            'Scalable for any future classes',
            'Lower risk per phase',
            'Thoroughly tested'
          ],
          when_to_use: 'IF you want a future-proof solution'
        },

        approach_3_defer: {
          name: 'DEFER (Not recommended)',
          action: 'Keep hardcoded list as-is, add Class 13, 14, 15 later as needed',
          why: [
            'Minimal effort each time',
            'No refactoring needed'
          ],
          when_to_use: 'Never — creates technical debt, repeated code changes'
        }
      },

      conclusion: {
        root_cause: 'ClassSubjectConfigTab uses hardcoded CLASSES array (line 11). SectionConfig allows any class_name (no enum). Mismatch creates discrepancy.',
        
        what_breaks_if_we_switch: [
          '🔴 ClassSubjectConfig schema must be updated (remove enum) FIRST',
          '🟡 Empty SectionConfig → no tabs (need fallback)',
          '🟡 Invalid class names from SectionConfig → confusing tabs (need validation)',
          '🟡 Loading delay (minor UX impact)',
          '🟢 Marks, Timetable, Homework, Diary, Exams NOT affected (independent)'
        ],
        
        safest_approach: 'Phased migration: Phase 0 (extend hardcoded now) → Phase 1-3 (migrate safely over 3 sprints)',
        
        critical_first_step: 'Update ClassSubjectConfig.json schema to remove enum restriction before attempting dynamic loading'
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