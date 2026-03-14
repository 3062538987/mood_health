// 存储工具类
class StorageUtil {
  /**
   * 存储数据到localStorage
   * @param key 存储键名
   * @param value 存储值
   */
  setItem<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error('存储数据失败:', error);
    }
  }

  /**
   * 从localStorage获取数据
   * @param key 存储键名
   * @returns 存储的值，如果不存在或解析失败则返回null
   */
  getItem<T>(key: string): T | null {
    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue === null) {
        return null;
      }
      return JSON.parse(serializedValue) as T;
    } catch (error) {
      console.error('获取数据失败:', error);
      return null;
    }
  }

  /**
   * 从localStorage删除数据
   * @param key 存储键名
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('删除数据失败:', error);
    }
  }

  /**
   * 清空localStorage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('清空数据失败:', error);
    }
  }
}

export default new StorageUtil();
