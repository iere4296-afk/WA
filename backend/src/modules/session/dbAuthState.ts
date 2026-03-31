import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'
import type { AuthenticationState, SignalDataSet, SignalDataTypeMap } from '@whiskeysockets/baileys'
import { supabase } from '../../lib/supabase.js'
import { encrypt, decrypt } from '../../lib/encryption.js'

export async function useDBAuthState(deviceId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  async function readData<T>(key: string): Promise<T | null> {
    const { data } = await supabase
      .from('wa_sessions')
      .select('session_value')
      .eq('device_id', deviceId)
      .eq('session_key', key)
      .maybeSingle()

    if (data?.session_value) {
      try {
        return JSON.parse(decrypt(data.session_value), BufferJSON.reviver) as T
      } catch {
        return null
      }
    }

    const { data: legacy } = await supabase
      .from('wa_session_keys')
      .select('value')
      .eq('device_id', deviceId)
      .eq('key_name', key)
      .maybeSingle()

    if (!legacy?.value) return null
    try {
      const parsed = JSON.parse(decrypt(legacy.value), BufferJSON.reviver) as T
      await writeData(key, parsed)
      return parsed
    } catch {
      return null
    }
  }

  async function writeData(key: string, value: unknown) {
    const encrypted = encrypt(JSON.stringify(value, BufferJSON.replacer))
    const { error } = await supabase.from('wa_sessions').upsert(
      {
        device_id: deviceId,
        session_key: key,
        session_value: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'device_id,session_key' },
    )
    if (error) throw error
    await supabase.from('wa_session_keys').delete().eq('device_id', deviceId).eq('key_name', key)
  }

  async function removeData(key: string) {
    await supabase.from('wa_sessions').delete().eq('device_id', deviceId).eq('session_key', key)
    await supabase.from('wa_session_keys').delete().eq('device_id', deviceId).eq('key_name', key)
  }

  const creds = (await readData<AuthenticationState['creds']>('creds')) ?? initAuthCreds()
  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data = {} as { [id: string]: SignalDataTypeMap[T] }
        await Promise.all(ids.map(async (id) => {
          const value = await readData<SignalDataTypeMap[T]>(`${type}-${id}`)
          if (!value) return
          data[id] = (type === 'app-state-sync-key'
            ? proto.Message.AppStateSyncKeyData.fromObject(value as proto.Message.IAppStateSyncKeyData)
            : value) as SignalDataTypeMap[T]
        }))
        return data
      },
      set: async (data: SignalDataSet) => {
        const pairs = Object.entries(data).flatMap(([type, ids]) =>
          Object.entries(ids ?? {}).map(([id, value]) => ({ key: `${type}-${id}`, value })),
        )
        await Promise.all(pairs.map(({ key, value }) =>
          value ? writeData(key, value) : removeData(key),
        ))
      },
    },
  }

  return {
    state,
    saveCreds: () => writeData('creds', state.creds),
  }
}
