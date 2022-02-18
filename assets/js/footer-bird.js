const footerBird = document.querySelector("#footer .footer-sprite");
const cls = footerBird.classList;
const hoverClass = "hover";

const cooldownMs = 200;
let lastCooldown = -1;

// add random bird
cls.add(`footer-sprite-${Math.random() < 0.5 ? "owl" : "crow"}`);

const cooldownExpired = () => {
    return Date.now() > lastCooldown + cooldownMs;
}

const handleTouchStop = () => {
    if (!cooldownExpired()) {
        return;
    }

    cls.remove(hoverClass);
    lastCooldown = Date.now();
}

footerBird.addEventListener("touchstart", () => {
    if (cooldownExpired()) {
        cls.add(hoverClass);
    }
}, false);

footerBird.addEventListener("touchcancel", handleTouchStop, false);
footerBird.addEventListener("touchend", handleTouchStop, false);