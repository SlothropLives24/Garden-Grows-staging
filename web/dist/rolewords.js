import { stripRuleCitations } from "./engine/labels.js";
const ROLE_WORDS = {
    fixer: "a legume - its roots host the bacteria that pull nitrogen from the air",
    cover: "a low, spreading plant that shades the soil between the others",
    support: "a tall, sturdy plant (or a structure) that something else climbs",
    insectary: "flowers grown for the insects they feed - pollinators, and the predators of pests",
    canopy: "the tallest layer - it casts the shade the others live under",
    bulb_ring: "a ring of alliums around a tree or shrub",
    primary: "the plant the bed is for - everything else is arranged around it",
    mulch_producer: "a plant grown to be cut and dropped as mulch",
    companion: "a plant grown alongside the crop",
    fruiting_understory: "a fruiting shrub in the shade of the canopy",
    leaf_crop: "a plant grown for its leaves, picked young",
    masking: "a strong-scented plant grown beside the crop",
    shrub_layer: "the shrub layer between the canopy and the ground",
    edge: "the plant along the bed's edge",
    crop: "the harvest crop of this team",
    trap: "a plant the pest prefers, grown to draw it away from the crop",
    border: "a low border along the bed's edge",
    overwinter: "a plant that holds the ground through winter",
    grain: "the grain crop of this team",
    legume: "a legume - its roots host the bacteria that pull nitrogen from the air",
    shade: "a plant grown to cast shade on a crop that suffers in heat",
    bolter: "a crop that bolts in heat, grown in another plant's shade",
    early: "the early-flowering plant - in bloom before the rest",
    backbone: "the plant in flower through the middle of the season",
    bridge: "the plant that carries the bloom across the gap between the others",
};
export function roleWords(guild, role) {
    const tagged = (guild.mechanisms ?? [])
        .filter((m) => m.role === role && m.claim).map((m) => stripRuleCitations(String(m.claim)));
    if (tagged.length)
        return tagged.join("; ");
    return ROLE_WORDS[role] ?? null;
}
