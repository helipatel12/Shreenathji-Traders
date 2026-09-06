// Print a single bill as a કેશ મેમો matching the paper memo pad.
// Labels stay Gujarati (paper format). Opens a self-contained print window.

import { toGujaratiDigits } from '../../utils/numbers'
import { formatDisplayDate } from '../../utils/dates'
import gu from '../../locales/gu.json'

const P = gu.bills.print

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

function formatWeight(weightKg) {
  const n = Number(weightKg) || 0
  const raw = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  return toGujaratiDigits(raw)
}

const rupeesFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
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

function buildRowsHtml(bill) {
  const items = bill.items || []
  const rows = items.map((item) => {
    const { rupeesStr, paiseStr } = splitRupeesPaise(item.amount)
    return `
      <tr>
        <td class="goods">${esc(item.type)}</td>
        <td class="num">${esc(formatWeight(item.weightKg))}</td>
        <td class="num">${esc(toGujaratiDigits(item.ratePer20kg))}</td>
        <td class="num">${esc(rupeesStr)}</td>
        <td class="num">${esc(paiseStr)}</td>
      </tr>`
  })
  // Blank filler rows so the table fills the paper pad.
  const minRows = 12
  for (let i = items.length; i < minRows; i += 1) {
    rows.push(`
      <tr class="blank">
        <td>&nbsp;</td><td></td><td></td><td></td><td></td>
      </tr>`)
  }
  return rows.join('')
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

function buildHtml({ bill, business, vepariName, vepariVillage, fontFace }) {
  const businessName = business?.name || gu.common.businessNameEn
  const ownerLine = business?.ownerName
    ? `${P.proprietorPrefix} ${esc(business.ownerName)}`
    : ''
  const addressLine = [P.commissionAgentLabel, business?.address]
    .filter(Boolean)
    .map(esc)
    .join(', ')
  const mobileLine = business?.mobile
    ? `${esc(P.mobilePrefix)} ${esc(business.mobile)}`
    : ''
  const licenseLine = business?.licenseNumber
    ? `${esc(P.licensePrefix)} ${esc(business.licenseNumber)}`
    : ''
  const totalSplit = splitRupeesPaise(bill.totalAmount)
  const buyerVillage = vepariVillage || ''

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
    padding: 0;
    background: #fff;
  }
  .memo {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 10px 12px;
    border: 2px solid #b3413a;
    color: #b3413a;
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .memo-body { flex: 1 1 auto; display: flex; flex-direction: column; }
  table.goods-table { width: 100%; flex: 1 1 auto; }
  .memo-topline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 12px;
    margin-bottom: 2px;
  }
  .memo-tag {
    background: #b3413a;
    color: #fff;
    padding: 2px 10px;
    border-radius: 2px;
    font-weight: 700;
  }
  .memo-title { text-align: center; font-weight: 700; font-size: 14px; flex: 1; }
  .memo-contact { text-align: right; line-height: 1.45; color: #b3413a; }
  .memo-header { text-align: center; margin: 4px 0 8px; }
  .memo-header h1 {
    font-size: 28px;
    margin: 0;
    color: #b3413a;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .memo-header .owner { font-size: 13px; margin-top: 2px; font-weight: 600; }
  .memo-header .address { font-size: 12px; margin-top: 1px; }
  .memo-noline {
    display: flex;
    justify-content: space-between;
    border-bottom: 1.5px solid #b3413a;
    padding: 2px 4px 4px;
    margin: 6px 0 8px;
    font-size: 14px;
    font-weight: 700;
  }
  .party-block {
    border: 1.5px solid #b3413a;
    padding: 6px 8px;
    font-size: 13px;
  }
  .party-row {
    display: grid;
    grid-template-columns: auto 1fr auto minmax(90px, 0.45fr);
    gap: 6px;
    align-items: end;
    padding: 3px 0;
  }
  .party-row .label { white-space: nowrap; font-weight: 700; }
  .party-row .value {
    border-bottom: 1px solid #b3413a;
    min-height: 18px;
    color: #1a1e1b;
    padding: 0 4px;
  }
  table.goods-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 13px;
  }
  table.goods-table th, table.goods-table td {
    border: 1.5px solid #b3413a;
    padding: 5px 6px;
    color: #1a1e1b;
  }
  table.goods-table th {
    background: #fbeceb;
    font-weight: 700;
    text-align: center;
    font-size: 12px;
    color: #b3413a;
  }
  table.goods-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.goods-table td.goods { min-width: 100px; }
  table.goods-table tbody tr.blank td { height: 26px; }
  tr.total-row td {
    font-weight: 700;
    color: #b3413a;
  }
  .memo-footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-top: auto;
    padding-top: 10px;
    color: #333;
  }
  .memo-footer .right { text-align: right; }
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
  @media print {
    html, body {
      width: 100%;
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
    }
    .print-bar { display: none !important; }
    .memo {
      max-width: none;
      width: 100%;
      min-height: 100vh;
      height: 100vh;
      margin: 0;
      padding: 6mm 7mm;
      border-width: 2px;
      page-break-after: avoid;
    }
    table.goods-table { height: 100%; }
    table.goods-table tbody tr.blank td { height: 28px; }
    @page {
      size: A4 portrait;
      margin: 0;
    }
  }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">${esc(P.printButton || P.cashMemoLabel)}</button></div>
  <div class="memo">
    <div class="memo-body">
    <div class="memo-topline">
      <span class="memo-tag">${esc(P.cashMemoLabel)}</span>
      <span class="memo-title">॥ શ્રી ॥</span>
      <div class="memo-contact">
        ${mobileLine ? `<div>${mobileLine}</div>` : ''}
        ${licenseLine ? `<div>${licenseLine}</div>` : ''}
      </div>
    </div>
    <div class="memo-header">
      <h1>${esc(businessName)}</h1>
      ${ownerLine ? `<div class="owner">${ownerLine}</div>` : ''}
      ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
    </div>
    <div class="memo-noline">
      <span>${esc(P.memoNumberLabel)} ${esc(toGujaratiDigits(bill.entryNumber))}</span>
      <span>${esc(P.dateLabel)} ${esc(toGujaratiDigits(formatDisplayDate(bill.date)))}</span>
    </div>
    <div class="party-block">
      <div class="party-row">
        <span class="label">${esc(P.farmerNameLabel)}</span>
        <span class="value">${esc(bill.farmerName)}</span>
        <span class="label">${esc(P.villageLabel)}</span>
        <span class="value">${esc(bill.farmerVillage)}</span>
      </div>
      <div class="party-row">
        <span class="label">${esc(P.buyerNameLabel)}</span>
        <span class="value">${esc(vepariName)}</span>
        <span class="label">${esc(P.villageLabel)}</span>
        <span class="value">${esc(buyerVillage)}</span>
      </div>
    </div>
    <table class="goods-table">
      <thead>
        <tr>
          <th rowspan="2">${esc(P.goodsColumnLabel)}</th>
          <th rowspan="2">${esc(P.weightColumnLabel)}<br/>(${esc(P.weightUnitLabel)})</th>
          <th rowspan="2">${esc(P.rateColumnLabel)}</th>
          <th colspan="2">${esc(P.amountColumnLabel)}</th>
        </tr>
        <tr>
          <th>રૂા.</th>
          <th>પૈસા</th>
        </tr>
      </thead>
      <tbody>
        ${buildRowsHtml(bill)}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">${esc(P.totalLabel)}</td>
          <td class="num">${esc(totalSplit.rupeesStr)}</td>
          <td class="num">${esc(totalSplit.paiseStr)}</td>
        </tr>
      </tbody>
    </table>
    </div>
    <div class="memo-footer">
      <div class="left">
        <div>${esc(P.ackLine)}</div>
        <div style="margin-top:12px;">${esc(P.ackLine1)}</div>
      </div>
      <div class="right">
        <div>${esc(P.eoeLine)}</div>
        <div style="margin-top:12px;">${esc(P.eoeLine1)}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function printBill(bill, { business, vepariName, vepariVillage }) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.alert('Pop-up blocked — allow pop-ups for this site to print the cash memo.')
    return
  }

  printWindow.document.write(
    '<!doctype html><title>...</title><body style="font-family:sans-serif;padding:24px;">Preparing print…</body>',
  )

  loadGujaratiFontFace().then((fontFace) => {
    const html = buildHtml({
      bill,
      business,
      vepariName,
      vepariVillage,
      fontFace,
    })
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  })
}
