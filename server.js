const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "news-links.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    schedule_time TEXT NOT NULL,
    keywords TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    url TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    UNIQUE(batch_id, rank),
    UNIQUE(batch_id, url)
  );
`);

const ensureLinkColumn = (columnName, definition) => {
  const columns = db.prepare("PRAGMA table_info(links)").all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE links ADD COLUMN ${columnName} ${definition}`);
  }
};

ensureLinkColumn("title", "TEXT NOT NULL DEFAULT ''");
ensureLinkColumn("published_at", "TEXT NOT NULL DEFAULT ''");

const countStmt = db.prepare("SELECT COUNT(*) AS total FROM batches");
const upsertBatchStmt = db.prepare(`
  INSERT INTO batches (date, schedule_time, keywords)
  VALUES (?, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    schedule_time = excluded.schedule_time,
    keywords = excluded.keywords
  RETURNING id
`);
const selectBatchIdStmt = db.prepare("SELECT id FROM batches WHERE date = ?");
const deleteLinksStmt = db.prepare("DELETE FROM links WHERE batch_id = ?");
const insertLinkStmt = db.prepare(`
  INSERT INTO links (batch_id, rank, url, collected_at, title, published_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const listStmt = db.prepare(`
  SELECT
    b.id AS batch_id,
    b.date,
    b.schedule_time,
    b.keywords,
    l.id AS link_id,
    l.rank,
    l.url,
    l.collected_at,
    l.title,
    l.published_at
  FROM batches b
  LEFT JOIN links l ON l.batch_id = b.id
  ORDER BY b.date DESC, l.rank ASC
`);

const seedDailyBatch = () => ({
  date: "2026-04-07",
  schedule: "每天早晨 9:00",
  keywords: ["机制砂", "碎石", "骨料", "花岗岩矿", "石灰岩矿", "建筑石料", "河砂", "海砂"],
  links: [
    "https://finance.sina.com.cn/roll/2026-02-12/doc-inhmnnwz4471747.shtml",
    "https://zhuanlan.zhihu.com/p/1988977080893994452",
    "https://www.zgss.org.cn/zixun/zhuti/17808.html",
    "https://intelmining2018.com/sys-nd/2602.html",
    "https://www.shsmzj.com/news/industry-news/2295.html",
    "https://www.stdaily.com/web/gdxw/2025-10/13/content_414118.html",
    "http://dkj.gxzf.gov.cn/sp/spxw/t19306750.shtml",
    "https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/content/post_12253918.html",
    "https://gxj.tl.gov.cn/tlsjjhxxhj/c00177/pc/content/content_1961002231891025920.html",
    "https://xxgk.mot.gov.cn/jigou/glj/202412/t20241226_4161678.html",
    "https://data.ccement.com/Report/Detail/69160436437955004.html",
    "https://www.qingxin.gov.cn/qxqzdlyxxgk/hjbh/jsxmhjyxpjxx/content/post_2093643.html",
    "https://m.100njz.com/a/24122416/784A60DE2BA64B67_abc.html",
    "http://www.lvliang.gov.cn/llxxgk/zfxxgk/xxgkml/ggzypzxx/kyqcr_21603/202512/P020251227404245346569.pdf",
    "http://lianghui.people.com.cn/2026/BIG5/n1/2026/0309/c461828-40678381.html"
  ].map((url, index) => ({
    rank: index + 1,
    url,
    collectedAt: `2026-04-07 09:${String(index).padStart(2, "0")}`
  }))
});

const saveBatch = (payload) => {
  db.exec("BEGIN");
  try {
    upsertBatchStmt.run(payload.date, payload.schedule, JSON.stringify(payload.keywords));
    const batchId = selectBatchIdStmt.get(payload.date).id;
    deleteLinksStmt.run(batchId);

    for (const link of payload.links) {
      insertLinkStmt.run(
        batchId,
        link.rank,
        link.url,
        link.collectedAt,
        link.title || "",
        link.publishedAt || ""
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

if (countStmt.get().total === 0) {
  saveBatch(seedDailyBatch());
}

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const sendFile = (response, filePath) => {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  response.writeHead(200, {
    "Content-Type": typeMap[ext] || "application/octet-stream",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  fs.createReadStream(filePath).pipe(response);
};

const parseBody = (request) =>
  new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("请求体过大"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON 格式不正确"));
      }
    });
    request.on("error", reject);
  });

const validatePayload = (payload) => {
  const date = String(payload.date || "").trim();
  const schedule = String(payload.schedule || "").trim();
  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const links = Array.isArray(payload.links)
    ? payload.links.map((item, index) => ({
        rank: Number(item.rank || index + 1),
        url: String(item.url || item.link || item["链接"] || "").trim(),
        collectedAt: String(item.collectedAt || item["采集时间"] || "").trim(),
        title: String(item.title || item["标题"] || "").trim(),
        publishedAt: String(
          item.publishedAt || item.newsTime || item.date || item["时间"] || ""
        ).trim()
      }))
    : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式必须是 YYYY-MM-DD");
  }

  if (!schedule) {
    throw new Error("采集时间不能为空");
  }

  if (!keywords.length) {
    throw new Error("关键词不能为空");
  }

  if (!links.length) {
    throw new Error("至少需要 1 条链接");
  }

  const seenRanks = new Set();
  for (const link of links) {
    if (!Number.isInteger(link.rank) || link.rank < 1) {
      throw new Error("相关度排序必须是从 1 开始的整数");
    }
    if (seenRanks.has(link.rank)) {
      throw new Error("相关度排序不能重复");
    }
    seenRanks.add(link.rank);
    if (!/^https?:\/\//i.test(link.url)) {
      throw new Error(`链接格式不正确: ${link.url}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(link.collectedAt)) {
      throw new Error("采集时间格式必须是 YYYY-MM-DD HH:mm");
    }
  }

  return { date, schedule, keywords, links: links.sort((a, b) => a.rank - b.rank) };
};

const readBatches = () => {
  const rows = listStmt.all();
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.batch_id)) {
      grouped.set(row.batch_id, {
        id: row.batch_id,
        date: row.date,
        schedule: row.schedule_time,
        keywords: JSON.parse(row.keywords),
        links: []
      });
    }

    if (row.link_id) {
      grouped.get(row.batch_id).links.push({
        id: row.link_id,
        rank: row.rank,
        url: row.url,
        collectedAt: row.collected_at,
        title: row.title,
        publishedAt: row.published_at
      });
    }
  }

  return Array.from(grouped.values());
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, dbPath: DB_PATH });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/batches") {
    sendJson(response, 200, { items: readBatches() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/batches") {
    try {
      const payload = validatePayload(await parseBody(request));
      saveBatch(payload);
      sendJson(response, 201, { ok: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    sendFile(response, path.join(ROOT, "index.html"));
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin.html") {
    sendFile(response, path.join(ROOT, "admin.html"));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/dist/")) {
    sendFile(response, path.join(ROOT, url.pathname));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`server started at http://localhost:${PORT}`);
  console.log(`sqlite db: ${DB_PATH}`);
});
