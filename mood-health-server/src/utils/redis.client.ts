import Redis from "ioredis";
import logger from "./logger";

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 2000;
  private fallbackEnabled: boolean = true;

  constructor() {
    this.client = this.createClient();
    this.setupEventListeners();
  }

  private createClient(): Redis {
    return new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > this.maxReconnectAttempts) {
          logger.error("Redis 重连失败，已达到最大尝试次数");
          this.isConnected = false;
          return null;
        }
        this.reconnectAttempts = times;
        const delay = Math.min(times * this.reconnectDelay, 30000);
        logger.warn(`Redis 重连中... (${times}/${this.maxReconnectAttempts})`);
        return delay;
      },
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    });
  }

  private setupEventListeners(): void {
    this.client.on("connect", () => {
      logger.info("Redis 连接成功");
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on("error", (error) => {
      logger.error("Redis 错误:", error);
      this.isConnected = false;
    });

    this.client.on("close", () => {
      logger.warn("Redis 连接关闭");
      this.isConnected = false;
    });

    this.client.on("reconnecting", (params: { attempt: number }) => {
      logger.info(`Redis 正在重连: ${params.attempt}`);
    });

    this.client.on("end", () => {
      logger.info("Redis 连接结束");
      this.isConnected = false;
    });
  }

  /**
   * 检查 Redis 连接状态
   */
  public async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.warn("Redis ping 失败:", error);
      return false;
    }
  }

  /**
   * 获取 Redis 连接状态
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 执行 Redis 命令，带错误处理
   */
  public async execute<T>(
    command: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T | null> {
    try {
      if (!this.isConnected) {
        if (this.fallbackEnabled) {
          logger.warn("Redis 未连接，返回 null");
          return null;
        }
        throw new Error("Redis 未连接");
      }
      return await command.apply(this.client, args);
    } catch (error) {
      logger.error("Redis 命令执行失败:", error);
      if (this.fallbackEnabled) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 设置缓存
   */
  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.execute(
          this.client.setex.bind(this.client),
          key,
          ttl,
          value,
        );
      } else {
        await this.execute(this.client.set.bind(this.client), key, value);
      }
      return true;
    } catch (error) {
      logger.error("Redis set 失败:", error);
      return false;
    }
  }

  /**
   * 获取缓存
   */
  public async get(key: string): Promise<string | null> {
    return this.execute(this.client.get.bind(this.client), key);
  }

  /**
   * 删除缓存
   */
  public async del(...keys: string[]): Promise<number | null> {
    return this.execute(this.client.del.bind(this.client), ...keys);
  }

  /**
   * 查找匹配的键
   */
  public async keys(pattern: string): Promise<string[] | null> {
    return this.execute(this.client.keys.bind(this.client), pattern);
  }

  /**
   * 关闭 Redis 连接
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      logger.info("Redis 连接已关闭");
    } catch (error) {
      logger.error("关闭 Redis 连接失败:", error);
    }
  }

  /**
   * 启用/禁用降级
   */
  public setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  /**
   * 获取原始 Redis 客户端（谨慎使用）
   */
  public getRawClient(): Redis {
    return this.client;
  }
}

// 导出单例实例
export const redisClient = new RedisClient();
export default redisClient;
