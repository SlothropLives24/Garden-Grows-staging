function dayOfYearIso(iso) {
    const y = Number(iso.slice(0, 4));
    return Math.round((Date.UTC(y, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(y, 0, 0)) / 86400000);
}

export { dayOfYearIso };
