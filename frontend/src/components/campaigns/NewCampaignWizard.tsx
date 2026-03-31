'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useCreateCampaign, useLaunchCampaign } from '@/hooks/useCampaigns'
import { useContactLists, useContacts } from '@/hooks/useContacts'
import { useDevices } from '@/hooks/useDevices'
import { useCreateTemplate, useTemplates } from '@/hooks/useTemplates'
import type { MessageTemplate } from '@/types'
import type { ContactsResponse } from '@/types/api.types'

async function fetchAllFilteredContactIds(filters: { status?: string; tags?: string[] }) {
  const contactIds: string[] = []
  let cursor: string | undefined
  let hasMore = true
  let safety = 0

  while (hasMore && safety < 50) {
    safety += 1
    const query = new URLSearchParams()
    query.set('limit', '100')
    if (cursor) query.set('cursor', cursor)
    if (filters.status) query.set('status', filters.status)
    if (filters.tags?.length) query.set('tags', filters.tags.join(','))

    const response = await api.get<ContactsResponse>(`/contacts?${query.toString()}`)
    contactIds.push(...response.data.data.map((contact) => contact.id))
    cursor = response.data.meta.nextCursor || undefined
    hasMore = Boolean(response.data.meta.hasMore && cursor)
  }

  return contactIds
}

function getCampaignErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (error as { response?: { data?: { error?: string } } }).response?.data?.error as string
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to save campaign.'
}

export function NewCampaignWizard() {
  const router = useRouter()
  const createCampaign = useCreateCampaign()
  const launchCampaign = useLaunchCampaign()
  const createTemplate = useCreateTemplate()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  const [audienceMode, setAudienceMode] = useState<'list' | 'filter'>('list')
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterTags, setFilterTags] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateMode, setTemplateMode] = useState<'select' | 'create'>('select')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateBody, setNewTemplateBody] = useState('')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const devicesQuery = useDevices({ limit: 100 })
  const listsQuery = useContactLists()
  const templatesQuery = useTemplates({ limit: 100 })
  const filteredContactsQuery = useContacts({
    limit: 25,
    status: audienceMode === 'filter' ? filterStatus : undefined,
    tags: audienceMode === 'filter' && filterTags
      ? filterTags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : undefined,
  })

  const devices = devicesQuery.data?.data || []
  const templates = templatesQuery.data?.data || []
  const contactLists = listsQuery.data || []
  const filteredPreviewContacts = filteredContactsQuery.data?.data || []
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
  const selectedDevices = devices.filter((device) => deviceIds.includes(device.id))
  const selectedLists = contactLists.filter((list) => selectedListIds.includes(list.id))

  function validateStep(currentStep: number) {
    if (currentStep === 1) {
      if (!name.trim()) {
        toast.error('Campaign name is required.')
        return false
      }

      if (deviceIds.length === 0) {
        toast.error('Select at least one device.')
        return false
      }
    }

    if (currentStep === 2) {
      if (audienceMode === 'list' && selectedListIds.length === 0) {
        toast.error('Select at least one contact list.')
        return false
      }

      if (audienceMode === 'filter' && filteredPreviewContacts.length === 0) {
        toast.error('Your current filter does not match any contacts.')
        return false
      }
    }

    if (currentStep === 3) {
      if (templateMode === 'select' && !selectedTemplateId) {
        toast.error('Select a template before continuing.')
        return false
      }

      if (templateMode === 'create' && (!newTemplateName.trim() || !newTemplateBody.trim())) {
        toast.error('Enter a template name and body before continuing.')
        return false
      }
    }

    if (currentStep === 4 && scheduleMode === 'later' && !scheduledAt) {
      toast.error('Choose a date and time for the scheduled send.')
      return false
    }

    return true
  }

  async function handleCreateTemplate() {
    try {
      const template = await createTemplate.mutateAsync({
        name: newTemplateName,
        body: newTemplateBody,
        language: 'en',
        category: 'marketing',
      })
      setSelectedTemplateId(template.id)
      setTemplateMode('select')
      toast.success('Template created and selected.')
    } catch (error) {
      toast.error(getCampaignErrorMessage(error))
    }
  }

  async function handleSubmit() {
    if (!validateStep(4)) return

    try {
      let templateId = selectedTemplateId
      if (templateMode === 'create') {
        const template = await createTemplate.mutateAsync({
          name: newTemplateName,
          body: newTemplateBody,
          language: 'en',
          category: 'marketing',
        })
        templateId = template.id
      }

      const payload = {
        name,
        description,
        templateId,
        deviceIds,
        contactListIds: audienceMode === 'list' ? selectedListIds : [],
        contactIds: audienceMode === 'filter'
          ? await fetchAllFilteredContactIds({
              status: filterStatus,
              tags: filterTags
                ? filterTags.split(',').map((tag) => tag.trim()).filter(Boolean)
                : undefined,
            })
          : [],
        scheduledAt: scheduleMode === 'later' ? new Date(scheduledAt).toISOString() : undefined,
        minDelaySeconds: 30,
        maxDelaySeconds: 120,
      }

      const campaign = await createCampaign.mutateAsync(payload)

      if (scheduleMode === 'later') {
        toast.success('Campaign scheduled successfully.')
        router.push('/campaigns')
        return
      }

      await launchCampaign.mutateAsync(campaign.id)
      toast.success('Campaign launched successfully.')
      router.push('/campaigns')
    } catch (error) {
      toast.error(getCampaignErrorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">New Campaign</h2>
          <p className="text-sm text-slate-500">Build, validate, and launch a WhatsApp campaign in 5 steps.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/campaigns')}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {['Name & Devices', 'Audience', 'Template', 'Schedule', 'Review'].map((label, index) => {
          const stepIndex = index + 1
          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-3 ${
                step >= stepIndex ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step {stepIndex}</p>
              <p className="mt-1 font-medium text-slate-950">{label}</p>
            </div>
          )
        })}
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 - Name + Select Device(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Campaign name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ramadan promo follow-up" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short internal note describing this campaign"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {devices.map((device) => (
                <label key={device.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={deviceIds.includes(device.id)}
                    onChange={(event) => {
                      if (event.target.checked) setDeviceIds((current) => [...current, device.id])
                      else setDeviceIds((current) => current.filter((id) => id !== device.id))
                    }}
                  />
                  <div>
                    <p className="font-medium text-slate-950">{device.name}</p>
                    <p className="text-sm text-slate-500">{device.phone_number || 'Unpaired device'}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 - Select Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <Button variant={audienceMode === 'list' ? 'default' : 'outline'} onClick={() => setAudienceMode('list')}>
                Contact List
              </Button>
              <Button variant={audienceMode === 'filter' ? 'default' : 'outline'} onClick={() => setAudienceMode('filter')}>
                Filter
              </Button>
            </div>

            {audienceMode === 'list' ? (
              <div className="grid gap-3 md:grid-cols-2">
                {contactLists.map((list) => (
                  <label key={list.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={selectedListIds.includes(list.id)}
                      onChange={(event) => {
                        if (event.target.checked) setSelectedListIds((current) => [...current, list.id])
                        else setSelectedListIds((current) => current.filter((id) => id !== list.id))
                      }}
                    />
                    <div>
                      <p className="font-medium text-slate-950">{list.name}</p>
                      <p className="text-sm text-slate-500">{list.contact_count} contacts</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Status</span>
                    <select
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={filterStatus}
                      onChange={(event) => setFilterStatus(event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="opted_out">Opted Out</option>
                      <option value="invalid">Invalid</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Tags</span>
                    <Input value={filterTags} onChange={(event) => setFilterTags(event.target.value)} placeholder="vip, retail" />
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-950">Filter preview</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredPreviewContacts.length} contact{filteredPreviewContacts.length === 1 ? '' : 's'} on the preview page match the current filter.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 - Select or Create Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <Button variant={templateMode === 'select' ? 'default' : 'outline'} onClick={() => setTemplateMode('select')}>
                Select Existing
              </Button>
              <Button variant={templateMode === 'create' ? 'default' : 'outline'} onClick={() => setTemplateMode('create')}>
                Create New
              </Button>
            </div>

            {templateMode === 'select' ? (
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template: MessageTemplate) => (
                  <button
                    key={template.id}
                    className={`rounded-2xl border px-4 py-4 text-left ${
                      selectedTemplateId === template.id ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <p className="font-medium text-slate-950">{template.name}</p>
                    <p className="mt-2 text-sm text-slate-500">{template.body}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Template name</span>
                  <Input value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value)} placeholder="Promo follow-up template" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Template body</span>
                  <textarea
                    className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={newTemplateBody}
                    onChange={(event) => setNewTemplateBody(event.target.value)}
                    placeholder="Hi {{name}}, we saved a special offer for you..."
                  />
                </label>
                <Button variant="outline" onClick={() => void handleCreateTemplate()} disabled={createTemplate.isPending}>
                  <Wand2 className="h-4 w-4" />
                  Save Template
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 - Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <Button variant={scheduleMode === 'now' ? 'default' : 'outline'} onClick={() => setScheduleMode('now')}>
                Launch Immediately
              </Button>
              <Button variant={scheduleMode === 'later' ? 'default' : 'outline'} onClick={() => setScheduleMode('later')}>
                Schedule
              </Button>
            </div>

            {scheduleMode === 'later' ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Scheduled date and time</span>
                <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              </label>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                The campaign will be created and launched immediately after review.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 5 - Review + Launch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Campaign</p>
                <p className="mt-2 font-medium text-slate-950">{name}</p>
                <p className="mt-1 text-sm text-slate-500">{description || 'No description'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Devices</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedDevices.length > 0
                    ? selectedDevices.map((device) => device.name).join(', ')
                    : 'No devices selected'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Audience</p>
                <p className="mt-2 font-medium text-slate-950">
                  {audienceMode === 'list'
                    ? selectedLists.map((list) => list.name).join(', ') || `${selectedListIds.length} list(s)`
                    : `Filtered audience (${filterStatus}${filterTags ? `, ${filterTags}` : ''})`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Delivery</p>
                <p className="mt-2 font-medium text-slate-950">
                  {scheduleMode === 'later' ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}` : 'Immediate launch'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Template</p>
                <p className="mt-2 font-medium text-slate-950">
                  {templateMode === 'create' ? newTemplateName || 'New template' : selectedTemplate?.name || 'No template selected'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {templateMode === 'create' ? newTemplateBody : selectedTemplate?.body || 'Template body preview unavailable.'}
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void handleSubmit()}
              disabled={createCampaign.isPending || launchCampaign.isPending || createTemplate.isPending}
            >
              <Check className="h-4 w-4" />
              {scheduleMode === 'later' ? 'Schedule Campaign' : 'Launch Campaign'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        {step < 5 ? (
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              if (validateStep(step)) setStep(step + 1)
            }}
          >
            Next 
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
