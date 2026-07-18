import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { createUserRepository, DuplicateUserError, PublicUser, UserRepository } from '../repositories/userRepository'
import { comparePassword as comparePasswordUtil, hashPassword as hashPasswordUtil } from '../utils/password'
import { BusinessError, HttpException } from '../utils/errors'
import redisClient from '../utils/redis.client'

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
  if (redis.lastError) return
  try {
    const attemptsKey = `login_attempts:${username}`
    const lockKey = `login_locked:${username}`
    const attempts = await redis.incr(attemptsKey)
    await redis.expire(attemptsKey, LOGIN_LOCK_MINUTES * 60)
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await redis.setex(lockKey, LOGIN_LOCK_MINUTES * 60, '1')
    }
  } catch (err) {
    console.error('[authService] incrementLoginAttempts failed:', (err as Error).message)
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

    if (redis.lastError) {
      // Redis 不可用时跳过锁定检查，仅记录日志
      console.warn('[authService] Redis 不可用，跳过登录锁定检查')
    } else {
      const isLocked = await redis.get(lockKey)
      if (isLocked) {
        throw new HttpException(`登录失败次数过多，请${LOGIN_LOCK_MINUTES}分钟后再试`, 429)
      }
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
        console.error('[authService] updateLastLoginAt failed:', (err as Error).message)
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
    deleteMe,
  }
}

export type AuthService = ReturnType<typeof createAuthService>
