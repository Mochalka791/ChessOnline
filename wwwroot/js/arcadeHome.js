export function setBodyClass(active) {
    if (typeof document === "undefined" || !document.body) {
        return;
    }

    document.body.classList.toggle("arcade-home", !!active);
}
