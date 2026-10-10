// ====== Shared helpers (used by every page) ======
const API =  "https://electriccitytracker-backend.onrender.com/api";   // change if your backend runs elsewhere
const getToken = () => localStorage.getItem("token");
const getUser = () => JSON.parse(localStorage.getItem("user") || "null");

async function api(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  if (getToken()) headers.Authorization = "Bearer " + getToken();
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw { message: "Cannot reach the server. Is the Spring Boot backend running on port 8080?" };
  }
  if (res.status === 401 && !location.pathname.endsWith("login.html")) { logout(); throw { message: "Session expired" }; }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw data || { message: "Request failed (" + res.status + ")" };
  return data;
}

function requireAuth() { if (!getToken()) location.href = "login.html"; }
function logout() { localStorage.clear(); location.href = "login.html"; }

function renderNav(active) {
  const links = [["dashboard", "Dashboard"], ["meter", "Meter Reading"], ["add-bill", "Add Bill"],
                 ["history", "Bill History"], ["appliances", "Appliance Calculator"], ["profile", "Profile"]];
  document.getElementById("nav").innerHTML =
    `<nav><span class="brand">⚡ Electricity Tracker</span>` +
    links.map(([p, t]) => `<a href="${p}.html" class="${p === active ? "active" : ""}">${t}</a>`).join("") +
    `<span class="spacer"></span><button onclick="logout()">Log out</button></nav>`;
}

const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = n => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);

function showMsg(text, ok = true, id = "msg") {
  const el = document.getElementById(id);
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Show per-field server errors (error.errors = {field: message}) next to inputs
function showErrors(err, form) {
  clearErrors(form);
  const fields = err.errors || {};
  Object.entries(fields).forEach(([f, m]) => {
    const input = form.querySelector(`[name="${f}"]`);
    if (input) { input.classList.add("invalid"); const e = form.querySelector(`[data-err="${f}"]`); if (e) e.textContent = m; }
  });
  showMsg(err.message || "Something went wrong", false);
}
function clearErrors(form) {
  form.querySelectorAll(".invalid").forEach(i => i.classList.remove("invalid"));
  form.querySelectorAll(".field-error").forEach(e => e.textContent = "");
}
// Client-side checks. rules: {field: [fn(value, formData) => errorMessage|null]}
function validate(form, rules) {
  clearErrors(form);
  let ok = true;
  const data = Object.fromEntries(new FormData(form));
  for (const [f, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const m = check(data[f], data);
      if (m) {
        ok = false;
        form.querySelector(`[name="${f}"]`).classList.add("invalid");
        const e = form.querySelector(`[data-err="${f}"]`); if (e) e.textContent = m;
        break;
      }
    }
  }
  if (!ok) showMsg("Please correct the highlighted fields", false);
  return ok ? data : null;
}
const R = {
  required: l => v => (v == null || String(v).trim() === "") ? l + " is required" : null,
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "") ? null : "Enter a valid email address",
  positive: l => v => (Number(v) > 0) ? null : l + " must be a positive number",
  nonNegative: l => v => (v !== "" && Number(v) >= 0) ? null : l + " must be zero or positive",
  minLen: n => v => (v || "").length >= n ? null : "Must be at least " + n + " characters",
  max: (n, l) => v => Number(v) <= n ? null : l + " cannot exceed " + n,
  notLower: (a, b) => (v, d) => Number(d[b]) >= Number(d[a]) ? null : "Current reading cannot be lower than previous reading",
};