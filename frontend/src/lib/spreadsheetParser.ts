/**
 * Parses XLSX, XLS, and CSV files in the browser.
 *
 * Rules:
 * - Use raw: false in SheetJS so phone values stay formatted as text
 * - Handle BOM and CSV encoding fallbacks in the browser
 * - Never throw to callers; always return a ParseResult with error when needed
 * - Stay client-safe for Next.js App Router
 */

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  detectedPhoneColumn: string | null
  detectedNameColumn: string | null
  detectedEmailColumn: string | null
  error: string | null
  preview: Record<string, string>[]
}

interface HeaderEntry {
  label: string
  sourceIndex: number
}

function looksLikeEmailValue(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function looksLikeNameValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.length < 2 || trimmed.length > 60) return false
  if (/\d/.test(trimmed)) return false
  return /^[A-Za-z][A-Za-z\s.'-]*$/.test(trimmed)
}

function looksLikeHeaderLabel(value: string): boolean {
  const normalized = value.toLowerCase().trim()
  if (!normalized) return false

  const headerKeywords = [
    'name',
    'full name',
    'full_name',
    'phone',
    'phone number',
    'phone_number',
    'mobile',
    'mobile number',
    'email',
    'email address',
    'contact',
    'contact number',
    'whatsapp',
    'telephone',
    'tel',
    'number',
    'first name',
    'last name',
  ]

  return headerKeywords.some((keyword) => normalized === keyword || normalized.includes(keyword))
}

function shouldTreatFirstRowAsData(rawData: unknown[][], startIndex: number): boolean {
  const firstRow = (rawData[startIndex] ?? []).map(coerceCellValue).filter(Boolean)
  if (firstRow.length === 0) return false

  const sampleRows = rawData
    .slice(startIndex, Math.min(startIndex + 5, rawData.length))
    .map((row) => (row ?? []).map(coerceCellValue))

  const headerishCount = firstRow.filter(looksLikeHeaderLabel).length
  if (headerishCount >= Math.ceil(firstRow.length / 2)) {
    return false
  }

  if (firstRow.length === 1) {
    const firstColumnSamples = sampleRows.map((row) => row[0] ?? '').filter(Boolean)
    const phoneLikeSamples = firstColumnSamples.filter((value) => normalizePhone(value) !== null).length
    if (firstColumnSamples.length >= 3 && phoneLikeSamples >= Math.min(3, firstColumnSamples.length)) {
      return true
    }
  }

  const dataLikeCount = firstRow.filter((value) => {
    return normalizePhone(value) !== null || looksLikeEmailValue(value) || /^\d[\d\s()+.-]*$/.test(value)
  }).length

  return dataLikeCount >= Math.ceil(firstRow.length * 0.6)
}

function buildSyntheticHeaderEntries(rawData: unknown[][], startIndex: number): HeaderEntry[] {
  const sampleRows = rawData.slice(startIndex, Math.min(startIndex + 10, rawData.length))
  const maxColumns = sampleRows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0)
  const syntheticHeaders: string[] = []

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const values = sampleRows
      .map((row) => coerceCellValue(row?.[columnIndex]))
      .filter(Boolean)

    let label = `column_${columnIndex + 1}`

    if (values.length > 0) {
      const phoneLikeCount = values.filter((value) => normalizePhone(value) !== null).length
      const emailLikeCount = values.filter(looksLikeEmailValue).length
      const nameLikeCount = values.filter(looksLikeNameValue).length
      const strongMatchThreshold = Math.max(2, Math.ceil(values.length * 0.6))

      if (phoneLikeCount >= strongMatchThreshold) {
        label = 'phone'
      } else if (emailLikeCount >= strongMatchThreshold) {
        label = 'email'
      } else if (nameLikeCount >= strongMatchThreshold) {
        label = 'name'
      }
    }

    syntheticHeaders.push(label)
  }

  return buildHeaderEntries(syntheticHeaders)
}

function createEmptyResult(error: string | null = null): ParseResult {
  return {
    headers: [],
    rows: [],
    totalRows: 0,
    detectedPhoneColumn: null,
    detectedNameColumn: null,
    detectedEmailColumn: null,
    error,
    preview: [],
  }
}

function coerceCellValue(value: unknown): string {
  let normalized = String(value ?? '').trim()
  normalized = normalized.replace(/^\uFEFF/, '')
  normalized = normalized.replace(/^(\d+)\.0+$/, '$1')
  return normalized
}

function buildHeaderEntries(rawHeaders: unknown[]): HeaderEntry[] {
  const seen = new Map<string, number>()
  const entries: HeaderEntry[] = []

  rawHeaders.forEach((value, sourceIndex) => {
    const baseLabel = coerceCellValue(value)
    if (!baseLabel) return

    const lower = baseLabel.toLowerCase()
    const duplicateCount = seen.get(lower) ?? 0
    seen.set(lower, duplicateCount + 1)

    entries.push({
      label: duplicateCount === 0 ? baseLabel : `${baseLabel}_${duplicateCount + 1}`,
      sourceIndex,
    })
  })

  return entries
}

export async function parseContactFile(file: File): Promise<ParseResult> {
  if (!file) {
    return createEmptyResult('No file provided')
  }

  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  const isCSV = fileName.endsWith('.csv') || fileType === 'text/csv' || fileType === 'application/csv'
  const isXLSX =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel'

  if (!isCSV && !isXLSX) {
    return createEmptyResult(
      `Unsupported file type: ${file.type || fileName}. Please upload a .xlsx, .xls, or .csv file.`,
    )
  }

  try {
    return isCSV ? await parseCSV(file) : await parseXLSX(file)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[spreadsheetParser] Uncaught error:', error)
    return createEmptyResult(`Failed to parse file: ${message}. Try saving as CSV and importing again.`)
  }
}

async function loadXlsxModule(): Promise<typeof import('xlsx')> {
  const imported = await import('xlsx')
  const candidate = ('default' in imported && imported.default ? imported.default : imported) as typeof import('xlsx')

  if (typeof candidate.read !== 'function') {
    throw new Error('XLSX module not properly loaded')
  }

  return candidate
}

async function parseXLSX(file: File): Promise<ParseResult> {
  let XLSX: typeof import('xlsx')

  try {
    XLSX = await loadXlsxModule()
  } catch (error) {
    console.error('[XLSX Import Error]', error)
    return createEmptyResult('XLSX library not available. Run: npm install xlsx')
  }

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return createEmptyResult('Could not read file buffer. Please try again.')
  }

  let workbook: import('xlsx').WorkBook
  try {
    workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellText: true,
      cellDates: false,
      raw: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return createEmptyResult(
      `Cannot read XLSX file: ${message}. The file may be corrupted or password-protected.`,
    )
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return createEmptyResult('XLSX file has no sheets.')
  }

  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]

  if (!sheet) {
    return createEmptyResult(`Sheet "${firstSheetName}" is empty.`)
  }

  let rawData: unknown[][]
  try {
    rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as unknown[][]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return createEmptyResult(`Failed to read sheet data: ${message}`)
  }

  if (!rawData || rawData.length === 0) {
    return createEmptyResult('The spreadsheet appears to be empty.')
  }

  return buildResult(rawData)
}

function decodeCsvText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  if (!utf8.includes('\uFFFD')) {
    return utf8
  }

  try {
    return new TextDecoder('windows-1252', { fatal: false }).decode(bytes)
  } catch {
    return utf8
  }
}

async function parseCSV(file: File): Promise<ParseResult> {
  let PapaModule: typeof import('papaparse')

  try {
    PapaModule = await import('papaparse')
  } catch {
    return createEmptyResult('PapaParse library not available. Run: npm install papaparse')
  }

  const Papa = (('default' in PapaModule && PapaModule.default ? PapaModule.default : PapaModule) as typeof import('papaparse'))

  let text: string
  try {
    const buffer = await file.arrayBuffer()
    text = decodeCsvText(buffer)
  } catch {
    return createEmptyResult('Could not read CSV file. Please try again.')
  }

  return new Promise((resolve) => {
    Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
      transform: (value) => value.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve(createEmptyResult('CSV file is empty.'))
          return
        }

        resolve(buildResult(results.data as unknown[][]))
      },
      error: (error: { message: string }) => {
        resolve(createEmptyResult(`CSV parse error: ${error.message}`))
      },
    })
  })
}

function buildResult(rawData: unknown[][]): ParseResult {
  let headerRowIndex = -1

  for (let index = 0; index < Math.min(5, rawData.length); index += 1) {
    const row = rawData[index] ?? []
    if (row.some((cell) => coerceCellValue(cell) !== '')) {
      headerRowIndex = index
      break
    }
  }

  if (headerRowIndex === -1) {
    return createEmptyResult('Could not detect column headers. Make sure the first row contains column names.')
  }

  const treatFirstRowAsData = shouldTreatFirstRowAsData(rawData, headerRowIndex)
  const headerEntries = treatFirstRowAsData
    ? buildSyntheticHeaderEntries(rawData, headerRowIndex)
    : buildHeaderEntries(rawData[headerRowIndex] ?? [])

  if (headerEntries.length === 0) {
    return createEmptyResult('Could not detect column headers. Make sure the first row contains column names.')
  }

  const headers = headerEntries.map((entry) => entry.label)
  const rows: Record<string, string>[] = []

  const dataStartIndex = treatFirstRowAsData ? headerRowIndex : headerRowIndex + 1

  for (let rowIndex = dataStartIndex; rowIndex < rawData.length; rowIndex += 1) {
    const rawRow = rawData[rowIndex] ?? []
    const hasAnyValue = rawRow.some((cell) => coerceCellValue(cell) !== '')

    if (!hasAnyValue) continue

    const row: Record<string, string> = {}
    headerEntries.forEach(({ label, sourceIndex }) => {
      row[label] = coerceCellValue(rawRow[sourceIndex])
    })
    rows.push(row)
  }

  const detectedPhoneColumn = detectPhoneColumn(headers, rows)
  const detectedNameColumn = detectNameColumn(headers)
  const detectedEmailColumn = detectEmailColumn(headers)

  return {
    headers,
    rows,
    totalRows: rows.length,
    detectedPhoneColumn,
    detectedNameColumn,
    detectedEmailColumn,
    error: null,
    preview: rows.slice(0, 5),
  }
}

function detectPhoneColumn(headers: string[], rows: Record<string, string>[]): string | null {
  const lower = (value: string) => value.toLowerCase().trim()

  const exactMatches = [
    'phone_number',
    'phone number',
    'phonenumber',
    'mobile_number',
    'mobile number',
    'mobilenumber',
    'phone',
    'mobile',
    'telephone',
    'whatsapp_number',
    'whatsapp number',
    'whatsapp',
    'contact_number',
    'contact number',
    'cell_number',
    'cell number',
    'cell',
    'tel',
    'gsm',
    'msisdn',
    'wa',
  ]

  for (const keyword of exactMatches) {
    const found = headers.find((header) => lower(header) === keyword)
    if (found) return found
  }

  const excludes = ['townhouse', 'unit', 'flat', 'apartment', 'apt', 'house', 'room', 'bed', 'floor']
  const containsMatches = ['phone', 'mobile', 'whatsapp', 'cell', 'gsm']

  for (const keyword of containsMatches) {
    const found = headers.find((header) => {
      const normalized = lower(header)
      return normalized.includes(keyword) && !excludes.some((exclude) => normalized.includes(exclude))
    })
    if (found) return found
  }

  const telFound = headers.find((header) => {
    const normalized = lower(header)
    return (
      (normalized === 'tel' || normalized.startsWith('tel_') || normalized.endsWith('_tel')) &&
      !excludes.some((exclude) => normalized.includes(exclude))
    )
  })

  if (telFound) return telFound

  const phonePattern = /^[+\d\s\-().]{6,20}$/
  let bestColumn: string | null = null
  let bestScore = 0

  for (const header of headers) {
    const samples = rows.slice(0, 30).map((row) => String(row[header] ?? '').trim())
    const score = samples.filter((value) => value && phonePattern.test(value) && /\d{6,}/.test(value)).length

    if (score > bestScore) {
      bestScore = score
      bestColumn = header
    }
  }

  return bestScore >= 3 ? bestColumn : null
}

function detectNameColumn(headers: string[]): string | null {
  const lower = (value: string) => value.toLowerCase().trim()
  const exactMatches = [
    'full_name',
    'full name',
    'fullname',
    'name',
    'customer_name',
    'customer name',
    'contact_name',
    'contact name',
    'client_name',
    'client name',
    'first_name',
    'firstname',
    'owner_name',
    'resident_name',
    'person_name',
  ]

  for (const keyword of exactMatches) {
    const found = headers.find((header) => lower(header) === keyword)
    if (found) return found
  }

  return (
    headers.find((header) => {
      const normalized = lower(header)
      return normalized.includes('name') && !normalized.includes('number') && !normalized.includes('phone') && !normalized.includes('email')
    }) ?? null
  )
}

function detectEmailColumn(headers: string[]): string | null {
  const lower = (value: string) => value.toLowerCase().trim()
  return (
    headers.find((header) => {
      const normalized = lower(header)
      return normalized === 'email' || normalized.includes('email') || normalized === 'e-mail' || normalized.includes('e-mail')
    }) ?? null
  )
}

export function normalizePhone(
  raw: string | number | null | undefined,
  defaultCountry = '971',
): string | null {
  if (raw === null || raw === undefined) return null

  let value = String(raw).trim()

  const garbage = [
    '',
    '-',
    'n/a',
    'na',
    'null',
    'none',
    'nil',
    'no phone',
    'no mobile',
    'unknown',
    'tbd',
    'tbc',
    '0',
  ]

  if (garbage.includes(value.toLowerCase())) return null

  value = value.replace(/^[Oo](\d)/, '0$1').replace(/^[Ii](\d)/, '1$1')
  value = value.replace(/^(\d+)\.0+$/, '$1')

  const hasPlus = value.startsWith('+')
  const digits = value.replace(/[^\d]/g, '')

  if (digits.length < 5 || digits.length > 15) return null

  if (hasPlus) return `+${digits}`

  if (digits.startsWith('00') && digits.length > 9) {
    return `+${digits.slice(2)}`
  }

  const countryCodes = [
    '971', '966', '974', '973', '968', '965', '972', '961', '962', '963', '964', '967', '970',
    '975', '976', '977', '992', '993', '994', '995', '996', '998', '960',
    '254', '260', '255', '234', '251', '250', '256', '237', '221', '212', '213', '216', '218',
    '233', '224', '225', '226', '227', '228', '229', '231', '232', '236', '238', '240', '241',
    '242', '243', '244', '245', '248', '249', '252', '253', '257', '258', '261', '262', '263',
    '264', '265', '266', '267', '268', '269', '291',
    '357', '359', '351', '352', '353', '354', '355', '356', '358',
    '370', '371', '372', '373', '374', '375', '376', '377', '380', '381', '382', '385', '386', '387', '389',
    '420', '421', '423',
    '880', '886', '855', '856', '852', '853', '850',
    '501', '502', '503', '504', '505', '506', '507', '508', '509',
    '590', '591', '592', '593', '594', '595', '596', '597', '598', '599',
    '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '51', '52', '53', '54', '55', '56', '57', '58',
    '60', '62', '63', '64', '65', '66',
    '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
    '20', '27', '7', '1',
  ]

  for (const code of countryCodes) {
    if (!digits.startsWith(code)) continue

    const remaining = digits.slice(code.length)
    if (remaining.length >= 6 && remaining.length <= 11) {
      return `+${digits}`
    }
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+${defaultCountry}${digits.slice(1)}`
  }

  if (digits.length === 9 && '5467'.includes(digits[0])) {
    return `+${defaultCountry}${digits}`
  }

  if (digits.length >= 7 && digits.length <= 9) {
    return `+${defaultCountry}${digits}`
  }

  return null
}
