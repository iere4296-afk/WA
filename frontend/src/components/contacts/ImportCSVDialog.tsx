'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useOrg } from '@/hooks/useOrg'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePhone, parseContactFile, type ParseResult } from '@/lib/spreadsheetParser'
import type { ContactImportResponse } from '@/types/api.types'

interface ImportCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (count: number) => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface ColumnMapping {
  phone: string
  name: string
  email: string
}

interface ImportSummary {
  imported: number
  skipped: number
  errors: string[]
}

const EMPTY_MAPPING: ColumnMapping = {
  phone: '',
  name: '',
  email: '',
}

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
}

export function ImportCSVDialog({ open, onOpenChange, onSuccess }: ImportCSVDialogProps) {
  const { orgId } = useOrg()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(EMPTY_MAPPING)
  const [isParsing, setIsParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

  const resetState = useCallback(() => {
    setStep('upload')
    setSelectedFile(null)
    setParseResult(null)
    setColumnMapping(EMPTY_MAPPING)
    setIsParsing(false)
    setDragOver(false)
    setImportProgress(0)
    setImportResult(null)
  }, [])

  const handleDialogChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && importResult) {
      onSuccess?.(importResult.imported)
    }

    if (!nextOpen) {
      resetState()
    }

    onOpenChange(nextOpen)
  }, [importResult, onOpenChange, onSuccess, resetState])

  const handleFile = useCallback(async (file: File) => {
    if (!file) return

    const fileExtension = getFileExtension(file.name)
    const supportedExtensions = ['.xlsx', '.xls', '.csv']

    if (!supportedExtensions.includes(fileExtension)) {
      toast.error('Please upload a .xlsx, .xls, or .csv file.')
      return
    }

    setSelectedFile(file)
    setParseResult(null)
    setColumnMapping(EMPTY_MAPPING)
    setImportResult(null)
    setImportProgress(0)
    setStep('upload')
    setIsParsing(true)

    try {
      const result = await parseContactFile(file)

      if (result.error) {
        toast.error('Unable to preview import file.', {
          description: result.error,
        })
        return
      }

      if (result.totalRows === 0) {
        toast.error('The file contains no data rows.')
        return
      }

      setParseResult(result)
      setColumnMapping({
        phone: result.detectedPhoneColumn ?? '',
        name: result.detectedNameColumn ?? '',
        email: result.detectedEmailColumn ?? '',
      })
      setStep('preview')

      if (!result.detectedPhoneColumn) {
        toast.error('Could not auto-detect a phone column. Select it manually to continue.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[Import Preview Error]', error)
      toast.error('Unable to preview import file.', { description: message })
    } finally {
      setIsParsing(false)
    }
  }, [])

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    event.target.value = ''
  }, [handleFile])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)

    const file = event.dataTransfer.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }, [handleFile])

  const validContactCount = useMemo(() => {
    if (!parseResult || !columnMapping.phone) return 0

    return parseResult.rows.reduce((count, row) => {
      return normalizePhone(row[columnMapping.phone]) ? count + 1 : count
    }, 0)
  }, [columnMapping.phone, parseResult])

  const handleStartImport = useCallback(async () => {
    if (!parseResult) return

    if (!orgId) {
      toast.error('Organization context is not ready yet. Refresh and try again.')
      return
    }

    if (!columnMapping.phone) {
      toast.error('Select the column that contains phone numbers.')
      return
    }

    const contacts = parseResult.rows.reduce<Array<{ phone: string; name?: string; email?: string }>>((acc, row) => {
      const normalized = normalizePhone(row[columnMapping.phone])
      if (!normalized) return acc

      const name = columnMapping.name ? row[columnMapping.name]?.trim() || undefined : undefined
      const email = columnMapping.email ? row[columnMapping.email]?.trim() || undefined : undefined

      acc.push({
        phone: normalized,
        name,
        email,
      })

      return acc
    }, [])

    if (contacts.length === 0) {
      toast.error(
        `Found ${parseResult.totalRows} rows but 0 valid phone numbers in "${columnMapping.phone}".`,
      )
      return
    }

    setStep('importing')
    setImportProgress(0)
    setImportResult(null)

    const batchSize = 500
    let imported = 0
    let skipped = parseResult.totalRows - contacts.length
    const errors: string[] = []

    try {
      for (let index = 0; index < contacts.length; index += batchSize) {
        const batch = contacts.slice(index, index + batchSize)
        const response = await api.post<ContactImportResponse>('/contacts/import', { contacts: batch })
        const payload = response.data.data

        imported += payload.imported ?? 0
        skipped += payload.skipped ?? 0
        if (payload.errors?.length) {
          errors.push(...payload.errors)
        }

        const progress = Math.round(((index + batch.length) / contacts.length) * 100)
        setImportProgress(Math.min(progress, 100))
      }

      const summary = { imported, skipped, errors }
      setImportResult(summary)
      setImportProgress(100)
      setStep('done')

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['contact-lists'] }),
      ])

      toast.success(`${imported} contacts imported. ${skipped} skipped.`)
    } catch (error) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : error instanceof Error
            ? error.message
            : 'Import failed'

      console.error('[Import Error]', error)
      toast.error(message)
      setStep('preview')
    }
  }, [columnMapping.email, columnMapping.name, columnMapping.phone, orgId, parseResult, queryClient])

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import CSV or XLSX</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet, preview the first rows, confirm the detected columns, and import in batches.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={[
                'cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors',
                dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleInputChange}
              />

              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                  <p className="text-sm text-muted-foreground">Parsing file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <Upload className="h-6 w-6 text-emerald-700" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">Choose a CSV or Excel file</p>
                    <p className="text-sm text-muted-foreground">Supports .csv, .xlsx, and .xls files.</p>
                  </div>
                </div>
              )}
            </div>

            {selectedFile && !isParsing && (
              <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            <DialogFooter className="sm:justify-end">
              <Button variant="outline" onClick={() => handleDialogChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
        
        {step === 'preview' && parseResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-emerald-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-slate-900">
                {parseResult.totalRows} rows parsed from {selectedFile?.name}
              </span>
              <Badge variant="secondary">{validContactCount} valid phones</Badge>
            </div>

            {!columnMapping.phone && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-amber-900">Phone column not detected</p>
                  <p className="text-amber-800">Select the correct phone column below to continue.</p>
                  <p className="text-xs text-amber-700">Headers found: {parseResult.headers.join(', ')}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-900">Phone column</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={columnMapping.phone}
                  onChange={(event) => setColumnMapping((current) => ({ ...current, phone: event.target.value }))}
                >
                  <option value="">Select a column</option>
                  {parseResult.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-900">Name column</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={columnMapping.name}
                  onChange={(event) => setColumnMapping((current) => ({ ...current, name: event.target.value }))}
                >
                  <option value="">Skip</option>
                  {parseResult.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-900">Email column</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={columnMapping.email}
                  onChange={(event) => setColumnMapping((current) => ({ ...current, email: event.target.value }))}
                >
                  <option value="">Skip</option>
                  {parseResult.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {parseResult.headers.map((header) => {
                      const isPhone = header === columnMapping.phone
                      const isName = header === columnMapping.name
                      const isEmail = header === columnMapping.email

                      return (
                        <th
                          key={header}
                          className={[
                            'border-b px-3 py-2 font-medium text-slate-700',
                            isPhone ? 'bg-emerald-100 text-emerald-900' : '',
                            isName ? 'bg-blue-50 text-blue-900' : '',
                            isEmail ? 'bg-violet-50 text-violet-900' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate">{header}</span>
                            {isPhone && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Phone</Badge>}
                            {isName && <Badge variant="secondary">Name</Badge>}
                            {isEmail && <Badge variant="outline">Email</Badge>}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.preview.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b last:border-b-0">
                      {parseResult.headers.map((header) => (
                        <td key={`${rowIndex}-${header}`} className="max-w-[180px] truncate px-3 py-2 text-slate-700">
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setParseResult(null)
                  setColumnMapping(EMPTY_MAPPING)
                  setStep('upload')
                }}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDialogChange(false)}>Close</Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void handleStartImport()}
                  disabled={!columnMapping.phone}
                >
                  Start Import ({parseResult.totalRows} rows)
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <p className="font-medium text-slate-900">Importing contacts...</p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{importProgress}% complete</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">Import complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.imported} imported, {importResult.skipped} skipped
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Import warnings</p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {importResult.errors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="sm:justify-end">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleDialogChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
