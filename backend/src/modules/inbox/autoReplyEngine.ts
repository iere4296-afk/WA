import type { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'

function extractContent(message: WAMessage): string {
  return message.message?.conversation
    || message.message?.extendedTextMessage?.text
    || ''
}

function renderTemplate(body: string, variables: Record<string, string | undefined>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '')
}

export const autoReplyEngine = {
  async checkAndReply(msg: WAMessage, deviceId: string, orgId: string, sock: WASocket) {
    const content = extractContent(msg)
    if (!content) return

    const jid = msg.key.remoteJid!
    const phone = `+${jid.replace('@s.whatsapp.net', '').replace('@g.us', '')}`

    const [{ data: contact }, { data: rules }] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('org_id', orgId)
        .eq('phone', phone)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('priority', { ascending: false }),
    ])

    if (!rules?.length) return

    let activeContact = contact
    if (!activeContact) {
      const { data } = await supabase
        .from('contacts')
        .upsert({
          org_id: orgId,
          phone,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,phone' })
        .select()
        .single()
      activeContact = data
    }

    for (const rule of rules) {
      if (!(await this.evaluateTrigger(rule, content, msg, orgId, activeContact?.id))) {
        continue
      }

      if (activeContact?.id && await this.isOnCooldown(rule.id, activeContact.id, rule.cooldown_minutes, orgId)) {
        continue
      }

      const reply = await this.buildReply(rule, activeContact, orgId)
      if (!reply) continue

      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('org_id', orgId)
        .eq('device_id', deviceId)
        .eq('contact_id', activeContact?.id)
        .maybeSingle()

      await sock.sendMessage(jid, { text: reply })

      await supabase
        .from('messages')
        .insert({
          org_id: orgId,
          conversation_id: conversation?.id || null,
          device_id: deviceId,
          contact_id: activeContact?.id || null,
          direction: 'outbound',
          type: 'text',
          content: reply,
          media_mime_type: 'application/x-auto-reply',
          error_code: `auto_reply:${rule.id}`,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

      await supabase
        .from('auto_reply_rules')
        .update({
          trigger_count: (rule.trigger_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id)

      break
    }
  },

  async evaluateTrigger(rule: any, content: string, msg: WAMessage, orgId: string, contactId?: string): Promise<boolean> {
    const lowerContent = content.toLowerCase()

    switch (rule.trigger_type) {
      case 'keyword':
        return this.matchKeywords(lowerContent, rule.keywords || [], rule.match_type)
      case 'first_message': {
        if (!contactId) return true
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('contact_id', contactId)
          .eq('direction', 'inbound')
        return (count ?? 0) <= 1
      }
      case 'outside_hours': {
        const hour = new Date().getHours()
        return hour < 9 || hour >= 20
      }
      case 'any_message':
        return !msg.key.fromMe
      default:
        return false
    }
  },

  matchKeywords(content: string, keywords: string[], matchType: string): boolean {
    switch (matchType) {
      case 'contains':
        return keywords.some((keyword) => content.includes(keyword.toLowerCase()))
      case 'exact':
        return keywords.some((keyword) => content === keyword.toLowerCase())
      case 'starts_with':
        return keywords.some((keyword) => content.startsWith(keyword.toLowerCase()))
      case 'regex':
        return keywords.some((keyword) => {
          try {
            return new RegExp(keyword, 'i').test(content)
          } catch {
            return false
          }
        })
      default:
        return false
    }
  },

  async isOnCooldown(ruleId: string, contactId: string, cooldownMinutes: number, orgId: string): Promise<boolean> {
    if (!cooldownMinutes) return false
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .eq('error_code', `auto_reply:${ruleId}`)
      .gte('created_at', cutoff)

    return (count ?? 0) > 0
  },

  async buildReply(rule: any, contact: any, orgId: string): Promise<string | null> {
    try {
      let body: string | null = null

      if (rule.response_type === 'text' && rule.response_message) {
        body = rule.response_message
      } else if (rule.response_type === 'template' && rule.template_id) {
        const { data: template } = await supabase
          .from('message_templates')
          .select('body')
          .eq('id', rule.template_id)
          .eq('org_id', orgId)
          .single()
        body = template?.body || null
      } else if (rule.response_type === 'ai_powered' && rule.response_message) {
        body = rule.response_message
      }

      if (!body) return null

      return renderTemplate(body, {
        name: contact?.name || 'there',
        firstName: contact?.name?.split(' ')[0] || contact?.name || 'there',
        phone: contact?.phone || '',
      }).trim()
    } catch (error) {
      logger.error({ error, ruleId: rule.id }, 'Failed to build auto-reply')
      return null
    }
  },
}
