import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

// DOM refs
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

// BOOT
(async () => {
  try {
    currentUser = await requireAuth();
    setupUI();
    loadEvents();
    setupRealtimeEvents();
  } catch (err) {
    console.error("Events boot error:", err);
    window.location.replace("login.html");
  }
})();

async function loadEvents() {
  try {
    const { data: events, error } = await supabase
      .from("events")
      .select("*, creator:profiles!events_creator_id_fkey(name, photo_url)")
      .order("date", { ascending: true });

    if (loadingState) loadingState.style.display = "none";
    if (error) {
      console.warn("Events load warning (Table may be newly initialized):", error);
      renderEvents([]);
      return;
    }

    allEvents = events || [];
    renderEvents(allEvents);
  } catch (err) {
    console.error("Load events error:", err);
    if (loadingState) loadingState.style.display = "none";
  }
}

function setupRealtimeEvents() {
  supabase
    .channel("events_realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadEvents())
    .subscribe();
}

function setupUI() {
  if (openCreateBtn) openCreateBtn.onclick = () => openCreateModal();
  if (emptyCreateBtn) emptyCreateBtn.onclick = () => openCreateModal();
  if (closeCreateBtn) closeCreateBtn.onclick = () => closeCreateModal();
  if (cancelCreateBtn) cancelCreateBtn.onclick = () => closeCreateModal();
  if (closeDetailBtn) closeDetailBtn.onclick = () => closeDetailModal();

  if (createModal) {
    createModal.onclick = (e) => { if (e.target === createModal) closeCreateModal(); };
  }
  if (detailModal) {
    detailModal.onclick = (e) => { if (e.target === detailModal) closeDetailModal(); };
  }

  document.querySelectorAll(".chip[data-filter]").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".chip[data-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      filterAndRender();
    };
  });

  if (descTextarea && descCount) {
    descTextarea.oninput = () => {
      descCount.textContent = descTextarea.value.length;
    };
  }

  if (createForm) createForm.onsubmit = handleCreateEvent;
  if (rsvpBtn) rsvpBtn.onclick = handleRSVP;
  if (deleteEventBtn) deleteEventBtn.onclick = handleDeleteEvent;
}

function openCreateModal() {
  if (createForm) createForm.reset();
  if (descCount) descCount.textContent = "0";
  if (createModal) createModal.classList.add("active");
}

function closeCreateModal() {
  if (createModal) createModal.classList.remove("active");
}

function closeDetailModal() {
  if (detailModal) detailModal.classList.remove("active");
  activeEventId = null;
}

function filterAndRender() {
  let list = allEvents;
  if (currentFilter !== "all") {
    list = list.filter(ev => ev.category === currentFilter);
  }
  renderEvents(list);
}

function renderEvents(events) {
  if (!eventsGrid) return;
  eventsGrid.innerHTML = "";

  if (!events.length) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  events.forEach(ev => {
    eventsGrid.appendChild(buildEventCard(ev));
  });
}

function buildEventCard(ev) {
  const card = document.createElement("div");
  card.className = "event-card";

  const evDate = ev.date ? new Date(ev.date) : new Date();
  const day    = evDate.getDate();
  const month  = MONTHS[evDate.getMonth()];
  const timeStr= evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rsvps = ev.rsvps || [];
  const isGoing = rsvps.includes(currentUser.id);
  const catLabel = CATEGORY_LABELS[ev.category] || "✨ Event";

  card.innerHTML = `
    <div class="event-card-header">
      <div class="event-date-badge">
        <span class="event-date-day">${day}</span>
        <span class="event-date-month">${month}</span>
      </div>
      <span class="event-category-pill category-${ev.category || 'other'}">${catLabel}</span>
    </div>
    <div class="event-card-body">
      <h3 class="event-title">${esc(ev.title)}</h3>
      <div class="event-meta">
        <div class="event-meta-item">📍 ${esc(ev.location || "Campus")}</div>
        <div class="event-meta-item">⏰ ${timeStr}</div>
      </div>
      <p class="event-desc-preview">${esc(ev.description || "")}</p>
    </div>
    <div class="event-card-footer">
      <div class="event-creator">
        <img class="event-creator-avatar" src="${ev.creator?.photo_url || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjwvc3ZnPg=='}" alt="Creator">
        <span class="event-creator-name">${esc(ev.creator?.name || "Student")}</span>
      </div>
      <button class="rsvp-mini-btn ${isGoing ? 'going' : ''}">
        ${isGoing ? '✓ Going' : 'RSVP'} (${rsvps.length})
      </button>
    </div>
  `;

  card.onclick = () => openEventDetail(ev);
  return card;
}

function openEventDetail(ev) {
  activeEventId = ev.id;
  const evDate = ev.date ? new Date(ev.date) : new Date();
  const day    = evDate.getDate();
  const month  = MONTHS[evDate.getMonth()];
  const timeStr= evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const detailDay = document.getElementById("detailDay");
  const detailMonth = document.getElementById("detailMonth");
  const detailTitle = document.getElementById("detailTitle");
  const detailCategory = document.getElementById("detailCategory");
  const detailLocation = document.getElementById("detailLocation");
  const detailTime = document.getElementById("detailTime");
  const detailCreatorName = document.getElementById("detailCreatorName");
  const detailDesc = document.getElementById("detailDesc");
  const rsvpCount = document.getElementById("rsvpCount");

  if (detailDay) detailDay.textContent = day;
  if (detailMonth) detailMonth.textContent = month;
  if (detailTitle) detailTitle.textContent = ev.title;
  if (detailCategory) detailCategory.textContent = CATEGORY_LABELS[ev.category] || "✨ Event";
  if (detailLocation) detailLocation.textContent = ev.location || "Campus";
  if (detailTime) detailTime.textContent = timeStr;
  if (detailCreatorName) detailCreatorName.textContent = ev.creator?.name || "Student";
  if (detailDesc) detailDesc.textContent = ev.description || "No description provided.";

  const rsvps = ev.rsvps || [];
  const isGoing = rsvps.includes(currentUser.id);

  if (rsvpCount) rsvpCount.textContent = `${rsvps.length} attending`;
  if (rsvpBtn) {
    rsvpBtn.className = `btn btn-primary ${isGoing ? 'going' : ''}`;
    if (rsvpBtnText) rsvpBtnText.textContent = isGoing ? "✓ You're Going" : "I'm Going!";
  }

  if (deleteEventBtn) {
    deleteEventBtn.style.display = ev.creator_id === currentUser.id ? "inline-flex" : "none";
  }

  if (detailModal) detailModal.classList.add("active");
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const title = document.getElementById("eventTitle").value.trim();
  const category = document.getElementById("eventCategory").value;
  const dateVal = document.getElementById("eventDate").value;
  const timeVal = document.getElementById("eventTime").value;
  const location = document.getElementById("eventLocation").value.trim();
  const description = document.getElementById("eventDesc").value.trim();

  if (!title || !dateVal || !timeVal || !location) {
    alert("Please fill in all required fields.");
    return;
  }

  const dateObj = new Date(`${dateVal}T${timeVal}`);

  try {
    const { error } = await supabase.from("events").insert({
      creator_id: currentUser.id,
      title,
      category,
      date: dateObj.toISOString(),
      location,
      description,
      rsvps: [currentUser.id]
    });

    if (error) throw error;

    closeCreateModal();
    loadEvents();
  } catch (err) {
    console.error("Create event error:", err);
    alert(err.message || "Failed to create event.");
  }
}

async function handleRSVP() {
  if (!activeEventId) return;
  const ev = allEvents.find(e => e.id === activeEventId);
  if (!ev) return;

  const rsvps = new Set(ev.rsvps || []);
  if (rsvps.has(currentUser.id)) {
    rsvps.delete(currentUser.id);
  } else {
    rsvps.add(currentUser.id);
  }

  try {
    const { error } = await supabase
      .from("events")
      .update({ rsvps: Array.from(rsvps) })
      .eq("id", activeEventId);

    if (error) throw error;

    ev.rsvps = Array.from(rsvps);
    openEventDetail(ev);
    loadEvents();
  } catch (err) {
    console.error("RSVP error:", err);
  }
}

async function handleDeleteEvent() {
  if (!activeEventId || !confirm("Delete this event?")) return;
  try {
    const { error } = await supabase.from("events").delete().eq("id", activeEventId);
    if (error) throw error;
    closeDetailModal();
    loadEvents();
  } catch (err) {
    console.error("Delete event error:", err);
  }
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}