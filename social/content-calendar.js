
/* Marketing Content Calendar
   Public Supabase-powered calendar with multi-project support.
   Use your Supabase project URL and anon/publishable key.
   Never use the service-role key in browser JavaScript.
*/
(() => {
  "use strict";

  const SUPABASE_URL = "https://qqvsfbpheacaqrvvdjbp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Dd7Nm5oTNLKuHj6JA_R01Q_yJqk8JCX";

  const TABLE = "marketing_content";
  const PROJECTS_TABLE = "marketing_projects";

  const $ = (id) => document.getElementById(id);

  const state = {
    client: null,
    items: [],
    projects: [],
    activeProjectId: null,
    cursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    view: "month",
    filters: {
      type: "all",
      status: "all",
      channel: "all",
      search: ""
    }
  };

  const TYPES = {
    social: "Social media",
    blog: "Blog & SEO",
    email: "Email marketing",
    website: "Website content",
    campaign: "Campaign",
    video: "Video",
    design: "Marketing material",
    other: "Other"
  };

  const STATUSES = {
    idea: "Idea",
    draft: "Draft",
    "in-review": "In review",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    "on-hold": "On hold"
  };

  const dateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const parseDate = (value) => new Date(`${value}T00:00:00`);

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  const formatDate = (
    value,
    options = { month: "short", day: "numeric", year: "numeric" }
  ) => new Intl.DateTimeFormat(undefined, options).format(parseDate(value));

  function setProjectMessage(message, isError = false) {
    $("projectFormMessage").textContent = message;
    $("projectFormMessage").classList.toggle("is-error", isError);
  }

  function getActiveProject() {
    return state.projects.find(
      (project) => String(project.id) === String(state.activeProjectId)
    );
  }

  function updateProjectSelector() {
    const select = $("projectSelect");

    if (!state.projects.length) {
      select.innerHTML = '<option value="">No projects available</option>';
      $("projectDescription").textContent = "Create a project to start organizing your marketing content.";
      $("addContent").disabled = true;
      return;
    }

    select.innerHTML = state.projects.map((project) =>
      `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`
    ).join("");

    select.value = String(state.activeProjectId);

    const activeProject = getActiveProject();

    $("projectDescription").textContent =
      activeProject?.description || "No project description provided.";

    $("addContent").disabled = !activeProject;
  }

  async function loadProjects() {
    const { data, error } = await state.client
      .from(PROJECTS_TABLE)
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      $("calendar").innerHTML =
        '<p class="mc-empty">Unable to load projects. Check your Supabase table and public access policies.</p>';

      console.error("Project loading error:", error);
      return false;
    }

    state.projects = data || [];

    if (state.projects.length) {
      const currentProjectExists = state.projects.some(
        (project) => String(project.id) === String(state.activeProjectId)
      );

      if (!currentProjectExists) {
        const defaultProject = state.projects.find(
          (project) => project.name === "General Content"
        );

        state.activeProjectId = defaultProject
          ? defaultProject.id
          : state.projects[0].id;
      }
    } else {
      state.activeProjectId = null;
    }

    updateProjectSelector();
    return true;
  }

  async function createProject(event) {
    event.preventDefault();

    const name = $("projectName").value.trim();
    const description = $("projectDescriptionInput").value.trim();

    if (!name) {
      setProjectMessage("Please enter a project name.", true);
      return;
    }

    const button = $("saveProject");
    button.disabled = true;
    button.textContent = "Creating...";

    const { data, error } = await state.client
      .from(PROJECTS_TABLE)
      .insert({
        name,
        description: description || null
      })
      .select()
      .single();

    button.disabled = false;
    button.textContent = "Create project";

    if (error) {
      setProjectMessage(error.message, true);
      return;
    }

    state.projects.push(data);
    state.activeProjectId = data.id;

    updateProjectSelector();

    $("projectForm").reset();
    $("projectDialog").close();

    await loadItems();
  }

  function visibleItems() {
    return state.items.filter((item) => {
      const query = state.filters.search.toLowerCase();

      const matchesSearch = !query ||
        [
          item.title,
          item.brief,
          item.notes,
          item.campaign,
          item.channel
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      return (
        (state.filters.type === "all" ||
          item.content_type === state.filters.type) &&
        (state.filters.status === "all" ||
          item.status === state.filters.status) &&
        (state.filters.channel === "all" ||
          item.channel === state.filters.channel) &&
        matchesSearch
      );
    });
  }

  async function loadItems() {
    if (!state.activeProjectId) {
      state.items = [];
      render();
      return;
    }

    $("calendar").innerHTML =
      '<p class="mc-empty">Loading project content...</p>';

    const { data, error } = await state.client
      .from(TABLE)
      .select("*")
      .eq("project_id", state.activeProjectId)
      .order("publish_date", { ascending: true })
      .order("publish_time", { ascending: true });

    if (error) {
      $("calendar").innerHTML =
        '<p class="mc-empty">Unable to load content. Check your Supabase table and public access policies.</p>';

      console.error("Content loading error:", error);
      return;
    }

    state.items = data || [];
    render();
  }

  function renderStats(items) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    $("statTotal").textContent = items.length;

    $("statDraft").textContent =
      items.filter((item) => item.status === "draft").length;

    $("statReview").textContent =
      items.filter((item) => item.status === "in-review").length;

    $("statScheduled").textContent =
      items.filter((item) => item.status === "scheduled").length;

    $("statPublished").textContent =
      items.filter((item) => item.status === "published").length;

    $("statMonth").textContent = items.filter((item) => {
      const date = parseDate(item.publish_date);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }

  function eventButton(item) {
    const time = item.publish_time
      ? `${item.publish_time.slice(0, 5)} `
      : "";

    return `<button type="button" class="mc-event"
      data-type="${escapeHtml(item.content_type)}"
      data-edit="${escapeHtml(item.id)}"
      title="${escapeHtml(item.title)}">
      ${escapeHtml(time + item.title)}
    </button>`;
  }

  function renderMonth(items) {
    const year = state.cursor.getFullYear();
    const month = state.cursor.getMonth();

    $("calendarTitle").textContent =
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric"
      }).format(state.cursor);

    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const today = dateKey(new Date());

    const days = Array.from(
      { length: 42 },
      (_, index) =>
        new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + index
        )
    );

    const html = `
      <div class="mc-weekdays">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          .map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="mc-month-grid">
        ${days.map((day) => {
          const key = dateKey(day);
          const dayItems = items.filter(
            (item) => item.publish_date === key
          );

          return `
            <div class="mc-day ${
              day.getMonth() !== month ? "is-outside" : ""
            } ${key === today ? "is-today" : ""}">
              <div class="mc-day-number">
                <span>${day.getDate()}</span>
                ${key === today ? '<i class="mc-today-dot"></i>' : ""}
              </div>
              ${dayItems.slice(0, 3).map(eventButton).join("")}
              ${dayItems.length > 3
                ? `<div class="mc-more">+${dayItems.length - 3} more</div>`
                : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;

    $("calendar").innerHTML = html;
  }

  function renderWeek(items) {
    const start = new Date(state.cursor);
    start.setDate(start.getDate() - start.getDay());

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    $("calendarTitle").textContent =
      `${formatDate(dateKey(start), {
        month: "short",
        day: "numeric"
      })} – ${formatDate(dateKey(end), {
        month: "short",
        day: "numeric",
        year: "numeric"
      })}`;

    const today = dateKey(new Date());

    $("calendar").innerHTML = `
      <div class="mc-week-grid">
        ${Array.from({ length: 7 }, (_, index) => {
          const day = new Date(start);
          day.setDate(start.getDate() + index);

          const key = dateKey(day);

          const dayItems = items.filter(
            (item) => item.publish_date === key
          );

          return `
            <div class="mc-week-column ${
              key === today ? "is-today" : ""
            }">
              <div class="mc-week-date">
                ${new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric"
                }).format(day)}
              </div>
              ${dayItems.map(eventButton).join("") ||
                '<span class="mc-list-meta">No content</span>'}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderList(items) {
    const sorted = [...items].sort((a, b) =>
      a.publish_date.localeCompare(b.publish_date) ||
      (a.publish_time || "").localeCompare(b.publish_time || "")
    );

    $("calendarTitle").textContent = "All matching content";

    $("calendar").innerHTML = sorted.length
      ? `
        <div class="mc-list">
          ${sorted.map((item) => `
            <button type="button" class="mc-list-item"
              data-edit="${escapeHtml(item.id)}">
              <span class="mc-list-date">
                ${formatDate(item.publish_date)}
                ${item.publish_time
                  ? ` · ${escapeHtml(item.publish_time.slice(0, 5))}`
                  : ""}
              </span>

              <span>
                <span class="mc-list-title">
                  ${escapeHtml(item.title)}
                </span>
                <br>
                <span class="mc-list-meta">
                  ${escapeHtml(TYPES[item.content_type] || "Other")}
                  · ${escapeHtml(item.channel || "No channel")}
                  · ${escapeHtml(item.campaign || "No campaign")}
                </span>
              </span>

              <span class="mc-pill">
                ${escapeHtml(STATUSES[item.status] || item.status)}
              </span>
            </button>
          `).join("")}
        </div>
      `
      : '<p class="mc-empty">No content matches your filters.</p>';
  }

  function renderUpcoming(items) {
    const today = dateKey(new Date());

    const upcoming = items
      .filter((item) =>
        item.publish_date >= today && item.status !== "published"
      )
      .sort((a, b) =>
        a.publish_date.localeCompare(b.publish_date) ||
        (a.publish_time || "").localeCompare(b.publish_time || "")
      )
      .slice(0, 6);

    $("upcomingList").innerHTML = upcoming.length
      ? upcoming.map((item) => `
          <article class="mc-upcoming-item">
            <strong>${escapeHtml(item.title)}</strong>
            <small>
              ${formatDate(item.publish_date)}
              ${item.publish_time
                ? ` · ${escapeHtml(item.publish_time.slice(0, 5))}`
                : ""}
              · ${escapeHtml(TYPES[item.content_type] || "Other")}
              · ${escapeHtml(STATUSES[item.status] || item.status)}
            </small>
          </article>
        `).join("")
      : '<p class="mc-empty">No upcoming content found.</p>';
  }

  function render() {
    const items = visibleItems();

    renderStats(state.items);

    if (!state.activeProjectId) {
      $("calendarTitle").textContent = "No project selected";

      $("calendar").innerHTML =
        '<p class="mc-empty">Create a project to start planning your content.</p>';

      $("upcomingList").innerHTML =
        '<p class="mc-empty">Create a project to view upcoming deadlines.</p>';

      return;
    }

    if (state.view === "month") {
      renderMonth(items);
    } else if (state.view === "week") {
      renderWeek(items);
    } else {
      renderList(items);
    }

    renderUpcoming(state.items);
  }

  function openNewContent(date = dateKey(state.cursor)) {
    if (!state.activeProjectId) return;

    $("contentForm").reset();
    $("contentId").value = "";
    $("dialogTitle").textContent = "Add marketing content";
    $("contentDate").value = date;
    $("contentStatus").value = "idea";
    $("deleteContent").hidden = true;
    $("formMessage").textContent = "";

    $("contentDialog").showModal();
  }

  function openEditContent(id) {
    const item = state.items.find(
      (entry) => String(entry.id) === String(id)
    );

    if (!item) return;

    $("contentId").value = item.id;
    $("dialogTitle").textContent = "Edit marketing content";
    $("contentTitle").value = item.title || "";
    $("contentType").value = item.content_type || "other";
    $("contentChannel").value = item.channel || "Other";
    $("contentStatus").value = item.status || "idea";
    $("contentDate").value = item.publish_date || "";
    $("contentTime").value = item.publish_time || "";
    $("contentCampaign").value = item.campaign || "";
    $("contentUrl").value = item.content_url || "";
    $("contentBrief").value = item.brief || "";
    $("contentNotes").value = item.notes || "";

    $("deleteContent").hidden = false;
    $("formMessage").textContent = "";

    $("contentDialog").showModal();
  }

  async function saveContent(event) {
    event.preventDefault();

    if (!state.activeProjectId) return;

    const id = $("contentId").value;

    const payload = {
      project_id: Number(state.activeProjectId),
      title: $("contentTitle").value.trim(),
      content_type: $("contentType").value,
      channel: $("contentChannel").value,
      status: $("contentStatus").value,
      publish_date: $("contentDate").value,
      publish_time: $("contentTime").value || null,
      campaign: $("contentCampaign").value.trim() || null,
      content_url: $("contentUrl").value.trim() || null,
      brief: $("contentBrief").value.trim() || null,
      notes: $("contentNotes").value.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.publish_date) {
      $("formMessage").textContent =
        "Please complete the required fields.";
      return;
    }

    const button = $("saveContent");
    button.disabled = true;
    button.textContent = "Saving...";

    let result;

    if (id) {
      result = await state.client
        .from(TABLE)
        .update(payload)
        .eq("id", id)
        .eq("project_id", state.activeProjectId)
        .select()
        .single();
    } else {
      result = await state.client
        .from(TABLE)
        .insert(payload)
        .select()
        .single();
    }

    button.disabled = false;
    button.textContent = "Save content";

    if (result.error) {
      $("formMessage").textContent = result.error.message;
      return;
    }

    $("contentDialog").close();
    await loadItems();
  }

  async function deleteContent() {
    const id = $("contentId").value;

    if (!id || !window.confirm(
      "Delete this content item? This cannot be undone."
    )) {
      return;
    }

    const { error } = await state.client
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("project_id", state.activeProjectId);

    if (error) {
      $("formMessage").textContent = error.message;
      return;
    }

    $("contentDialog").close();
    await loadItems();
  }

  function changePeriod(amount) {
    if (state.view === "week") {
      state.cursor.setDate(state.cursor.getDate() + amount * 7);
    } else if (state.view === "list") {
      return;
    } else {
      state.cursor.setMonth(state.cursor.getMonth() + amount);
    }

    render();
  }

  function bindEvents() {
    $("addProject").addEventListener("click", () => {
      $("projectForm").reset();
      setProjectMessage("");
      $("projectDialog").showModal();
    });

    $("projectForm").addEventListener("submit", createProject);

    document.querySelectorAll("[data-close-project-dialog]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          $("projectDialog").close();
        });
      });

    $("projectSelect").addEventListener("change", async (event) => {
      state.activeProjectId = event.target.value || null;

      updateProjectSelector();

      await loadItems();
    });

    $("addContent").addEventListener("click", () => openNewContent());

    $("contentForm").addEventListener("submit", saveContent);
    $("deleteContent").addEventListener("click", deleteContent);

    document.querySelectorAll("[data-close-dialog]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          $("contentDialog").close();
        });
      });

    $("previousPeriod").addEventListener("click", () => changePeriod(-1));
    $("nextPeriod").addEventListener("click", () => changePeriod(1));

    $("todayButton").addEventListener("click", () => {
      state.cursor = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      );

      render();
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;

        document.querySelectorAll("[data-view]").forEach((item) => {
          const active = item === button;

          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });

        render();
      });
    });

    $("typeFilter").addEventListener("change", (event) => {
      state.filters.type = event.target.value;
      render();
    });

    $("statusFilter").addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      render();
    });

    $("channelFilter").addEventListener("change", (event) => {
      state.filters.channel = event.target.value;
      render();
    });

    $("contentSearch").addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      render();
    });

    $("calendar").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");

      if (edit) {
        openEditContent(edit.dataset.edit);
        return;
      }

      const day = event.target.closest(".mc-day");

      if (day && state.activeProjectId) {
        const dayIndex = [...day.parentElement.children].indexOf(day);

        const year = state.cursor.getFullYear();
        const month = state.cursor.getMonth();

        const first = new Date(year, month, 1);
        const start = new Date(year, month, 1 - first.getDay());

        const selected = new Date(start);
        selected.setDate(start.getDate() + dayIndex);

        openNewContent(dateKey(selected));
      }
    });
  }

  async function init() {
    $("currentYear").textContent = new Date().getFullYear();

    bindEvents();

    if (!window.supabase || !window.supabase.createClient) {
      $("calendar").innerHTML =
        '<p class="mc-empty">Supabase library could not be loaded. Check your internet connection.</p>';
      return;
    }

    if (
      SUPABASE_URL.startsWith("YOUR_") ||
      SUPABASE_ANON_KEY.startsWith("YOUR_")
    ) {
      $("calendar").innerHTML =
        '<p class="mc-empty">Add your Supabase project URL and anon/publishable key in content-calendar.js before using this page.</p>';
      return;
    }

    state.client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    const projectsLoaded = await loadProjects();

    if (projectsLoaded) {
      if (state.activeProjectId) {
        await loadItems();
      } else {
        render();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
