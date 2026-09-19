import { acceptInvite, attachGarden, createTeam, deleteTeam, detachGarden, leaveTeam, listAttachments, listMembers, listMyInvites, listSentInvites, listTeams, mintInvite, renameTeam, revokeInvite } from "./sync.js";
import { copy } from "./copy.js";
import { toast } from "./notices.js";
import { el } from "./dom.js";
const $ = (id) => document.getElementById(id);
const dismissed = new Set();
export function initTeams(deps) {
    const nameInput = $("teamname");
    const createBtn = $("teamcreate");
    if (nameInput)
        nameInput.placeholder = copy.teamsCreatePlaceholder;
    const report = (line) => {
        const box = $("teamsreport");
        if (!box)
            return;
        box.innerHTML = "";
        if (!line)
            return;
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = line;
        box.appendChild(p);
    };
    const myEmail = () => (deps.session()?.email ?? "").toLowerCase();
    const myUid = () => deps.session()?.userId;
    const isMe = (id, email) => (!!id && id === myUid()) || (!!email && email.toLowerCase() === myEmail());
    const guard = async (btn, fn) => {
        const label = btn?.textContent ?? "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "working…";
        }
        try {
            report("");
            await fn();
        }
        catch (e) {
            report(e instanceof Error ? e.message : String(e));
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = label;
            }
        }
    };
    const renderInvites = (invites) => {
        const box = $("teaminvites");
        if (!box)
            return;
        box.innerHTML = "";
        const live = invites.filter((iv) => !dismissed.has(iv.id));
        if (!live.length)
            return;
        box.appendChild(el("p", "teamsub", copy.teamsInvitesHeading));
        for (const iv of live) {
            const card = el("div", "teamcard");
            const who = iv.teams?.owner_email ? `${iv.teams.owner_email} invited you to ` : "You've been invited to ";
            const name = iv.teams?.name ?? "a circle";
            const line = el("p");
            line.appendChild(document.createTextNode(who));
            line.appendChild(el("b", undefined, name));
            card.appendChild(line);
            const row = el("div", "logrow");
            const join = el("button", "primary", copy.teamsAcceptBtn);
            join.type = "button";
            join.addEventListener("click", () => void guard(join, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                await acceptInvite(c, s, iv.id);
                deps.onSharedChange();
                toast(`Joined ${name}`);
                await refresh();
            }));
            const dismiss = el("button", undefined, copy.teamsDeclineBtn);
            dismiss.type = "button";
            dismiss.addEventListener("click", () => { dismissed.add(iv.id); renderInvites(invites); });
            row.append(join, dismiss);
            card.appendChild(row);
            box.appendChild(card);
        }
    };
    const renderRoster = (card, members, team) => {
        const roster = el("div", "teamroster");
        roster.appendChild(el("p", "teamsub", copy.teamsRosterLabel));
        const ownerTags = [copy.teamsOwnerTag, isMe(team.owner_id, team.owner_email) ? copy.teamsYouTag : ""].filter(Boolean);
        roster.appendChild(el("p", "teammember", `${team.owner_email ?? "the owner"} (${ownerTags.join(", ")})`));
        for (const m of members) {
            if (m.member_id === team.owner_id)
                continue;
            const tags = [isMe(m.member_id, m.member_email) ? copy.teamsYouTag : ""].filter(Boolean);
            const label = (m.member_email ?? "a member") + (tags.length ? ` (${tags.join(", ")})` : "");
            roster.appendChild(el("p", "teammember", label));
        }
        card.appendChild(roster);
    };
    const renderSent = (card, sent) => {
        for (const iv of sent) {
            const row = el("div", "logrow teampending");
            row.appendChild(el("span", "hint", `${iv.invited_email} - ${copy.teamsPendingLabel}`));
            const cancel = el("button", undefined, copy.teamsRevokeBtn);
            cancel.type = "button";
            cancel.addEventListener("click", () => void guard(cancel, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                await revokeInvite(c, s, iv.id);
                await refresh();
            }));
            row.appendChild(cancel);
            card.appendChild(row);
        }
    };
    const renderAttachments = (card, team, attachments, ownGardens, sharedGardens) => {
        const me = myUid();
        const iOwnTeam = isMe(team.owner_id, team.owner_email);
        const box = el("div", "teamgardens");
        box.appendChild(el("p", "teamsub", copy.teamsAttachLabel));
        if (!attachments.length)
            box.appendChild(el("p", "teammember hint", copy.teamsNoAttached));
        for (const a of attachments) {
            const mine = a.owner_id === me;
            const label = mine ? (ownGardens.find((g) => g.id === a.plot)?.name ?? a.plot)
                : (sharedGardens.find((g) => g.ownerId === a.owner_id && g.plot === a.plot)?.name ?? a.plot);
            const row = el("div", "logrow teampending");
            row.appendChild(el("span", "teammember", label + (mine ? ` (${copy.teamsYouTag})` : "")));
            if (mine || iOwnTeam) {
                const detach = el("button", undefined, copy.teamsDetachBtn);
                detach.type = "button";
                detach.addEventListener("click", () => void guard(detach, async () => {
                    const s = deps.session(), c = deps.cfg();
                    if (!c || !s)
                        throw new Error("sign in first");
                    await detachGarden(c, s, team.id, a.owner_id, a.plot);
                    deps.onSharedChange();
                    await refresh();
                }));
                row.appendChild(detach);
            }
            box.appendChild(row);
        }
        const attachable = ownGardens.filter((g) => !attachments.some((a) => a.owner_id === me && a.plot === g.id));
        if (attachable.length) {
            const row = el("div", "logrow");
            const sel = el("select");
            for (const g of attachable) {
                const o = document.createElement("option");
                o.value = g.id;
                o.textContent = g.name;
                sel.appendChild(o);
            }
            const add = el("button", undefined, copy.teamsAttachBtn);
            add.type = "button";
            add.addEventListener("click", () => void guard(add, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                await attachGarden(c, s, team.id, sel.value);
                deps.onSharedChange();
                toast(copy.teamsAttachedToast);
                await refresh();
            }));
            row.append(sel, add);
            box.appendChild(row);
        }
        card.appendChild(box);
    };
    const renderTeam = (team, members, sent, attachments, ownGardens, sharedGardens) => {
        const owner = isMe(team.owner_id, team.owner_email);
        const card = el("div", "teamcard");
        const head = el("div", "teamhead");
        head.appendChild(el("b", undefined, team.name));
        head.appendChild(el("span", "hint", owner ? ` - ${copy.teamsOwnerTag}` : ""));
        card.appendChild(head);
        renderRoster(card, members, team);
        renderAttachments(card, team, attachments, ownGardens, sharedGardens);
        if (owner) {
            renderSent(card, sent);
            const inviteRow = el("div", "logrow");
            const email = el("input");
            email.type = "email";
            email.placeholder = copy.teamsInvitePlaceholder;
            email.style.width = "12rem";
            const invite = el("button", undefined, copy.teamsInviteBtn);
            invite.type = "button";
            invite.addEventListener("click", () => void guard(invite, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                const addr = email.value.trim();
                if (!addr)
                    throw new Error("enter an email to invite");
                await mintInvite(c, s, team.id, addr);
                email.value = "";
                report(copy.teamsInviteSentNote);
                await refresh();
            }));
            inviteRow.append(email, invite);
            card.appendChild(inviteRow);
            const manage = el("div", "logrow");
            const del = el("button", undefined, copy.teamsDeleteBtn);
            del.type = "button";
            del.addEventListener("click", () => void guard(del, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                await deleteTeam(c, s, team.id);
                toast(`Deleted ${team.name}`);
                await refresh();
            }));
            const rename = el("button", undefined, copy.teamsRenameBtn);
            rename.type = "button";
            rename.addEventListener("click", () => void guard(rename, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                const next = (window.prompt("Rename this circle", team.name) ?? "").trim();
                if (!next || next === team.name)
                    return;
                await renameTeam(c, s, team.id, next);
                await refresh();
            }));
            manage.append(rename, del);
            card.appendChild(manage);
        }
        else {
            const leaveRow = el("div", "logrow");
            const leave = el("button", undefined, copy.teamsLeaveBtn);
            leave.type = "button";
            leave.addEventListener("click", () => void guard(leave, async () => {
                const s = deps.session(), c = deps.cfg();
                if (!c || !s)
                    throw new Error("sign in first");
                await leaveTeam(c, s, team.id);
                deps.onSharedChange();
                toast(`Left ${team.name}`);
                await refresh();
            }));
            leaveRow.appendChild(leave);
            card.appendChild(leaveRow);
        }
        return card;
    };
    const refresh = async () => {
        const c = deps.cfg(), s = deps.session();
        const list = $("teamlist"), invBox = $("teaminvites");
        if (!list)
            return;
        if (!c || !s) {
            list.innerHTML = "";
            if (invBox)
                invBox.innerHTML = "";
            return;
        }
        let teams, invites;
        try {
            [teams, invites] = await Promise.all([listTeams(c, s), listMyInvites(c, s)]);
        }
        catch (e) {
            report(e instanceof Error ? e.message : String(e));
            return;
        }
        renderInvites(invites);
        const owned = new Set(teams.filter((t) => isMe(t.owner_id, t.owner_email)).map((t) => t.id));
        const rosters = await Promise.all(teams.map((t) => listMembers(c, s, t.id).catch(() => [])));
        const sents = await Promise.all(teams.map((t) => owned.has(t.id) ? listSentInvites(c, s, t.id).catch(() => []) : Promise.resolve([])));
        const attachAll = await Promise.all(teams.map((t) => listAttachments(c, s, t.id).catch(() => [])));
        const ownGardens = await deps.listOwnGardens().catch(() => []);
        const sharedGardens = await deps.listSharedGardens().catch(() => []);
        list.innerHTML = "";
        if (!teams.length) {
            list.appendChild(el("p", "hint", copy.teamsEmpty));
            return;
        }
        teams.forEach((t, i) => list.appendChild(renderTeam(t, rosters[i], sents[i], attachAll[i], ownGardens, sharedGardens)));
    };
    createBtn?.addEventListener("click", () => void guard(createBtn, async () => {
        const c = deps.cfg(), s = deps.session();
        if (!c || !s)
            throw new Error("sign in first");
        const name = (nameInput?.value ?? "").trim();
        if (!name)
            throw new Error("name the circle first");
        await createTeam(c, s, name);
        if (nameInput)
            nameInput.value = "";
        toast(`Created ${name}`);
        await refresh();
    }));
    deps.onAuthChange(() => void refresh());
    void refresh();
    return { refresh };
}
