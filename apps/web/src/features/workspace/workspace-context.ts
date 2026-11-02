import { createContext, useContext } from 'react';
import type { Tenant } from '../onboarding/tenant-api';

export interface WorkspaceValue {
  tenant: Tenant;
  accessToken: string;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceLayout.');
  return value;
}
