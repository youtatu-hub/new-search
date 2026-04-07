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

type ViewState = {
  batches: DailyBatch[];
  currentIndex: number;
  keyword: string;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("找不到 #app 容器");
}

const state: ViewState = {
  batches: [],
  currentIndex: 0,
  keyword: ""
};

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

const filterLinks = (batch: DailyBatch, keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return batch.links.filter((link) => {
    if (!normalizedKeyword) {
      return true;
    }

    return [link.url, getHostname(link.url), batch.keywords.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(normalizedKeyword);
  });
};

const renderEmpty = (title: string, message: string) => {
  app.innerHTML = `
    <section class="empty-state empty-alone">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
};

const render = () => {
  if (!state.batches.length) {
    renderEmpty("暂无数据", "当前数据库还没有可展示的每日链接。");
    return;
  }

  const currentBatch = state.batches[state.currentIndex];
  const filteredLinks = filterLinks(currentBatch, state.keyword);
  const hasPrevDay = state.currentIndex < state.batches.length - 1;
  const hasNextDay = state.currentIndex > 0;
  const prevDate = hasPrevDay ? state.batches[state.currentIndex + 1].date : "";
  const nextDate = hasNextDay ? state.batches[state.currentIndex - 1].date : "";

  app.innerHTML = `
    <div class="page-frame">
      <button
        class="day-nav day-nav-prev"
        type="button"
        data-action="prev-day"
        ${hasPrevDay ? "" : "disabled"}
        aria-label="切换到上一天"
      >
        <span class="nav-arrow">‹</span>
        <span class="nav-copy">
          <strong>上一天</strong>
          <small>${escapeHtml(prevDate || "无数据")}</small>
        </span>
      </button>

      <button
        class="day-nav day-nav-next"
        type="button"
        data-action="next-day"
        ${hasNextDay ? "" : "disabled"}
        aria-label="切换到下一天"
      >
        <span class="nav-copy">
          <strong>下一天</strong>
          <small>${escapeHtml(nextDate || "无数据")}</small>
        </span>
        <span class="nav-arrow">›</span>
      </button>

      <section class="overview-panel">
        <div class="overview-head">
          <div>
            <p class="eyebrow">Daily Mining News Board</p>
            <h1>${escapeHtml(formatDateHeading(currentBatch.date))}</h1>
            <p class="hero-copy">
              一次只查看一天的数据，顶部信息、筛选和跳转入口集中到同一个面板中，便于快速核对当天结果。
            </p>
          </div>
          <div class="hero-stats">
            <article>
              <span>采集时间</span>
              <strong>${escapeHtml(currentBatch.schedule)}</strong>
            </article>
            <article>
              <span>当日结果</span>
              <strong>${filteredLinks.length}</strong>
            </article>
            <article>
              <span>录入入口</span>
              <strong><a class="admin-link" href="/admin.html">打开后台</a></strong>
            </article>
          </div>
        </div>

        <div class="overview-tools">
          <div class="toolbar-main">
            <label class="search">
              <span>快速筛选</span>
              <input
                id="search-input"
                type="search"
                placeholder="按域名、链接、关键词过滤"
                value="${escapeHtml(state.keyword)}"
              />
            </label>
            <p class="keyword-line">${escapeHtml(currentBatch.keywords.join(" | "))}</p>
          </div>
          <p class="toolbar-tip">左右悬浮按钮用于切换日期，当前页面只保留当日内容。</p>
        </div>
      </section>

      <section class="day-stage">
        ${
          filteredLinks.length
            ? `
              <div class="day-meta">
                <p class="date-label">${escapeHtml(currentBatch.date)}</p>
                <span class="date-count">${filteredLinks.length} 条结果</span>
              </div>
              <div class="card-grid">
                ${filteredLinks
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
                          <span>${escapeHtml(currentBatch.schedule)}</span>
                          ${currentBatch.keywords
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
            `
            : `
              <article class="empty-state">
                <h2>这一天没有匹配到结果</h2>
                <p>可以清空筛选词，或者切换到上一天 / 下一天继续查看。</p>
              </article>
            `
        }
      </section>
    </div>
  `;

  const searchInput = document.querySelector<HTMLInputElement>("#search-input");
  const prevButton = document.querySelector<HTMLButtonElement>("[data-action='prev-day']");
  const nextButton = document.querySelector<HTMLButtonElement>("[data-action='next-day']");

  searchInput?.addEventListener("input", (event) => {
    state.keyword = (event.target as HTMLInputElement).value;
    render();
  });

  prevButton?.addEventListener("click", () => {
    if (!hasPrevDay) {
      return;
    }

    state.currentIndex += 1;
    render();
  });

  nextButton?.addEventListener("click", () => {
    if (!hasNextDay) {
      return;
    }

    state.currentIndex -= 1;
    render();
  });
};

const bootstrap = async () => {
  renderEmpty("正在加载", "正在从 SQLite 读取每日链接数据。");

  try {
    const response = await fetch("/api/batches", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`接口返回 ${response.status}`);
    }

    const payload = (await response.json()) as { items: DailyBatch[] };
    state.batches = payload.items;
    state.currentIndex = 0;
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    renderEmpty("加载失败", `无法读取数据：${message}`);
  }
};

bootstrap();
