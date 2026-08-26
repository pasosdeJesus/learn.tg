import { registerEngine } from '@/lib/engines'

registerEngine('mr519', {
  'GET /forms': () => import('./forms/route').then(m => m.GET),
  'GET /forms/[id]': () => import('./forms/by-id/route').then(m => m.GET),
  'POST /forms/[id]/responses': () => import('./forms/by-id-responses/route').then(m => m.POST),
})

registerEngine('mr519-admin', {
  'POST /forms': () => import('./admin/forms/route').then(m => m.POST),
})
