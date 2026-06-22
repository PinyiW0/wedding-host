import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CustomizeThankYouCardBody,
  SendThankYouFallbackBody,
  SetThankYouTemplateBody,
  ThankYouBatchSentEvent,
  ThankYouCardCustomizedEvent,
  ThankYouCustomizationListItem,
  ThankYouFallbackSentEvent,
  ThankYouTemplateDetail,
  ThankYouTemplateSetEvent,
} from '~/types/api/thankyou'
import { useHttp } from '~/composables/useHttp'

export function getThankYouTemplate(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<ThankYouTemplateDetail | null>,
) {
  return useHttp().get<ThankYouTemplateDetail | null>(
    () => `/api/v1/weddings/${toValue(weddingId)}/thank-you-card/template`,
    options,
  )
}

export function listThankYouCustomizations(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<ThankYouCustomizationListItem[]>,
) {
  return useHttp().get<ThankYouCustomizationListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/thank-you-card/customizations`,
    options,
  )
}

export function setThankYouTemplate(weddingId: string, body: SetThankYouTemplateBody) {
  return useHttp().put<ThankYouTemplateSetEvent>(
    '/api/v1/weddings/{weddingId}/thank-you-card/template',
    { pathParams: { weddingId }, body },
  )
}

export function customizeThankYouCard(weddingId: string, body: CustomizeThankYouCardBody) {
  return useHttp().post<ThankYouCardCustomizedEvent>(
    '/api/v1/weddings/{weddingId}/thank-you-card/customizations',
    { pathParams: { weddingId }, body },
  )
}

export function batchSendThankYou(weddingId: string) {
  return useHttp().post<ThankYouBatchSentEvent>(
    '/api/v1/weddings/{weddingId}/thank-you/batch-send',
    { pathParams: { weddingId } },
  )
}

export function fallbackSendThankYou(weddingId: string, body: SendThankYouFallbackBody) {
  return useHttp().post<ThankYouFallbackSentEvent>(
    '/api/v1/weddings/{weddingId}/thank-you/fallback-send',
    { pathParams: { weddingId }, body },
  )
}
