import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { createUserRepository, DuplicateUserError, PublicUser, UserRepository } from '../repositories/userRepository'
import { comparePassword as comparePasswordUtil, hashPassword as hashPasswordUtil } from '../utils/password'
import { BusinessError, HttpException, RedisError } from '../utils/errors'
import redisClient from '../utils/redis.client'
import logger from '../utils/logger'

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCK_MINUTES = 15

type JwtSigner = (
  payload: { userId: number; username: string; role: string },
  secret: string,
  options: jwt.SignOptions
) => string

interface AuthServiceDependencies {
  repository?: UserRepository
  hashPassword?: (password: string) => Promise<string>
  comparePassword?: (password: string, passwordHash: string) => Promise<boolean>
  signJwt?: JwtSigner
  jwtSecret?: string
  now?: () => Date
  randomSuffix?: () => string
}

interface RegisterInput {
  username?: string
  password?: string
  role?: unknown
  isAdmin?: unknown
}

interface LoginInput {
  username?: string
  password?: string
}

interface LoginResult {
  token: string
  user: PublicUser
}

interface UpdateProfileInput {
  username?: unknown
  avatarUrl?: unknown
}

const buildDefaultEmail = (
  username: string,
  now: () => Date = () => new Date(),
  randomSuffix: () => string = () => crypto.randomBytes(3).toString('hex')
): string => {
  const sanitized = username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 12)
  const prefix = sanitized || 'user'
  return `${prefix}_${now().getTime()}${randomSuffix()}@temp.user`
}

const toPublicUser = (user: {
  id: number
  username: string
  email: string
  nickname: string | null
  avatarUrl: string | null
  status: PublicUser['status']
  role: PublicUser['role']
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  nickname: user.nickname,
  avatarUrl: user.avatarUrl,
  status: user.status,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
})

const incrementLoginAttempts = async (
  redis: typeof redisClient,
  username: string
): Promise<void> => {
  // 安全关键：Redis 不可用必须抛错，由调用方拒绝登录，避免暴力破解绕过计数
  const attemptsKey = `login_attempts:${username}`
  const lockKey = `login_locked:${username}`
  const attempts = await redis.executeSecure((k) => redis.incr(k), attemptsKey)
  await redis.executeSecure(
    (k, ttl) => redis.expire(k, ttl),
    attemptsKey,
    LOGIN_LOCK_MINUTES * 60
  )
  if (attempts !== null && attempts >= MAX_LOGIN_ATTEMPTS) {
    await redis.executeSecure((k, v, ttl) => redis.set(k, v, ttl), lockKey, '1', LOGIN_LOCK_MINUTES * 60)
  }
}

export const createAuthService = (dependencies: AuthServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createUserRepository()
  const hashPassword = dependencies.hashPassword ?? hashPasswordUtil
  const comparePassword = dependencies.comparePassword ?? comparePasswordUtil
  const signJwt = dependencies.signJwt ?? ((payload, secret, options) => jwt.sign(payload, secret, options))
  const jwtSecret = dependencies.jwtSecret ?? process.env.JWT_SECRET
  const now = dependencies.now
  const randomSuffix = dependencies.randomSuffix

  const register = async (input: RegisterInput): Promise<void> => {
    if (input.role !== undefined || input.isAdmin !== undefined) {
      throw new HttpException('管理员账号只能通过后台脚本创建', 403)
    }

    if (!input.username || !input.password) {
      throw new BusinessError('请提供用户名和密码')
    }

    const existingUser = await repository.findAuthUserByUsername(input.username)
    if (existingUser) {
      throw new BusinessError(`用户名"${input.username}" 已存在，请更换其他用户名`)
    }

    const passwordHash = await hashPassword(input.password)

    try {
      await repository.createStudentUser({
        username: input.username,
        passwordHash,
        email: buildDefaultEmail(input.username, now, randomSuffix),
        nickname: null,
      })
    } catch (error) {
      if (error instanceof DuplicateUserError) {
        throw new BusinessError('用户名或邮箱已存在')
      }
      throw error
    }
  }

  const login = async (input: LoginInput): Promise<LoginResult> => {
    if (!input.username || !input.password) {
      throw new BusinessError('请提供用户名和密码')
    }

    // 登录失败次数限制：检查是否被锁定
    const redis = redisClient
    const lockKey = `login_locked:${input.username}`
    const attemptsKey = `login_attempts:${input.username}`

    // 安全关键（R6 fail-closed）：Redis 不可用时拒绝登录，
    // 阻止攻击者借 Redis 故障绕过登录失败锁定进行暴力破解
    try {
      const isLocked = await redis.executeSecure((k) => redis.get(k), lockKey)
      if (isLocked) {
        throw new HttpException(`登录失败次数过多，请${LOGIN_LOCK_MINUTES}分钟后再试`, 429)
      }
    } catch (err) {
      if (err instanceof RedisError) {
        logger.error('[authService] Redis 不可用，拒绝登录以防暴力破解', { error: (err as Error).message })
        throw new HttpException('登录风控服务暂时不可用，请稍后重试', 503)
      }
      throw err
    }

    const user = await repository.findAuthUserByUsername(input.username)
    if (!user) {
      await incrementLoginAttempts(redis, input.username)
      throw new HttpException('用户名或密码错误', 401)
    }

    const isValid = await comparePassword(input.password, user.passwordHash)
    if (!isValid) {
      await incrementLoginAttempts(redis, input.username)
      throw new HttpException('用户名或密码错误', 401)
    }

    // 登录成功，清除失败计数
    if (!redis.lastError) {
      await redis.del(attemptsKey)
      await redis.del(lockKey)
    }

    if (!jwtSecret) {
      throw new HttpException('服务配置错误', 500)
    }

    const token = signJwt(
      { userId: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    )

    await repository.updateLastLoginAt(user.id).catch((err) => {
        logger.error('[authService] updateLastLoginAt failed', { error: (err as Error).message })
      })

    return {
      token,
      user: toPublicUser(user),
    }
  }

  const getMe = async (userId: number): Promise<PublicUser> => {
    const user = await repository.findPublicUserById(userId)
    if (!user) {
      throw new HttpException('用户不存在', 404)
    }
    return user
  }

  const updateProfile = async (
    userId: number,
    input: UpdateProfileInput
  ): Promise<PublicUser> => {
    if (
      typeof input.username !== 'string' ||
      !/^[\u4e00-\u9fa5a-zA-Z0-9_]{3,20}$/.test(input.username.trim())
    ) {
      throw new BusinessError('用户名需为3-20位，可包含中文、字母、数字或下划线')
    }

    let avatarUrl: string | null = null
    if (input.avatarUrl !== null && input.avatarUrl !== undefined && input.avatarUrl !== '') {
      if (typeof input.avatarUrl !== 'string' || input.avatarUrl.length > 500) {
        throw new BusinessError('头像地址无效')
      }
      try {
        const url = new URL(input.avatarUrl)
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe')
        avatarUrl = input.avatarUrl
      } catch {
        throw new BusinessError('头像必须使用安全的 HTTPS 地址')
      }
    }

    try {
      const user = await repository.updateProfile(userId, {
        username: input.username.trim(),
        avatarUrl,
      })
      if (!user) throw new HttpException('用户不存在', 404)
      return user
    } catch (error) {
      if (error instanceof DuplicateUserError) throw new BusinessError('用户名已存在')
      throw error
    }
  }

  const deleteMe = async (userId: number): Promise<void> => {
    const result = await repository.deleteUser(userId)
    if (!result.deleted) {
      throw new HttpException('用户不存在', 404)
    }
  }

  return {
    register,
    login,
    getMe,
    updateProfile,
    deleteMe,
  }
}

export type AuthService = ReturnType<typeof createAuthService>
