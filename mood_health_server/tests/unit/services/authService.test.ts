import { createAuthService } from '../../../src/services/authService'
import { DuplicateUserError, UserRepository } from '../../../src/repositories/userRepository'

const authUser = {
  id: 8,
  username: 'student_demo',
  passwordHash: 'hashed-password',
  email: 'student@example.com',
  nickname: '学生演示',
  avatarUrl: null,
  status: 'active' as const,
  role: 'student' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  lastLoginAt: null,
}

const publicUser = {
  id: authUser.id,
  username: authUser.username,
  email: authUser.email,
  nickname: authUser.nickname,
  avatarUrl: authUser.avatarUrl,
  status: authUser.status,
  role: authUser.role,
  createdAt: authUser.createdAt,
  updatedAt: authUser.updatedAt,
  lastLoginAt: authUser.lastLoginAt,
}

const createRepository = (): jest.Mocked<UserRepository> => ({
  findAuthUserByUsername: jest.fn(),
  findPublicUserById: jest.fn(),
  createStudentUser: jest.fn(),
  updateLastLoginAt: jest.fn(),
})

describe('authService', () => {
  it('registers a student account with a hashed password and generated default email', async () => {
    const repository = createRepository()
    repository.findAuthUserByUsername.mockResolvedValue(null)
    repository.createStudentUser.mockResolvedValue(8)
    const service = createAuthService({
      repository,
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      comparePassword: jest.fn(),
      signJwt: jest.fn(),
      jwtSecret: 'test-secret',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      randomSuffix: () => 'abc123',
    })

    await service.register({ username: 'Student_Demo', password: 'Password123!' })

    expect(repository.createStudentUser).toHaveBeenCalledWith({
      username: 'Student_Demo',
      passwordHash: 'hashed-password',
      email: 'student_demo_1767225600000abc123@temp.user',
      nickname: null,
    })
  })

  it('rejects client supplied role fields during registration', async () => {
    const service = createAuthService({
      repository: createRepository(),
      hashPassword: jest.fn(),
      comparePassword: jest.fn(),
      signJwt: jest.fn(),
      jwtSecret: 'test-secret',
    })

    await expect(
      service.register({ username: 'student_demo', password: 'Password123!', role: 'super_admin' })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('maps duplicate username or email to a 400 business error', async () => {
    const repository = createRepository()
    repository.findAuthUserByUsername.mockResolvedValue(null)
    repository.createStudentUser.mockRejectedValue(new DuplicateUserError())
    const service = createAuthService({
      repository,
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      comparePassword: jest.fn(),
      signJwt: jest.fn(),
      jwtSecret: 'test-secret',
    })

    await expect(
      service.register({ username: 'student_demo', password: 'Password123!' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('logs in with repository user, signs the JWT role code, updates last login, and hides password hash', async () => {
    const repository = createRepository()
    repository.findAuthUserByUsername.mockResolvedValue(authUser)
    const comparePassword = jest.fn().mockResolvedValue(true)
    const signJwt = jest.fn().mockReturnValue('jwt-token')
    const service = createAuthService({
      repository,
      hashPassword: jest.fn(),
      comparePassword,
      signJwt,
      jwtSecret: 'test-secret',
    })

    const result = await service.login({ username: 'student_demo', password: 'Password123!' })

    expect(comparePassword).toHaveBeenCalledWith('Password123!', 'hashed-password')
    expect(signJwt).toHaveBeenCalledWith(
      { userId: 8, username: 'student_demo', role: 'student' },
      'test-secret',
      { expiresIn: '7d' }
    )
    expect(repository.updateLastLoginAt).toHaveBeenCalledWith(8)
    expect(result).toEqual({ token: 'jwt-token', user: publicUser })
    expect(JSON.stringify(result)).not.toContain('passwordHash')
  })

  it('rejects login when the user is missing or password is invalid without revealing which field failed', async () => {
    const repository = createRepository()
    repository.findAuthUserByUsername.mockResolvedValue(null)
    const service = createAuthService({
      repository,
      hashPassword: jest.fn(),
      comparePassword: jest.fn(),
      signJwt: jest.fn(),
      jwtSecret: 'test-secret',
    })

    await expect(
      service.login({ username: 'missing_user', password: 'Password123!' })
    ).rejects.toMatchObject({ statusCode: 401, message: '用户名或密码错误' })
  })

  it('returns the public current user from /me without password hash', async () => {
    const repository = createRepository()
    repository.findPublicUserById.mockResolvedValue(publicUser)
    const service = createAuthService({
      repository,
      hashPassword: jest.fn(),
      comparePassword: jest.fn(),
      signJwt: jest.fn(),
      jwtSecret: 'test-secret',
    })

    await expect(service.getMe(8)).resolves.toEqual(publicUser)
  })
})
