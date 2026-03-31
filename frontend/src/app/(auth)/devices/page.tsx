'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { AddDeviceDialog } from '@/components/devices/AddDeviceDialog'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { DeviceDetailSheet } from '@/components/devices/DeviceDetailSheet'
import {
  useConnectDevice,
  useDeleteDevice,
  useDevices,
  useDisconnectDevice,
} from '@/hooks/useDevices'
import { useDevicesRealtime } from '@/hooks/useRealtime'
import { Device } from '@/types'

type DeviceAction = 'connect' | 'disconnect' | 'delete' | null

export default function DevicesPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [devicePendingDelete, setDevicePendingDelete] = useState<Device | null>(null)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<DeviceAction>(null)

  const devicesQuery = useDevices({ cursor, limit: 12 })
  const connectDevice = useConnectDevice()
  const disconnectDevice = useDisconnectDevice()
  const deleteDevice = useDeleteDevice()

  useDevicesRealtime()

  const devices = devicesQuery.data?.data ?? []
  const pagination = devicesQuery.data?.meta

  async function runDeviceAction(deviceId: string, action: Exclude<DeviceAction, null>) {
    setBusyDeviceId(deviceId)
    setBusyAction(action)

    try {
      if (action === 'connect') {
        await connectDevice.mutateAsync(deviceId)
        toast.success('Connection initiated. Scan the QR code to finish pairing.')
      }

      if (action === 'disconnect') {
        await disconnectDevice.mutateAsync(deviceId)
        toast.success('Device disconnected.')
      }

      if (action === 'delete') {
        await deleteDevice.mutateAsync(deviceId)
        toast.success('Device deleted.')

        if (selectedDeviceId === deviceId) {
          setSelectedDeviceId(null)
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Unable to ${action} device.`)
    } finally {
      setBusyDeviceId(null)
      setBusyAction(null)
      setDevicePendingDelete(null)
    }
  }

  function handleNextPage() {
    if (!pagination?.nextCursor) return
    setCursorHistory((current) => [...current, cursor])
    setCursor(pagination.nextCursor)
  }

  function handlePreviousPage() {
    if (cursorHistory.length === 0) return
    const previousCursor = cursorHistory[cursorHistory.length - 1]
    setCursorHistory((current) => current.slice(0, -1))
    setCursor(previousCursor)
  }

  if (devicesQuery.isLoading && !devicesQuery.data) {
    return <SkeletonPage rows={4} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Devices</h2>
          <p className="text-sm text-slate-500">
            Pair WhatsApp devices, monitor connection health, and manage warmup safely.
          </p>
        </div>

        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices connected yet"
          description="Add your first device to launch the QR pairing flow and start sending messages."
          action={{ label: 'Add Device', onClick: () => setIsAddDialogOpen(true) }}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onOpen={() => setSelectedDeviceId(device.id)}
                onConnect={() => void runDeviceAction(device.id, 'connect')}
                onDisconnect={() => void runDeviceAction(device.id, 'disconnect')}
                onDelete={() => setDevicePendingDelete(device)}
                busyAction={busyDeviceId === device.id ? busyAction : null}
              />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-500">
              Showing {devices.length} device{devices.length === 1 ? '' : 's'} on this page
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={cursorHistory.length === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!pagination?.hasMore || !pagination?.nextCursor}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <AddDeviceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      <DeviceDetailSheet
        open={!!selectedDeviceId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDeviceId(null)
          }
        }}
        deviceId={selectedDeviceId}
      />

      <ConfirmDialog
        open={!!devicePendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDevicePendingDelete(null)
          }
        }}
        title={`Delete ${devicePendingDelete?.name || 'device'}?`}
        description="This removes the device from the workspace and clears the active session. This action cannot be undone."
        destructive
        confirmText={busyAction === 'delete' ? 'Deleting...' : 'Delete Device'}
        onConfirm={() => devicePendingDelete ? runDeviceAction(devicePendingDelete.id, 'delete') : Promise.resolve()}
      />
    </div>
  )
}
