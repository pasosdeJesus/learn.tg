declare module '@pasosdejesus/m/test-utils/rainbowkit-mocks' {
  import type { Mock } from 'vitest';

  export interface AuthMockConfig {
    address?: string;
    isConnected?: boolean;
    sessionData?: any;
    csrfToken?: string;
    siweVerificationSuccess?: boolean;
    chainId?: number;
    mockAxios?: boolean;
    axiosMock?: Record<string, any>;
    mockWagmi?: boolean;
    mockSiwe?: boolean;
    mockNextAuth?: boolean;
  }

  export interface AuthMocks {
    mocks: {
      mockSiweMessage: Mock;
      mockGetCsrfToken: Mock;
      mockUseSession: Mock;
      mockUseAccount: Mock;
      mockAxiosGet: Mock;
      mockAxiosPost: Mock;
      mockAxiosPut: Mock;
      mockAxiosDelete: Mock;
      mockAxiosRequest: Mock;
    };
    setupMocks: () => void;
    setupDefaultImplementations: () => void;
    resetMocks: () => void;
    updateConfig: (config: Partial<AuthMockConfig>) => void;
  }

  export function createAuthMocks(config?: AuthMockConfig): AuthMocks;
  export const apiAuthMocks: AuthMocks;
}
