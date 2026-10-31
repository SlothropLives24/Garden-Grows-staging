import './chunk-lutet8cz.js';
import { fillCopy, copy } from './paint.js';
import { MONTHS, daysBetween } from './core.js';

const DAYS_SHORT = [copy.clDaySun, copy.clDayMon, copy.clDayTue, copy.clDayWed, copy.clDayThu, copy.clDayFri, copy.clDaySat];
function dayHeading(dateIso, todayIso) {
    const d = new Date(`${dateIso}T12:00:00`);
    const label = fillCopy("clDayLabel", { weekday: DAYS_SHORT[d.getDay()], month: MONTHS[d.getMonth()].slice(0, 3), day: d.getDate() });
    const gap = daysBetween(todayIso, dateIso);
    return gap === 0 ? fillCopy("clToday", { label }) : gap === 1 ? fillCopy("clTomorrow", { label }) : label;
}

export { dayHeading };
