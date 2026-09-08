// Print a vepari દાખલો matching the paper pad (portrait, red grid,
// રૂા./પૈસા columns, કુલ રકમ Total box). Opens a self-contained print
// window with the embedded Gujarati font — same approach as billPrint.js.

import { toGujaratiDigits } from '../../utils/numbers'
import { formatDisplayDate } from '../../utils/dates'
import gu from '../../locales/gu.json'

const P = gu.dakhla.print

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

const rupeesFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const amountFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function splitRupeesPaise(amount) {
  const n = Number(amount) || 0
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100
  const rupees = Math.floor(rounded)
  const paise = Math.round((rounded - rupees) * 100)
  const rupeesStr = toGujaratiDigits(rupeesFormatter.format(rupees))
  const paiseStr = toGujaratiDigits(String(paise).padStart(2, '0'))
  return { rupeesStr, paiseStr }
}

/** Full amount for the paper "કુલ રકમ Total" box — one decimal only. */
function formatTotalAmount(amount) {
  const n = Number(amount) || 0
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100
  return toGujaratiDigits(amountFormatter.format(rounded))
}

function formatKg(weightKg) {
  const n = Number(weightKg) || 0
  const raw = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  return toGujaratiDigits(raw)
}

function formatRate(rate) {
  if (rate == null || rate === '') return ''
  const n = Number(rate)
  if (!Number.isFinite(n)) return toGujaratiDigits(rate)
  const raw = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  return toGujaratiDigits(raw)
}

/** Expand each bill into paper-style goods rows (one per item). */
function buildGoodsRows(lines) {
  const rows = []
  for (const { bill } of lines) {
    const items = bill.items?.length
      ? bill.items
      : [{ type: '—', weightKg: 0, ratePer20kg: '', amount: bill.totalAmount || 0 }]
    for (const item of items) {
      const { rupeesStr, paiseStr } = splitRupeesPaise(item.amount)
      rows.push(`
        <tr>
          <td class="name">${esc(bill.farmerName)}</td>
          <td class="name">${esc(bill.farmerVillage)}</td>
          <td class="goods">${esc(item.type)}</td>
          <td class="num">${esc(formatKg(item.weightKg))}</td>
          <td class="num">${esc(formatRate(item.ratePer20kg))}</td>
          <td class="num">${esc(rupeesStr)}</td>
          <td class="num">${esc(paiseStr)}</td>
        </tr>`)
    }
  }
  return rows
}

function chargeRow(label, amount) {
  const { rupeesStr, paiseStr } = splitRupeesPaise(amount)
  // Paper pad stacks charge amounts in the price columns; label sits
  // lightly in the left area for clarity on the digital print.
  return `
    <tr class="charge-row">
      <td class="charge-label" colspan="5">${esc(label)}</td>
      <td class="num">${esc(rupeesStr)}</td>
      <td class="num">${esc(paiseStr)}</td>
    </tr>`
}

function blankRow() {
  return `
    <tr class="blank">
      <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`
}

function buildTableBody(lines, totals) {
  const goodsRows = buildGoodsRows(lines)
  const chargeRows = [
    chargeRow(P.tolaiColumnLabel, totals.tolai),
    chargeRow(P.shesColumnLabel, totals.shes),
    chargeRow(P.commissionColumnLabel, totals.commission),
  ]
  // Paper pad is a tall empty grid — fill enough blank lines after goods
  // so charges sit near the bottom of the sheet.
  const minBody = 16
  const blanksNeeded = Math.max(0, minBody - goodsRows.length - chargeRows.length)
  const blanks = Array.from({ length: blanksNeeded }, blankRow)

  return [...goodsRows, ...blanks, ...chargeRows].join('')
}

function resolvePrintDate(lines) {
  if (!lines.length) return ''
  const dates = lines.map((l) => l.bill.date).filter(Boolean).sort()
  if (!dates.length) return ''
  if (dates[0] === dates[dates.length - 1]) return formatDisplayDate(dates[0])
  return `${formatDisplayDate(dates[0])} – ${formatDisplayDate(dates[dates.length - 1])}`
}

function resolveSerial(lines) {
  const nums = lines
    .map((l) => Number(l.bill.dakhlaNumber))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!nums.length) {
    const fallback = lines
      .map((l) => Number(l.bill.entryNumber))
      .filter((n) => Number.isFinite(n))
    if (!fallback.length) return ''
    return String(Math.max(...fallback))
  }
  // Day-group print: all lines share one dakhla number.
  return String(Math.min(...nums))
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
    return ''
  }
}

function buildHtml({ vepari, lines, totals, grandTotal, business, fontFace, logoUrl }) {
  const businessName = business?.name || gu.common.businessNameGu
  const ownerLine = business?.ownerName
    ? `${P.proprietorPrefix} ${esc(business.ownerName)}`
    : ''
  const addressLine = [P.commissionAgentLabel, business?.address]
    .filter(Boolean)
    .map(esc)
    .join(', ')
  const contactName = business?.ownerName ? esc(business.ownerName) : ''
  const mobileLine = business?.mobile
    ? `${esc(P.mobilePrefix)} ${esc(toGujaratiDigits(business.mobile))}`
    : ''
  const licenseLine = business?.licenseNumber
    ? `${esc(P.licensePrefix)} ${esc(toGujaratiDigits(business.licenseNumber))}`
    : ''
  const printDate = resolvePrintDate(lines)
  const serial = resolveSerial(lines)
  const totalAmountStr = formatTotalAmount(grandTotal)

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
    padding: 0;
    background: #fff;
  }
  .sheet {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    padding: 8px 10px 10px;
    border: 2.5px solid #c62828;
    color: #c62828;
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .sheet-body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }
  .top-meta {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1fr;
    gap: 6px;
    align-items: start;
    font-size: 11px;
    margin-bottom: 2px;
  }
  .top-meta .left {
    text-align: left;
    line-height: 1.3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .top-meta .center { text-align: center; line-height: 1.35; }
  .top-meta .right { text-align: right; line-height: 1.4; }
  .logo {
    width: 52px;
    height: 52px;
    object-fit: contain;
  }
  .serial {
    font-size: 20px;
    font-weight: 800;
    color: #c62828;
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .invocation { font-weight: 700; font-size: 12px; }
  .apmc { font-size: 10.5px; margin-top: 2px; }
  .dakhla-tag {
    display: inline-block;
    margin-top: 4px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }
  .header {
    text-align: center;
    margin: 2px 0 4px;
    position: relative;
  }
  .header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 800;
    color: #c62828;
    letter-spacing: 0.02em;
  }
  .header .owner { font-size: 13px; font-weight: 700; margin-top: 2px; color: #c62828; }
  .header .address { font-size: 11.5px; margin-top: 2px; color: #c62828; }
  .license-pill {
    position: absolute;
    right: 0;
    top: 6px;
    border: 1.5px solid #c62828;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 700;
    max-width: 42%;
    line-height: 1.25;
    color: #c62828;
  }
  .note-line {
    text-align: center;
    font-size: 11.5px;
    font-weight: 600;
    border-top: 1.5px solid #c62828;
    border-bottom: 1.5px solid #c62828;
    padding: 4px 4px;
    margin: 6px 0 8px;
    color: #c62828;
  }
  .party {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 8px;
    font-size: 13px;
    margin-bottom: 8px;
    align-items: end;
  }
  .party .label { font-weight: 700; white-space: nowrap; color: #c62828; }
  .party .value {
    border-bottom: 1.25px solid #c62828;
    min-height: 18px;
    color: #111;
    padding: 0 4px 1px;
  }
  .party-row-2 {
    display: grid;
    grid-template-columns: auto 1fr auto minmax(110px, 0.4fr);
    gap: 6px 8px;
    grid-column: 1 / -1;
    align-items: end;
  }
  table.dakhla {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    flex: 1 1 auto;
  }
  table.dakhla col.c-name { width: 22%; }
  table.dakhla col.c-village { width: 14%; }
  table.dakhla col.c-goods { width: 12%; }
  table.dakhla col.c-kg { width: 10%; }
  table.dakhla col.c-rate { width: 10%; }
  table.dakhla col.c-rs { width: 18%; }
  table.dakhla col.c-ps { width: 8%; }
  table.dakhla th, table.dakhla td {
    border: 1.5px solid #c62828;
    padding: 3px 5px;
    color: #111;
    vertical-align: middle;
  }
  table.dakhla th {
    background: #fff;
    color: #c62828;
    font-weight: 700;
    text-align: center;
    font-size: 11.5px;
  }
  table.dakhla td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  table.dakhla td.name, table.dakhla td.goods { text-align: left; }
  table.dakhla tbody tr.blank td { height: 22px; }
  table.dakhla tbody tr.charge-row td {
    color: #111;
    font-weight: 600;
  }
  table.dakhla tbody tr.charge-row td.charge-label {
    text-align: right;
    padding-right: 10px;
    color: #c62828;
    font-weight: 700;
    font-size: 11.5px;
  }
  .footer {
    display: grid;
    grid-template-columns: 1fr minmax(160px, 28%);
    gap: 10px 14px;
    margin-top: 0;
    align-items: stretch;
  }
  .footer-left {
    padding-top: 8px;
  }
  .instructions {
    font-size: 11px;
    color: #1565c0;
    line-height: 1.5;
  }
  .instructions .title {
    font-weight: 700;
    color: #1565c0;
    margin-bottom: 2px;
  }
  .eoe {
    margin-top: 10px;
    font-size: 11px;
    color: #333;
  }
  .total-box {
    border: 2px solid #c62828;
    border-top: none;
    padding: 8px 10px 10px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 72px;
    margin-top: -1.5px;
  }
  .total-box .label {
    font-size: 13px;
    font-weight: 800;
    color: #c62828;
    line-height: 1.25;
  }
  .total-box .label-en {
    font-size: 12px;
    font-weight: 700;
    color: #c62828;
    margin-bottom: 4px;
  }
  .total-box .amount {
    font-size: 18px;
    font-weight: 800;
    color: #111;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
  .print-bar {
    max-width: 780px;
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
  @media print {
    html, body {
      width: 100%;
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
    }
    .print-bar { display: none !important; }
    .sheet {
      max-width: none;
      width: 100%;
      min-height: 100vh;
      height: 100vh;
      margin: 0;
      padding: 5mm 6mm;
      border-width: 2.5px;
      page-break-after: avoid;
    }
    table.dakhla { height: 100%; }
    table.dakhla tbody tr.blank td { height: 24px; }
    @page {
      size: A4 portrait;
      margin: 0;
    }
  }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">${esc(P.dakhlaLabel)} — Print</button></div>
  <div class="sheet">
    <div class="sheet-body">
    <div class="top-meta">
      <div class="left">
        ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="" />` : ''}
        ${serial ? `<div class="serial">${esc(toGujaratiDigits(serial))}</div>` : ''}
      </div>
      <div class="center">
        <div class="invocation">${esc(P.invocationLine)}</div>
        <div class="apmc">${esc(P.apmcLine)}</div>
        <div class="dakhla-tag">${esc(P.dakhlaLabel)}</div>
      </div>
      <div class="right">
        ${contactName ? `<div>${contactName}</div>` : ''}
        ${mobileLine ? `<div>${mobileLine}</div>` : ''}
      </div>
    </div>

    <div class="header">
      <h1>${esc(businessName)}</h1>
      ${ownerLine ? `<div class="owner">${ownerLine}</div>` : ''}
      ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
      ${licenseLine ? `<div class="license-pill">${licenseLine}</div>` : ''}
    </div>

    <div class="note-line">${esc(P.noteLine)}</div>

    <div class="party">
      <span class="label">${esc(P.vepariNameLabel)}</span>
      <span class="value">${esc(vepari?.name)}</span>
      <div class="party-row-2">
        <span class="label">${esc(P.villageLabel)}</span>
        <span class="value">${esc(vepari?.village)}</span>
        <span class="label">${esc(P.dateLabel)}</span>
        <span class="value">${esc(toGujaratiDigits(printDate))}</span>
      </div>
    </div>

    <table class="dakhla">
      <colgroup>
        <col class="c-name" />
        <col class="c-village" />
        <col class="c-goods" />
        <col class="c-kg" />
        <col class="c-rate" />
        <col class="c-rs" />
        <col class="c-ps" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">${esc(P.farmerNameColumnLabel)}</th>
          <th rowspan="2">${esc(P.villageColumnLabel)}</th>
          <th rowspan="2">${esc(P.goodsColumnLabel)}</th>
          <th rowspan="2">${esc(P.weightColumnLabel)}</th>
          <th rowspan="2">${esc(P.rateColumnLabel)}</th>
          <th colspan="2">${esc(P.totalColumnLabel)}</th>
        </tr>
        <tr>
          <th>${esc(P.rupeesLabel)}</th>
          <th>${esc(P.paiseLabel)}</th>
        </tr>
      </thead>
      <tbody>
        ${buildTableBody(lines, totals)}
      </tbody>
    </table>
    </div>

    <div class="footer">
      <div class="footer-left">
        <div class="instructions">
          <div class="title">${esc(P.instructionsTitle)}</div>
          <div>${esc(P.instruction1)}</div>
          <div>${esc(P.instruction2)}</div>
        </div>
        <div class="eoe">${esc(P.eoeLine)}</div>
      </div>
      <div class="total-box">
        <div class="label">${esc(P.totalLabel)}</div>
        <div class="label-en">Total</div>
        <div class="amount">${esc(totalAmountStr)}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function printDakhla(vepari, lines, grandTotal, { business, totals }) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.alert('Pop-up blocked — allow pop-ups for this site to print the dakhla.')
    return
  }

  printWindow.document.write(
    '<!doctype html><title>...</title><body style="font-family:sans-serif;padding:24px;">Preparing print…</body>',
  )

  const resolvedTotals = totals || {
    tolai: 0,
    shes: 0,
    commission: 0,
    goodsAmount: 0,
    total: grandTotal,
  }

  const logoUrl = `${window.location.origin}/icons/logo_full_ink_transparent.png`

  loadGujaratiFontFace().then((fontFace) => {
    const html = buildHtml({
      vepari,
      lines,
      totals: resolvedTotals,
      grandTotal,
      business,
      fontFace,
      logoUrl,
    })
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  })
}
