export {};

type DailyLink = {
  id: number;
  rank: number;
  url: string;
  collectedAt: string;
};

type DailyBatch = {
  id: number;
  date: string;
  schedule: string;
  keywords: string[];
  links: DailyLink[];
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("找不到 #app 容器");
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDateHeading = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
};

const formatDateTime = (input: string) => {
  const date = new Date(input.replace(" ", "T"));
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "未知来源";
  }
};

const render = (batches: DailyBatch[], keyword = "") => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredBatches = batches
    .map((batch) => ({
      ...batch,
      links: batch.links.filter((link) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [link.url, getHostname(link.url), batch.keywords.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword);
      })
    }))
    .filter((batch) => batch.links.length > 0);

  const currentBatch = batches[0];
  const linkTotal = filteredBatches.reduce((sum, batch) => sum + batch.links.length, 0);
  const keywordText = currentBatch?.keywords.join(" | ") ?? "";

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Daily Mining News Board</p>
        <h1>每日行业链接面板</h1>
        <p class="hero-copy">
          结果由手动采集录入 SQLite，按日期归档，按相关度排序展示，适合每天快速核对和直接跳转。
        </p>
      </div>
      <div class="hero-stats">
        <article>
          <span>最新采集</span>
          <strong>${escapeHtml(currentBatch?.schedule ?? "-")}</strong>
        </article>
        <article>
          <span>当前结果</span>
          <strong>${linkTotal}</strong>
        </article>
        <article>
          <span>录入入口</span>
          <strong><a class="admin-link" href="/admin.html">打开后台</a></strong>
        </article>
      </div>
    </section>

    <section class="toolbar">
      <div class="toolbar-main">
        <label class="search">
          <span>快速筛选</span>
          <input
            id="search-input"
            type="search"
            placeholder="按域名、链接、关键词过滤"
            value="${escapeHtml(keyword)}"
          />
        </label>
        <p class="keyword-line">${escapeHtml(keywordText)}</p>
      </div>
      <p class="toolbar-tip">每日数据来自 SQLite，默认按日期倒序、链接相关度升序显示。</p>
    </section>

    <section class="timeline">
      ${
        filteredBatches.length
          ? filteredBatches
              .map(
                (batch) => `
                  <article class="date-section">
                    <header class="date-header">
                      <div>
                        <p class="date-label">${escapeHtml(batch.date)}</p>
                        <h2>${escapeHtml(formatDateHeading(batch.date))}</h2>
                      </div>
                      <span class="date-count">${batch.links.length} 条结果</span>
                    </header>
                    <div class="card-grid">
                      ${batch.links
                        .map(
                          (item) => `
                            <section class="link-card">
                              <div class="card-top">
                                <span class="source-badge">相关度 #${item.rank}</span>
                                <time>${escapeHtml(formatDateTime(item.collectedAt))}</time>
                              </div>
                              <h3>${escapeHtml(getHostname(item.url))}</h3>
                              <p class="url-preview">${escapeHtml(item.url)}</p>
                              <div class="tag-row">
                                <span>${escapeHtml(batch.schedule)}</span>
                                ${batch.keywords
                                  .slice(0, 3)
                                  .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                                  .join("")}
                              </div>
                              <div class="card-actions">
                                <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
                                  打开链接
                                </a>
                              </div>
                            </section>
                          `
                        )
                        .join("")}
                    </div>
                  </article>
                `
              )
              .join("")
          : `
            <article class="empty-state">
              <h2>没有匹配到结果</h2>
              <p>可以尝试输入域名片段，例如 sina、people、gov。</p>
            </article>
          `
      }
    </section>
  `;

  const searchInput = document.querySelector<HTMLInputElement>("#search-input");
  searchInput?.addEventListener("input", (event) => {
    const nextKeyword = (event.target as HTMLInputElement).value;
    render(batches, nextKeyword);
  });
};

const renderMessage = (title: string, message: string) => {
  app.innerHTML = `
    <section class="empty-state">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
};

const bootstrap = async () => {
  renderMessage("正在加载", "正在从 SQLite 读取每日链接数据。");

  try {
    const response = await fetch("/api/batches", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`接口返回 ${response.status}`);
    }

    const payload = (await response.json()) as { items: DailyBatch[] };
    render(payload.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    renderMessage("加载失败", `无法读取数据：${message}`);
  }
};

bootstrap();
