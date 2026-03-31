import XLSX from 'xlsx'
import type { ImportedContactRow } from './csvParser.js'
import { dedupePhones, normalizePhone } from './phoneNormalizer.js'

/**
 * Auto-detects which column contains phone numbers.
 * 
 * Strategy:
 * 1. Check column headers against known phone keywords (exact match first)
 * 2. Check contains match
 * 3. Scan column content for phone-like values (fallback)
 */
function detectPhoneColumn(
  headers: string[],
  rows: Record<string, string>[]
): string | null {

  // Priority-ordered list — more specific matches first
  const PHONE_EXACT = [
    'phone_number', 'phone number', 'phonenumber',
    'mobile_number', 'mobile number', 'mobilenumber',
    'phone', 'mobile', 'telephone',
    'whatsapp', 'whatsapp_number', 'whatsapp number',
    'contact_number', 'contact number',
    'cell', 'cell_number', 'cell number',
    'tel', 'gsm', 'msisdn',
  ]

  const headersLower = headers.map(h => h.toLowerCase().trim())

  // 1. Exact match (case-insensitive)
  for (const keyword of PHONE_EXACT) {
    const idx = headersLower.indexOf(keyword)
    if (idx !== -1) return headers[idx]
  }

  // 2. Contains match (e.g. "primary_phone_no", "wa_number")
  // BUT exclude "number" alone — it matches too broadly (e.g. "TOWNHOUSE NUMBER")
  const PHONE_CONTAINS = ['phone', 'mobile', 'whatsapp', 'tel', 'cell', 'gsm']
  for (const keyword of PHONE_CONTAINS) {
    const idx = headersLower.findIndex(h => h.includes(keyword))
    if (idx !== -1) return headers[idx]
  }

  // 3. Content scanning — find column with most phone-like values
  // Phone-like = mostly digits, possibly +, -, spaces, parens, 7-15 chars
  const PHONE_PATTERN = /^[+\-()\s\d]{7,20}$/
  const scores: { header: string; score: number }[] = []

  for (const header of headers) {
    const sampleValues = rows.slice(0, 20).map(r => String(r[header] ?? '').trim())
    const phoneCount = sampleValues.filter(v => v && PHONE_PATTERN.test(v)).length
    if (phoneCount > 0) {
      scores.push({ header, score: phoneCount })
    }
  }

  if (scores.length > 0) {
    scores.sort((a, b) => b.score - a.score)
    return scores[0].header
  }

  return null
}

/**
 * Auto-detects which column contains names.
 */
function detectNameColumn(headers: string[]): string | null {
  const NAME_EXACT = [
    'full_name', 'full name', 'fullname',
    'name', 'customer_name', 'customer name',
    'contact_name', 'contact name',
    'client_name', 'client name',
    'first_name', 'firstname',
    'resident_name', 'owner_name',
  ]
  const headersLower = headers.map(h => h.toLowerCase().trim())
  for (const keyword of NAME_EXACT) {
    const idx = headersLower.indexOf(keyword)
    if (idx !== -1) return headers[idx]
  }
  const NAME_CONTAINS = ['name', 'client', 'customer', 'resident', 'owner']
  for (const keyword of NAME_CONTAINS) {
    const idx = headersLower.findIndex(h => h.includes(keyword) && !h.includes('phone') && !h.includes('number'))
    if (idx !== -1) return headers[idx]
  }
  return null
}

/**
 * Auto-detects email column.
 */
function detectEmailColumn(headers: string[]): string | null {
  const headersLower = headers.map(h => h.toLowerCase().trim())
  const idx = headersLower.findIndex(h => h.includes('email') || h.includes('e-mail') || h.includes('mail'))
  return idx !== -1 ? headers[idx] : null
}

/**
 * Parses an XLSX or XLS file into an array of row objects.
 * 
 * KEY FIX: raw: false tells SheetJS to use formatted text (.w) instead of
 * raw JS values (.v). This preserves leading zeros on phone numbers.
 * Without this, "0507267858" becomes 507267858 (number) → "507267858.0" (string).
 */
export function parseExcelBuffer(buffer: Buffer, defaultCountryCode = 'AE') {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellText: true,   // Generate .w (formatted text) for every cell
    cellDates: false, // Keep dates as strings, not Date objects
    raw: false,       // Use .w not .v (CRITICAL for leading zero preservation)
  })

  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]

  if (!sheet) {
    return { rows: [], rawRows: [], phoneColumn: null, nameColumn: null }
  }

  // Get as array of arrays first (gives us more control)
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    raw: false,     // Use formatted text NOT raw JS numbers — PRESERVES LEADING ZEROS
    defval: '',     // Empty string for missing cells (not undefined/null)
    header: 1,      // Return as array rows (we handle headers manually)
  }) as string[][]

  if (!rawRows || rawRows.length === 0) {
    return { rows: [], rawRows: [], phoneColumn: null, nameColumn: null }
  }

  // First row = headers, normalize them
  const headers = rawRows[0].map((h) => String(h ?? '').trim())
  
  // Convert data rows to objects
  const jsonRows: Record<string, string>[] = rawRows.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((header, i) => {
        obj[header] = String(row[i] ?? '').trim()
      })
      return obj
    })

  // SMART DETECTION: Find phone and name columns by scanning data
  const phoneColumn = detectPhoneColumn(headers, jsonRows)
  const nameColumn = detectNameColumn(headers)
  const emailColumn = detectEmailColumn(headers)

  const rows = jsonRows
    .map((row) => {
      // Use detected phone column, fall back to common names
      let rawPhone = ''
      if (phoneColumn) {
        rawPhone = row[phoneColumn] || ''
      } else {
        // Fallback: try common column names
        rawPhone =
          row.phone || row.PHONE || row.Phone ||
          row.mobile || row.MOBILE || row.Mobile ||
          row.number || row.NUMBER || row.Number ||
          row.tel || row.TEL || row.Tel ||
          row.telephone || row.TELEPHONE || row.Telephone ||
          row.whatsapp || row.WHATSAPP || row.WhatsApp ||
          ''
      }

      const phone = normalizePhone(rawPhone, defaultCountryCode)
      if (!phone) return null

      // Use detected name column, fall back to common names
      let rawName = ''
      if (nameColumn) {
        rawName = row[nameColumn] || ''
      } else {
        rawName =
          row.name || row.NAME || row.Name ||
          row.full_name || row.FULL_NAME || row.fullname ||
          row.customer || row.owner || row.resident ||
          ''
      }

      // Use detected email column, fall back to common names
      let rawEmail = ''
      if (emailColumn) {
        rawEmail = row[emailColumn] || ''
      } else {
        rawEmail = row.email || row.EMAIL || row.Email || ''
      }

      return {
        name: rawName.trim() || undefined,
        phone,
        email: rawEmail.trim() || undefined,
        tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      } as ImportedContactRow
    })
    .filter(Boolean) as ImportedContactRow[]

  const uniquePhones = new Set(dedupePhones(rows.map((row) => row.phone)))
  return {
    rows: rows.filter((row) => uniquePhones.delete(row.phone)),
    rawRows: jsonRows,
    phoneColumn,
    nameColumn,
    emailColumn,
  }
}
