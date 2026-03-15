/**
 * React contexts barrel export
 */

export { AuthContext, AuthProvider, type AuthContextValue } from './AuthContext';

export {
  ToastContext,
  ToastProvider,
  useToastContext,
  DEFAULT_TOAST_DURATION,
  type ToastContextValue,
  type Toast,
  type ToastVariant,
  type ToastOptions,
} from './ToastContext';

export {
  WorkspaceContext,
  WorkspaceProvider,
  useWorkspaceContext,
  useActiveWorkspace,
  useWorkspaces,
  type WorkspaceContextValue,
} from './WorkspaceContext';
