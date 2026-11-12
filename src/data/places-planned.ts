// Planned landings on the Moon and Mars, typed by hand from each agency's or operator's own page on the day in `planned.read` (never a news site). Each is held only where the page names a site the IAU
// Gazetteer has a name for: the position is that feature's centre (the Gazetteer's nightly centre-point file of 2026-11-11), marked approximate, because no page gives the landing point itself.
// The date is the year the page gives, and `planned.dateOf` says whether it is the launch or the landing. `node scripts/check-planned.ts` lists the ones whose date has passed, for the monthly look.
import type { Place } from "../places.ts";

const read = "2026-11-11";
const nasa = "https://www.nasa.gov/event/";

export const PLANNED_MOON: readonly Place[] = [
  {
    id: "moon/griffin-mission-one", kind: "planned", name: { en: "Griffin Mission One", ja: "グリフィン ミッション1" }, lat: -85.2752, lon: 53.2725, approximate: true, site: "Nobile",
    mission: "Griffin-1 (CLPS TO20A)", operator: "Astrobotic", country: "US", planned: { date: "2026", status: "slipped", read, dateOf: "launch" },
    source: { id: "announcement", read, url: `${nasa}clps-flight-astrobotics-griffin-mission-one/` },
  },
  {
    id: "moon/im-3", kind: "planned", name: { en: "IM-3", ja: "IM-3" }, lat: 7.3853, lon: -58.9583, approximate: true, site: "Reiner Gamma",
    mission: "IM-3 (CLPS CP-11)", operator: "Intuitive Machines", country: "US", planned: { date: "2027", status: "slipped", read, dateOf: "launch" },
    source: { id: "announcement", read, url: `${nasa}clps-flight-intuitive-machines-im-3/` },
  },
  {
    id: "moon/blue-moon-mk1-endurance", kind: "planned", name: { en: "Blue Moon MK1 Endurance", ja: "ブルームーン MK1 エンデュランス" }, lat: -89.67, lon: 129.78, approximate: true, site: "Shackleton connecting ridge",
    mission: "Blue Moon Mark 1 pathfinder", operator: "Blue Origin", country: "US", planned: { date: "2027", status: "announced", read, dateOf: "launch" },
    source: { id: "announcement", read, url: `${nasa}clps-flight-blue-origins-blue-moon-mark-1/` },
  },
  {
    id: "moon/im-4", kind: "planned", name: { en: "IM-4", ja: "IM-4" }, lat: -84.6, lon: 31, approximate: true, site: "Mons Mouton",
    mission: "IM-4 (CLPS CP-22)", operator: "Intuitive Machines", country: "US", planned: { date: "2027", status: "announced", read, dateOf: "launch" },
    source: { id: "announcement", read, url: `${nasa}clps-flight-intuitive-machines-im-4-2/` },
  },
  {
    id: "moon/blue-ghost-mission-2", kind: "planned", name: { en: "Blue Ghost Mission 2", ja: "ブルーゴースト ミッション2" }, lat: -24.9137, lon: 177.337, approximate: true, site: "Nassau",
    mission: "Blue Ghost Mission 2 (CLPS CS-3/4)", operator: "Firefly Aerospace", country: "US", planned: { date: "2027", status: "slipped", read, dateOf: "launch" },
    source: { id: "announcement", read, url: "https://fireflyspace.com/missions/blue-ghost-mission-2/" },
  },
  {
    id: "moon/viper", kind: "planned", name: { en: "VIPER", ja: "VIPER" }, lat: -84.6, lon: 31, approximate: true, site: "Mons Mouton",
    mission: "VIPER (CLPS CS-7)", operator: "NASA", country: "US", planned: { date: "2027", status: "announced", read, dateOf: "landing" },
    source: { id: "announcement", read, url: "https://www.nasa.gov/moonbase-phases/" },
  },
  {
    id: "moon/blue-ghost-mission-3", kind: "planned", name: { en: "Blue Ghost Mission 3", ja: "ブルーゴースト ミッション3" }, lat: 36.5585, lon: -40.7213, approximate: true, site: "Gruithuisen Domes",
    mission: "Blue Ghost Mission 3 (CLPS CP-21)", operator: "Firefly Aerospace", country: "US", planned: { date: "2028", status: "announced", read, dateOf: "launch" },
    source: { id: "announcement", read, url: "https://fireflyspace.com/missions/blue-ghost-mission-3/" },
  },
  {
    id: "moon/blue-ghost-mission-4", kind: "planned", name: { en: "Blue Ghost Mission 4", ja: "ブルーゴースト ミッション4" }, lat: -87.45, lon: -5.17, approximate: true, site: "Haworth",
    mission: "Blue Ghost Mission 4 (CLPS CS-6)", operator: "Firefly Aerospace", country: "US", planned: { date: "2029", status: "announced", read, dateOf: "launch" },
    source: { id: "announcement", read, url: "https://fireflyspace.com/missions/blue-ghost-mission-4/" },
  },
];

export const PLANNED_MARS: readonly Place[] = [
  {
    id: "mars/rosalind-franklin", kind: "planned", name: { en: "Rosalind Franklin", ja: "ロザリンド・フランクリン" }, lat: 17.28, lon: -25.71, approximate: true, site: "Oxia Planum",
    mission: "ExoMars Rosalind Franklin", operator: "ESA", country: "EU", planned: { date: "2030", status: "announced", read, dateOf: "landing" },
    source: { id: "announcement", read, latitude: "planetocentric", url: "https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/FAQ_The_rebirth_of_ESA_s_ExoMars_Rosalind_Franklin_mission" },
  },
];
