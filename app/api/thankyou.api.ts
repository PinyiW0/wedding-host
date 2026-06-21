import type {
  CustomizeThankYouCardBody,
  SendThankYouFallbackBody,
  SetThankYouTemplateBody,
  ThankYouBatchSentEvent,
  ThankYouCardCustomizedEvent,
  ThankYouFallbackSentEvent,
  ThankYouTemplateSetEvent,
} from '~/types/api/thankyou'
import { useHttp } from '~/composables/useHttp'

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
