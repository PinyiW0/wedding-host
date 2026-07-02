// app/api/index.ts — 統一 re-export 所有 client API function
export {
  createReceptionAccount,
  deleteReceptionAccount,
  listReceptionAccounts,
} from './accounts.api'
export { login, registerAdmin } from './auth.api'
export {
  approveBlessing,
  listBlessings,
  projectBlessing,
  rejectBlessing,
  submitBlessing,
} from './blessings.api'
export {
  configureCakeBoxAssignment,
  createCakeBoxExtraOrder,
  createCakeBoxType,
  deleteCakeBoxExtraOrder,
  deleteCakeBoxType,
  excludeGuestCakeBox,
  listCakeBoxAssignments,
  listCakeBoxExclusions,
  listCakeBoxExtraOrders,
  listCakeBoxTypes,
  removeCakeBoxExclusion,
  updateCakeBoxType,
} from './cakebox.api'
export { listFlowers } from './flowers.api'
export {
  bindGuestLine,
  createGuest,
  deleteGuest,
  importGuests,
  listGuests,
  restoreGuest,
  updateGuest,
} from './guests.api'
export { connectLineOa, getLineOa } from './line.api'
export {
  confirmPendingGuest,
  listPendingGuests,
  mergePendingGuest,
  rejectPendingGuest,
  submitPublicRsvp,
} from './pending-guests.api'
export {
  checkInGuest,
  distributeCakeBox,
  getReceptionStatus,
  recordGiftMoney,
  selfCheckInGuest,
  updateGiftMoney,
} from './reception.api'
export { configureRsvpForm, getRsvpFormConfig } from './rsvp-config.api'
export {
  overrideRsvp,
  sendRsvpInvitation,
  submitRsvp,
} from './rsvp.api'
export {
  configureVenueLayout,
  createTable,
  deleteTable,
  dismissEtiquetteWarning,
  getEtiquetteSettings,
  getTableSeats,
  getVenueLayout,
  listEtiquetteWarnings,
  listTables,
  seatGuest,
  unseatGuest,
  updateEtiquetteSettings,
  updateTable,
} from './seating.api'
export {
  batchSendThankYou,
  customizeThankYouCard,
  fallbackSendThankYou,
  getPublicThankYouCard,
  getThankYouTemplate,
  listThankYouCustomizations,
  setThankYouTemplate,
} from './thankyou.api'
export {
  createWedding,
  deleteWedding,
  getWedding,
  listWeddings,
  restoreWedding,
  updateWedding,
} from './weddings.api'
