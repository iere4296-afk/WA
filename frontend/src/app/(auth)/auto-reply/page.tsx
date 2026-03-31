'use client'

import { useMemo, useState } from 'react'
import { Bot, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { AutoReplyRuleCard } from '@/components/auto-reply/AutoReplyRuleCard'
import { NewRuleDialog } from '@/components/auto-reply/NewRuleDialog'
import { useAutoReply, useCreateAutoReplyRule, useDeleteAutoReplyRule, useUpdateAutoReplyRule } from '@/hooks/useAutoReply'
import { useTemplates } from '@/hooks/useTemplates'
import type { AutoReplyRule } from '@/types'

const DEFAULT_RULE = {
  name: '',
  triggerType: 'keyword' as AutoReplyRule['trigger_type'],
  matchType: 'contains' as AutoReplyRule['match_type'],
  keywords: '',
  responseType: 'text' as AutoReplyRule['response_type'],
  responseMessage: '',
  templateId: '',
  cooldownMinutes: 60,
  priority: 0,
  isActive: true,
}

export default function AutoReplyPage() {
  const [search, setSearch] = useState('')
  const [newRuleOpen, setNewRuleOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [draftRule, setDraftRule] = useState(DEFAULT_RULE)

  const rulesQuery = useAutoReply()
  const templatesQuery = useTemplates({ limit: 100 })
  const createRule = useCreateAutoReplyRule()
  const updateRule = useUpdateAutoReplyRule()
  const deleteRule = useDeleteAutoReplyRule()

  const rules = rulesQuery.data || []
  const templates = templatesQuery.data?.data || []
  const filteredRules = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    return rules.filter((rule) => {
      if (!searchValue) return true
      return rule.name.toLowerCase().includes(searchValue)
        || rule.keywords.some((keyword) => keyword.toLowerCase().includes(searchValue))
        || (rule.response_message || '').toLowerCase().includes(searchValue)
    })
  }, [rules, search])

  async function handleCreateRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await createRule.mutateAsync({
        name: draftRule.name,
        triggerType: draftRule.triggerType,
        matchType: draftRule.matchType,
        keywords: draftRule.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
        responseType: draftRule.responseType,
        responseMessage: draftRule.responseType === 'text' ? draftRule.responseMessage : undefined,
        templateId: draftRule.responseType === 'template' ? draftRule.templateId || undefined : undefined,
        cooldownMinutes: draftRule.cooldownMinutes,
        priority: draftRule.priority,
        isActive: draftRule.isActive,
      })
      toast.success('Auto-reply rule created.')
      setDraftRule(DEFAULT_RULE)
      setNewRuleOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create rule.')
    }
  }

  async function handleToggleRule(rule: AutoReplyRule) {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        isActive: !rule.is_active,
      })
      toast.success(rule.is_active ? 'Rule disabled.' : 'Rule enabled.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to update rule.')
    }
  }

  async function handleDeleteRule() {
    if (!deleteId) return

    try {
      await deleteRule.mutateAsync(deleteId)
      toast.success('Rule deleted.')
      setDeleteId(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to delete rule.')
      throw error
    }
  }

  if (rulesQuery.isLoading && !rulesQuery.data) {
    return <SkeletonPage rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Auto-Reply</h2>
          <p className="text-sm text-slate-500">
            Configure real inbox rules that respond to keywords, first-touch messages, or templates.
          </p>
        </div>

        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setNewRuleOpen(true)}>
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder="Search rules by name, keyword, or response"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filteredRules.length > 0 ? (
        <div className="space-y-4">
          {filteredRules.map((rule) => (
            <AutoReplyRuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => void handleToggleRule(rule)}
              onDelete={() => setDeleteId(rule.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bot}
          title="No auto-reply rules yet"
          description="Create a rule to automatically reply to incoming messages using text or templates."
          action={{ label: 'New Rule', onClick: () => setNewRuleOpen(true) }}
        />
      )}

      <NewRuleDialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
        <form onSubmit={handleCreateRule} className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Rule name</span>
            <Input
              value={draftRule.name}
              onChange={(event) => setDraftRule((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Trigger type</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftRule.triggerType}
                onChange={(event) => setDraftRule((current) => ({
                  ...current,
                  triggerType: event.target.value as AutoReplyRule['trigger_type'],
                }))}
              >
                <option value="keyword">Keyword</option>
                <option value="first_message">First Message</option>
                <option value="outside_hours">Outside Hours</option>
                <option value="any_message">Any Message</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Match type</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftRule.matchType}
                onChange={(event) => setDraftRule((current) => ({
                  ...current,
                  matchType: event.target.value as AutoReplyRule['match_type'],
                }))}
              >
                <option value="contains">Contains</option>
                <option value="exact">Exact Match</option>
                <option value="starts_with">Starts With</option>
                <option value="regex">Regex</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Keywords</span>
            <Input
              value={draftRule.keywords}
              onChange={(event) => setDraftRule((current) => ({ ...current, keywords: event.target.value }))}
              placeholder="pricing, quote, help"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Response type</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftRule.responseType}
                onChange={(event) => setDraftRule((current) => ({
                  ...current,
                  responseType: event.target.value as AutoReplyRule['response_type'],
                }))}
              >
                <option value="text">Text</option>
                <option value="template">Template</option>
                <option value="ai_powered">AI Powered</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Cooldown (minutes)</span>
              <Input
                type="number"
                min={0}
                value={draftRule.cooldownMinutes}
                onChange={(event) => setDraftRule((current) => ({
                  ...current,
                  cooldownMinutes: Number(event.target.value),
                }))}
              />
            </label>
          </div>

          {draftRule.responseType === 'template' ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Template</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={draftRule.templateId}
                onChange={(event) => setDraftRule((current) => ({ ...current, templateId: event.target.value }))}
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Response message</span>
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={draftRule.responseMessage}
                onChange={(event) => setDraftRule((current) => ({ ...current, responseMessage: event.target.value }))}
                placeholder="Write the auto-reply message here..."
                required={draftRule.responseType === 'text'}
              />
            </label>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewRuleOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" type="submit" disabled={createRule.isPending}>
              Save Rule
            </Button>
          </div>
        </form>
      </NewRuleDialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Delete this rule?"
        description="This will remove the auto-reply rule from the workspace."
        destructive
        confirmText={deleteRule.isPending ? 'Deleting...' : 'Delete Rule'}
        onConfirm={handleDeleteRule}
      />
    </div>
  )
}
