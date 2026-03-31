'use client'

import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Campaign } from '@/types'
import { formatDate } from '@/lib/utils'
import { CampaignProgressBar } from './CampaignProgressBar'

interface CampaignListProps {
  campaigns: Campaign[]
  loading?: boolean
  onSelect: (campaign: Campaign) => void
  onLaunch: (campaignId: string) => void
  onPause: (campaignId: string) => void
  onResume: (campaignId: string) => void
  onStop: (campaignId: string) => void
  onDelete: (campaignId: string) => void
  pagination?: {
    nextCursor?: string | null
    previousCursor?: string | null
    hasMore?: boolean
  }
  onNextPage?: () => void
  onPreviousPage?: () => void
}

export function CampaignList({
  campaigns,
  loading = false,
  onSelect,
  onLaunch,
  onPause,
  onResume,
  onStop,
  onDelete,
  pagination,
  onNextPage,
  onPreviousPage,
}: CampaignListProps) {
  return (
    <DataTable
      data={campaigns}
      loading={loading}
      searchable={false}
      getRowKey={(campaign) => campaign.id}
      onRowClick={onSelect}
      emptyState="No campaigns yet."
      pagination={pagination}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      columns={[
        {
          key: 'name',
          header: 'Campaign',
          sortable: true,
          cell: (campaign) => (
            <div>
              <p className="font-medium text-slate-950">{campaign.name}</p>
              <p className="text-xs text-slate-500 capitalize">{campaign.type.replace('_', ' ')}</p>
            </div>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          cell: (campaign) => <StatusBadge status={campaign.status} />,
        },
        {
          key: 'progress',
          header: 'Progress',
          cell: (campaign) => (
            <CampaignProgressBar
              sent={campaign.sent_count}
              delivered={campaign.delivered_count}
              read={campaign.read_count}
              failed={campaign.failed_count}
              total={campaign.total_contacts}
            />
          ),
        },
        {
          key: 'updated_at',
          header: 'Updated',
          sortable: true,
          cell: (campaign) => formatDate(campaign.updated_at),
        },
        {
          key: 'actions',
          header: 'Actions',
          className: 'w-16',
          cell: (campaign) => (
            <div onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {campaign.status === 'draft' ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onLaunch(campaign.id) }}>
                      Launch
                    </DropdownMenuItem>
                  ) : null}
                  {campaign.status === 'running' ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onPause(campaign.id) }}>
                      Pause
                    </DropdownMenuItem>
                  ) : null}
                  {campaign.status === 'paused' ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onResume(campaign.id) }}>
                      Resume
                    </DropdownMenuItem>
                  ) : null}
                  {['running', 'paused'].includes(campaign.status) ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onStop(campaign.id) }}>
                      Stop
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={(event) => { event.preventDefault(); onDelete(campaign.id) }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        },
      ]}
    />
  )
}
