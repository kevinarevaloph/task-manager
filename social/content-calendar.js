/* Marketing Content Calendar
   Configure these with the same Supabase project URL and anon/publishable key
   used by your existing Social Media Calendar. Never use the service-role key here. */
(() => {
  "use strict";

const SUPABASE_URL = "https://qqvsfbpheacaqrvvdjbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dd7Nm5oTNLKuHj6JA_R01Q_yJqk8JCX";
  const TABLE = "marketing_content";

  const $ = (id) => document.getElementById(id);
  const state = {
    client: null, items: [],
    cursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    view: "month", filters: { type: "all", status: "all", channel: "all", search: "" }
  };

  const TYPES = {
    social: "Social media", blog: "Blog & SEO", email: "Email marketing",
    website: "Website content", campaign: "Campaign", video: "Video",
    design: "Marketing material", other: "Other"
  };
  const STATUSES = {
    idea: "Idea", draft: "Draft", "in-review": "In review", approved: "Approved",
    scheduled: "Scheduled", published: "Published", "on-hold": "On hold"
  };
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const parseDate = (value) => new Date(`${value}T00:00:00`);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
  const formatDate = (value, options = { month:"short", day:"numeric", year:"numeric" }) =>
    new Intl.DateTimeFormat(undefined, options).format(parseDate(value));
  const visibleItems = () => state.items.filter((item) => {
    const query = state.filters.search.toLowerCase();
    const matchesSearch = !query || [item.title,item.brief,item.notes,item.campaign,item.channel]
      .some((value) => String(value || "").toLowerCase().includes(query));
    return (state.filters.type === "all" || item.content_type === state.filters.type) &&
      (state.filters.status === "all" || item.status === state.filters.status) &&
      (state.filters.channel === "all" || item.channel === state.filters.channel) && matchesSearch;
  });

  function ensureSupabaseClient() {
    if (!state.client) {
      throw new Error("Supabase is not connected. Add your project URL and anon/publishable key in content-calendar.js, then refresh the page.");
    }
    return state.client;
  }

  async function loadItems() {
    if (!state.client) {
      $("calendar").innerHTML = '<p class="mc-empty">Connect Supabase by adding your project URL and anon/publishable key in content-calendar.js.</p>';
      return;
    }
    $("calendar").innerHTML = '<p class="mc-empty">Loading calendar...</p>';
    const { data, error } = await state.client.from(TABLE).select("*").order("publish_date", { ascending:true }).order("publish_time", { ascending:true });
    if (error) {
      $("calendar").innerHTML = '<p class="mc-empty">Unable to load content. Check your Supabase table and Row Level Security policies.</p>';
      return;
    }
    state.items = data || [];
    render();
  }

  function renderStats(items) {
    const now = new Date();
    const month = now.getMonth(), year = now.getFullYear();
    $("statTotal").textContent = items.length;
    $("statDraft").textContent = items.filter(x => x.status === "draft").length;
    $("statReview").textContent = items.filter(x => x.status === "in-review").length;
    $("statScheduled").textContent = items.filter(x => x.status === "scheduled").length;
    $("statPublished").textContent = items.filter(x => x.status === "published").length;
    $("statMonth").textContent = items.filter(x => {
      const d = parseDate(x.publish_date); return d.getMonth() === month && d.getFullYear() === year;
    }).length;
  }

  function eventButton(item) {
    const time = item.publish_time ? `${item.publish_time.slice(0,5)} ` : "";
    return `<button type="button" class="mc-event" data-type="${escapeHtml(item.content_type)}" data-edit="${escapeHtml(item.id)}" title="${escapeHtml(item.title)}">${escapeHtml(time + item.title)}</button>`;
  }

  function renderMonth(items) {
    const year = state.cursor.getFullYear(), month = state.cursor.getMonth();
    $("calendarTitle").textContent = new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(state.cursor);
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const today = dateKey(new Date());
    const days = Array.from({length:42},(_,i) => new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
    const html = `<div class="mc-weekdays">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<span>${d}</span>`).join("")}</div><div class="mc-month-grid">${days.map(day=>{
      const key=dateKey(day), dayItems=items.filter(x=>x.publish_date===key);
      return `<div class="mc-day ${day.getMonth()!==month?"is-outside":""} ${key===today?"is-today":""}"><div class="mc-day-number"><span>${day.getDate()}</span>${key===today?'<i class="mc-today-dot"></i>':""}</div>${dayItems.slice(0,3).map(eventButton).join("")}${dayItems.length>3?`<div class="mc-more">+${dayItems.length-3} more</div>`:""}</div>`;
    }).join("")}</div>`;
    $("calendar").innerHTML=html;
  }

  function renderWeek(items) {
    const start = new Date(state.cursor);
    start.setDate(start.getDate()-start.getDay());
    const end = new Date(start); end.setDate(start.getDate()+6);
    $("calendarTitle").textContent = `${formatDate(dateKey(start),{month:"short",day:"numeric"})} – ${formatDate(dateKey(end),{month:"short",day:"numeric",year:"numeric"})}`;
    const today=dateKey(new Date());
    $("calendar").innerHTML=`<div class="mc-week-grid">${Array.from({length:7},(_,i)=>{
      const day=new Date(start); day.setDate(start.getDate()+i); const key=dateKey(day);
      return `<div class="mc-week-column ${key===today?"is-today":""}"><div class="mc-week-date">${new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(day)}</div>${items.filter(x=>x.publish_date===key).map(eventButton).join("")||'<span class="mc-list-meta">No content</span>'}</div>`;
    }).join("")}</div>`;
  }

  function renderList(items) {
    const sorted=[...items].sort((a,b)=>a.publish_date.localeCompare(b.publish_date)||(a.publish_time||"").localeCompare(b.publish_time||""));
    $("calendarTitle").textContent="All matching content";
    $("calendar").innerHTML=sorted.length?`<div class="mc-list">${sorted.map(item=>`<button type="button" class="mc-list-item" data-edit="${escapeHtml(item.id)}"><span class="mc-list-date">${formatDate(item.publish_date)}${item.publish_time?` · ${escapeHtml(item.publish_time.slice(0,5))}`:""}</span><span><span class="mc-list-title">${escapeHtml(item.title)}</span><br><span class="mc-list-meta">${escapeHtml(TYPES[item.content_type]||"Other")} · ${escapeHtml(item.channel||"No channel")} · ${escapeHtml(item.campaign||"No campaign")}</span></span><span class="mc-pill">${escapeHtml(STATUSES[item.status]||item.status)}</span></button>`).join("")}</div>`:'<p class="mc-empty">No content matches your filters.</p>';
  }

  function renderUpcoming(items) {
    const today=dateKey(new Date());
    const upcoming=items.filter(x=>x.publish_date>=today && x.status!=="published")
      .sort((a,b)=>a.publish_date.localeCompare(b.publish_date)).slice(0,6);
    $("upcomingList").innerHTML=upcoming.length?upcoming.map(x=>`<article class="mc-upcoming-item"><strong>${escapeHtml(x.title)}</strong><small>${formatDate(x.publish_date)} · ${escapeHtml(TYPES[x.content_type]||"Other")} · ${escapeHtml(STATUSES[x.status]||x.status)}</small></article>`).join(""):'<p class="mc-empty">No upcoming content found.</p>';
  }

  function render() {
    const items=visibleItems();
    renderStats(state.items);
    if(state.view==="month") renderMonth(items);
    else if(state.view==="week") renderWeek(items);
    else renderList(items);
    renderUpcoming(state.items);
  }

  function openNewContent(date = dateKey(state.cursor)) {
    $("contentForm").reset();
    $("contentId").value="";
    $("dialogTitle").textContent="Add marketing content";
    $("contentDate").value=date;
    $("contentStatus").value="idea";
    $("deleteContent").hidden=true;
    $("formMessage").textContent="";
    $("contentDialog").showModal();
  }

  function openEditContent(id) {
    const item=state.items.find(x=>String(x.id)===String(id));
    if(!item) return;
    $("contentId").value=item.id;
    $("dialogTitle").textContent="Edit marketing content";
    $("contentTitle").value=item.title||"";
    $("contentType").value=item.content_type||"other";
    $("contentChannel").value=item.channel||"Other";
    $("contentStatus").value=item.status||"idea";
    $("contentDate").value=item.publish_date||"";
    $("contentTime").value=item.publish_time||"";
    $("contentCampaign").value=item.campaign||"";
    $("contentUrl").value=item.content_url||"";
    $("contentBrief").value=item.brief||"";
    $("contentNotes").value=item.notes||"";
    $("deleteContent").hidden=false;
    $("formMessage").textContent="";
    $("contentDialog").showModal();
  }

  async function saveContent(event) {
    event.preventDefault();
    const id=$("contentId").value;
    const payload={
      title:$("contentTitle").value.trim(),
      content_type:$("contentType").value,
      channel:$("contentChannel").value,
      status:$("contentStatus").value,
      publish_date:$("contentDate").value,
      publish_time:$("contentTime").value||null,
      campaign:$("contentCampaign").value.trim()||null,
      content_url:$("contentUrl").value.trim()||null,
      brief:$("contentBrief").value.trim()||null,
      notes:$("contentNotes").value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if(!payload.title||!payload.publish_date) { $("formMessage").textContent="Please complete the required fields."; return; }
    const button=$("saveContent");
    button.disabled=true;
    button.textContent="Saving...";
    $("formMessage").textContent="";
    try {
      const client = ensureSupabaseClient();
      let result;
      if(id) result=await client.from(TABLE).update(payload).eq("id",id).select().single();
      else result=await client.from(TABLE).insert(payload).select().single();

      if(result.error) {
        $("formMessage").textContent=`Could not save content: ${result.error.message}`;
        return;
      }

      $("contentDialog").close();
      await loadItems();
    } catch(error) {
      $("formMessage").textContent=`Could not save content: ${error.message || "Please check your connection and Supabase settings."}`;
    } finally {
      button.disabled=false;
      button.textContent="Save content";
    }
  }

  async function deleteContent() {
    const id=$("contentId").value;
    if(!id||!window.confirm("Delete this content item? This cannot be undone.")) return;
    try {
      const client = ensureSupabaseClient();
      const {error}=await client.from(TABLE).delete().eq("id",id);
      if(error) { $("formMessage").textContent=`Could not delete content: ${error.message}`; return; }
      $("contentDialog").close(); await loadItems();
    } catch(error) {
      $("formMessage").textContent=`Could not delete content: ${error.message || "Please check your Supabase settings."}`;
    }
  }

  function changePeriod(amount) {
    if(state.view==="week") state.cursor.setDate(state.cursor.getDate()+amount*7);
    else if(state.view==="list") return;
    else state.cursor.setMonth(state.cursor.getMonth()+amount);
    render();
  }

  function bindEvents() {
    $("addContent").addEventListener("click",()=>openNewContent());
    $("contentForm").addEventListener("submit",saveContent);
    $("deleteContent").addEventListener("click",deleteContent);
    document.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>$("contentDialog").close()));
    $("previousPeriod").addEventListener("click",()=>changePeriod(-1));
    $("nextPeriod").addEventListener("click",()=>changePeriod(1));
    $("todayButton").addEventListener("click",()=>{state.cursor=new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());render();});
    document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{
      state.view=button.dataset.view;
      document.querySelectorAll("[data-view]").forEach(b=>{const active=b===button;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active));});
      render();
    }));
    $("typeFilter").addEventListener("change",e=>{state.filters.type=e.target.value;render();});
    $("statusFilter").addEventListener("change",e=>{state.filters.status=e.target.value;render();});
    $("channelFilter").addEventListener("change",e=>{state.filters.channel=e.target.value;render();});
    $("contentSearch").addEventListener("input",e=>{state.filters.search=e.target.value;render();});
    $("calendar").addEventListener("click",e=>{
      const edit=e.target.closest("[data-edit]");
      if(edit) { openEditContent(edit.dataset.edit); return; }
      const day=e.target.closest(".mc-day");
      if(day) {
        const number=day.querySelector(".mc-day-number span")?.textContent;
        if(number) {
          const visibleDate=[...day.parentElement.children].indexOf(day);
          const year=state.cursor.getFullYear(),month=state.cursor.getMonth();
          const first=new Date(year,month,1), start=new Date(year,month,1-first.getDay());
          const selected=new Date(start); selected.setDate(start.getDate()+visibleDate);
          openNewContent(dateKey(selected));
        }
      }
    });
  }

  async function init() {
    $("currentYear").textContent=new Date().getFullYear();
    bindEvents();
    if(!window.supabase||!window.supabase.createClient) {
      $("calendar").innerHTML='<p class="mc-empty">Supabase library could not be loaded. Check your internet connection.</p>';
      return;
    }
    if(SUPABASE_URL.startsWith("YOUR_")||SUPABASE_ANON_KEY.startsWith("YOUR_")) {
      $("calendar").innerHTML='<p class="mc-empty">Add your Supabase project URL and anon/publishable key in content-calendar.js before using this page.</p>';
      return;
    }
    state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    await loadItems();
  }

  document.addEventListener("DOMContentLoaded",init);
})();
