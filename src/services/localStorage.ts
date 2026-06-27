import SQLite, {SQLiteDatabase} from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const dbPromise = SQLite.openDatabase({
  name: 'field_agent_checkin.db',
  location: 'default',
}).then(async (db: SQLiteDatabase) => {
  await db.executeSql(
    'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)',
  );
  return db;
});

export const localStorage = {
  async getString(key: string) {
    const db = await dbPromise;
    const [result] = await db.executeSql('SELECT value FROM kv_store WHERE key = ?', [
      key,
    ]);

    return result.rows.length > 0 ? (result.rows.item(0).value as string) : undefined;
  },

  async set(key: string, value: string) {
    const db = await dbPromise;
    await db.executeSql('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', [
      key,
      value,
    ]);
  },

  async delete(key: string) {
    const db = await dbPromise;
    await db.executeSql('DELETE FROM kv_store WHERE key = ?', [key]);
  },
};
