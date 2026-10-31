import './chunk-lutet8cz.js';
import { loadSync, el, toast, orderGardens, defaultPlotId } from './core.js';
import { copy, fillCopy } from './paint.js';
import './chunk-l5cseoso.js';

const $ = (id) => document.getElementById(id);
const dismissed = new Set();
class Say extends Error {
}
const say = (line) => new Say(line);
const joinFailed = (detail) => /invite not found|not addressed/i.test(detail) ? copy.acTeamInviteGone : copy.acTeamActionFailed;
function fillNodes(parent, template, nodes) {
    for (const part of template.split(/(\{\w+\})/)) {
        const k = /^\{(\w+)\}$/.exec(part)?.[1];
        if (k && k in nodes)
            parent.appendChild(nodes[k]);
        else if (part)
            parent.appendChild(document.createTextNode(part));
    }
}
function initTeams(deps) {
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
    const guard = async (btn, fn, failed) => {
        const label = btn?.textContent ?? "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = copy.acWorking;
        }
        try {
            report("");
            await fn();
        }
        catch (e) {
            if (e instanceof Say)
                report(e.message);
            else {
                const detail = e instanceof Error ? e.message : String(e);
                console.warn("[garden circles]", detail);
                report(failed?.(detail) ?? copy.acTeamActionFailed);
            }
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
            const name = iv.teams?.name ?? copy.acTeamACircle;
            const line = el("p");
            const owner = iv.teams?.owner_email;
            fillNodes(line, owner ? fillCopy("acTeamInvitedBy", { email: owner }) : copy.acTeamInvitedYou, { circle: el("b", undefined, name) });
            card.appendChild(line);
            const row = el("div", "logrow");
            const join = el("button", "btn btn-primary primary", copy.teamsAcceptBtn);
            join.type = "button";
            join.addEventListener("click", () => void guard(join, async () => {
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                await (await loadSync()).acceptInvite(c, s, iv.id);
                deps.onSharedChange();
                toast(fillCopy("acTeamJoinedToast", { name }));
                await refresh();
            }, joinFailed));
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
        roster.appendChild(el("p", "teammember", fillCopy("acTeamTagged", { name: team.owner_email ?? copy.acTeamTheOwner, tags: ownerTags.join(", ") })));
        for (const m of members) {
            if (m.member_id === team.owner_id)
                continue;
            const tags = [isMe(m.member_id, m.member_email) ? copy.teamsYouTag : ""].filter(Boolean);
            const who = m.member_email ?? copy.acTeamAMember;
            const label = tags.length ? fillCopy("acTeamTagged", { name: who, tags: tags.join(", ") }) : who;
            roster.appendChild(el("p", "teammember", label));
        }
        card.appendChild(roster);
    };
    const renderSent = (card, sent) => {
        for (const iv of sent) {
            const row = el("div", "logrow teampending");
            row.appendChild(el("span", "hint", fillCopy("acTeamPendingRow", { email: iv.invited_email, status: copy.teamsPendingLabel })));
            const cancel = el("button", undefined, copy.teamsRevokeBtn);
            cancel.type = "button";
            cancel.addEventListener("click", () => void guard(cancel, async () => {
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                await (await loadSync()).revokeInvite(c, s, iv.id);
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
        const labelOf = (a) => a.owner_id === me ? (ownGardens.find((g) => g.id === a.plot)?.name ?? a.plot)
            : (sharedGardens.find((g) => g.ownerId === a.owner_id && g.plot === a.plot)?.name ?? a.plot);
        const ordered = orderGardens(attachments, (a) => a.owner_id === me ? { id: a.plot, name: labelOf(a) }
            : { id: `${a.owner_id}:${a.plot}`, name: labelOf(a), shared: true }, defaultPlotId());
        for (const a of ordered) {
            const mine = a.owner_id === me;
            const label = labelOf(a);
            const row = el("div", "logrow teampending");
            row.appendChild(el("span", "teammember", mine ? fillCopy("acTeamTagged", { name: label, tags: copy.teamsYouTag }) : label));
            if (mine || iOwnTeam) {
                const detach = el("button", undefined, copy.teamsDetachBtn);
                detach.type = "button";
                detach.addEventListener("click", () => void guard(detach, async () => {
                    const s = await deps.fresh(), c = deps.cfg();
                    if (!c || !s)
                        throw say(copy.acErrSignInFirst);
                    await (await loadSync()).detachGarden(c, s, team.id, a.owner_id, a.plot);
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
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                await (await loadSync()).attachGarden(c, s, team.id, sel.value);
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
        head.appendChild(el("span", "hint", owner ? fillCopy("acTeamHeadOwner", { tag: copy.teamsOwnerTag }) : ""));
        card.appendChild(head);
        renderRoster(card, members, team);
        renderAttachments(card, team, attachments, ownGardens, sharedGardens);
        if (owner) {
            renderSent(card, sent);
            const inviteRow = el("div", "logrow");
            const email = el("input");
            email.type = "email";
            email.placeholder = copy.teamsInvitePlaceholder;
            const invite = el("button", undefined, copy.teamsInviteBtn);
            invite.type = "button";
            invite.addEventListener("click", () => void guard(invite, async () => {
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                const addr = email.value.trim();
                if (!addr)
                    throw say(copy.acTeamErrEnterEmail);
                await (await loadSync()).mintInvite(c, s, team.id, addr);
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
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                await (await loadSync()).deleteTeam(c, s, team.id);
                toast(fillCopy("acTeamDeletedToast", { name: team.name }));
                await refresh();
            }));
            const rename = el("button", undefined, copy.teamsRenameBtn);
            rename.type = "button";
            rename.addEventListener("click", () => void guard(rename, async () => {
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                const next = (window.prompt(copy.acTeamRenamePrompt, team.name) ?? "").trim();
                if (!next || next === team.name)
                    return;
                await (await loadSync()).renameTeam(c, s, team.id, next);
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
                const s = await deps.fresh(), c = deps.cfg();
                if (!c || !s)
                    throw say(copy.acErrSignInFirst);
                await (await loadSync()).leaveTeam(c, s, team.id);
                deps.onSharedChange();
                toast(fillCopy("acTeamLeftToast", { name: team.name }));
                await refresh();
            }));
            leaveRow.appendChild(leave);
            card.appendChild(leaveRow);
        }
        return card;
    };
    const refresh = async () => {
        const c = deps.cfg(), s = await deps.fresh().catch(() => null);
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
        let wire;
        try {
            wire = await loadSync();
            [teams, invites] = await Promise.all([wire.listTeams(c, s), wire.listMyInvites(c, s)]);
        }
        catch (e) {
            console.warn("[garden circles]", e instanceof Error ? e.message : e);
            report(copy.teamsLoadFailed);
            return;
        }
        renderInvites(invites);
        const owned = new Set(teams.filter((t) => isMe(t.owner_id, t.owner_email)).map((t) => t.id));
        const rosters = await Promise.all(teams.map((t) => wire.listMembers(c, s, t.id).catch(() => [])));
        const sents = await Promise.all(teams.map((t) => owned.has(t.id) ? wire.listSentInvites(c, s, t.id).catch(() => []) : Promise.resolve([])));
        const attachAll = await Promise.all(teams.map((t) => wire.listAttachments(c, s, t.id).catch(() => [])));
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
        const c = deps.cfg(), s = await deps.fresh().catch(() => null);
        if (!c || !s)
            throw say(copy.acErrSignInFirst);
        const name = (nameInput?.value ?? "").trim();
        if (!name)
            throw say(copy.acTeamErrNameFirst);
        await (await loadSync()).createTeam(c, s, name);
        if (nameInput)
            nameInput.value = "";
        toast(fillCopy("acTeamCreatedToast", { name }));
        await refresh();
    }));
    deps.onAuthChange(() => void refresh());
    void refresh();
    return { refresh };
}

export { initTeams };
