document.documentElement.classList.remove("no-js");
const menuButton = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("#main-nav");
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "Close −" : "Menu +";
  nav.classList.toggle("is-open", open);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menuButton?.getAttribute("aria-expanded") === "true"
  ) {
    menuButton.click();
    menuButton.focus();
  }
});
document
  .querySelector("[data-print]")
  ?.addEventListener("click", () => window.print());
document
  .querySelector("[data-copy-email]")
  ?.addEventListener("click", async () => {
    const status = document.querySelector("[data-copy-status]");
    try {
      await navigator.clipboard.writeText("carlodoroff@gmail.com");
      status.textContent = "Email address copied.";
    } catch {
      status.textContent = "Select and copy: carlodoroff@gmail.com";
    }
  });
const form = document.querySelector("#contact-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const subject = `${data.get("topic")} — ${data.get("name")}`;
  const body = `Hi Carlo,\n\n${data.get("message")}\n\n${data.get("name")}\n${data.get("email")}`;
  const href = `mailto:carlodoroff@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const fallback = document.querySelector("[data-email-draft]");
  fallback.href = href;
  fallback.hidden = false;
  document.querySelector("[data-form-status]").textContent =
    "Your email draft is ready. Send it from your email app to finish.";
  window.location.href = href;
});
