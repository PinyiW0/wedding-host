// app/api/index.ts — 統一 re-export 所有 client API function
export {
  createReceptionAccount,
  deleteReceptionAccount,
  listReceptionAccounts,
  updateReceptionAccount,
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
  updateCakeBoxExtraOrder,
  updateCakeBoxType,
} from './cakebox.api'
export { getDashboardStats } from './dashboard.api'
export { listFlowers } from './flowers.api'
export {
  createGiftCategory,
  createGiftItem,
  deleteGiftCategory,
  deleteGiftItem,
  listGiftCategories,
  listGiftItems,
  updateGiftCategory,
  updateGiftItem,
} from './gifts.api'
export {
  batchCategorizeGuests,
  batchDeleteGuests,
  bindGuestLine,
  createGuest,
  deleteGuest,
  getGuestLineLogin,
  importGuests,
  listGuestCategories,
  listGuestDisplayNames,
  listGuests,
  markInvitationSent,
  renameGuestCategory,
  restoreGuest,
  saveGuestCategories,
  updateGuest,
} from './guests.api'
export { connectLineOa, getLineOa } from './line.api'
export { getSignedLink } from './links.api'
export {
  confirmPendingGuest,
  listPendingGuests,
  mergePendingGuest,
  rejectPendingGuest,
  submitPublicRsvp,
} from './pending-guests.api'
export {
  getProjectionSettings,
  updateProjectionSettings,
} from './projection.api'
export {
  cancelCakeBoxDistribution,
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
  createRundownRole,
  deleteRundownRole,
  listRundownItems,
  listRundownRoles,
  saveRundownTable,
  updateRundownRole,
} from './rundown.api'
export {
  configureVenueLayout,
  createTable,
  createVenueMarker,
  deleteTable,
  deleteVenueMarker,
  getVenueLayout,
  listTables,
  listVenueMarkers,
  listWeddingSeats,
  moveSeat,
  seatGuest,
  unseatGuest,
  updateTable,
  updateVenueMarker,
} from './seating.api'
export {
  batchSendThankYou,
  customizeThankYouCard,
  fallbackSendThankYou,
  getPublicThankYouCard,
  getThankYouTemplate,
  listThankYouCustomizations,
  resendThankYou,
  setThankYouTemplate,
} from './thankyou.api'
export { presignUpload } from './uploads.api'
export {
  createCoupleAccount,
  deleteCoupleAccount,
  listCoupleAccounts,
  updateCoupleAccount,
} from './users.api'
export {
  createWedding,
  deleteWedding,
  getWedding,
  listWeddings,
  restoreWedding,
  updateWedding,
} from './weddings.api'
