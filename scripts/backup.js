const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SOURCE_DB = path.join(DATA_DIR, "news-links.db");
const BACKUP_DIR = path.join(ROOT, "backups");
const KEEP_COUNT = Number(process.env.BACKUP_KEEP_COUNT || 14);

const formatTimestamp = (date) => {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
};

const removeOldBackups = (dir) => {
  const files = fs
    .readdirSync(dir)
    .filter((file) => /^news-links-\d{8}-\d{6}\.db$/.test(file))
    .sort()
    .reverse();

  for (const staleFile of files.slice(KEEP_COUNT)) {
    fs.unlinkSync(path.join(dir, staleFile));
  }
};

if (!fs.existsSync(SOURCE_DB)) {
  throw new Error(`源数据库不存在: ${SOURCE_DB}`);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const backupName = `news-links-${formatTimestamp(new Date())}.db`;
const backupPath = path.join(BACKUP_DIR, backupName);
const escapedBackupPath = backupPath.replace(/'/g, "''");

const db = new DatabaseSync(SOURCE_DB);

try {
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(`VACUUM INTO '${escapedBackupPath}'`);
  removeOldBackups(BACKUP_DIR);
  console.log(`backup created: ${backupPath}`);
} finally {
  db.close();
}
