export interface LeaderboardRow {
  usuario_id: number
  username: string
  pais_alfa2: string | null
  pais_nombre: string | null
  slearn_balance: number
  scholarship_usdt: number
  ubi_celo: number
  donations_usdt: number
  sbt_count?: number
  // R-#278: marcos por guía (aprobada, beca USDT, beca SLEARN) y su suma (`guide_score`),
  // uno de los componentes del ranking (§4).
  guide_approved: number
  guide_usdt: number
  guide_slearn: number
  guide_score: number
  // Puesto canonico del estudiante (ROW_NUMBER() sobre el orden canonico compartido
  // con el perfil, R-#278 §4). No depende del orden que el visitante elija.
  canonical_rank?: number
  religion?: string | null
}

export interface LeaderboardQueryParams {
  sortBy?: 'slearn_balance' | 'scholarship_usdt' | 'ubi_celo' | 'donations_usdt' | 'sbt_count' | 'guide_approved' | 'guide_usdt' | 'guide_slearn' | 'guide_score' | 'platform_score'
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
    totalUsersWithSLEARN: number
    totalSLEARNBalance: number
    totalScholarshipUSDT: number
    totalUBICELO: number
    totalDonationsUSDT: number
    // Referidos (R-#163): el único lugar público donde se publica el número (§4.1).
    totalReferrals: number
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
  totalUsersWithSLEARN: number
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
    totalUsersWithSLEARN: number
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
    referralWalletSLEARN: number
    churchesWalletUSDT: number
    churchesWalletSLEARN: number
    coverageRatio: number
    coverageTarget: number
    adminTestSLEARN: number
    vaultSLEARN: number
  }
  // Flujos de SLEARN en los pagos de cursos (lo que se quema y lo que se acuña como
  // recompensa): lo que el panel de transparencia puede publicar sin abrir la
  // contabilidad comercial de learn.tg, que vive en `/api/admin/premium-purchases`.
  premiumSlearn?: {
    burned: number
    minted: number
  }
}
