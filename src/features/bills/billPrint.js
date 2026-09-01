// Print a single bill as a કેશ મેમો matching the paper memo pad
// (see the Phase-8 print feature request: a photo of an actual
// Shreenath Traders memo, red-bordered header + goods table). Rather
// than fighting the whole app's layout with @media print rules, this
// opens a small, self-contained print window with just the memo in
// it — the same approach exportRowsToPDF takes for the Gujarati font
// (dynamic import, embedded as base64 so printing still works
// offline instead of depending on a Google Fonts request landing).

import { formatCurrency } from "../../utils/calc";
import gu from "../../locales/gu.json";

const P = gu.bills.print;

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Weight is stored as a plain kg number (BillForm/useBills), but the
// paper form's tolerance column is quintal.kg (ક્વિ. કી.) — 100kg per
// quintal — so this is display-only formatting, not a stored value.
function formatWeight(weightKg) {
  const kg = Number(weightKg) || 0;
  const quintals = Math.floor(kg / 100);
  const remainder = kg - quintals * 100;
  const remainderStr = Number.isInteger(remainder)
    ? remainder
    : remainder.toFixed(2);
  return quintals > 0 ? `${quintals}-${remainderStr}` : `${remainderStr}`;
}

function amountPlain(amount) {
  // Same Indian grouping as formatCurrency, without the ₹ symbol —
  // the paper form has separate રૂ./પૈસા columns instead.
  return formatCurrency(amount).replace(/^₹\s?/, "");
}

function buildRowsHtml(bill) {
  return bill.items
    .map(
      (item) => `
        <tr>
          <td class="goods">${esc(item.type)}</td>
          <td class="num">${esc(formatWeight(item.weightKg))}</td>
          <td class="num">${esc(item.ratePer20kg)}</td>
          <td class="num amount">${esc(amountPlain(item.amount))}</td>
        </tr>`,
    )
    .join("");
}

async function loadGujaratiFontFace() {
  try {
    const { NOTO_SANS_GUJARATI_REGULAR_BASE64 } =
      await import("../../assets/notoSansGujaratiFont");
    return `
      @font-face {
        font-family: 'NotoSansGujarati';
        src: url(data:font/ttf;base64,${NOTO_SANS_GUJARATI_REGULAR_BASE64}) format('truetype');
        font-weight: 400;
        font-style: normal;
      }`;
  } catch {
    // Offline and somehow this chunk isn't cached — fall back to
    // whatever Gujarati-capable system font the OS/printer has.
    return "";
  }
}

function buildHtml({ bill, business, vepariName, vepariVillage, fontFace }) {
  const businessName = business?.name || gu.common.businessNameEn;
  // Deliberately generic placeholders, not a hardcoded real business'
  // details — this data now lives in Settings → Business Profile
  // (businesses/{id}.ownerName/address/mobile/licenseNumber), so a
  // blank field here means the owner hasn't filled it in yet, not
  // that the code should quietly print someone else's real name and
  // phone number on an official money document.
  const ownerLine = business?.ownerName
    ? `${P.proprietorPrefix} ${esc(business.ownerName)}`
    : "";
  const addressLine = [P.commissionAgentLabel, business?.address]
    .filter(Boolean)
    .map(esc)
    .join(", ");
  const mobileLine = business?.mobile
    ? `${esc(P.mobilePrefix)} ${esc(business.mobile)}`
    : "";
  const licenseLine = business?.licenseNumber
    ? `${esc(P.licensePrefix)} ${esc(business.licenseNumber)}`
    : "";

  return `<!doctype html>
<html lang="gu">
<head>
<meta charset="utf-8" />
<title>${esc(P.cashMemoLabel)} ${esc(bill.entryNumber)}</title>
<style>
  ${fontFace}
  * { box-sizing: border-box; }
  body {
    font-family: 'NotoSansGujarati', 'Noto Sans Gujarati', sans-serif;
    color: #1a1e1b;
    margin: 0;
    padding: 16px;
  }
  .memo {
    width: 100%;
    margin: 0 auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
  }
  .memo-topline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 12px;
    margin-bottom: -25px;
  }
  .memo-tag {
    background: #b3413a;
    color: #fff;
    padding: 2px 10px;
    border-radius: 3px;
    font-weight: 600;
  }
  .memo-title {
    text-align: center;
    color: #b3413a;
    font-weight: bold;
  }
  .memo-contact { text-align: right; line-height: 1.5; }
  .memo-header { text-align: center; margin: 6px 0 10px; }
  /* Outlined/embossed look on the business name, matching the paper
     memo pad's pre-printed red-on-white header block. */
  .memo-header h1 {
    font-size: 26px;
    margin: 0;
    color: #fef3f3;
    font-weight: 700;
    text-shadow: -1px -1px 0 #b3413a, 1px -1px 0 #b3413a, 1px 1px 0 #b3413a,
    1px 1px 0 #b3413a;
  }
  .memo-header .owner { font-size: 13px; margin-top: 2px; color: #b3413a; font-weight: 600;}
  .memo-header .address { font-size: 12px; margin-top: 1px; color: #b3413a; }
  .memo-noline {
    display: flex;
    justify-content: space-between;
    color: #b3413a;
    border-bottom: 1.5px solid #b3413a;
    padding: 0.5px 6px 2px;
    margin: 8px 0;
    font-size: 14px;
    font-weight: 600;
  }
  .party-block {
    border: 1.5px solid #b3413a;
    padding: 8px 10px;
    font-size: 13px;
  }
  .party-row { display: flex; gap: 6px; padding: 3px 0; padding-right: 60px; }
  .party-row .label { color: #b3413a; white-space: nowrap; font-weight: bold; }
  .party-row .value { border-bottom: 1px solid #b3413a; flex: 1; min-height: 16px; }
  .table-wrapper {
    flex: 1;
    display: flex;
  }
  table.goods-table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    margin-top: 3px;
    font-size: 13px;
  }
  table.goods-table th, table.goods-table td {
    border: 1.5px solid #b3413a;
    padding: 6px 8px;
  }
  table.goods-table th {
    background: #fbeceb;
    font-weight: 600;
    text-align: center;
    font-size: 12px;
  }
  table.goods-table td.num { text-align: right; }
  table.goods-table td.goods { min-width: 90px; }
  table.goods-table tbody tr td { height: 24px; }
  tr.total-row td {
    font-weight: 700;
    border-top: 1.5px solid #b3413a;
  }
  .memo-footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-top: 14px;
    color: #333;
  }
  .memo-footer .right { text-align: right; }

  @media print {
    body { padding: 0; }
    .memo { border-width: 2px; }
    @page { margin: 10mm; }
  }
  .print-bar {
    max-width: 720px;
    margin: 0 auto 10px;
    text-align: right;
  }
  .print-bar button {
    font-size: 14px;
    padding: 8px 18px;
    border-radius: 8px;
    border: none;
    background: #2b4238;
    color: #fff;
    cursor: pointer;
  }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">${esc(P.cashMemoLabel)} — Print</button></div>
  <div class="memo">
    <div class="memo-topline">
      <span class="memo-tag">${esc(P.cashMemoLabel)}</span>
      <span class="memo-title"> શ્રી </span>
      <div class="memo-contact">
        ${mobileLine ? `<div>${mobileLine}</div>` : ""}
        ${licenseLine ? `<div>${licenseLine}</div>` : ""}
      </div>
    </div>
    <div class="memo-header">
      <h1>${esc(businessName)}</h1>
      ${ownerLine ? `<div class="owner">${ownerLine}</div>` : ""}
      ${addressLine ? `<div class="address">${addressLine}</div>` : ""}
    </div>
    <div class="memo-noline">
      <span>${esc(P.memoNumberLabel)} ${esc(bill.entryNumber)}</span>
      <span>${esc(P.dateLabel)} ${esc(bill.date)}</span>
    </div>
    <div class="party-block">
      <div class="party-row">
        <span class="label">${esc(P.farmerNameLabel)}</span>
        <span class="value">${esc(bill.farmerName)}</span>
      </div>
      <div class="party-row">
        <span class="label">${esc(P.buyerNameLabel)}</span>
        <span class="value">${esc(vepariName)}</span>
        <span class="label">${esc(P.villageLabel)}</span>
        <span class="value">${esc(vepariVillage || bill.farmerVillage)}</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="goods-table">
        <thead>
          <tr>
            <th>${esc(P.goodsColumnLabel)}</th>
            <th>${esc(P.weightColumnLabel)}<br/>(${esc(P.weightUnitLabel)})</th>
            <th>${esc(P.rateColumnLabel)}</th>
            <th>${esc(P.amountColumnLabel)}<br/>${esc(P.rupeesSubLabel)}</th>
          </tr>
        </thead>
        <tbody>
          ${buildRowsHtml(bill)}
          <tr class="total-row">
            <td colspan="3" style="text-align:right;">${esc(P.totalLabel)}</td>
            <td class="num">${esc(amountPlain(bill.totalAmount))}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="memo-footer">
      <div class="left">
        <div>${esc(P.ackLine)}</div>
        <div>${esc(P.ackLine1)}</div>
      </div>

      <div class="right">
        <div>${esc(P.eoeLine)}</div>
        <div>${esc(P.eoeLine1)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Opens a new tab with the memo rendered and ready to print. Called
// straight from a click handler (not awaited before window.open) so
// popup blockers don't treat it as an unsolicited popup — the window
// opens immediately, blank, and we fill it in once the font is
// loaded.
export function printBill(bill, { business, vepariName, vepariVillage }) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(
    '<!doctype html><title>...</title><body style="font-family:sans-serif;padding:24px;">Preparing print…</body>',
  );

  loadGujaratiFontFace().then((fontFace) => {
    const html = buildHtml({
      bill,
      business,
      vepariName,
      vepariVillage,
      fontFace,
    });
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  });
}
