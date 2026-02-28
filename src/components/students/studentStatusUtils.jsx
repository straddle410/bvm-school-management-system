// Phase 6: Strict Student Status Workflow Control

export const STATUS_FLOW = {
  Pending:    ['Verified'],
  Verified:   ['Approved'],
  Approved:   ['Published'],
  Published:  ['Passed Out', 'Transferred'],
  'Passed Out': [],   // terminal — admin-only revert handled separately
  Transferred:  [],   // terminal
};

// Statuses shown by default (not archived)
export const ACTIVE_STATUSES = ['Pending', 'Verified', 'Approved', 'Published'];
// Archived statuses
export const ARCHIVED_STATUSES = ['Passed Out', 'Transferred'];

export const isLocked = (student) =>
  student?.status === 'Passed Out' || student?.status === 'Transferred';

export const getAllowedTransitions = (currentStatus) =>
  STATUS_FLOW[currentStatus] || [];

// Returns true if the transition is allowed
export const isValidTransition = (from, to) =>
  (STATUS_FLOW[from] || []).includes(to);

// Label map for display
export const STATUS_LABELS = {
  Pending:      'Pending',
  Verified:     'Verified',
  Approved:     'Approved',
  Published:    'Active',
  'Passed Out': 'Passed Out',
  Transferred:  'Transferred',
};