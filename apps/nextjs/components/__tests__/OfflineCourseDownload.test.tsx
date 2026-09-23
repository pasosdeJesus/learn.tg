import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Botón de descarga para leer un curso sin conexión
// (https://github.com/pasosdeJesus/learn.tg/issues/256 §3.2/§3.6b).
const hooks = vi.hoisted(() => ({
  address: '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c' as string | undefined,
  ready: true,
  authedGet: vi.fn(),
  downloadCourse: vi.fn(),
  revalidateCourse: vi.fn(),
  record: null as any,
  deleteDownloadedCourse: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({
    authedGet: hooks.authedGet,
    ready: hooks.ready,
    wallet: hooks.address,
  }),
}))

vi.mock('@/lib/hooks/useTranslation', () => ({
  createComponentT: (_lang: string, translations: any) => {
    const dict = translations?.en || {}
    return (key: string) => dict[key] || key
  },
}))

vi.mock('@/lib/offline-course-db', async () => {
  const actual = await vi.importActual<any>('@/lib/offline-course-db')
  return {
    ...actual,
    getDownloadedCourse: vi.fn(async () => hooks.record),
    deleteDownloadedCourse: hooks.deleteDownloadedCourse,
  }
})

vi.mock('@/lib/offline-course-download', () => ({
  downloadCourse: hooks.downloadCourse,
  revalidateCourse: hooks.revalidateCourse,
}))

import { OfflineCourseDownload } from '../OfflineCourseDownload'

const SAVED = {
  key: 'en/web3-and-ubi',
  courseId: 3,
  lang: 'en',
  prefix: 'web3-and-ubi',
  titulo: 'Web3 and UBI',
  contenidoSensible: false,
  isPremium: false,
  wallet: null,
  downloadedAt: Date.now(),
  revision: 'abc',
  guides: [{ suffix: 'guide1', puzzle: null }],
  bytes: 4096,
}

const BASE_PROPS = {
  lang: 'en',
  courseId: 3,
  prefix: 'web3-and-ubi',
  titulo: 'Web3 and UBI',
  contenidoSensible: false,
  isPremium: false,
  guides: ['guide1', 'guide2'],
  canRead: true,
}

describe('OfflineCourseDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hooks.address = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
    hooks.ready = true
    hooks.record = null
    hooks.authedGet.mockResolvedValue({ data: { publicCourses: true, publicSensitiveCourses: false } })
    hooks.downloadCourse.mockResolvedValue(SAVED)
    hooks.revalidateCourse.mockResolvedValue({ updated: false, course: null })
  })

  it('offers the download for a course the wallet can read', async () => {
    render(<OfflineCourseDownload {...BASE_PROPS} />)

    expect(await screen.findByText('Download for offline')).toBeInTheDocument()
  })

  it('renders nothing when the course is not readable', () => {
    const { container } = render(<OfflineCourseDownload {...BASE_PROPS} canRead={false} />)

    expect(container).toBeEmptyDOMElement()
    expect(hooks.downloadCourse).not.toHaveBeenCalled()
  })

  it('offers nothing for a sensitive course while the switch is off', async () => {
    const { container } = render(
      <OfflineCourseDownload {...BASE_PROPS} contenidoSensible />,
    )

    await waitFor(() => expect(hooks.authedGet).toHaveBeenCalledWith('/api/settings'))
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the download for a sensitive course once the switch is on', async () => {
    hooks.authedGet.mockResolvedValue({ data: { publicCourses: true, publicSensitiveCourses: true } })

    render(<OfflineCourseDownload {...BASE_PROPS} contenidoSensible />)

    expect(await screen.findByText('Download for offline')).toBeInTheDocument()
  })

  it('does not offer a sensitive course download to an anonymous visitor', async () => {
    hooks.address = undefined
    const { container } = render(
      <OfflineCourseDownload {...BASE_PROPS} contenidoSensible />,
    )

    await waitFor(() => expect(hooks.authedGet).not.toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('downloads the course and then shows the space it takes', async () => {
    // La descarga deja el registro en el store: el componente lo relee al terminar.
    hooks.downloadCourse.mockImplementation(async () => {
      hooks.record = SAVED
      return SAVED
    })

    render(<OfflineCourseDownload {...BASE_PROPS} />)

    fireEvent.click(await screen.findByText('Download for offline'))

    await waitFor(() => expect(hooks.downloadCourse).toHaveBeenCalledTimes(1))
    expect(hooks.downloadCourse.mock.calls[0][0]).toMatchObject({
      courseId: 3,
      prefix: 'web3-and-ubi',
      guides: ['guide1', 'guide2'],
    })

    await waitFor(() => expect(screen.getByText('You can read this course without a connection')).toBeInTheDocument())
    expect(screen.getByText('4 KB')).toBeInTheDocument()
    expect(screen.getByText('Remove download')).toBeInTheDocument()
  })

  it('does not show a paid copy downloaded with another wallet', async () => {
    hooks.record = { ...SAVED, isPremium: true, wallet: '0xotra' }

    render(<OfflineCourseDownload {...BASE_PROPS} isPremium />)

    await waitFor(() => expect(screen.getByText('Download for offline')).toBeInTheDocument())
  })

  it('revalidates a copy older than a week and tells the user when it changed', async () => {
    hooks.record = { ...SAVED, downloadedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }
    hooks.revalidateCourse.mockResolvedValue({ updated: true, course: SAVED })

    render(<OfflineCourseDownload {...BASE_PROPS} />)

    await waitFor(() => expect(hooks.revalidateCourse).toHaveBeenCalled())
    expect(await screen.findByText('This course was updated: the saved copy was refreshed')).toBeInTheDocument()
  })

  it('does not revalidate a fresh copy', async () => {
    hooks.record = SAVED

    render(<OfflineCourseDownload {...BASE_PROPS} />)

    await waitFor(() => expect(screen.getByText('You can read this course without a connection')).toBeInTheDocument())
    expect(hooks.revalidateCourse).not.toHaveBeenCalled()
  })
})
