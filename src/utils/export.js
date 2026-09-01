// Client-side Excel/CSV/PDF export — SheetJS (xlsx) + jsPDF, per
// rules.md §1. No server round trip, nothing leaves the browser.
//
// Single source of truth for the "rows of data → downloadable file"
// mechanics (prd.md's "every module supports export" requirement,
// §5). Each feature's own export button supplies its own row-shaping
// function and calls into these — bills here in Phase 4, vepari
// dakhla/rojmer/silak in Phases 5–7, the year-end archive in Phase 9,
// CA reports in Phase 10 — rather than each reimplementing the
// SheetJS/jsPDF calls inline.
//
// All three functions dynamically import their heavy dependencies
// (xlsx, jsPDF + autoTable, and the ~240KB embedded Gujarati font)
// rather than importing them at the top of this module. Phase 7's
// build started failing outright once the main bundle crossed
// vite-plugin-pwa's 2MB precache limit — these libraries, needed only
// the moment someone actually clicks an export button, were the
// biggest contributors sitting in every single page load regardless.
// Dynamic import() splits them into separate chunks Vite only fetches
// on first actual use, which fixes the build AND means opening the
// dashboard on a slow rural connection no longer pays for a PDF
// library it may never touch that session.

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

// Builds an .xlsx workbook as a Blob without triggering a download —
// shared by exportRowsToExcel() below (which does trigger one) and
// the year-end archive (Phase 9), which needs each module's file as
// raw bytes to bundle into a single zip via JSZip, not as N separate
// browser downloads.
async function buildExcelBlob(rows, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// rows: array of flat objects — keys become column headers as-is, so
// callers should pass already-human-readable keys (e.g. "Farmer",
// not "farmerName").
export async function exportRowsToExcel(rows, filename, sheetName = 'Sheet1') {
  const blob = await buildExcelBlob(rows, sheetName)
  downloadBlob(blob, `${filename}.xlsx`)
}

// Same workbook-building logic as exportRowsToExcel(), exposed
// separately for the year-end archive to embed as one file among
// several inside a single zip, without triggering its own download.
export async function buildExcelBlobForArchive(rows, sheetName) {
  return buildExcelBlob(rows, sheetName)
}

export async function exportRowsToCSV(rows, filename) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  // Prefix a UTF-8 BOM so Gujarati text opens correctly in Excel,
  // which otherwise guesses the wrong encoding for plain CSV.
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

const GUJARATI_FONT_NAME = 'NotoSansGujarati'

// Builds the jsPDF document itself — shared by exportRowsToPDF()
// (downloads it) and printRows() (opens it in a new tab for the
// browser's own print dialog), so the two can never drift apart in
// formatting/fonts.
async function buildPdfDoc(rows, columns, title) {
  const [{ default: jsPDF }, { default: autoTable }, { NOTO_SANS_GUJARATI_REGULAR_BASE64 }] =
    await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      import('../assets/notoSansGujaratiFont'),
    ])

  const doc = new jsPDF()
  // Registers the embedded Gujarati font on this jsPDF document.
  // Must happen per-document (jsPDF's VFS/font registry is
  // per-instance, not global) before any Gujarati text is drawn —
  // otherwise jsPDF falls back to its built-in Latin-only fonts and
  // Gujarati characters render as blank boxes. See
  // notoSansGujaratiFont.js for why this couldn't just be a normal
  // font-family CSS setting.
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
    // fontStyle: 'normal' everywhere is deliberate, not a default left
    // in place — autoTable bolds header rows by default, but only the
    // Regular weight of the Gujarati font is embedded. Without this,
    // header cells with Gujarati text would silently fall back to
    // jsPDF's built-in Latin-only bold font and render as blank boxes.
    styles: { fontSize: 9, font: GUJARATI_FONT_NAME, fontStyle: 'normal' },
    headStyles: {
      fillColor: [43, 66, 56], // --color-accent, design.md §2
      font: GUJARATI_FONT_NAME,
      fontStyle: 'normal',
    },
  })
  return doc
}

// columns: [{ header: 'Farmer', key: 'farmer' }, ...] — kept separate
// from `rows` (unlike Excel/CSV) because jsPDF-autotable needs an
// explicit column order and header labels rather than inferring them
// from object keys.
export async function exportRowsToPDF(rows, columns, filename, title) {
  const doc = await buildPdfDoc(rows, columns, title)
  doc.save(`${filename}.pdf`)
}

// "Print" (added alongside every export button, per owner request) —
// builds the exact same PDF as exportRowsToPDF() but opens it in a
// new tab instead of downloading it, so the browser's own PDF viewer
// and its native print button/Ctrl+P handle the rest. Deliberately
// NOT trying to auto-trigger window.print() programmatically on the
// opened tab — most browsers sandbox their built-in PDF viewer enough
// that a script in the opening page can't reliably reach into it, so
// a "looks like it prints but silently doesn't in some browsers"
// button would be worse than just handing the user a PDF they print
// themselves the normal way.
export async function printRows(rows, columns, title) {
  const doc = await buildPdfDoc(rows, columns, title)
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}
