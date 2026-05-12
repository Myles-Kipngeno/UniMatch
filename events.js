import { auth, db } from "./firebase.js";
import {
  collection, addDoc, deleteDoc,
  doc, getDoc, getDocs,
  query, where, orderBy,
  onSnapshot, serverTimestamp, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAuth } from "./auth-guard.js";

// ─── DOM ───
const eventsGrid     = document.getElementById("eventsGrid");
const loadingState   = document.getElementById("loadingState");
const emptyState     = document.getElementById("emptyState");
const createModal    = document.getElementById("createModal");
const detailModal    = document.getElementById("detailModal");
const createForm     = document.getElementById("createEventForm");
const openCreateBtn  = document.getElementById("openCreateBtn");
const closeCreateBtn = document.getElementById("closeCreateBtn");
const cancelCreateBtn= document.getElementById("cancelCreateBtn");
const emptyCreateBtn = document.getElementById("emptyCreateBtn");
const closeDetailBtn = document.getElementById("closeDetailBtn");
const descTextarea   = document.getElementById("eventDesc");
const descCount      = document.getElementById("descCount");
const rsvpBtn        = document.getElementById("rsvpBtn");
const rsvpBtnText    = document.getElementById("rsvpBtnText");
const deleteEventBtn = document.getElementById("deleteEventBtn");

const CATEGORY_LABELS = {
  study: "📚 Study", social: "🎉 Social",
  sports: "⚽ Sports", academic: "🎓 Academic", other: "✨ Other"
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let currentUser   = null;
let currentFilter = "all";
let allEvents     = [];
let activeEventId = null;

// ─── BOOT ───
(async () => {
  try {
    currentUser = await requireAuth();
    setupUI();
    listenEvents();
  } catch (err) {
    console.error("Events boot error:", err);
    window.location.replace("login.html");
  }
})();

// ─── REAL-TIME EVENTS LISTENER ───
function listenEvents() {
  const q = query(
    collection(db, "events"),
    orderBy("date", "asc")
  );

  onSnapshot(q, async snap => {
    if (loadingState) loadingState.style.display = "none";

    allEvents = [];
    for (const docSnap of snap.docs) {
      allEvents.push({ id: docSnap.id, ...docSnap.data() });
    }

    renderEvents();
  }, err => {
    console.error("Events listener error:", err);
    if (loadingState) loadingState.style.display = "none";
  });
}

// ─── RENDER EVENTS ───
function renderEvents() {
  eventsGrid.querySelectorAll(".event-card").forEach(c => c.remove());

  const now = new Date();

  const filtered = allEvents.filter(ev => {
    if (currentFilter !== "all" && ev.category !== currentFilter) return false;
    // Keep event visible until midnight at the END of the event day
    const evMidnight = new Date(ev.date + "T23:59:59");
    return evMidnight > now;
  });

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  filtered.forEach((ev, i) => {
    const card = buildEventCard(ev, i);
    eventsGrid.appendChild(card);
  });
}

// ─── BUILD EVENT CARD ───
function buildEventCard(ev, index) {
  const card = document.createElement("div");
  card.className = `event-card cat-${ev.category || "other"}`;
  card.style.animationDelay = `${index * 0.07}s`;

  const evDate  = new Date(ev.date);
  const day     = evDate.getDate();
  const month   = MONTHS[evDate.getMonth()];
  const timeStr = formatTime(ev.time);
  const count   = (ev.attendees || []).length;
  const isGoing = currentUser && (ev.attendees || []).includes(currentUser.uid);

  const pips = Math.min(count, 3);
  const pipHTML = Array.from({length: pips}, () => `<div class="pip"></div>`).join("");

  const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

  card.innerHTML = `
    <div class="card-top"></div>
    <div class="card-content">
      <div class="card-head">
        <span class="card-category">${CATEGORY_LABELS[ev.category] || ev.category}</span>
        <div class="card-date-badge">
          <div class="date-day">${day}</div>
          <div class="date-month">${month}</div>
        </div>
      </div>
      <div class="card-title">${escHtml(ev.title)}</div>
      <div class="card-meta">
        <div class="meta-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          ${timeStr}
        </div>
        <div class="meta-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.134 2 5 5.134 5 9c0 6.25 7 13 7 13s7-6.75 7-13c0-3.866-3.134-7-7-7z" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          ${escHtml(ev.location)}
        </div>
      </div>
    </div>
    <div class="card-footer">
      <div class="host-row">
        <img class="host-thumb" src="${ev.hostPhoto || DEFAULT_AVATAR}"
             alt="${escHtml(ev.hostName || '')}"
             onerror="this.src='${DEFAULT_AVATAR}'">
        <span class="host-name-sm">${escHtml(ev.hostName || "Unknown")}</span>
      </div>
      <div class="attendee-count">
        ${pipHTML}
        <span>${count} going</span>
        ${isGoing ? '<span class="rsvp-tag">You\'re in</span>' : ""}
      </div>
    </div>`;

  card.onclick = () => openDetailModal(ev.id);
  return card;
}

// ─── OPEN DETAIL MODAL ───
async function openDetailModal(eventId) {
  activeEventId = eventId;
  const ev = allEvents.find(e => e.id === eventId);
  if (!ev) return;

  const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

  const bar = document.getElementById("detailCategoryBar");
  bar.className = `detail-category-bar cat-${ev.category || "other"}`;

  document.getElementById("detailCategory").textContent = CATEGORY_LABELS[ev.category] || ev.category;
  document.getElementById("detailTitle").textContent    = ev.title;

  const evDate = new Date(ev.date);
  document.getElementById("detailDateTag").textContent =
    `${evDate.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}`;
  document.getElementById("detailDateTime").textContent =
    `${evDate.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })} at ${formatTime(ev.time)}`;
  document.getElementById("detailLocation").textContent  = ev.location;

  const count    = (ev.attendees || []).length;
  const maxStr   = ev.maxAttendees ? ` / ${ev.maxAttendees} max` : "";
  document.getElementById("detailAttendees").textContent = `${count} attending${maxStr}`;

  const descEl = document.getElementById("detailDesc");
  if (ev.description) {
    descEl.textContent = ev.description;
    descEl.style.display = "block";
  } else {
    descEl.style.display = "none";
  }

  document.getElementById("detailHostName").textContent = ev.hostName || "Unknown";
  const hostAvatar = document.getElementById("detailHostAvatar");
  hostAvatar.src = ev.hostPhoto || DEFAULT_AVATAR;
  hostAvatar.onerror = () => { hostAvatar.src = DEFAULT_AVATAR; };

  await renderAttendeeChips(ev.attendees || []);

  const isGoing = currentUser && (ev.attendees || []).includes(currentUser.uid);
  updateRsvpBtn(isGoing, count, ev.maxAttendees);

  const isHost = currentUser && ev.hostId === currentUser.uid;
  deleteEventBtn.style.display = isHost ? "block" : "none";

  detailModal.style.display = "flex";
}

async function renderAttendeeChips(attendeeUids) {
  const row = document.getElementById("attendeesRow");
  const section = document.getElementById("attendeesSection");
  row.innerHTML = "";

  const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

  if (attendeeUids.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  const toShow = attendeeUids.slice(0, 8);

  for (const uid of toShow) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : {};
      const chip = document.createElement("div");
      chip.className = "attendee-chip";
      chip.innerHTML = `
        <img src="${data.photoURL || DEFAULT_AVATAR}"
             alt="${escHtml(data.name || 'User')}"
             onerror="this.src='${DEFAULT_AVATAR}'">
        ${escHtml(data.name || "Student")}`;
      row.appendChild(chip);
    } catch (_) {}
  }

  if (attendeeUids.length > 8) {
    const more = document.createElement("div");
    more.className = "attendee-chip";
    more.textContent = `+${attendeeUids.length - 8} more`;
    row.appendChild(more);
  }
}

function updateRsvpBtn(isGoing, count, maxAttendees) {
  const full = maxAttendees && count >= maxAttendees && !isGoing;
  rsvpBtn.className = `btn-rsvp${isGoing ? " going" : ""}`;
  rsvpBtn.disabled  = full;
  rsvpBtnText.textContent = isGoing
    ? "✓ You're going — Cancel RSVP"
    : full
      ? "Event is full"
      : "RSVP — I'm going";
}

// ─── RSVP ───
rsvpBtn.addEventListener("click", async () => {
  if (!currentUser || !activeEventId) return;
  rsvpBtn.disabled = true;

  const ev = allEvents.find(e => e.id === activeEventId);
  if (!ev) { rsvpBtn.disabled = false; return; }

  const isGoing = (ev.attendees || []).includes(currentUser.uid);
  const evRef   = doc(db, "events", activeEventId);

  try {
    if (isGoing) {
      await updateDoc(evRef, { attendees: arrayRemove(currentUser.uid) });
      ev.attendees = (ev.attendees || []).filter(u => u !== currentUser.uid);
    } else {
      await updateDoc(evRef, { attendees: arrayUnion(currentUser.uid) });
      ev.attendees = [...(ev.attendees || []), currentUser.uid];
    }

    const newCount = (ev.attendees || []).length;
    const nowGoing = !isGoing;
    updateRsvpBtn(nowGoing, newCount, ev.maxAttendees);
    document.getElementById("detailAttendees").textContent =
      `${newCount} attending${ev.maxAttendees ? ` / ${ev.maxAttendees} max` : ""}`;
    await renderAttendeeChips(ev.attendees || []);
    renderEvents();
  } catch (err) {
    console.error("RSVP error:", err);
    alert("Failed to RSVP. Please try again.");
  }

  rsvpBtn.disabled = false;
});

// ─── DELETE EVENT ───
deleteEventBtn.addEventListener("click", async () => {
  if (!activeEventId) return;
  if (!confirm("Delete this event? This cannot be undone.")) return;

  try {
    await deleteDoc(doc(db, "events", activeEventId));
    closeDetail();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete event.");
  }
});

// ─── CREATE EVENT ───
function setupUI() {
  const dateInput = document.getElementById("eventDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
  }

  if (descTextarea) {
    descTextarea.addEventListener("input", () => {
      descCount.textContent = descTextarea.value.length;
    });
  }

  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      renderEvents();
    });
  });

  openCreateBtn?.addEventListener("click",  openCreate);
  emptyCreateBtn?.addEventListener("click", openCreate);
  closeCreateBtn?.addEventListener("click", closeCreate);
  cancelCreateBtn?.addEventListener("click", closeCreate);
  closeDetailBtn?.addEventListener("click",  closeDetail);

  createModal?.addEventListener("click", e => { if (e.target === createModal) closeCreate(); });
  detailModal?.addEventListener("click", e => { if (e.target === detailModal) closeDetail(); });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (createModal?.style.display !== "none") closeCreate();
      if (detailModal?.style.display !== "none") closeDetail();
    }
  });
}

function openCreate() {
  createForm.reset();
  if (descCount) descCount.textContent = "0";
  createModal.style.display = "flex";
}

function closeCreate() { createModal.style.display = "none"; }
function closeDetail()  { detailModal.style.display = "none"; activeEventId = null; }

// ─── FORM SUBMIT ───
createForm.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = document.getElementById("submitEventBtn");
  btn.disabled = true;
  btn.textContent = "Publishing...";

  const title        = document.getElementById("eventTitle").value.trim();
  const category     = document.getElementById("eventCategory").value;
  const date         = document.getElementById("eventDate").value;
  const time         = document.getElementById("eventTime").value;
  const location     = document.getElementById("eventLocation").value.trim();
  const description  = document.getElementById("eventDesc").value.trim();
  const maxRaw       = document.getElementById("eventMax").value;
  const maxAttendees = maxRaw ? parseInt(maxRaw) : null;

  if (!title || !category || !date || !time || !location) {
    alert("Please fill in all required fields.");
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Publish Event`;
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    await addDoc(collection(db, "events"), {
      title,
      category,
      date,
      time,
      location,
      description,
      maxAttendees,
      hostId:    currentUser.uid,
      hostName:  userData.name    || "Unknown",
      hostPhoto: userData.photoURL || null,
      campus:    userData.campus  || null,
      attendees: [currentUser.uid],
      createdAt: serverTimestamp()
    });

    closeCreate();
  } catch (err) {
    console.error("Create event error:", err);
    alert(`Failed to create event: ${err.message}`);
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Publish Event`;
});

// ─── HELPERS ───
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour  = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}