import { escapeHtml } from "./ui.js";

export function formatProposalDate(val) {
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString("ru-RU");
}

export function formatMoney(n) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDemandVolume(kg) {
  if (kg == null || kg === "") return "—";
  const num = Number(kg);
  if (!Number.isFinite(num)) return "—";
  return `до ${formatMoney(num)} кг`;
}

export function formatDemandBudget(rub) {
  if (rub == null || rub === "") return "—";
  const num = Number(rub);
  if (!Number.isFinite(num)) return "—";
  return `до ${formatMoney(num)} ₽`;
}

function parseNumericInput(value) {
  if (value == null || value === "") return null;
  const str = String(value).trim();
  const direct = Number(str.replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const m = str.match(/(\d[\d\s]*(?:[.,]\d+)?)/);
  if (!m) return null;
  const num = Number(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function parseDemandVolumeInput(value) {
  return parseNumericInput(value);
}

export function parseDemandBudgetInput(value) {
  return parseNumericInput(value);
}

export function parseProductMinOrderInput(value) {
  if (value == null || value === "") return null;
  const str = String(value).trim();
  const rubMatch = str.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*₽/);
  if (rubMatch) {
    const num = Number(rubMatch[1].replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return parseNumericInput(value);
}

export function formatProductPrice(price, unit, priceHint = null) {
  if (price != null && price !== "") {
    const num = Number(price);
    if (Number.isFinite(num)) return `${formatMoney(num)}₽/${unit || "шт."}`;
  }
  return priceHint ? String(priceHint) : "—";
}

export function formatProductMinOrder(minOrder) {
  if (!minOrder) return "—";
  const str = String(minOrder);
  if (str.includes("мин. от")) return str;
  const rub = parseProductMinOrderInput(minOrder);
  if (rub != null) return `мин. от ${formatMoney(rub)} ₽`;
  return str;
}

export function renderProposalItemsTable(lineItems, offerTotal) {
  if (!lineItems?.length) return "";
  return `<div class="panel__scroll-x"><table class="products-table">
    <thead><tr><th>Продукция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead>
    <tbody>
      ${lineItems
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.quantity} ${escapeHtml(item.unit)}</td>
            <td>${formatMoney(item.unitPrice)} ₽</td>
            <td>${formatMoney(item.lineTotal)} ₽</td>
          </tr>`
        )
        .join("")}
    </tbody>
    ${
      offerTotal != null
        ? `<tfoot><tr><td colspan="3"><strong>Итого</strong></td><td><strong>${formatMoney(offerTotal)} ₽</strong></td></tr></tfoot>`
        : ""
    }
  </table></div>`;
}

export function renderProposalFacts(priceOffer, volumeOffer, offerTotal) {
  const price =
    offerTotal != null
      ? `${formatMoney(offerTotal)} ₽`
      : priceOffer
        ? escapeHtml(priceOffer)
        : "—";
  return `<dl class="proposal-card__facts">
    <div><dt>Цена</dt><dd>${price}</dd></div>
    <div><dt>Объём</dt><dd>${volumeOffer ? escapeHtml(volumeOffer) : "—"}</dd></div>
  </dl>`;
}

export function truncateMessage(msg, max = 140) {
  const text = String(msg || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function isProposalEditable(status) {
  return !status || status === "pending";
}

export function proposalStatusDescription(status, organizationName) {
  const org = String(organizationName || "").trim() || "покупателя";
  const quoted = `«${org}»`;
  if (status === "accepted") {
    return `Ваше предложение для ${quoted} было принято.`;
  }
  if (status === "rejected") {
    return `К сожалению, ${quoted} отклонило ваше предложение.`;
  }
  return `Ожидаем ответ от ${quoted}.`;
}

export function renderSellerProposalStatus(status, organizationName, options = {}) {
  const { showLockNote = false } = options;
  const s = status || "pending";
  const desc = proposalStatusDescription(s, organizationName);
  const lockSuffix =
    showLockNote && !isProposalEditable(s) ? " Редактирование недоступно." : "";

  return `<div class="proposal-status-block">
    ${renderProposalStatusBadge(s)}
    <p class="proposal-status-block__text">${escapeHtml(desc)}${lockSuffix ? `<span class="proposal-status-block__lock">${escapeHtml(lockSuffix.trim())}</span>` : ""}</p>
  </div>`;
}

export function proposalStatusLabel(status) {
  if (status === "accepted") return "Принято";
  if (status === "rejected") return "Отклонено";
  return "На рассмотрении";
}

export function proposalStatusBadgeClass(status) {
  if (status === "accepted") return "badge--ok";
  if (status === "rejected") return "badge--muted";
  return "badge--score";
}

export function renderProposalStatusBadge(status) {
  const s = status || "pending";
  return `<span class="badge ${proposalStatusBadgeClass(s)}">${proposalStatusLabel(s)}</span>`;
}

export function renderProposalItemsSummary(lineItems) {
  if (!lineItems?.length) {
    return '<p class="proposal-card__products muted">Товары не указаны</p>';
  }
  return `<ul class="proposal-card__products">
    ${lineItems
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.name)}</strong> — ${item.quantity} ${escapeHtml(item.unit)}${item.lineTotal != null ? ` · ${formatMoney(item.lineTotal)} ₽` : ""}</li>`
      )
      .join("")}
  </ul>`;
}

export function renderOrderItemsTable(items) {
  if (!items?.length) return '<p class="muted">Позиции не указаны.</p>';
  return `<div class="panel__scroll-x"><table class="products-table">
    <thead><tr><th>Продукция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead>
    <tbody>
      ${items
        .map(
          (i) => `<tr>
            <td><strong>${escapeHtml(i.productName)}</strong></td>
            <td>${i.quantity} ${escapeHtml(i.unit)}</td>
            <td>${formatMoney(i.unitPrice)} ₽ / ${escapeHtml(i.unit)}</td>
            <td><strong>${formatMoney(i.lineTotal)} ₽</strong></td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`;
}

export function orderStatusLabel(status, audience = "buyer") {
  if (status === "confirmed") return audience === "seller" ? "Принято" : "Подтверждён";
  if (status === "cancelled") return audience === "seller" ? "Отклонено" : "Отменён";
  return audience === "seller" ? "Ожидает вашего ответа" : "Ожидает ответа";
}

export function sellerIncomingOrderStatusDescription(status, organizationName) {
  const org = String(organizationName || "").trim() || "покупателя";
  const quoted = `«${org}»`;
  if (status === "confirmed") return `Вы приняли предложение от ${quoted}.`;
  if (status === "cancelled") return `Вы отклонили предложение от ${quoted}.`;
  return `Ожидает вашего ответа — предложение от ${quoted}.`;
}

export function renderSellerIncomingOrderStatus(status, organizationName) {
  return `<div class="proposal-status-block">
    ${renderOrderStatusBadge(status, "seller")}
    <p class="proposal-status-block__text">${escapeHtml(sellerIncomingOrderStatusDescription(status, organizationName))}</p>
  </div>`;
}

export function orderStatusBadgeClass(status) {
  if (status === "confirmed") return "badge--ok";
  if (status === "cancelled") return "badge--muted";
  return "badge--score";
}

export function renderOrderStatusBadge(status, audience = "buyer") {
  return `<span class="badge ${orderStatusBadgeClass(status)}">${orderStatusLabel(status, audience)}</span>`;
}

export function renderProposalProductsSection(lineItems, offerTotal) {
  if (!lineItems?.length) {
    return `<section class="detail-section"><h3>Предложенные товары</h3><p class="muted">Поставщик не указал конкретные позиции из каталога.</p></section>`;
  }
  return `<section class="detail-section"><h3>Предложенные товары</h3>${renderProposalItemsTable(lineItems, offerTotal)}</section>`;
}
