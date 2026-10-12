import db from "../config/db.js";
export const userLifecycleRepository = {
  async findCurrentUser(id, executor = db.promise()) {
    const [rows] = await executor.execute("SELECT id, ten, email, role, status, token_version FROM users WHERE id = ?", [id]);
    return rows[0] ?? null;
  },
  async lockAdmins(connection) {
    const [rows] = await connection.execute("SELECT id FROM users WHERE role = 'admin' AND status = 'ACTIVE' ORDER BY id FOR UPDATE");
    return rows;
  },
  async lockUser(connection, id) {
    const [rows] = await connection.execute("SELECT id, ten, email, role, status, token_version FROM users WHERE id = ? FOR UPDATE", [id]);
    return rows[0] ?? null;
  },
  async update(connection, user) {
    const [result] = await connection.execute("UPDATE users SET role = ?, status = ?, token_version = ? WHERE id = ?",
      [user.role, user.status, user.token_version, user.id]);
    return result.affectedRows;
  },
  async audit(connection, { actorId, userId, operation, reason, before, after }) {
    await connection.execute("INSERT INTO UserLifecycleAudit (actor_id, user_id, operation, reason, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?)",
      [actorId, userId, operation, reason, JSON.stringify(before), JSON.stringify(after)]);
  },
};
