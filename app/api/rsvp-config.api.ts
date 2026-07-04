import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  ConfigureRsvpFormBody,
  RsvpFormConfigDetail,
  RsvpFormConfiguredEvent,
} from '~/types/api/rsvp-config'
import { useHttp } from '~/composables/useHttp'

export function getRsvpFormConfig(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<RsvpFormConfigDetail>,
) {
  return useHttp().get<RsvpFormConfigDetail>(
    () => `/api/v1/weddings/${toValue(weddingId)}/rsvp-config`,
    options,
  )
}

export function configureRsvpForm(weddingId: string, body: ConfigureRsvpFormBody) {
  return useHttp().put<RsvpFormConfiguredEvent>(
    '/api/v1/weddings/{weddingId}/rsvp-config',
    { pathParams: { weddingId }, body },
  )
}
