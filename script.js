const EMAIL = "shivamrajput.datascientist@gmail.com";

const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

menuBtn?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(isOpen));
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
  });
});

const revealItems = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -70px 0px" }
);
revealItems.forEach((item) => revealObserver.observe(item));

const commandText = document.getElementById("commandText");
const messages = ["Build → Debug → Explain", "Data → Model → App", "RAG → Sources → Answer", "No fake claims"];
let messageIndex = 0;
setInterval(() => {
  if (!commandText) return;
  messageIndex = (messageIndex + 1) % messages.length;
  commandText.textContent = messages[messageIndex];
}, 1800);

const toast = document.getElementById("toast");
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    showToast("Email copied");
  } catch {
    window.location.href = `mailto:${EMAIL}`;
  }
}
document.getElementById("copyEmailContact")?.addEventListener("click", copyEmail);

document.getElementById("contactForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("nameInput").value.trim();
  const subject = document.getElementById("subjectInput").value.trim() || "Internship Opportunity - Shivam Rajput";
  const message = document.getElementById("messageInput").value.trim() || "Hi Shivam, I saw your portfolio and wanted to discuss an opportunity.";
  const body = `${message}\n\n${name ? `Regards,\n${name}` : ""}`;
  window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxClose = document.getElementById("lightboxClose");

document.querySelectorAll("[data-full]").forEach((button) => {
  button.addEventListener("click", () => {
    const src = button.getAttribute("data-full");
    const caption = button.getAttribute("data-caption") || "";
    lightboxImage.src = src;
    lightboxImage.alt = caption;
    lightboxCaption.textContent = caption;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  });
});

function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.src = "";
}

lightboxClose?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox.classList.contains("open")) closeLightbox();
});

document.getElementById("year").textContent = new Date().getFullYear();
