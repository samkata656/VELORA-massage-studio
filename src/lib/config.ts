// Studio-wide business constants. All times are local studio time (Europe/Sofia),
// expressed as minutes after midnight.
export const STUDIO_TZ = "Europe/Sofia";

export const SHIFT_START = 10 * 60; // 10:00
export const SHIFT_END = 19 * 60; // 19:00 — procedures must end by then
export const BUFFER_MIN = 20; // rest + room preparation after each procedure
export const LUNCH_WINDOW_START = 12 * 60; // 12:00
export const LUNCH_WINDOW_END = 14 * 60; // 14:00
export const LUNCH_MIN = 30;
export const SLOT_STEP_MIN = 15;
export const BOOKING_HORIZON_DAYS = 60;
export const MIN_LEAD_MIN = 60; // earliest bookable slot is 1h from now
export const CANCEL_CUTOFF_HOURS = 24;

// Rota rules
export const MAX_CONSECUTIVE_WORK_DAYS = 5;
export const MIN_CONSECUTIVE_DAYS_OFF_PER_WEEK = 2;
export const TARGET_THERAPISTS_PER_DAY = 3; // one per room
export const MIN_THERAPISTS_PER_DAY = 2; // couples massage needs two
export const ROTA_WEEKS_AHEAD = 8;

export const STUDIO = {
  name: "VELORA",
  phone: "+359 88 712 4560",
  phoneHref: "tel:+359887124560",
  email: "hello@velora-spa.bg",
  addressEn: "14 Oborishte St, Sofia 1504, Bulgaria",
  addressBg: "ул. „Оборище“ 14, София 1504",
  instagram: "@velora.spa",
};
