/* =========================================================
   SOCIAL MEDIA CALENDAR
   Supabase-connected version
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const SUPABASE_URL =
    "https://qqvsfbpheacaqrvvdjbp.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdnNmYnBoZWFjYXFydnZkamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjczOTEsImV4cCI6MjEwNTQwMzM5MX0.BltfO0hVKQMZSuT23dHMpUMdK6CS2DIYoe6SQZLjjz0";

  const SUPABASE_TABLE =
    "social_media_posts";

  const STORAGE_KEY =
    "kevin_social_media_calendar_v1";

  const EDITOR_SESSION_KEY =
    "kevin_social_media_calendar_editor";

  const ATTACHMENT_DB_NAME =
    "kevin_social_media_calendar_files";

  const ATTACHMENT_DB_VERSION = 1;

  const ATTACHMENT_STORE =
    "attachments";


  /* =========================================================
     CONFIGURATION / CONSTANTS
     ========================================================= */

  const PLATFORMS = {
    linkedin: "LinkedIn",
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X"
  };

  const POST_STATUSES = {
    draft: "Draft",
    scheduled: "Scheduled",
    stuck: "Stuck",
    running: "Running",
    "on-hold": "On Hold",
    published: "Published"
  };

  const APPROVAL_STATUSES = {
    "in-review": "In review",
    "needs-revision": "Needs revision",
    published: "Published"
  };

  /*
   * Add additional editors here when needed.
   */
  const AUTHORIZED_EDITORS = [
    {
      id: "kevin-arevalo",
      name: "Kevin Arevalo"
    }
  ];


  /* =========================================================
     SUPABASE
     ========================================================= */

  let supabaseClient = null;
  let supabaseReady = false;


  function isSupabaseConfigured() {
    return (
      SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_URL") &&
      !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
    );
  }


  function loadSupabaseLibrary() {
    if (window.supabase) {
      return Promise.resolve(window.supabase);
    }

    return new Promise((resolve, reject) => {
      const existing =
        document.querySelector(
          'script[data-supabase-calendar="true"]'
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => {
            if (window.supabase) {
              resolve(window.supabase);
            } else {
              reject(
                new Error(
                  "Supabase library loaded but was unavailable."
                )
              );
            }
          }
        );

        existing.addEventListener(
          "error",
          reject
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

      script.async = true;

      script.dataset.supabaseCalendar =
        "true";

      script.addEventListener(
        "load",
        () => {
          if (!window.supabase) {
            reject(
              new Error(
                "Supabase library loaded but was unavailable."
              )
            );

            return;
          }

          resolve(window.supabase);
        }
      );

      script.addEventListener(
        "error",
        () => {
          reject(
            new Error(
              "Unable to load the Supabase JavaScript library."
            )
          );
        }
      );

      document.head.appendChild(script);
    });
  }


  async function initializeSupabase() {
    if (
      supabaseReady &&
      supabaseClient
    ) {
      return supabaseClient;
    }

    if (!isSupabaseConfigured()) {
      throw new Error(
        "Supabase is not configured. Add your Project URL and anon/public key to social-media-calendar.js."
      );
    }

    const supabase =
      await loadSupabaseLibrary();

    supabaseClient =
      supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );

    supabaseReady = true;

    return supabaseClient;
  }


  /* =========================================================
     STATE
     ========================================================= */

  let state = {
    posts: []
  };

  let currentDate =
    new Date();

  let activeEditor = null;

  let pendingPostFiles = [];

  let attachmentDBPromise = null;


  /* =========================================================
     DOM
     ========================================================= */

  const calendar =
    document.getElementById(
      "calendar"
    );

  const calendarTitle =
    document.getElementById(
      "calendarTitle"
    );

  const upcomingPosts =
    document.getElementById(
      "upcomingPosts"
    );

  const postDialog =
    document.getElementById(
      "postDialog"
    );

  const postForm =
    document.getElementById(
      "postForm"
    );

  const postDialogTitle =
    document.getElementById(
      "postDialogTitle"
    );

  const postIdInput =
    document.getElementById(
      "postId"
    );

  const postPlatformInput =
    document.getElementById(
      "postPlatform"
    );

  const postCaptionInput =
    document.getElementById(
      "postCaption"
    );

  const postHashtagsInput =
    document.getElementById(
      "postHashtags"
    );

  const postDateInput =
    document.getElementById(
      "postDate"
    );

  const postTimeInput =
    document.getElementById(
      "postTime"
    );

  const postApprovalStatusInput =
    document.getElementById(
      "postApprovalStatus"
    );

  const approvalStatusMeta =
    document.getElementById(
      "approvalStatusMeta"
    );

  const postSuggestionsInput =
    document.getElementById(
      "postSuggestions"
    );

  const postStatusInput =
    document.getElementById(
      "postStatus"
    );

  const postStatusMeta =
    document.getElementById(
      "postStatusMeta"
    );

  const postChangeHistory =
    document.getElementById(
      "postChangeHistory"
    );

  const postFilesInput =
    document.getElementById(
      "postFiles"
    );

  const postAttachmentsList =
    document.getElementById(
      "postAttachmentsList"
    );

  const captionCount =
    document.getElementById(
      "captionCount"
    );

  const platformFilter =
    document.getElementById(
      "platformFilter"
    );

  const statusFilter =
    document.getElementById(
      "statusFilter"
    );

  const postSearch =
    document.getElementById(
      "postSearch"
    );


  /* =========================================================
     EDITOR SESSION
     ========================================================= */

  const editorSession =
    document.querySelector(
      ".smc-editor-session"
    );

  const editorSessionIcon =
    document.getElementById(
      "editorSessionIcon"
    );

  const editorSessionTitle =
    document.getElementById(
      "editorSessionTitle"
    );

  const editorSessionMessage =
    document.getElementById(
      "editorSessionMessage"
    );

  const editorUser =
    document.getElementById(
      "editorUser"
    );

  const startEditing =
    document.getElementById(
      "startEditing"
    );

  const lockEditing =
    document.getElementById(
      "lockEditing"
    );


  /* =========================================================
     STATS
     ========================================================= */

  const statTotal =
    document.getElementById(
      "statTotal"
    );

  const statDraft =
    document.getElementById(
      "statDraft"
    ) ||
    document.getElementById(
      "statDrafts"
    );

  const statScheduled =
    document.getElementById(
      "statScheduled"
    );

  const statStuck =
    document.getElementById(
      "statStuck"
    );

  const statRunning =
    document.getElementById(
      "statRunning"
    );

  const statOnHold =
    document.getElementById(
      "statOnHold"
    );

  const statPublished =
    document.getElementById(
      "statPublished"
    );

  const statMonth =
    document.getElementById(
      "statMonth"
    );

  const statPlatforms =
    document.getElementById(
      "statPlatforms"
    );


  /* =========================================================
     GENERAL HELPERS
     ========================================================= */

  function createId(
    prefix = "id"
  ) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }


  function escapeHTML(
    value
  ) {
    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  function getTodayKey() {
    const date =
      new Date();

    return getDateKey(date);
  }


  function getDateKey(
    date
  ) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  function parseDateTime(
    date,
    time = "00:00"
  ) {
    if (!date) {
      return new Date(
        NaN
      );
    }

    return new Date(
      `${date}T${time || "00:00"}:00`
    );
  }


  function isPastDate(
    date
  ) {
    return (
      date <
      getTodayKey()
    );
  }


  function isPastSchedule(
    date,
    time
  ) {
    return (
      parseDateTime(
        date,
        time
      ).getTime() <
      Date.now()
    );
  }


  function getPostDateTime(
    post
  ) {
    return parseDateTime(
      post.date,
      post.time
    ).getTime();
  }


  function formatTime(
    time
  ) {
    if (!time) {
      return "";
    }

    const parts =
      String(time).split(":");

    let hour =
      Number(parts[0]);

    const minute =
      parts[1] || "00";

    const suffix =
      hour >= 12
        ? "PM"
        : "AM";

    hour =
      hour % 12 || 12;

    return `${hour}:${minute} ${suffix}`;
  }


  function formatPostDate(
    date
  ) {
    if (!date) {
      return "";
    }

    const parsed =
      new Date(
        `${date}T00:00:00`
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    ).format(parsed);
  }


  function formatUpcomingDate(
    date,
    time
  ) {
    return {
      day: formatPostDate(date),
      time: formatTime(time)
    };
  }


  function formatFileSize(
    bytes
  ) {
    if (
      !Number.isFinite(bytes) ||
      bytes <= 0
    ) {
      return "0 KB";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB"
    ];

    let size = bytes;
    let index = 0;

    while (
      size >= 1024 &&
      index <
        units.length - 1
    ) {
      size /= 1024;
      index++;
    }

    if (index === 0) {
      return `${size} ${units[index]}`;
    }

    return `${size.toFixed(1)} ${units[index]}`;
  }


  function getFileIcon(
    name
  ) {
    const extension =
      String(name || "")
        .split(".")
        .pop()
        .toLowerCase();

    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
        "avif"
      ].includes(extension)
    ) {
      return "IMG";
    }

    if (
      [
        "pdf"
      ].includes(extension)
    ) {
      return "PDF";
    }

    if (
      [
        "doc",
        "docx"
      ].includes(extension)
    ) {
      return "DOC";
    }

    if (
      [
        "xls",
        "xlsx",
        "csv"
      ].includes(extension)
    ) {
      return "XLS";
    }

    if (
      [
        "mp4",
        "mov",
        "avi",
        "webm"
      ].includes(extension)
    ) {
      return "VID";
    }

    return "FILE";
  }


  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  function saveLocalStateOnly() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error(
        "Unable to save local calendar state:",
        error
      );
    }
  }


  function readLocalState() {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) {
        return {
          posts: []
        };
      }

      const parsed =
        JSON.parse(saved);

      if (
        !parsed ||
        !Array.isArray(
          parsed.posts
        )
      ) {
        return {
          posts: []
        };
      }

      return parsed;
    } catch (error) {
      console.error(
        "Unable to read local calendar state:",
        error
      );

      return {
        posts: []
      };
    }
  }


  /* =========================================================
     SUPABASE MAPPING
     ========================================================= */

  function postToSupabaseRow(
    post
  ) {
    return {
      id: post.id,

      platform:
        post.platform || "",

      caption:
        post.caption || "",

      hashtags:
        post.hashtags || "",

      date:
        post.date || "",

      time:
        post.time || "",

      approval_status:
        post.approvalStatus ||
        "in-review",

      suggestions:
        post.suggestions || "",

      status:
        post.status ||
        "draft",

      image:
        post.image || "",

      created_by:
        post.createdBy || "",

      created_at:
        post.createdAt ||
        new Date().toISOString(),

      updated_at:
        post.updatedAt ||
        post.createdAt ||
        new Date().toISOString(),

      change_history:
        Array.isArray(
          post.changeHistory
        )
          ? post.changeHistory
          : [],

      attachments:
        Array.isArray(
          post.attachments
        )
          ? post.attachments
          : []
    };
  }


  function supabaseRowToPost(
    row
  ) {
    return {
      id: row.id,

      platform:
        row.platform ||
        "linkedin",

      caption:
        row.caption ||
        "",

      hashtags:
        row.hashtags ||
        "",

      date:
        row.date ||
        "",

      time:
        row.time ||
        "09:00",

      approvalStatus:
        row.approval_status ||
        "in-review",

      suggestions:
        row.suggestions ||
        "",

      status:
        row.status ||
        "draft",

      image:
        row.image ||
        "",

      createdBy:
        row.created_by ||
        "",

      createdAt:
        row.created_at ||
        new Date().toISOString(),

      updatedAt:
        row.updated_at ||
        row.created_at ||
        new Date().toISOString(),

      changeHistory:
        Array.isArray(
          row.change_history
        )
          ? row.change_history
          : [],

      attachments:
        Array.isArray(
          row.attachments
        )
          ? row.attachments
          : []
    };
  }


  /* =========================================================
     LOAD FROM SUPABASE
     ========================================================= */

  async function loadPostsFromSupabase() {
    const client =
      await initializeSupabase();

    const {
      data,
      error
    } =
      await client
        .from(SUPABASE_TABLE)
        .select("*")
        .order(
          "date",
          {
            ascending: true
          }
        )
        .order(
          "time",
          {
            ascending: true
          }
        );

    if (error) {
      throw error;
    }

    return (
      data || []
    ).map(
      supabaseRowToPost
    );
  }


  async function savePostToSupabase(
    post
  ) {
    const client =
      await initializeSupabase();

    const row =
      postToSupabaseRow(
        post
      );

    const {
      error
    } =
      await client
        .from(SUPABASE_TABLE)
        .upsert(
          row,
          {
            onConflict: "id"
          }
        );

    if (error) {
      throw error;
    }
  }


  async function deletePostFromSupabase(
    postId
  ) {
    const client =
      await initializeSupabase();

    const {
      error
    } =
      await client
        .from(SUPABASE_TABLE)
        .delete()
        .eq(
          "id",
          postId
        );

    if (error) {
      throw error;
    }
  }


  async function loadState() {
    const local =
      readLocalState();

    state =
      local || {
        posts: []
      };

    try {
      const remote =
        await loadPostsFromSupabase();

      /*
       * If Supabase is empty but this browser has
       * old local posts, migrate them to Supabase.
       */
      if (
        remote.length === 0 &&
        state.posts.length > 0
      ) {
        for (
          const post of state.posts
        ) {
          await savePostToSupabase(
            post
          );
        }

        state.posts =
          state.posts;
      } else {
        /*
         * Supabase becomes the source of truth.
         */
        state.posts =
          remote;
      }

      saveLocalStateOnly();
    } catch (error) {
      console.error(
        "Unable to load Social Media Calendar from Supabase:",
        error
      );

      /*
       * Continue using localStorage if Supabase
       * is temporarily unavailable.
       */
    }
  }


  async function saveState() {
    saveLocalStateOnly();
  }


  /* =========================================================
     EDITOR SESSION
     ========================================================= */

  function getEditorById(
    id
  ) {
    return (
      AUTHORIZED_EDITORS.find(
        editor =>
          editor.id === id
      ) || null
    );
  }


  function getActiveEditor() {
    try {
      const id =
        sessionStorage.getItem(
          EDITOR_SESSION_KEY
        );

      if (!id) {
        return null;
      }

      return getEditorById(id);
    } catch {
      return null;
    }
  }


  function setActiveEditor(
    id
  ) {
    const editor =
      getEditorById(id);

    if (!editor) {
      return false;
    }

    activeEditor =
      editor;

    try {
      sessionStorage.setItem(
        EDITOR_SESSION_KEY,
        editor.id
      );
    } catch {}

    updateEditingUI();

    return true;
  }


  function clearActiveEditor() {
    activeEditor = null;

    try {
      sessionStorage.removeItem(
        EDITOR_SESSION_KEY
      );
    } catch {}

    updateEditingUI();
  }


  function requireEditor() {
    if (activeEditor) {
      return true;
    }

    alert(
      "Please select your name and click Start Editing before making changes."
    );

    return false;
  }


  function populateEditorList() {
    if (!editorUser) {
      return;
    }

    editorUser.innerHTML =
      `<option value="">Select your name</option>` +
      AUTHORIZED_EDITORS
        .map(
          editor =>
            `<option value="${escapeHTML(
              editor.id
            )}">${escapeHTML(
              editor.name
            )}</option>`
        )
        .join("");

    if (activeEditor) {
      editorUser.value =
        activeEditor.id;
    }
  }


  function updateEditingUI() {
    if (!editorSession) {
      return;
    }

    if (activeEditor) {
      editorSession.classList.add(
        "is-active"
      );

      if (editorSessionIcon) {
        editorSessionIcon.textContent =
          "✓";
      }

      if (editorSessionTitle) {
        editorSessionTitle.textContent =
          `Editing as ${activeEditor.name}`;
      }

      if (editorSessionMessage) {
        editorSessionMessage.textContent =
          "You can now create, edit, move, and delete calendar posts.";
      }

      if (editorUser) {
        editorUser.value =
          activeEditor.id;

        editorUser.disabled =
          true;
      }

      if (startEditing) {
        startEditing.hidden =
          true;
      }

      if (lockEditing) {
        lockEditing.hidden =
          false;
      }
    } else {
      editorSession.classList.remove(
        "is-active"
      );

      if (editorSessionIcon) {
        editorSessionIcon.textContent =
          "🔒";
      }

      if (editorSessionTitle) {
        editorSessionTitle.textContent =
          "Editing locked";
      }

      if (editorSessionMessage) {
        editorSessionMessage.textContent =
          "Select your name before making changes to the calendar.";
      }

      if (editorUser) {
        editorUser.disabled =
          false;
      }

      if (startEditing) {
        startEditing.hidden =
          false;

        startEditing.disabled =
          !editorUser ||
          !editorUser.value;
      }

      if (lockEditing) {
        lockEditing.hidden =
          true;
      }
    }

    if (
      typeof updateEditingControls ===
      "function"
    ) {
      updateEditingControls();
    }
  }


  function updateEditingControls() {
    const button =
      document.getElementById(
        "newPost"
      );

    if (!button) {
      return;
    }

    button.disabled =
      !activeEditor;

    button.setAttribute(
      "aria-disabled",
      String(!activeEditor)
    );
  }


  /* =========================================================
     CHANGE HISTORY
     ========================================================= */

  function addChangeHistory(
    post,
    field,
    fromValue,
    toValue
  ) {
    if (
      !post ||
      !activeEditor
    ) {
      return false;
    }

    const from =
      String(
        fromValue ?? ""
      );

    const to =
      String(
        toValue ?? ""
      );

    if (from === to) {
      return false;
    }

    if (
      !Array.isArray(
        post.changeHistory
      )
    ) {
      post.changeHistory =
        [];
    }

    post.changeHistory.push({
      id: createId(
        "change"
      ),

      field,

      from,

      to,

      changedBy:
        activeEditor.name,

      changedAt:
        new Date().toISOString()
    });

    return true;
  }


  function getLastChange(
    post,
    field
  ) {
    if (
      !post ||
      !Array.isArray(
        post.changeHistory
      )
    ) {
      return null;
    }

    for (
      let i =
        post.changeHistory.length - 1;
      i >= 0;
      i--
    ) {
      if (
        post.changeHistory[i]
          .field === field
      ) {
        return post.changeHistory[i];
      }
    }

    return null;
  }


  function auditValue(
    field,
    value
  ) {
    if (!value) {
      return "—";
    }

    if (
      field ===
      "platform"
    ) {
      return (
        PLATFORMS[value] ||
        value
      );
    }

    if (
      field ===
      "status"
    ) {
      return (
        POST_STATUSES[value] ||
        value
      );
    }

    if (
      field ===
      "approvalStatus"
    ) {
      return (
        APPROVAL_STATUSES[value] ||
        value
      );
    }

    if (
      field ===
      "date"
    ) {
      return formatPostDate(
        value
      );
    }

    if (
      field ===
      "time"
    ) {
      return formatTime(
        value
      );
    }

    return String(value);
  }


  function auditFieldName(
    field
  ) {
    return {
      platform:
        "Platform",

      caption:
        "Caption",

      hashtags:
        "Hashtags",

      date:
        "Date",

      time:
        "Time",

      approvalStatus:
        "Approval status",

      suggestions:
        "Suggestions / Feedback",

      status:
        "Post status",

      attachments:
        "Attachments"
    }[field] || field;
  }


  function renderPostAudit(
    post
  ) {
    if (
      approvalStatusMeta
    ) {
      const change =
        getLastChange(
          post,
          "approvalStatus"
        );

      approvalStatusMeta.textContent =
        change
          ? `Last modified by ${change.changedBy} on ${new Date(
              change.changedAt
            ).toLocaleString()}`
          : post?.createdBy
          ? `Created by ${post.createdBy} on ${new Date(
              post.createdAt
            ).toLocaleString()}`
          : "Last modified by: —";
    }

    if (
      postStatusMeta
    ) {
      const change =
        getLastChange(
          post,
          "status"
        );

      postStatusMeta.textContent =
        change
          ? `Last modified by ${change.changedBy} on ${new Date(
              change.changedAt
            ).toLocaleString()}`
          : post?.createdBy
          ? `Created by ${post.createdBy} on ${new Date(
              post.createdAt
            ).toLocaleString()}`
          : "Last modified by: —";
    }

    if (
      !postChangeHistory
    ) {
      return;
    }

    if (
      !post ||
      !Array.isArray(
        post.changeHistory
      ) ||
      !post.changeHistory.length
    ) {
      postChangeHistory.innerHTML =
        `<p class="smc-no-history">No changes recorded yet.</p>`;

      return;
    }

    postChangeHistory.innerHTML =
      [...post.changeHistory]
        .reverse()
        .map(
          change => `
            <article class="smc-change-history-item">
              <div class="smc-change-history-item-top">
                <span class="smc-change-history-field">
                  ${escapeHTML(
                    auditFieldName(
                      change.field
                    )
                  )}
                </span>

                <span class="smc-change-history-date">
                  ${escapeHTML(
                    new Date(
                      change.changedAt
                    ).toLocaleString()
                  )}
                </span>
              </div>

              <div class="smc-change-history-change">
                ${escapeHTML(
                  auditValue(
                    change.field,
                    change.from
                  )
                )}
                →
                ${escapeHTML(
                  auditValue(
                    change.field,
                    change.to
                  )
                )}
              </div>

              <div class="smc-change-history-person">
                ${escapeHTML(
                  change.changedBy
                )}
              </div>
            </article>
          `
        )
        .join("");
  }


  /* =========================================================
     ATTACHMENT INDEXEDDB
     ========================================================= */

  function openAttachmentDB() {
    if (
      attachmentDBPromise
    ) {
      return attachmentDBPromise;
    }

    attachmentDBPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {
          if (
            !window.indexedDB
          ) {
            reject(
              new Error(
                "IndexedDB is not supported."
              )
            );

            return;
          }

          const request =
            indexedDB.open(
              ATTACHMENT_DB_NAME,
              ATTACHMENT_DB_VERSION
            );

          request.addEventListener(
            "upgradeneeded",
            () => {
              const db =
                request.result;

              let store;

              if (
                !db.objectStoreNames.contains(
                  ATTACHMENT_STORE
                )
              ) {
                store =
                  db.createObjectStore(
                    ATTACHMENT_STORE,
                    {
                      keyPath: "id"
                    }
                  );
              } else {
                store =
                  request.transaction.objectStore(
                    ATTACHMENT_STORE
                  );
              }

              if (
                !store.indexNames.contains(
                  "postId"
                )
              ) {
                store.createIndex(
                  "postId",
                  "postId",
                  {
                    unique: false
                  }
                );
              }
            }
          );

          request.addEventListener(
            "success",
            () =>
              resolve(
                request.result
              )
          );

          request.addEventListener(
            "error",
            () =>
              reject(
                request.error
              )
          );
        }
      );

    return attachmentDBPromise;
  }


  async function saveAttachment(
    postId,
    file
  ) {
    const db =
      await openAttachmentDB();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const attachment = {
          id: createId(
            "attachment"
          ),

          postId,

          name:
            file.name,

          type:
            file.type ||
            "application/octet-stream",

          size:
            file.size,

          blob:
            file,

          createdAt:
            new Date().toISOString()
        };

        const transaction =
          db.transaction(
            ATTACHMENT_STORE,
            "readwrite"
          );

        transaction
          .objectStore(
            ATTACHMENT_STORE
          )
          .put(
            attachment
          );

        transaction.addEventListener(
          "complete",
          () =>
            resolve(
              attachment
            )
        );

        transaction.addEventListener(
          "error",
          () =>
            reject(
              transaction.error
            )
        );
      }
    );
  }


  async function getPostAttachments(
    postId
  ) {
    const db =
      await openAttachmentDB();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            ATTACHMENT_STORE,
            "readonly"
          );

        const index =
          transaction
            .objectStore(
              ATTACHMENT_STORE
            )
            .index(
              "postId"
            );

        const request =
          index.getAll(
            postId
          );

        request.addEventListener(
          "success",
          () =>
            resolve(
              request.result ||
              []
            )
        );

        request.addEventListener(
          "error",
          () =>
            reject(
              request.error
            )
        );
      }
    );
  }


  async function deleteAttachment(
    attachmentId
  ) {
    const db =
      await openAttachmentDB();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            ATTACHMENT_STORE,
            "readwrite"
          );

        transaction
          .objectStore(
            ATTACHMENT_STORE
          )
          .delete(
            attachmentId
          );

        transaction.addEventListener(
          "complete",
          resolve
        );

        transaction.addEventListener(
          "error",
          () =>
            reject(
              transaction.error
            )
        );
      }
    );
  }


  async function deletePostAttachments(
    postId
  ) {
    const attachments =
      await getPostAttachments(
        postId
      );

    for (
      const attachment of attachments
    ) {
      await deleteAttachment(
        attachment.id
      );
    }
  }


  async function getAttachment(
    id
  ) {
    const db =
      await openAttachmentDB();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const request =
          db
            .transaction(
              ATTACHMENT_STORE,
              "readonly"
            )
            .objectStore(
              ATTACHMENT_STORE
            )
            .get(id);

        request.addEventListener(
          "success",
          () =>
            resolve(
              request.result
            )
        );

        request.addEventListener(
          "error",
          () =>
            reject(
              request.error
            )
        );
      }
    );
  }


  /* =========================================================
     ATTACHMENTS UI
     ========================================================= */

  function renderPendingAttachments() {
    if (
      !postAttachmentsList
    ) {
      return;
    }

    if (
      !pendingPostFiles.length
    ) {
      postAttachmentsList.innerHTML =
        `<p class="smc-no-media">No attachments yet.</p>`;

      return;
    }

    postAttachmentsList.innerHTML =
      pendingPostFiles
        .map(
          (
            file,
            index
          ) => `
            <article class="smc-attachment">
              <div class="smc-attachment-icon">
                ${escapeHTML(
                  getFileIcon(
                    file.name
                  )
                )}
              </div>

              <div class="smc-attachment-info">
                <strong>
                  ${escapeHTML(
                    file.name
                  )}
                </strong>

                <small>
                  ${escapeHTML(
                    formatFileSize(
                      file.size
                    )
                  )}
                </small>
              </div>

              <div class="smc-attachment-actions">
                <button
                  type="button"
                  class="smc-attachment-remove"
                  data-remove-pending-attachment="${index}"
                >
                  Remove
                </button>
              </div>
            </article>
          `
        )
        .join("");
  }


  async function renderPostAttachments(
    postId
  ) {
    if (
      !postAttachmentsList
    ) {
      return;
    }

    if (!postId) {
      renderPendingAttachments();
      return;
    }

    postAttachmentsList.innerHTML =
      `<p class="smc-no-media">Loading attachments...</p>`;

    try {
      const attachments =
        await getPostAttachments(
          postId
        );

      if (
        !attachments.length
      ) {
        postAttachmentsList.innerHTML =
          `<p class="smc-no-media">No attachments yet.</p>`;

        return;
      }

      postAttachmentsList.innerHTML =
        attachments
          .map(
            attachment => `
              <article class="smc-attachment">
                <div class="smc-attachment-icon">
                  ${escapeHTML(
                    getFileIcon(
                      attachment.name
                    )
                  )}
                </div>

                <div class="smc-attachment-info">
                  <strong>
                    ${escapeHTML(
                      attachment.name
                    )}
                  </strong>

                  <small>
                    ${escapeHTML(
                      formatFileSize(
                        attachment.size
                      )
                    )}
                  </small>
                </div>

                <div class="smc-attachment-actions">
                  <button
                    type="button"
                    class="smc-attachment-download"
                    data-download-attachment="${escapeHTML(
                      attachment.id
                    )}"
                  >
                    Download
                  </button>

                  <button
                    type="button"
                    class="smc-attachment-remove"
                    data-remove-attachment="${escapeHTML(
                      attachment.id
                    )}"
                  >
                    Remove
                  </button>
                </div>
              </article>
            `
          )
          .join("");
    } catch (error) {
      console.error(
        "Unable to load attachments:",
        error
      );

      postAttachmentsList.innerHTML =
        `<p class="smc-no-media">Attachments could not be loaded.</p>`;
    }
  }


  async function downloadAttachment(
    id
  ) {
    try {
      const attachment =
        await getAttachment(
          id
        );

      if (!attachment) {
        alert(
          "Attachment could not be found."
        );

        return;
      }

      const url =
        URL.createObjectURL(
          attachment.blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        attachment.name;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Unable to download the attachment."
      );
    }
  }


  async function removePostAttachment(
    attachmentId,
    postId
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove this attachment?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAttachment(
        attachmentId
      );

      const post =
        state.posts.find(
          item =>
            item.id ===
            postId
        );

      if (post) {
        const attachments =
          await getPostAttachments(
            postId
          );

        post.attachments =
          attachments.map(
            item => ({
              id: item.id,
              name: item.name,
              type: item.type,
              size: item.size,
              createdAt:
                item.createdAt
            })
          );

        addChangeHistory(
          post,
          "attachments",
          "",
          "Attachment removed"
        );

        post.updatedAt =
          new Date().toISOString();

        saveLocalStateOnly();

        await savePostToSupabase(
          post
        );
      }

      await renderPostAttachments(
        postId
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Unable to remove the attachment."
      );
    }
  }


  function removePendingAttachment(
    index
  ) {
    pendingPostFiles.splice(
      index,
      1
    );

    renderPendingAttachments();
  }


  function handleFileSelection(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
          []
      );

    if (!files.length) {
      return;
    }

    pendingPostFiles =
      pendingPostFiles.concat(
        files
      );

    renderPendingAttachments();

    event.target.value =
      "";
  }


  /* =========================================================
     FILTERING
     ========================================================= */

  function getFilteredPosts() {
    const platform =
      platformFilter?.value ||
      "all";

    const status =
      statusFilter?.value ||
      "all";

    const search =
      (
        postSearch?.value ||
        ""
      )
        .trim()
        .toLowerCase();

    return state.posts.filter(
      post => {
        if (
          platform !== "all" &&
          post.platform !== platform
        ) {
          return false;
        }

        if (
          status !== "all" &&
          post.status !== status
        ) {
          return false;
        }

        if (search) {
          const text = [
            post.caption,
            post.hashtags,
            post.platform,
            post.status,
            post.approvalStatus,
            post.suggestions
          ]
            .join(" ")
            .toLowerCase();

          if (
            !text.includes(
              search
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }


  /* =========================================================
     STATISTICS
     ========================================================= */

  function renderStats() {
    const posts =
      state.posts;

    const month =
      currentDate.getMonth();

    const year =
      currentDate.getFullYear();

    const monthPosts =
      posts.filter(
        post => {
          if (!post.date) {
            return false;
          }

          const date =
            parseDateTime(
              post.date
            );

          return (
            date.getMonth() ===
              month &&
            date.getFullYear() ===
              year
          );
        }
      );

    const count =
      status =>
        posts.filter(
          post =>
            post.status ===
            status
        ).length;

    if (statTotal) {
      statTotal.textContent =
        posts.length;
    }

    if (statDraft) {
      statDraft.textContent =
        count("draft");
    }

    if (statScheduled) {
      statScheduled.textContent =
        count("scheduled");
    }

    if (statStuck) {
      statStuck.textContent =
        count("stuck");
    }

    if (statRunning) {
      statRunning.textContent =
        count("running");
    }

    if (statOnHold) {
      statOnHold.textContent =
        count("on-hold");
    }

    if (statPublished) {
      statPublished.textContent =
        count("published");
    }

    if (statMonth) {
      statMonth.textContent =
        monthPosts.length;
    }

    if (statPlatforms) {
      const unique =
        new Set(
          posts.map(
            post =>
              post.platform
          )
        );

      statPlatforms.textContent =
        unique.size;
    }
  }


  /* =========================================================
     CALENDAR
     ========================================================= */

  function renderCalendar() {
    if (!calendar) {
      return;
    }

    calendar.innerHTML = "";

    const year =
      currentDate.getFullYear();

    const month =
      currentDate.getMonth();

    if (calendarTitle) {
      calendarTitle.textContent =
        new Intl.DateTimeFormat(
          "en-US",
          {
            month: "long",
            year: "numeric"
          }
        ).format(
          currentDate
        );
    }

    const weekdays = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ];

    weekdays.forEach(
      day => {
        const element =
          document.createElement(
            "div"
          );

        element.className =
          "smc-weekday";

        element.textContent =
          day;

        calendar.appendChild(
          element
        );
      }
    );

    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const previousMonthDays =
      new Date(
        year,
        month,
        0
      ).getDate();

    const totalCells =
      Math.ceil(
        (
          firstDay +
          daysInMonth
        ) / 7
      ) * 7;

    const posts =
      getFilteredPosts();

    for (
      let index = 0;
      index < totalCells;
      index++
    ) {
      let cellDate;
      let dayNumber;

      if (
        index <
        firstDay
      ) {
        dayNumber =
          previousMonthDays -
          firstDay +
          index +
          1;

        cellDate =
          new Date(
            year,
            month - 1,
            dayNumber
          );
      } else if (
        index >=
        firstDay +
        daysInMonth
      ) {
        dayNumber =
          index -
          firstDay -
          daysInMonth +
          1;

        cellDate =
          new Date(
            year,
            month + 1,
            dayNumber
          );
      } else {
        dayNumber =
          index -
          firstDay +
          1;

        cellDate =
          new Date(
            year,
            month,
            dayNumber
          );
      }

      const cell =
        document.createElement(
          "div"
        );

      cell.className =
        "smc-day";

      if (
        cellDate.getMonth() !==
        month
      ) {
        cell.classList.add(
          "other-month"
        );
      }

      const dateKey =
        getDateKey(
          cellDate
        );

      cell.dataset.date =
        dateKey;

      if (
        dateKey ===
        getTodayKey()
      ) {
        cell.classList.add(
          "today"
        );
      }

      const number =
        document.createElement(
          "div"
        );

      number.className =
        "smc-day-number";

      number.textContent =
        dayNumber;

      cell.appendChild(
        number
      );

      const postsContainer =
        document.createElement(
          "div"
        );

      postsContainer.className =
        "smc-day-posts";

      posts
        .filter(
          post =>
            post.date ===
            dateKey
        )
        .sort(
          (
            a,
            b
          ) =>
            getPostDateTime(a) -
            getPostDateTime(b)
        )
        .forEach(
          post => {
            postsContainer.appendChild(
              createCalendarPost(
                post
              )
            );
          }
        );

      cell.appendChild(
        postsContainer
      );

      cell.addEventListener(
        "dblclick",
        () => {
          if (
            !requireEditor()
          ) {
            return;
          }

          if (
            isPastDate(
              dateKey
            )
          ) {
            alert(
              "You cannot create a new post for a date that has already passed."
            );

            return;
          }

          openPost(
            null,
            dateKey
          );
        }
      );

      cell.addEventListener(
        "dragover",
        event => {
          if (!activeEditor) {
            return;
          }

          event.preventDefault();

          cell.classList.add(
            "is-drop-target"
          );
        }
      );

      cell.addEventListener(
        "dragleave",
        () => {
          cell.classList.remove(
            "is-drop-target"
          );
        }
      );

      cell.addEventListener(
        "drop",
        async event => {
          event.preventDefault();

          cell.classList.remove(
            "is-drop-target"
          );

          if (
            !requireEditor()
          ) {
            return;
          }

          const id =
            event.dataTransfer.getData(
              "text/plain"
            );

          if (!id) {
            return;
          }

          await movePostToDate(
            id,
            dateKey
          );
        }
      );

      calendar.appendChild(
        cell
      );
    }
  }


  function createCalendarPost(
    post
  ) {
    const article =
      document.createElement(
        "article"
      );

    article.className =
      "smc-calendar-post";

    article.dataset.id =
      post.id;

    article.draggable =
      Boolean(
        activeEditor
      );

    article.tabIndex =
      0;

    const platform =
      PLATFORMS[
        post.platform
      ] ||
      post.platform;

    article.innerHTML = `
      <div class="smc-calendar-post-top">

        <span
          class="smc-status-dot ${escapeHTML(
            post.status
          )}"
          aria-hidden="true"
        ></span>

        <span class="smc-calendar-post-time">
          ${escapeHTML(
            formatTime(
              post.time
            )
          )}
        </span>

        <span class="smc-calendar-post-platform">
          ${escapeHTML(
            platform
          )}
        </span>

      </div>

      <div class="smc-calendar-post-caption">
        ${escapeHTML(
          post.caption ||
            "Untitled social post"
        )}
      </div>
    `;

    article.addEventListener(
      "click",
      () => {
        openPost(
          post.id
        );
      }
    );

    article.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
            "Enter" ||
          event.key ===
            " "
        ) {
          event.preventDefault();

          openPost(
            post.id
          );
        }
      }
    );

    article.addEventListener(
      "contextmenu",
      event => {
        event.preventDefault();

        if (
          requireEditor()
        ) {
          deletePost(
            post.id
          );
        }
      }
    );

    article.addEventListener(
      "dragstart",
      event => {
        if (
          !requireEditor()
        ) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed =
          "move";

        event.dataTransfer.setData(
          "text/plain",
          post.id
        );

        article.classList.add(
          "is-dragging"
        );
      }
    );

    article.addEventListener(
      "dragend",
      () => {
        article.classList.remove(
          "is-dragging"
        );

        document
          .querySelectorAll(
            ".smc-day.is-drop-target"
          )
          .forEach(
            element =>
              element.classList.remove(
                "is-drop-target"
              )
          );
      }
    );

    return article;
  }


  /* =========================================================
     UPCOMING POSTS
     ========================================================= */

  function renderUpcomingPosts() {
    if (!upcomingPosts) {
      return;
    }

    const posts =
      state.posts
        .filter(
          post =>
            post.status ===
            "scheduled"
        )
        .sort(
          (
            a,
            b
          ) =>
            getPostDateTime(a) -
            getPostDateTime(b)
        )
        .slice(
          0,
          8
        );

    if (!posts.length) {
      upcomingPosts.innerHTML =
        `<div class="smc-empty">No scheduled posts yet.</div>`;

      return;
    }

    upcomingPosts.innerHTML =
      posts
        .map(
          post => {
            const date =
              formatUpcomingDate(
                post.date,
                post.time
              );

            return `
              <article
                class="smc-upcoming-item"
                data-id="${escapeHTML(
                  post.id
                )}"
              >

                <div class="smc-upcoming-date">
                  <strong>
                    ${escapeHTML(
                      date.day
                    )}
                  </strong>

                  <small>
                    ${escapeHTML(
                      date.time
                    )}
                  </small>
                </div>

                <div class="smc-upcoming-content">

                  <div class="smc-upcoming-meta">

                    <span class="smc-platform-badge">
                      ${escapeHTML(
                        PLATFORMS[
                          post.platform
                        ] ||
                          post.platform
                      )}
                    </span>

                    <span class="smc-status-badge scheduled">
                      Scheduled
                    </span>

                  </div>

                  <h3>
                    ${escapeHTML(
                      post.caption ||
                        "Untitled social post"
                    )}
                  </h3>

                  <p>
                    ${escapeHTML(
                      post.hashtags ||
                        ""
                    )}
                  </p>

                </div>

              </article>
            `;
          }
        )
        .join("");

    upcomingPosts
      .querySelectorAll(
        ".smc-upcoming-item"
      )
      .forEach(
        item => {
          item.addEventListener(
            "click",
            () => {
              openPost(
                item.dataset.id
              );
            }
          );
        }
      );
  }


  /* =========================================================
     DATE/TIME
     ========================================================= */

  function getNextAvailableTime() {
    const now =
      new Date();

    let hour =
      now.getHours();

    let minute =
      now.getMinutes();

    minute =
      Math.ceil(
        minute / 15
      ) * 15;

    if (minute === 60) {
      hour++;
      minute = 0;
    }

    if (hour >= 24) {
      return null;
    }

    return `${String(
      hour
    ).padStart(
      2,
      "0"
    )}:${String(
      minute
    ).padStart(
      2,
      "0"
    )}`;
  }


  function getDefaultPostDateTime(
    dateOverride
  ) {
    if (
      dateOverride &&
      !isPastDate(
        dateOverride
      )
    ) {
      return {
        date:
          dateOverride,

        time:
          dateOverride ===
          getTodayKey()
            ? getNextAvailableTime() ||
              "09:00"
            : "09:00"
      };
    }

    const today =
      getTodayKey();

    const next =
      getNextAvailableTime();

    if (next) {
      return {
        date: today,
        time: next
      };
    }

    const tomorrow =
      new Date();

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    return {
      date:
        getDateKey(
          tomorrow
        ),
      time: "09:00"
    };
  }


  function updateDateTimeMinimums() {
    if (
      !postDateInput ||
      !postTimeInput
    ) {
      return;
    }

    const today =
      getTodayKey();

    postDateInput.min =
      today;

    if (
      postDateInput.value ===
      today
    ) {
      const next =
        getNextAvailableTime();

      postTimeInput.min =
        next || "23:59";
    } else {
      postTimeInput.removeAttribute(
        "min"
      );
    }
  }


  /* =========================================================
     OPEN / CLOSE POST
     ========================================================= */

  async function openPost(
    postId = null,
    dateOverride = null
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    pendingPostFiles =
      [];

    if (
      postFilesInput
    ) {
      postFilesInput.value =
        "";
    }

    if (
      postId
    ) {
      const post =
        state.posts.find(
          item =>
            item.id ===
            postId
        );

      if (!post) {
        return;
      }

      postDialogTitle.textContent =
        "Edit post";

      postIdInput.value =
        post.id;

      postPlatformInput.value =
        post.platform;

      postCaptionInput.value =
        post.caption;

      postHashtagsInput.value =
        post.hashtags;

      postDateInput.value =
        post.date;

      postTimeInput.value =
        post.time ||
        "09:00";

      postApprovalStatusInput.value =
        post.approvalStatus ||
        "in-review";

      postSuggestionsInput.value =
        post.suggestions ||
        "";

      postStatusInput.value =
        post.status ||
        "draft";

      await renderPostAttachments(
        post.id
      );

      renderPostAudit(
        post
      );
    } else {
      const defaults =
        getDefaultPostDateTime(
          dateOverride
        );

      postDialogTitle.textContent =
        "Create post";

      postIdInput.value =
        "";

      postPlatformInput.value =
        "linkedin";

      postCaptionInput.value =
        "";

      postHashtagsInput.value =
        "";

      postDateInput.value =
        defaults.date;

      postTimeInput.value =
        defaults.time;

      postApprovalStatusInput.value =
        "in-review";

      postSuggestionsInput.value =
        "";

      postStatusInput.value =
        "draft";

      renderPendingAttachments();

      renderPostAudit(
        null
      );
    }

    updateDateTimeMinimums();

    updateCaptionCount();

    if (
      typeof postDialog.showModal ===
      "function"
    ) {
      postDialog.showModal();
    } else {
      postDialog.setAttribute(
        "open",
        ""
      );
    }
  }


  function closeDialog() {
    if (
      postDialog &&
      typeof postDialog.close ===
        "function"
    ) {
      postDialog.close();
    } else if (
      postDialog
    ) {
      postDialog.removeAttribute(
        "open"
      );
    }

    pendingPostFiles =
      [];

    if (
      postFilesInput
    ) {
      postFilesInput.value =
        "";
    }

    if (
      postAttachmentsList
    ) {
      postAttachmentsList.innerHTML =
        `<p class="smc-no-media">No attachments yet.</p>`;
    }

    if (
      postChangeHistory
    ) {
      postChangeHistory.innerHTML =
        `<p class="smc-no-history">No changes recorded yet.</p>`;
    }

    if (
      approvalStatusMeta
    ) {
      approvalStatusMeta.textContent =
        "Last modified by: —";
    }

    if (
      postStatusMeta
    ) {
      postStatusMeta.textContent =
        "Last modified by: —";
    }
  }


  /* =========================================================
     SAVE POST
     ========================================================= */

  async function savePost(
    event
  ) {
    event.preventDefault();

    if (
      !requireEditor()
    ) {
      return;
    }

    const date =
      postDateInput.value;

    const time =
      postTimeInput.value;

    if (
      !date ||
      !time
    ) {
      alert(
        "Please choose a date and time."
      );

      return;
    }

    const status =
      postStatusInput.value;

    if (
      status !==
        "published" &&
      isPastSchedule(
        date,
        time
      )
    ) {
      alert(
        "New and non-published posts must use a future date and time."
      );

      return;
    }

    const id =
      postIdInput.value ||
      createId("post");

    const existing =
      state.posts.find(
        post =>
          post.id ===
          id
      );

    const now =
      new Date().toISOString();

    const post = {
      id,

      platform:
        postPlatformInput.value,

      caption:
        postCaptionInput.value.trim(),

      hashtags:
        postHashtagsInput.value.trim(),

      date,

      time,

      approvalStatus:
        postApprovalStatusInput.value,

      suggestions:
        postSuggestionsInput.value.trim(),

      status,

      image: "",

      createdAt:
        existing?.createdAt ||
        now,

      createdBy:
        existing?.createdBy ||
        activeEditor.name,

      updatedAt:
        existing?.updatedAt ||
        now,

      changeHistory:
        existing?.changeHistory
          ? [
              ...existing.changeHistory
            ]
          : [],

      attachments:
        existing?.attachments
          ? [
              ...existing.attachments
            ]
          : []
    };


    /* =======================================================
       TRACK CHANGES
       ======================================================= */

    if (existing) {
      const fields = [
        "platform",
        "caption",
        "hashtags",
        "date",
        "time",
        "approvalStatus",
        "suggestions",
        "status"
      ];

      let changed =
        false;

      fields.forEach(
        field => {
          const oldValue =
            existing[field] ??
            "";

          const newValue =
            post[field] ??
            "";

          if (
            String(oldValue) !==
            String(newValue)
          ) {
            if (
              addChangeHistory(
                post,
                field,
                oldValue,
                newValue
              )
            ) {
              changed =
                true;
            }
          }
        }
      );

      if (changed) {
        post.updatedAt =
          now;
      } else {
        post.updatedAt =
          existing.updatedAt ||
          now;
      }
    } else {
      addChangeHistory(
        post,
        "approvalStatus",
        "",
        post.approvalStatus
      );

      addChangeHistory(
        post,
        "status",
        "",
        post.status
      );

      post.changeHistory.push({
        id: createId(
          "change"
        ),

        field: "created",

        from: "",

        to: "Post created",

        changedBy:
          activeEditor.name,

        changedAt: now
      });
    }


    /* =======================================================
       SAVE LOCALLY FIRST
       ======================================================= */

    const index =
      state.posts.findIndex(
        item =>
          item.id ===
          id
      );

    if (index === -1) {
      state.posts.push(
        post
      );
    } else {
      state.posts[index] =
        post;
    }

    saveLocalStateOnly();


    /* =======================================================
       SAVE ATTACHMENTS
       ======================================================= */

    if (
      pendingPostFiles.length
    ) {
      try {
        for (
          const file of
            pendingPostFiles
        ) {
          const attachment =
            await saveAttachment(
              post.id,
              file
            );

          post.attachments.push({
            id:
              attachment.id,

            name:
              attachment.name,

            type:
              attachment.type,

            size:
              attachment.size,

            createdAt:
              attachment.createdAt
          });
        }

        addChangeHistory(
          post,
          "attachments",
          "",
          `Added ${pendingPostFiles.length} attachment(s)`
        );

        post.updatedAt =
          new Date().toISOString();

        saveLocalStateOnly();
      } catch (error) {
        console.error(
          "Attachment error:",
          error
        );

        alert(
          "The post was saved, but one or more attachments could not be saved."
        );
      }
    }


    /* =======================================================
       SAVE TO SUPABASE
       ======================================================= */

    try {
      await savePostToSupabase(
        post
      );
    } catch (error) {
      console.error(
        "Supabase save error:",
        error
      );

      alert(
        "The post was saved locally, but Supabase could not save it. Please check your Supabase URL, anon key, and RLS policies."
      );

      return;
    }


    pendingPostFiles =
      [];

    closeDialog();

    render();
  }


  /* =========================================================
     DELETE POST
     ========================================================= */

  async function deletePost(
    postId
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    const post =
      state.posts.find(
        item =>
          item.id ===
          postId
      );

    if (!post) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this social media post?"
      );

    if (!confirmed) {
      return;
    }

    const oldPosts =
      [...state.posts];

    state.posts =
      state.posts.filter(
        item =>
          item.id !==
          postId
      );

    saveLocalStateOnly();

    try {
      await deletePostFromSupabase(
        postId
      );

      await deletePostAttachments(
        postId
      );
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      state.posts =
        oldPosts;

      saveLocalStateOnly();

      alert(
        "The post could not be deleted from Supabase. Your local calendar has been restored."
      );

      render();

      return;
    }

    render();
  }


  /* =========================================================
     MOVE POST
     ========================================================= */

  async function movePostToDate(
    postId,
    newDate
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    const post =
      state.posts.find(
        item =>
          item.id ===
          postId
      );

    if (!post) {
      return;
    }

    if (
      isPastDate(
        newDate
      )
    ) {
      alert(
        "You cannot move a post to a date that has already passed."
      );

      return;
    }

    if (
      post.date ===
      newDate
    ) {
      return;
    }

    const oldDate =
      post.date;

    post.date =
      newDate;

    addChangeHistory(
      post,
      "date",
      oldDate,
      newDate
    );

    post.updatedAt =
      new Date().toISOString();

    saveLocalStateOnly();

    try {
      await savePostToSupabase(
        post
      );
    } catch (error) {
      console.error(
        error
      );

      post.date =
        oldDate;

      saveLocalStateOnly();

      alert(
        "The post could not be moved because Supabase could not save the change."
      );
    }

    render();
  }


  /* =========================================================
     CAPTION COUNT
     ========================================================= */

  function updateCaptionCount() {
    if (
      captionCount &&
      postCaptionInput
    ) {
      captionCount.textContent =
        postCaptionInput.value.length;
    }
  }


  /* =========================================================
     MAIN RENDER
     ========================================================= */

  function render() {
    renderCalendar();
    renderUpcomingPosts();
    renderStats();
  }


  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  const newPostButton =
    document.getElementById(
      "newPost"
    );

  if (
    newPostButton
  ) {
    newPostButton.addEventListener(
      "click",
      () => {
        if (
          requireEditor()
        ) {
          openPost();
        }
      }
    );
  }


  if (
    editorUser
  ) {
    editorUser.addEventListener(
      "change",
      () => {
        if (
          startEditing
        ) {
          startEditing.disabled =
            !editorUser.value;
        }
      }
    );
  }


  if (
    startEditing
  ) {
    startEditing.addEventListener(
      "click",
      () => {
        if (
          !editorUser ||
          !editorUser.value
        ) {
          alert(
            "Please select your name first."
          );

          return;
        }

        if (
          setActiveEditor(
            editorUser.value
          )
        ) {
          render();
        }
      }
    );
  }


  if (
    lockEditing
  ) {
    lockEditing.addEventListener(
      "click",
      () => {
        if (
          window.confirm(
            "Lock editing for this session?"
          )
        ) {
          clearActiveEditor();
          render();
        }
      }
    );
  }


  const previousMonth =
    document.getElementById(
      "previousMonth"
    );

  if (
    previousMonth
  ) {
    previousMonth.addEventListener(
      "click",
      () => {
        currentDate =
          new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - 1,
            1
          );

        render();
      }
    );
  }


  const nextMonth =
    document.getElementById(
      "nextMonth"
    );

  if (
    nextMonth
  ) {
    nextMonth.addEventListener(
      "click",
      () => {
        currentDate =
          new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            1
          );

        render();
      }
    );
  }


  const todayButton =
    document.getElementById(
      "todayButton"
    );

  if (
    todayButton
  ) {
    todayButton.addEventListener(
      "click",
      () => {
        const today =
          new Date();

        currentDate =
          new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );

        render();
      }
    );
  }


  if (
    platformFilter
  ) {
    platformFilter.addEventListener(
      "change",
      render
    );
  }


  if (
    statusFilter
  ) {
    statusFilter.addEventListener(
      "change",
      render
    );
  }


  if (
    postSearch
  ) {
    postSearch.addEventListener(
      "input",
      render
    );
  }


  if (
    postForm
  ) {
    postForm.addEventListener(
      "submit",
      savePost
    );
  }


  if (
    postCaptionInput
  ) {
    postCaptionInput.addEventListener(
      "input",
      updateCaptionCount
    );
  }


  if (
    postFilesInput
  ) {
    postFilesInput.addEventListener(
      "change",
      handleFileSelection
    );
  }


  if (
    postDateInput
  ) {
    postDateInput.addEventListener(
      "change",
      updateDateTimeMinimums
    );
  }


  if (
    postTimeInput
  ) {
    postTimeInput.addEventListener(
      "change",
      updateDateTimeMinimums
    );
  }


  if (
    postApprovalStatusInput
  ) {
    postApprovalStatusInput.addEventListener(
      "change",
      () => {
        const post =
          state.posts.find(
            item =>
              item.id ===
              postIdInput.value
          );

        if (post) {
          renderPostAudit(
            post
          );
        }
      }
    );
  }


  if (
    postStatusInput
  ) {
    postStatusInput.addEventListener(
      "change",
      () => {
        const post =
          state.posts.find(
            item =>
              item.id ===
              postIdInput.value
          );

        if (post) {
          renderPostAudit(
            post
          );
        }
      }
    );
  }


  if (
    postAttachmentsList
  ) {
    postAttachmentsList.addEventListener(
      "click",
      event => {
        const download =
          event.target.closest(
            "[data-download-attachment]"
          );

        if (download) {
          downloadAttachment(
            download.dataset
              .downloadAttachment
          );

          return;
        }

        const remove =
          event.target.closest(
            "[data-remove-attachment]"
          );

        if (remove) {
          removePostAttachment(
            remove.dataset
              .removeAttachment,
            postIdInput.value
          );

          return;
        }

        const pending =
          event.target.closest(
            "[data-remove-pending-attachment]"
          );

        if (pending) {
          removePendingAttachment(
            Number(
              pending.dataset
                .removePendingAttachment
            )
          );
        }
      }
    );
  }


  document
    .querySelectorAll(
      "[data-close='postDialog']"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          closeDialog
        );
      }
    );


  if (
    postDialog
  ) {
    postDialog.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          postDialog
        ) {
          closeDialog();
        }
      }
    );

    postDialog.addEventListener(
      "close",
      () => {
        pendingPostFiles =
          [];

        if (
          postFilesInput
        ) {
          postFilesInput.value =
            "";
        }
      }
    );
  }


  /* =========================================================
     YEAR
     ========================================================= */

  const yearElement =
    document.getElementById(
      "year"
    );

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  activeEditor =
    getActiveEditor();

  populateEditorList();

  updateEditingUI();

  /*
   * Render immediately using local data,
   * then replace it with Supabase data.
   */
  render();

  (async () => {
    try {
      await initializeSupabase();

      await loadState();

      render();

      console.log(
        "Social Media Calendar connected to Supabase."
      );
    } catch (error) {
      console.error(
        "Supabase initialization failed:",
        error
      );

      console.warn(
        "The calendar will continue using local browser storage until Supabase is configured."
      );

      render();
    }
  })();

})();
