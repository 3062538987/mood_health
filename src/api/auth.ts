import request from '@/utils/request'

export const deleteCurrentAccount = (): Promise<null> => {
  return request<null>({
    url: '/api/auth/me',
    method: 'delete',
  })
}
