import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Contact, ContactList } from '@/types'
import type {
  ContactDeleteResponse,
  ContactImportResponse,
  ContactListResponse,
  ContactListsResponse,
  ContactResponse,
  ContactsResponse,
} from '@/types/api.types'

interface ContactsParams {
  cursor?: string
  limit?: number
  search?: string
  status?: string
  tags?: string[]
  listId?: string
}

function buildContactsQuery(params: ContactsParams = {}) {
  const query = new URLSearchParams()

  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.tags?.length) query.set('tags', params.tags.join(','))
  if (params.listId) query.set('listId', params.listId)

  return query.toString()
}

export function useContacts(params: ContactsParams = {}) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: async () => {
      const query = buildContactsQuery(params)
      const { data } = await api.get<ContactsResponse>(`/contacts?${query}`)
      return data
    },
  })
}

export function useContactLists() {
  return useQuery({
    queryKey: ['contact-lists'],
    queryFn: async () => {
      const { data } = await api.get<ContactListsResponse>('/contacts/lists')
      return data.data
    },
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: Partial<Contact>) => {
      const { data } = await api.post<ContactResponse>('/contacts', contact)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}

export function useCreateContactList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<ContactList>) => {
      const { data } = await api.post<ContactListResponse>('/contacts/lists', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}

export function useImportContacts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      contacts: Array<{
        phone: string
        name?: string
        email?: string
      }>
    }) => {
      const { data } = await api.post<ContactImportResponse>('/contacts/import', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Contact>) => {
      const { data } = await api.patch<ContactResponse>(`/contacts/${id}`, updates)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data } = await api.delete<ContactDeleteResponse>(`/contacts/${contactId}`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactIds: string[]) => {
      await Promise.all(
        contactIds.map((contactId) => api.delete<ContactDeleteResponse>(`/contacts/${contactId}`)),
      )
      return { deleted: contactIds.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] })
    },
  })
}
