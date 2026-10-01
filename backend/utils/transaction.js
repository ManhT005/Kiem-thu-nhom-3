import db from "../config/db.js";

export const withTransaction = async (work, pool = db) => {
  const connection = await pool.promise().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the error that caused the transaction to fail.
    }
    throw error;
  } finally {
    connection.release();
  }
};