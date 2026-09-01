// Print a vepari's dakhla ledger matching the paper દાખલો pad (see
// billPrint.js's header comment for the overall approach — same
// pattern here: a small, self-contained print window with the
// embedded Gujarati font, rather than fighting the app's own layout
// with @media print rules).
//
// The paper form's table (farmer/village/type/kg/rate/price) is
// extended here with તોલાઈ/શેસ/કમિશન/કુલ લેણું columns — the physical
// pad doesn't need those since a person fills it in by hand, but
// auto-calculating them is this app's whole reason to exist for
// Vepari Dakhla (prd.md §4.2). Landscape orientation, since the wider
// table needs the room a portrait memo doesn't.

import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'

const P = gu.dakhla.print

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

function amountPlain(amount) {
  // Same Indian grouping as formatCurrency, without the ₹ symbol —
  // the paper form has separate રૂ./પૈસા columns instead.
  return formatCurrency(amount).replace(/^₹\s?/, '')
}

function goodsTypesForBill(bill) {
  const types = [...new Set(bill.items.map((item) => item.type))]
  return types.join(', ')
}

function buildRowsHtml(lines) {
  return lines
    .map(
      ({ bill, weightKg, goodsAmount, tolai, shes, commission, total }) => `
        <tr>
          <td class="name">${esc(bill.farmerName)}</td>
          <td class="name">${esc(bill.farmerVillage)}</td>
          <td class="goods">${esc(goodsTypesForBill(bill))}</td>
          <td class="num">${esc(weightKg)}</td>
          <td class="num">${esc(amountPlain(goodsAmount))}</td>
          <td class="num">${esc(amountPlain(tolai))}</td>
          <td class="num">${esc(amountPlain(shes))}</td>
          <td class="num">${esc(amountPlain(commission))}</td>
          <td class="num amount">${esc(amountPlain(total))}</td>
        </tr>`
    )
    .join('')
}

async function loadGujaratiFontFace() {
  try {
    const { NOTO_SANS_GUJARATI_REGULAR_BASE64 } = await import(
      '../../assets/notoSansGujaratiFont'
    )
    return `
      @font-face {
        font-family: 'NotoSansGujarati';
        src: url(data:font/ttf;base64,${NOTO_SANS_GUJARATI_REGULAR_BASE64}) format('truetype');
        font-weight: 400;
        font-style: normal;
      }`
  } catch {
    // Offline and somehow this chunk isn't cached — fall back to
    // whatever Gujarati-capable system font the OS/printer has.
    return ''
  }
}

function buildHtml({ vepari, lines, grandTotal, business, fontFace }) {
  const businessName = business?.name || gu.common.businessNameEn
  // Same deliberate-placeholder reasoning as billPrint.js: this data
  // lives in Settings → Business Profile, not hardcoded here.
  const ownerLine = business?.ownerName ? `${P.proprietorPrefix} ${esc(business.ownerName)}` : ''
  const addressLine = [P.commissionAgentLabel, business?.address].filter(Boolean).map(esc).join(', ')
  const mobileLine = business?.mobile ? `${esc(P.mobilePrefix)} ${esc(business.mobile)}` : ''

  return `<!doctype html>
<html lang="gu">
<head>
<meta charset="utf-8" />
<title>${esc(P.dakhlaLabel)} — ${esc(vepari?.name)}</title>
<style>
  ${fontFace}
  * { box-sizing: border-box; }
  body {
    font-family: 'NotoSansGujarati', 'Noto Sans Gujarati', sans-serif;
    color: #1a1e1b;
    margin: 0;
    padding: 16px;
  }
  .sheet { width: 100%; margin: 0 auto; padding: 16px 20px; }
  .invocation { text-align: center; font-size: 12px; color: #b3413a; margin-bottom: 4px; }
  .dakhla-topline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 12px;
    margin-bottom: -22px;
  }
  .dakhla-tag { color: #b3413a; font-weight: 700; font-size: 15px; }
  .dakhla-contact { text-align: right; line-height: 1.5; color: #b3413a; }
  .dakhla-header { text-align: center; margin: 6px 0 10px; }
  .dakhla-header h1 {
    font-size: 26px;
    margin: 0;
    color: #fef3f3;
    font-weight: 700;
    text-shadow: -1px -1px 0 #b3413a, 1px -1px 0 #b3413a, 1px 1px 0 #b3413a, 1px 1px 0 #b3413a;
  }
  .dakhla-header .owner { font-size: 13px; margin-top: 2px; color: #b3413a; font-weight: 600; }
  .dakhla-header .address { font-size: 12px; margin-top: 1px; color: #b3413a; }
  .note-line {
    text-align: center;
    font-size: 12px;
    color: #b3413a;
    border-top: 1px solid #b3413a;
    border-bottom: 1px solid #b3413a;
    padding: 4px 6px;
    margin: 8px 0;
  }
  .party-block {
    display: flex;
    gap: 24px;
    border: 1.5px solid #b3413a;
    padding: 8px 10px;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .party-row { display: flex; gap: 6px; flex: 1; }
  .party-row .label { color: #b3413a; white-space: nowrap; font-weight: bold; }
  .party-row .value { border-bottom: 1px solid #b3413a; flex: 1; min-height: 16px; }
  table.dakhla-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3px;
    font-size: 12px;
  }
  table.dakhla-table th, table.dakhla-table td {
    border: 1.5px solid #b3413a;
    padding: 5px 6px;
  }
  table.dakhla-table th {
    background: #fbeceb;
    font-weight: 600;
    text-align: center;
    font-size: 11px;
  }
  table.dakhla-table td.num { text-align: right; }
  table.dakhla-table td.name, table.dakhla-table td.goods { min-width: 70px; }
  table.dakhla-table tbody tr td { height: 22px; }
  tr.total-row td { font-weight: 700; border-top: 1.5px solid #b3413a; }
  .instructions { font-size: 11px; color: #333; margin-top: 12px; }
  .instructions .title { font-weight: 600; }
  .dakhla-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 12px;
    margin-top: 10px;
    color: #333;
  }

  @media print {
    body { padding: 0; }
    @page { size: landscape; margin: 10mm; }
  }
  .print-bar { margin: 0 auto 10px; text-align: right; }
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
  <div class="print-bar"><button onclick="window.print()">${esc(P.dakhlaLabel)} — Print</button></div>
  <div class="sheet">
    <div class="invocation">${esc(P.invocationLine)}</div>
    <div class="dakhla-topline">
      <span class="dakhla-tag">${esc(P.dakhlaLabel)}</span>
      <span></span>
      <div class="dakhla-contact">
        ${mobileLine ? `<div>${mobileLine}</div>` : ''}
      </div>
    </div>
    <div class="dakhla-header">
      <h1>${esc(businessName)}</h1>
      ${ownerLine ? `<div class="owner">${ownerLine}</div>` : ''}
      ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
    </div>
    <div class="note-line">${esc(P.noteLine)}</div>
    <div class="party-block">
      <div class="party-row">
        <span class="label">${esc(P.vepariNameLabel)}</span>
        <span class="value">${esc(vepari?.name)}</span>
      </div>
      <div class="party-row">
        <span class="label">${esc(P.villageLabel)}</span>
        <span class="value">${esc(vepari?.village)}</span>
      </div>
      <div class="party-row">
        <span class="label">${esc(P.dateLabel)}</span>
        <span class="value"></span>
      </div>
    </div>
    <table class="dakhla-table">
      <thead>
        <tr>
          <th>${esc(P.farmerNameColumnLabel)}</th>
          <th>${esc(P.villageColumnLabel)}</th>
          <th>${esc(P.goodsColumnLabel)}</th>
          <th>${esc(P.weightColumnLabel)}</th>
          <th>${esc(P.goodsAmountColumnLabel)}</th>
          <th>${esc(P.tolaiColumnLabel)}</th>
          <th>${esc(P.shesColumnLabel)}</th>
          <th>${esc(P.commissionColumnLabel)}</th>
          <th>${esc(P.totalColumnLabel)}<br/>${esc(P.rupeesSubLabel)}</th>
        </tr>
      </thead>
      <tbody>
        ${buildRowsHtml(lines)}
        <tr class="total-row">
          <td colspan="8" style="text-align:right;">${esc(P.totalLabel)}</td>
          <td class="num">${esc(amountPlain(grandTotal))}</td>
        </tr>
      </tbody>
    </table>
    <div class="instructions">
      <div class="title">${esc(P.instructionsTitle)}</div>
      <div>${esc(P.instruction1)}</div>
      <div>${esc(P.instruction2)}</div>
    </div>
    <div class="dakhla-footer">
      <div>${esc(P.eoeLine)}</div>
      <div>${esc(P.signatureLine)}</div>
    </div>
  </div>
</body>
</html>`
}

// Opens a new tab with the dakhla ledger rendered and ready to print.
// Called straight from a click handler (not awaited before
// window.open) so popup blockers don't treat it as an unsolicited
// popup — the window opens immediately, blank, and we fill it in once
// the font is loaded.
export function printDakhla(vepari, lines, grandTotal, { business }) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(
    '<!doctype html><title>...</title><body style="font-family:sans-serif;padding:24px;">Preparing print…</body>'
  )

  loadGujaratiFontFace().then((fontFace) => {
    const html = buildHtml({ vepari, lines, grandTotal, business, fontFace })
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  })
}
