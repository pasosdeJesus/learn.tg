export interface LeaderboardRow {
  usuario_id: number
  username: string
  pais_alfa2: string | null
  pais_nombre: string | null
  learningpoints: number
  scholarship_usdt: number
  ubi_celo: number
  donations_usdt: number
  religion?: string | null
}

export interface LeaderboardQueryParams {
  sortBy?: 'learningpoints' | 'scholarship_usdt' | 'ubi_celo' | 'donations_usdt'
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
    totalLearningPoints: number
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