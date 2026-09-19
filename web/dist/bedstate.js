import { humanize, titleCase } from "./engine/labels.js";
import { bedSeasonStatus, plantingOnBed } from "./plan.js";
export function bedState(bed, season, teamLabel) {
    try {
        if (season?.closed_date) {
            const st = bedSeasonStatus(bed.region, season);
            return { key: "closed", chip: `Closed ${season.id}`, line: st.carried ? `${st.carried} overwintering` : "dormant for the season" };
        }
        const live = (season?.plantings ?? []).filter((p) => !p.end_cause && plantingOnBed(p.region, bed.region));
        const draft = (Array.isArray(season?.plan) ? season.plan : [])
            .find((e) => e.area === bed.name);
        const myDraft = draft?.mybed === true && Array.isArray(draft.plantings) ? draft.plantings.length : 0;
        if (draft?.guild && live.length > 0) {
            const team = teamLabel(draft.guild) ?? titleCase(humanize(draft.guild));
            return { key: "planned", chip: "Planned", line: `${team} - a draft, partly planted (${live.length} in the ground)`, guild: draft.guild };
        }
        if (myDraft && live.length > 0) {
            return { key: "planned", chip: "Planned", line: `your own design - a draft, partly planted (${live.length} in the ground)`, mybed: true };
        }
        if (live.length > 0) {
            const st = bedSeasonStatus(bed.region, season);
            return { key: "planted", chip: "Planted", line: st.label === "ready to plant" ? "in the ground" : st.label };
        }
        if (draft?.guild) {
            const team = teamLabel(draft.guild) ?? titleCase(humanize(draft.guild));
            return { key: "planned", chip: "Planned", line: `${team} - a draft, not yet planted`, guild: draft.guild };
        }
        if (myDraft) {
            return { key: "planned", chip: "Planned", line: `your own design - a draft, not yet planted (${myDraft} plant${myDraft === 1 ? "" : "s"})`, mybed: true };
        }
        return { key: "empty", chip: "Bare ground", line: "nothing planned here yet" };
    }
    catch {
        return { key: "empty", chip: "Bare ground", line: "nothing planned here yet" };
    }
}
