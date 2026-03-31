'use client'

import { useEffect, useState } from 'react'
import { Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAddDevice, useConnectDevice } from '@/hooks/useDevices'
import { QRCodePanel } from './QRCodePanel'

interface AddDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (deviceId: string) => void
}

export function AddDeviceDialog({ open, onOpenChange, onCreated }: AddDeviceDialogProps) {
  const addDevice = useAddDevice()
  const connectDevice = useConnectDevice()
  const [name, setName] = useState('')
  const [phoneLabel, setPhoneLabel] = useState('')
  const [createdDeviceId, setCreatedDeviceId] = useState<string | null>(null)

  useEffect(() => {
    if (open) return
    setName('')
    setPhoneLabel('')
    setCreatedDeviceId(null)
  }, [open])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const device = await addDevice.mutateAsync({
        name,
        phoneNumber: phoneLabel || undefined,
      })

      setCreatedDeviceId(device.id)
      onCreated?.(device.id)

      try {
        await connectDevice.mutateAsync(device.id)
        toast.success('Device created. Scan the QR code to complete pairing.')
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Device created, but QR generation needs a retry.')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to create device.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{createdDeviceId ? 'Pair Device' : 'Add Device'}</DialogTitle>
          <DialogDescription>
            {createdDeviceId
              ? 'A secure pairing session is live below. Scan the QR code from your phone.'
              : 'Create a WhatsApp device entry, then launch the QR pairing flow immediately.'}
          </DialogDescription>
        </DialogHeader>

        {!createdDeviceId ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Device name</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sales phone 01"
                  className="h-11 rounded-2xl"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Assigned phone label</span>
                <Input
                  value={phoneLabel}
                  onChange={(event) => setPhoneLabel(event.target.value)}
                  placeholder="UAE lead inbox"
                  className="h-11 rounded-2xl"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <Smartphone className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">What happens next?</p>
                  <p className="mt-1">
                    We’ll create the device record in Supabase, trigger the connection flow, and keep the QR code live in this dialog until it is scanned or expires.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={addDevice.isPending || connectDevice.isPending}
              >
                {(addDevice.isPending || connectDevice.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Device'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <QRCodePanel deviceId={createdDeviceId} initialStatus="connecting" />

            <DialogFooter className="border-t-0 bg-transparent p-0">
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedDeviceId(null)
                  setName('')
                  setPhoneLabel('')
                }}
              >
                Create Another
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
