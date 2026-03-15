/**
 * Project Components Barrel Export
 *
 * This module exports all project-related UI components for workspace
 * project management functionality.
 */

// Core components
export { ProjectCard, type ProjectCardProps } from './ProjectCard';
export { ProjectList, type ProjectListProps, type ProjectFilter } from './ProjectList';
export { CreateProjectModal, type CreateProjectModalProps } from './CreateProjectModal';
export { ProjectDetailSheet, type ProjectDetailSheetProps } from './ProjectDetailSheet';

// Member management
export { ProjectMemberList, type ProjectMemberListProps } from './ProjectMemberList';
export { AddProjectMemberModal, type AddProjectMemberModalProps } from './AddProjectMemberModal';

// Shared components
export { RolePicker, type RolePickerProps } from './RolePicker';
export { ProjectPicker, type ProjectPickerProps } from './ProjectPicker';
