import * as React from 'react';

import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext';

export function useAuth(): AuthContextValue {
  const authContext = React.useContext(AuthContext);

  if (!authContext) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return authContext;
}

export default useAuth;
