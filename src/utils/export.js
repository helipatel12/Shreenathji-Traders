// Client-side Excel/CSV/PDF export — ExcelJS + jsPDF.
// No server round trip. Dynamic imports keep the main bundle small.

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Prevent Excel formula injection when opening exports. */
function sanitizeCell(value) {
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return value
  const s = String(value)
  if (/^[=+\-@]/.test(s)) return `'${s}`
  return s
}

function rowsToMatrix(rows) {
  if (!rows?.length) return [['Note'], ['(empty)']]
  const keys = Object.keys(rows[0])
  return [keys, ...rows.map((row) => keys.map((k) => sanitizeCell(row[k])))]
}

async function buildExcelBlob(rows, sheetName = 'Sheet1') {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Sheet1')
  const matrix = rowsToMatrix(rows)
  matrix.forEach((line) => worksheet.addRow(line))
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function exportRowsToExcel(rows, filename, sheetName = 'Sheet1') {
  const blob = await buildExcelBlob(rows, sheetName)
  downloadBlob(blob, `${filename}.xlsx`)
}

export async function buildExcelBlobForArchive(rows, sheetName) {
  return buildExcelBlob(rows, sheetName)
}

function rowsToCsv(rows) {
  const matrix = rowsToMatrix(rows)
  return matrix
    .map((line) =>
      line
        .map((cell) => {
          const s = String(cell ?? '')
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
          return s
        })
        .join(','),
    )
    .join('\n')
}

export async function exportRowsToCSV(rows, filename) {
  const csv = rowsToCsv(rows)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

const GUJARATI_FONT_NAME = 'NotoSansGujarati'

async function buildPdfDoc(rows, columns, title) {
  const [{ default: jsPDF }, { default: autoTable }, { NOTO_SANS_GUJARATI_REGULAR_BASE64 }] =
    await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      import('../assets/notoSansGujaratiFont'),
    ])

  const doc = new jsPDF()
  doc.addFileToVFS('NotoSansGujarati-Regular.ttf', NOTO_SANS_GUJARATI_REGULAR_BASE64)
  doc.addFont('NotoSansGujarati-Regular.ttf', GUJARATI_FONT_NAME, 'normal')
  doc.setFont(GUJARATI_FONT_NAME)

  if (title) {
    doc.setFontSize(14)
    doc.text(title, 14, 15)
  }
  autoTable(doc, {
    startY: title ? 22 : 14,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => row[c.key] ?? '')),
    styles: { fontSize: 9, font: GUJARATI_FONT_NAME, fontStyle: 'normal' },
    headStyles: {
      fillColor: [43, 66, 56],
      font: GUJARATI_FONT_NAME,
      fontStyle: 'normal',
    },
  })
  return doc
}

export async function exportRowsToPDF(rows, columns, filename, title) {
  const doc = await buildPdfDoc(rows, columns, title)
  doc.save(`${filename}.pdf`)
}

export async function printRows(rows, columns, title) {
  const doc = await buildPdfDoc(rows, columns, title)
  const blobUrl = doc.output('bloburl')
  const win = window.open(blobUrl, '_blank')
  if (!win) {
    window.alert('Pop-up blocked — allow pop-ups to print, or use Export PDF instead.')
  }
}
