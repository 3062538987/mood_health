import pool from "../config/database";
import sql from "mssql";

/**
 * 音乐模型接口
 * @interface Music
 * @property {number} id - 音乐ID
 * @property {string} title - 音乐标题
 * @property {string} artist - 艺术家
 * @property {string} url - 音乐URL
 * @property {string} duration - 音乐时长
 * @property {string} category - 音乐分类
 * @property {string} cover - 封面图片URL
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */
export interface Music {
  id: number;
  title: string;
  artist: string;
  url: string;
  duration: string;
  category: string;
  cover: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 获取音乐列表
 * @param {string} [category] - 音乐分类（可选）
 * @returns {Promise<Music[]>} - 音乐列表
 */
export const getMusicList = async (category?: string): Promise<Music[]> => {
  let query = "SELECT * FROM musics";
  const params: any[] = [];

  if (category) {
    query += " WHERE category = @category";
    params.push({ name: "category", type: sql.NVarChar, value: category });
  }

  const result = await pool
    .request()
    .input("category", sql.NVarChar, category)
    .query(query);

  return result.recordset;
};

/**
 * 根据ID获取音乐
 * @param {number} id - 音乐ID
 * @returns {Promise<Music | null>} - 音乐对象或null
 */
export const getMusicById = async (id: number): Promise<Music | null> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM musics WHERE id = @id");

  return result.recordset.length ? result.recordset[0] : null;
};

/**
 * 创建音乐
 * @param {Omit<Music, "id" | "created_at" | "updated_at">} musicData - 音乐数据
 * @returns {Promise<Music>} - 创建的音乐对象
 */
export const createMusic = async (
  musicData: Partial<Omit<Music, "id" | "created_at" | "updated_at">>,
): Promise<Music> => {
  const { title, artist, url, duration, category, cover } = musicData;

  const result = await pool
    .request()
    .input("title", sql.NVarChar, title)
    .input("artist", sql.NVarChar, artist)
    .input("url", sql.NVarChar, url)
    .input("duration", sql.NVarChar, duration)
    .input("category", sql.NVarChar, category)
    .input("cover", sql.NVarChar, cover).query(`
      INSERT INTO musics (title, artist, url, duration, category, cover)
      VALUES (@title, @artist, @url, @duration, @category, @cover)
      OUTPUT INSERTED.*
    `);

  return result.recordset[0];
};

/**
 * 更新音乐
 * @param {number} id - 音乐ID
 * @param {Partial<Omit<Music, "id" | "created_at" | "updated_at">>} musicData - 音乐数据
 * @returns {Promise<Music | null>} - 更新后的音乐对象或null
 */
export const updateMusic = async (
  id: number,
  musicData: Partial<Omit<Music, "id" | "created_at" | "updated_at">>,
): Promise<Music | null> => {
  const { title, artist, url, duration, category, cover } = musicData;

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("title", sql.NVarChar, title)
    .input("artist", sql.NVarChar, artist)
    .input("url", sql.NVarChar, url)
    .input("duration", sql.NVarChar, duration)
    .input("category", sql.NVarChar, category)
    .input("cover", sql.NVarChar, cover).query(`
      UPDATE musics
      SET title = @title, artist = @artist, url = @url, duration = @duration, category = @category, cover = @cover
      WHERE id = @id
      OUTPUT INSERTED.*
    `);

  return result.recordset.length ? result.recordset[0] : null;
};

/**
 * 删除音乐
 * @param {number} id - 音乐ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
export const deleteMusic = async (id: number): Promise<boolean> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM musics WHERE id = @id");

  return result.rowsAffected[0] > 0;
};
