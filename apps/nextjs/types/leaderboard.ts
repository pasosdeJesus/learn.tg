export interface LeaderboardRow {
  usuario_id: number
  username: string
  pais_alfa2: string | null
  pais_nombre: string | null
  learningpoints: number
  slearn_balance: number
  scholarship_usdt: number
  ubi_celo: number
  donations_usdt: number
  sbt_count?: number
  religion?: string | null
}

export interface LeaderboardQueryParams {
  sortBy?: 'learningpoints' | 'slearn_balance' | 'scholarship_usdt' | 'ubi_celo' | 'donations_usdt' | 'sbt_count'
  sortOrder?: 'asc' | 'desc'
  country?: string
  page?: number
  limit?: number
}

export interface LeaderboardResponse {
  data: LeaderboardRow[]
  rules?: Array<{ action: string; subject: string }>
  totals?: {
    totalUsers: number
    totalUsersWithLP: number
    totalUsersWithSLEARN: number
    totalLearningPoints: number
    totalSLEARNBalance: number
    totalScholarshipUSDT: number
    totalUBICELO: number
    totalDonationsUSDT: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  countries: Array<{
    alfa2: string
    nombre: string
  }>
}

export interface CountryTotals {
  alfa2: string
  nombre: string
  totalUsers: number
  totalUsersWithLP: number
  totalUsersWithSLEARN: number
  totalLearningPoints: number
  totalSLEARNBalance: number
  totalScholarshipUSDT: number
  totalUBICELO: number
  totalDonationsUSDT: number
}

export interface TransparencyResponse {
  data: CountryTotals[]
  rules?: Array<{ action: string; subject: string }>
  totals?: {
    totalUsers: number
    totalUsersWithLP: number
    totalUsersWithSLEARN: number
    totalLearningPoints: number
    totalSLEARNBalance: number
    totalScholarshipUSDT: number
    totalUBICELO: number
    totalDonationsUSDT: number
  }
  reserves?: {
    slearnTotalSupply: number
    slearnExplorerUrl: string
    learnTgReserveUSDT: number
    stableSlReserveUSDT: number
    reserveMultisigUSDT: number
    referralWalletUSDT: number
    churchesWalletUSDT: number
    coverageRatio: number
    coverageTarget: number
    adminTestSLEARN: number
  }
}
