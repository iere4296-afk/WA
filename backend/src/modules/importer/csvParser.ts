import Papa from 'papaparse'
import { dedupePhones, normalizePhone } from './phoneNormalizer.js'

export interface ImportedContactRow {
  name?: string
  phone: string
  email?: string
  tags?: string[]
}

export interface CsvParseError {
  row: number
  phone?: string
  reason: string
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

function rowHasPhoneColumn(row: Record<string, string>): boolean {
  const keys = Object.keys(row).map((k) => k.toLowerCase())
  return keys.some((k) =>
    ['phone', 'mobile', 'number', 'tel', 'telephone', 'whatsapp', 'cell'].includes(k),
  )
}

/**
 * Auto-detects which column contains phone numbers.
 */
function detectPhoneColumn(headers: string[]): string | null {
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
  for (const keyword of PHONE_EXACT) {
    const idx = headersLower.indexOf(keyword)
    if (idx !== -1) return headers[idx]
  }
  const PHONE_CONTAINS = ['phone', 'mobile', 'whatsapp', 'tel', 'cell', 'gsm']
  for (const keyword of PHONE_CONTAINS) {
    const idx = headersLower.findIndex(h => h.includes(keyword))
    if (idx !== -1) return headers[idx]
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

function mapRowFromHeader(
  row: Record<string, string>,
  defaultCountryCode: string,
): ImportedContactRow | null {
  // Try multiple column name variations (case-insensitive)
  const rawPhone = 
    row.phone || row.PHONE || row.Phone ||
    row.mobile || row.MOBILE || row.Mobile ||
    row.number || row.NUMBER || row.Number ||
    row.tel || row.TEL || row.Tel ||
    row.telephone || row.TELEPHONE || row.Telephone ||
    row.whatsapp || row.WHATSAPP || row.WhatsApp ||
    row.cell || row.CELL || row.Cell ||
    ''
  
  const phone = normalizePhone(String(rawPhone), defaultCountryCode)
  if (!phone) return null
  return {
    name: row.name || row.NAME || row.Name || row.full_name || row.FULL_NAME || row['full name'] || row.fullname || undefined,
    phone,
    email: row.email || row.EMAIL || row.Email || undefined,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
  }
}

function mapPositionalRow(
  cells: string[],
  rowIndex: number,
  defaultCountryCode: string,
): { row: ImportedContactRow | null; error?: CsvParseError } {
  const rawPhone = cells[0] ?? ''
  const phone = normalizePhone(rawPhone, defaultCountryCode)
  if (!phone) {
    return {
      row: null,
      error: { row: rowIndex, phone: rawPhone, reason: 'Could not normalize phone' },
    }
  }
  return {
    row: {
      phone,
      name: cells[1]?.trim() || undefined,
      email: cells[2]?.trim() || undefined,
      tags: [],
    },
  }
}

export function parseCsvBuffer(buffer: Buffer, defaultCountryCode = 'AE') {
  const text = stripBom(buffer.toString('utf8'))
  const parseErrors: CsvParseError[] = []

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  for (const e of parsed.errors) {
    parseErrors.push({ row: e.row ?? 0, reason: e.message || 'Parse error' })
  }

  const rawRows = parsed.data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')]),
    ),
  )

  let rows: ImportedContactRow[] = []

  const firstRow = parsed.data[0]
  const useHeader = !!(firstRow && rowHasPhoneColumn(firstRow) && parsed.data.length > 0)

  if (useHeader) {
    parsed.data.forEach((row, i) => {
      const r = mapRowFromHeader(row, defaultCountryCode)
      if (!r) {
        parseErrors.push({ row: i + 2, reason: 'Invalid or missing phone' })
      } else {
        rows.push(r)
      }
    })
  } else {
    const noHeader = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    })
    for (const e of noHeader.errors) {
      parseErrors.push({ row: e.row ?? 0, reason: e.message || 'Parse error' })
    }

    const dataRows = noHeader.data.filter((r) => r.some((c) => String(c).trim().length > 0))
    let start = 0
    if (dataRows.length > 0) {
      const headerGuess = dataRows[0].join('').toLowerCase()
      if (headerGuess.includes('phone') || headerGuess.includes('mobile') || headerGuess.includes('name')) {
        start = 1
      }
    }

    for (let i = start; i < dataRows.length; i++) {
      const cells = dataRows[i].map((c) => String(c ?? '').trim())
      const { row, error } = mapPositionalRow(cells, i + 1, defaultCountryCode)
      if (error) parseErrors.push(error)
      if (row) rows.push(row)
    }
  }

  const uniquePhones = new Set(dedupePhones(rows.map((r) => r.phone)))
  const deduped = rows.filter((row) => uniquePhones.delete(row.phone))

  // Detect columns from headers
  const headers = parsed.data.length > 0 ? Object.keys(parsed.data[0]) : []
  const phoneColumn = detectPhoneColumn(headers)
  const nameColumn = detectNameColumn(headers)
  const emailColumn = detectEmailColumn(headers)

  return {
    rows: deduped,
    rawRows,
    errors: parseErrors,
    phoneColumn,
    nameColumn,
    emailColumn,
  }
}
