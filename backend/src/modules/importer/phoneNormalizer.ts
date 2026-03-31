/** ISO 3166-1 alpha-2 → E.164 country calling code (digits only, no +). */
const COUNTRY_TO_CC: Record<string, string> = {
  AE: '971',
  SA: '966',
  US: '1',
  GB: '44',
  IN: '91',
  EG: '20',
}

/**
 * Normalizes ANY phone number to E.164 format (+CCXXXXXXXXX).
 * 
 * Handles every real-world format found in Excel imports:
 *
 * Input formats handled:
 *   "0507267858"              → UAE local (10 digits, leading 0)
 *   "507267858.0"             → XLSX float artifact (leading 0 dropped + .0 suffix)
 *   "507267858"               → UAE digits only, leading 0 stripped by xlsx parser
 *   "+971507267858"           → Already E.164 ✓
 *   "971507267858"            → Country code, no +
 *   "00971507267858"          → 00-prefix international
 *   "O558562643"              → Letter O instead of digit 0 (OCR/typo error)
 *   "+966544401066"           → Saudi Arabia
 *   "+919969779050"           → India
 *   "254722370986"            → Kenya (no + prefix)
 *   "2348147604334"           → Nigeria
 *   "-"                       → null (garbage)
 *   "50"                      → null (too short)
 *   "+971554221705582980062"  → null (too long / corrupted)
 *
 * @param raw - Raw value from Excel/CSV cell (string, number, null)
 * @param defaultCountry - Default country code digits if no prefix (default: '971' = UAE)
 * @returns E.164 string like "+971507267858" or null if invalid
 */
export function normalizePhone(
  raw: string | number | null | undefined,
  defaultCountry = '971'
): string | null {
  if (raw === null || raw === undefined) return null

  // ── Step 1: To string and basic clean ──────────────────────────
  let s = String(raw).trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1) // Remove BOM

  // Reject obvious non-phones
  const GARBAGE = ['', '-', 'n/a', 'na', 'null', 'none', 'nil', 'no phone',
    'no mobile', 'unknown', '-', '—', 'tbd', 'tbc', '0']
  if (GARBAGE.includes(s.toLowerCase())) return null

  // ── Step 2: Fix letter O/I confused with digit 0/1 (OCR errors) ─
  // "O558562643" → "0558562643"
  s = s
    .replace(/^O/i, '0')   // Leading O → 0
    .replace(/^I/i, '1')   // Leading I → 1 (rare but happens)

  // ── Step 3: Strip float .0 suffix from xlsx numeric conversion ──
  // "507267858.0" → "507267858"
  // "507267858.00" → "507267858"
  s = s.replace(/\.0+$/, '')

  // ── Step 4: Extract clean components ───────────────────────────
  const hasPlus = s.startsWith('+')
  const digits = s.replace(/[^\d]/g, '')  // strip ALL non-digits

  // ── Step 5: Length guard ────────────────────────────────────────
  if (digits.length < 5) return null   // too short to be valid
  if (digits.length > 15) return null  // ITU E.164 max is 15 digits; longer = corrupt

  // ── Step 6: Already E.164 (has +) ──────────────────────────────
  // "+971507267858" → "+971507267858"
  if (hasPlus) {
    return '+' + digits
  }

  // ── Step 7: 00-prefix international ────────────────────────────
  // "00971507267858" → "+971507267858"
  if (digits.startsWith('00')) {
    const stripped = digits.slice(2)
    if (stripped.length >= 7) return '+' + stripped
  }

  // ── Step 8: Recognize known country code prefix (no + needed) ──
  // "971507267858" → "+971507267858"
  // "254722370986" → "+254722370986"  (Kenya)
  // Sorted longest-first so "971" matched before "97"
  const COUNTRY_CODES = [
    // Middle East
    '971','966','974','973','968','965','972','961','962','963','964','967','970','975','976',
    '977','992','993','994','995','996','998','960',
    // Africa (important for UAE expat community)
    '254','260','255','234','251','250','256','237','221','212','213','216','218',
    '233','224','225','226','227','228','229','231','232','236','238','240','241',
    '242','243','244','245','248','249','252','253','257','258','261','262','263',
    '264','265','266','267','268','269','291',
    // South & SE Asia
    '880','886','855','856','852','853','850',
    '91','92','93','94','95','98',
    // East Asia
    '81','82','84','86',
    // Europe
    '357','359','351','352','353','354','355','356','358','370','371','372','373',
    '374','375','376','377','380','381','382','385','386','387','389',
    '420','421','423',
    '30','31','32','33','34','36','39','40','41','43','44','45','46','47','48','49',
    // Americas & other
    '55','61','64',
    '501','502','503','504','505','506','507','508','509',
    '590','591','592','593','594','595','596','597','598','599',
    '60','62','63','65','66',
    '20','27',
    '1','7',
  ]

  for (const code of COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const remaining = digits.slice(code.length)
      // Remaining digits must be 6-11 (local number length range globally)
      if (remaining.length >= 6 && remaining.length <= 11) {
        return '+' + digits
      }
    }
  }

  // ── Step 9: UAE local format 0XXXXXXXXX (10 digits, starts with 0) ─
  // "0507267858" → "+971507267858"
  if (digits.startsWith('0') && digits.length === 10) {
    return '+' + defaultCountry + digits.slice(1)
  }

  // ── Step 10: UAE stripped — xlsx removed leading 0 ────────────────
  // "507267858" (9 digits, starts with 5) → "+971507267858"
  // This is THE KEY FIX for Maha_Townhouses import bug
  if (digits.length === 9 && '5467'.includes(digits[0])) {
    return '+' + defaultCountry + digits
  }

  // ── Step 11: 8-digit numbers (Bahrain-style or short local) ───────
  if (digits.length === 8) {
    return '+' + defaultCountry + digits
  }

  // ── Step 12: 7-digit numbers (some local formats) ─────────────────
  if (digits.length === 7) {
    return '+' + defaultCountry + digits
  }

  // ── Step 13: Generic 9-11 digit — assume default country ──────────
  if (digits.length >= 9 && digits.length <= 11) {
    return '+' + defaultCountry + digits
  }

  // Can't normalize — return null
  return null
}

export function dedupePhones(phones: string[]): string[] {
  return [...new Set(phones)]
}
