'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { AIGenerateDialog } from '@/components/templates/AIGenerateDialog'
import { NewTemplateDialog } from '@/components/templates/NewTemplateDialog'
import { TemplateCard } from '@/components/templates/TemplateCard'
import { TemplatePreview } from '@/components/templates/TemplatePreview'
import { useCreateTemplate, useDeleteTemplate, useTemplates } from '@/hooks/useTemplates'
import type { MessageTemplate } from '@/types'

const DEFAULT_TEMPLATE = {
  name: '',
  category: 'marketing' as MessageTemplate['category'],
  type: 'text' as MessageTemplate['type'],
  body: '',
  tags: '',
  status: 'draft' as MessageTemplate['status'],
}

export default function TemplatesPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | MessageTemplate['type']>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null)
  const [draftTemplate, setDraftTemplate] = useState(DEFAULT_TEMPLATE)

  const templatesQuery = useTemplates({
    limit: 100,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    tags: tagFilter !== 'all' ? [tagFilter] : undefined,
  })
  const createTemplate = useCreateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const templates = templatesQuery.data?.data || []
  const availableTags = useMemo(
    () => Array.from(new Set(templates.flatMap((template) => template.tags || []))).sort(),
    [templates],
  )
  const filteredTemplates = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    return templates.filter((template) => {
      if (!searchValue) return true
      return template.name.toLowerCase().includes(searchValue) || template.body.toLowerCase().includes(searchValue)
    })
  }, [search, templates])

  async function handleCreateTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await createTemplate.mutateAsync({
        name: draftTemplate.name,
        category: draftTemplate.category,
        type: draftTemplate.type,
        body: draftTemplate.body,
        tags: draftTemplate.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        status: draftTemplate.status,
        language: 'EN',
      })
      toast.success('Template created.')
      setDraftTemplate(DEFAULT_TEMPLATE)
      setNewTemplateOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create template.')
    }
  }

  async function handleDeleteTemplate() {
    if (!templateToDelete) return

    try {
      await deleteTemplate.mutateAsync(templateToDelete.id)
      toast.success('Template deleted.')
      if (selectedTemplate?.id === templateToDelete.id) {
        setSelectedTemplate(null)
      }
      setTemplateToDelete(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to delete template.')
      throw error
    }
  }

  if (templatesQuery.isLoading && !templatesQuery.data) {
    return <SkeletonPage rows={6} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Templates</h2>
          <p className="text-sm text-slate-500">
            Build reusable WhatsApp content, preview variables, and generate drafts with AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="h-4 w-4" />
            AI Generate
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.45fr_0.45fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            placeholder="Search templates"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | MessageTemplate['type'])}
        >
          <option value="all">All types</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
        >
          <option value="all">All tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={setSelectedTemplate}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No templates found"
          description="Create a new template or generate one with AI to start building reusable message content."
          action={{ label: 'New Template', onClick: () => setNewTemplateOpen(true) }}
        />
      )}

      <NewTemplateDialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Template name</span>
            <Input
              value={draftTemplate.name}
              onChange={(event) => setDraftTemplate((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftTemplate.category}
                onChange={(event) => setDraftTemplate((current) => ({
                  ...current,
                  category: event.target.value as MessageTemplate['category'],
                }))}
              >
                <option value="marketing">Marketing</option>
                <option value="transactional">Transactional</option>
                <option value="support">Support</option>
                <option value="reminder">Reminder</option>
                <option value="otp">OTP</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftTemplate.type}
                onChange={(event) => setDraftTemplate((current) => ({
                  ...current,
                  type: event.target.value as MessageTemplate['type'],
                }))}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <Input
              value={draftTemplate.tags}
              onChange={(event) => setDraftTemplate((current) => ({ ...current, tags: event.target.value }))}
              placeholder="promo, onboarding, vip"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Message body</span>
            <textarea
              className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={draftTemplate.body}
              onChange={(event) => setDraftTemplate((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write the message body here..."
              required
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewTemplateOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" type="submit" disabled={createTemplate.isPending}>
              Save Template
            </Button>
          </div>
        </form>
      </NewTemplateDialog>

      <AIGenerateDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onSaved={() => void templatesQuery.refetch()}
      />

      <Sheet open={!!selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selectedTemplate?.name || 'Template Preview'}</SheetTitle>
            <SheetDescription>
              Preview the template in a WhatsApp-style phone mockup and copy the body with variables preserved.
            </SheetDescription>
          </SheetHeader>

          {selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => setTemplateToDelete(selectedTemplate)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Template
                </Button>
              </div>
              <TemplatePreview template={selectedTemplate} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!templateToDelete}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null)
        }}
        title="Delete this template?"
        description="This removes the template from the workspace and any future campaigns will need a different message."
        destructive
        confirmText={deleteTemplate.isPending ? 'Deleting...' : 'Delete Template'}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  )
}
