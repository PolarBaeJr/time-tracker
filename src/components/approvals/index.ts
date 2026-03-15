/**
 * Approval Components Barrel Export
 *
 * This module exports all approval workflow UI components for
 * time entry approval management.
 */

// Status display
export { ApprovalStatusBadge, type ApprovalStatusBadgeProps } from './ApprovalStatusBadge';

// Queue and list views
export { ApprovalQueue, type ApprovalQueueProps } from './ApprovalQueue';
export { SubmissionList, type SubmissionListProps } from './SubmissionList';

// Action modals and sheets
export { ApprovalActionSheet, type ApprovalActionSheetProps } from './ApprovalActionSheet';
export { SubmitEntriesModal, type SubmitEntriesModalProps } from './SubmitEntriesModal';

// Admin management
export {
  ApprovalAssignmentManager,
  type ApprovalAssignmentManagerProps,
} from './ApprovalAssignmentManager';
