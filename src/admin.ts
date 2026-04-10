export {};

const app = document.querySelector<HTMLDivElement>("#admin-app");

if (!app) {
  throw new Error("找不到 #admin-app 容器");
}

const requestedDate = new URL(window.location.href).searchParams.get("date")?.trim() || "";

const today = new Date().toISOString().slice(0, 10);

const defaultKeywords =
  "机制砂|碎石|骨料|花岗岩矿|石灰岩矿|建筑石料|河砂|海砂";

const defaultLinks = [
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
].join("\n");

type LinkInputPayload = {
  rank: number;
  url: string;
  collectedAt: string;
  title: string;
  publishedAt: string;
};

type DailyBatch = {
  id: number;
  date: string;
  schedule: string;
  keywords: string[];
  links: LinkInputPayload[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const padMinute = (index: number) => String(index).padStart(2, "0");

const buildCollectedAt = (date: string, value: string, index: number) => {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return `${date} 09:${padMinute(index)}`;
};

const stringifyLinksInput = (links: LinkInputPayload[]) => {
  if (!links.length) {
    return defaultLinks;
  }

  return JSON.stringify(
    links.map((link) => ({
      时间: link.publishedAt || "",
      标题: link.title || "",
      链接: link.url,
      采集时间: link.collectedAt
    })),
    null,
    2
  );
};

const parseLinksInput = (raw: string, date: string): LinkInputPayload[] => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return [];
  }

  if (/^[\[{]/.test(trimmed)) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("JSON 解析失败，请检查格式");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("JSON 内容必须是数组");
    }

    return parsed.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`第 ${index + 1} 条 JSON 数据格式不正确`);
      }

      const item = entry as Record<string, unknown>;
      const url = String(item.url || item.link || item["链接"] || "").trim();
      const title = String(item.title || item["标题"] || "").trim();
      const publishedAt = String(
        item.publishedAt || item.newsTime || item.date || item["时间"] || ""
      ).trim();
      const collectedAtInput = String(item.collectedAt || item["采集时间"] || "").trim();

      return {
        rank: index + 1,
        url,
        title,
        publishedAt,
        collectedAt: buildCollectedAt(date, collectedAtInput || publishedAt, index)
      };
    });
  }

  return trimmed
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((url, index) => ({
      rank: index + 1,
      url,
      title: "",
      publishedAt: "",
      collectedAt: `${date} 09:${padMinute(index)}`
    }));
};

const render = (batch?: DailyBatch) => {
  const initialDate = batch?.date || today;
  const initialSchedule = batch?.schedule || "每天早晨 9:00";
  const initialKeywords = batch?.keywords?.length ? batch.keywords.join("|") : defaultKeywords;
  const initialLinks = batch ? stringifyLinksInput(batch.links) : defaultLinks;

  app.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Manual Input</p>
          <h1>每日链接录入后台</h1>
          <p class="copy">按天录入手动搜索结果，提交后直接写入 SQLite，并覆盖当天已有数据。</p>
        </div>
        <a class="ghost-link" href="/index.html">查看前台</a>
      </div>

      <form id="entry-form" class="entry-form">
        <label>
          <span>日期</span>
          <input name="date" type="date" value="${escapeHtml(initialDate)}" required />
        </label>
        <label>
          <span>采集时间</span>
          <input name="schedule" type="text" value="${escapeHtml(initialSchedule)}" required />
        </label>
        <label class="full">
          <span>关键词</span>
          <input name="keywords" type="text" value="${escapeHtml(initialKeywords)}" required />
        </label>
        <label class="full">
          <span>链接列表 / JSON 数组</span>
          <textarea name="links" rows="14" required placeholder="支持两种格式：1. 每行一个链接；2. 直接粘贴 [{&quot;时间&quot;,&quot;标题&quot;,&quot;链接&quot;}] JSON">${escapeHtml(initialLinks)}</textarea>
        </label>
        <button type="submit">保存到 SQLite</button>
      </form>

      <p id="result" class="result">${batch ? `已载入 ${escapeHtml(batch.date)} 的录入数据，共 ${batch.links.length} 条。` : "支持纯链接逐行录入，也支持直接粘贴包含“时间 / 标题 / 链接”的 JSON 数组。"}</p>
    </section>
  `;

  const form = document.querySelector<HTMLFormElement>("#entry-form");
  const result = document.querySelector<HTMLParagraphElement>("#result");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form || !result) {
      return;
    }

    const formData = new FormData(form);
    const date = String(formData.get("date") || "").trim();
    const schedule = String(formData.get("schedule") || "").trim();
    const keywords = String(formData.get("keywords") || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    const links = parseLinksInput(String(formData.get("links") || ""), date);

    result.textContent = "正在保存...";

    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date,
          schedule,
          keywords,
          links
        })
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || `请求失败: ${response.status}`);
      }

      result.textContent = `保存成功，已写入 ${links.length} 条链接。`;
    } catch (error) {
      result.textContent = error instanceof Error ? `保存失败：${error.message}` : "保存失败";
    }
  });
};

const bootstrap = async () => {
  try {
    const response = await fetch("/api/batches", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`接口返回 ${response.status}`);
    }

    const payload = (await response.json()) as { items: DailyBatch[] };
    const matchedBatch = requestedDate
      ? payload.items.find((item) => item.date === requestedDate)
      : undefined;

    render(matchedBatch || payload.items[0]);
  } catch {
    render();
  }
};

bootstrap();
