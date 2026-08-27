// Task generation (Phase 5) - line-for-line port of engine/tasks.py, pinned by the
// season-log conformance golden. DOM-free and dependency-free.
//
// Two hard rules, same as the oracle: no task carries a date the engine can't source (an
// unresolved site yields NO tasks, never a guess), and output is structured data - the UI
// composes the sentences. Date arithmetic uses frost_calib's non-leap doy convention so both
// engines emit identical strings.
import { fromDoy, mmddDoy } from "./frostcalib.js";
import { matchSite } from "./intake.js";
import { livingSupportLead } from "./schedule.js";
function shiftMmdd(mmdd, days) {
    const doy = mmddDoy(mmdd);
    if (doy === null)
        return null;
    const shifted = doy + days;
    if (shifted < 1 || shifted > 365)
        return null; // off the calendar = a bug upstream, not a date
    return fromDoy(shifted);
}
export function gardenTasks(guild, lat, lon, seasonYear, bundle) {
    const site = lat != null && lon != null ? matchSite(lat, lon, bundle) : null;
    if (!site)
        return []; // no resolved climate -> no dates; the engine does not guess
    const out = [];
    const lf = (site.last_frost_32f ?? {}).p50 ?? null;
    const lf10 = (site.last_frost_32f ?? {}).p10 ?? null;
    const ff = site.first_freeze_32f_p50 ?? null;
    if (lf) {
        out.push({ date: `${seasonYear}-${lf}`, kind: "plant_after_last_frost", rule: "R-031", species: null, frost_risk_until: lf10 });
        const lead = livingSupportLead(guild, bundle);
        if (lead && lead.lead_days) {
            const sow = shiftMmdd(lf, lead.lead_days);
            if (sow) {
                out.push({ date: `${seasonYear}-${sow}`, kind: "sow_climber", rule: lead.rule, species: lead.climber, support: lead.support, lead_days: lead.lead_days });
            }
        }
        // install_support (O80b): a guild whose support role names a STRUCTURE (the small-bed trellis
        // substitute, the grape arbour's canonical panel) gets the staking guide's rule as a dated
        // task - the support goes in ON planting day, before the vine needs it. A LIVING support
        // keeps R-033's sow-lead instead; the two never both fire for one role. Mirrors tasks.py.
        outer: for (const role of guild.roles ?? []) {
            for (const key of ["canonical", "substitute"]) {
                const sid = role[key];
                if (typeof sid === "string"
                    && (bundle.entities ?? []).some((e) => e.id === sid && e.entity_class === "structure")) {
                    out.push({ date: `${seasonYear}-${lf}`, kind: "install_support", rule: "R-040", species: sid });
                    break outer;
                }
            }
        }
    }
    if (ff)
        out.push({ date: `${seasonYear}-${ff}`, kind: "log_first_freeze", rule: "R-093", species: null });
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
    return out;
}
