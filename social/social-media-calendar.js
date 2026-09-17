(() => {
  "use strict";

  /* =========================================================
     STORAGE
     ========================================================= */

  const STORAGE_KEY =
    "kevin_social_media_calendar_v1";

  const EDITOR_SESSION_KEY =
    "kevin_social_media_calendar_editor";

  /*
   * Add additional authorized team members here.
   *
   * IMPORTANT:
   * This is an identity-selection system, not secure
   * authentication. GitHub Pages cannot securely verify
   * someone's identity without an external authentication
   * service.
   */
  const AUTHORIZED_EDITORS = [
    {
      id: "kevin-arevalo",
      name: "Kevin Arevalo"
    }

    /*
     * Example:
     *
     * {
     *   id: "john-doe",
     *   name: "John Doe"
     * }
     */
  ];


  /* =========================================================
     POST / APPROVAL STATUSES
     ========================================================= */

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


  /* =========================================================
     INDEXEDDB ATTACHMENT STORAGE
     ========================================================= */

  /*
   * Attachments are stored separately from localStorage.
   * This allows the original files to remain downloadable
   * after the page is refreshed.
   */
  const ATTACHMENT_DB_NAME =
    "kevin_social_media_calendar_files";

  const ATTACHMENT_DB_VERSION = 1;
  const ATTACHMENT_STORE = "attachments";


  const PLATFORMS = {
    linkedin: "LinkedIn",
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X"
  };


  /* =========================================================
     STATE
     ========================================================= */

  let state = {
    posts: []
  };

  let currentDate = new Date();

  /*
   * Files selected for a brand-new post are held here
   * until the post is saved.
   */
  let pendingPostFiles = [];

  let attachmentDBPromise = null;

  /*
   * Active editor for this browser session.
   */
  let activeEditor = null;


  /* =========================================================
     DOM REFERENCES
     ========================================================= */

  const calendar =
    document.getElementById("calendar");

  const calendarTitle =
    document.getElementById("calendarTitle");

  const upcomingPosts =
    document.getElementById("upcomingPosts");

  const postDialog =
    document.getElementById("postDialog");

  const postForm =
    document.getElementById("postForm");

  const postDialogTitle =
    document.getElementById("postDialogTitle");

  const postIdInput =
    document.getElementById("postId");

  const postPlatformInput =
    document.getElementById("postPlatform");

  const postCaptionInput =
    document.getElementById("postCaption");

  const postHashtagsInput =
    document.getElementById("postHashtags");

  const postDateInput =
    document.getElementById("postDate");

  const postTimeInput =
    document.getElementById("postTime");

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
    document.getElementById("postStatus");

  const postStatusMeta =
    document.getElementById(
      "postStatusMeta"
    );

  const postChangeHistory =
    document.getElementById(
      "postChangeHistory"
    );

  const postFilesInput =
    document.getElementById("postFiles");

  const postAttachmentsList =
    document.getElementById(
      "postAttachmentsList"
    );

  const captionCount =
    document.getElementById("captionCount");

  const platformFilter =
    document.getElementById(
      "platformFilter"
    );

  const statusFilter =
    document.getElementById(
      "statusFilter"
    );

  const postSearch =
    document.getElementById("postSearch");


  /* =========================================================
     EDITOR SESSION DOM
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
     STATISTICS DOM
     ========================================================= */

  const statTotal =
    document.getElementById("statTotal");

  /*
   * Your HTML uses statDraft.
   * The original JS used statDrafts.
   *
   * Support both so nothing breaks.
   */
  const statDraft =
    document.getElementById("statDraft") ||
    document.getElementById("statDrafts");

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
    document.getElementById("statMonth");

  const statPlatforms =
    document.getElementById(
      "statPlatforms"
    );


  /* =========================================================
     GENERAL HELPERS
     ========================================================= */

  function createId(prefix = "id") {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }


  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatFileSize(bytes) {
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
    let unitIndex = 0;

    while (
      size >= 1024 &&
      unitIndex < units.length - 1
    ) {
      size /= 1024;
      unitIndex++;
    }

    if (unitIndex === 0) {
      return `${size} ${units[unitIndex]}`;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }


  function getFileIcon(fileName) {
    const extension =
      String(fileName || "")
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
        "pdf",
        "doc",
        "docx",
        "txt"
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
        "ppt",
        "pptx"
      ].includes(extension)
    ) {
      return "PPT";
    }

    if (
      [
        "zip",
        "rar",
        "7z"
      ].includes(extension)
    ) {
      return "ZIP";
    }

    return "FILE";
  }


  function formatTime(timeString) {
    if (!timeString) {
      return "";
    }

    const parts =
      timeString.split(":");

    if (parts.length < 2) {
      return timeString;
    }

    const date = new Date();

    date.setHours(
      Number(parts[0]),
      Number(parts[1]),
      0,
      0
    );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }


  function formatMonthYear(date) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(date);
  }


  function formatPostDate(dateString) {
    const date =
      new Date(
        `${dateString}T00:00:00`
      );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    ).format(date);
  }


  function formatUpcomingDate(
    dateString,
    timeString
  ) {
    const date =
      new Date(
        `${dateString}T${timeString || "00:00"}`
      );

    return {
      day: new Intl.DateTimeFormat(
        "en-US",
        {
          month: "short",
          day: "numeric"
        }
      ).format(date),

      time: new Intl.DateTimeFormat(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit"
        }
      ).format(date)
    };
  }


  function getDateKey(date) {
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


  function getTodayKey() {
    return getDateKey(
      new Date()
    );
  }


  function getMonthKey(dateString) {
    return String(
      dateString || ""
    ).slice(0, 7);
  }


  function getPostDateTime(post) {
    return new Date(
      `${post.date}T${post.time || "00:00"}`
    ).getTime();
  }


  function getSelectedDateTime(
    dateString,
    timeString
  ) {
    if (
      !dateString ||
      !timeString
    ) {
      return null;
    }

    const dateTime =
      new Date(
        `${dateString}T${timeString}`
      );

    if (
      Number.isNaN(
        dateTime.getTime()
      )
    ) {
      return null;
    }

    return dateTime;
  }


  function isPastSchedule(
    dateString,
    timeString
  ) {
    const selectedDateTime =
      getSelectedDateTime(
        dateString,
        timeString
      );

    if (!selectedDateTime) {
      return false;
    }

    return (
      selectedDateTime.getTime() <
      Date.now()
    );
  }


  function isPastDate(dateString) {
    if (!dateString) {
      return false;
    }

    return (
      dateString <
      getTodayKey()
    );
  }


  function getNextAvailableTime() {
    const now = new Date();

    const minutes =
      now.getMinutes();

    const roundedMinutes =
      Math.ceil(
        (minutes + 1) / 15
      ) * 15;

    const nextTime =
      new Date(now);

    nextTime.setSeconds(0, 0);

    nextTime.setMinutes(
      roundedMinutes
    );

    if (
      getDateKey(nextTime) !==
      getTodayKey()
    ) {
      return null;
    }

    return (
      String(
        nextTime.getHours()
      ).padStart(2, "0") +
      ":" +
      String(
        nextTime.getMinutes()
      ).padStart(2, "0")
    );
  }


  function getDefaultPostDateTime(
    dateOverride = null
  ) {
    const todayKey =
      getTodayKey();

    if (
      dateOverride &&
      !isPastDate(dateOverride)
    ) {
      if (
        dateOverride ===
        todayKey
      ) {
        const nextTime =
          getNextAvailableTime();

        if (nextTime) {
          return {
            date: todayKey,
            time: nextTime
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

      return {
        date: dateOverride,
        time: "09:00"
      };
    }

    const nextTime =
      getNextAvailableTime();

    if (nextTime) {
      return {
        date: todayKey,
        time: nextTime
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

    const todayKey =
      getTodayKey();

    postDateInput.min =
      todayKey;

    if (
      postDateInput.value ===
      todayKey
    ) {
      const nextTime =
        getNextAvailableTime();

      postTimeInput.min =
        nextTime || "23:59";

      if (
        postTimeInput.value &&
        nextTime &&
        postTimeInput.value <
          nextTime
      ) {
        postTimeInput.value =
          nextTime;
      }
    } else {
      postTimeInput.removeAttribute(
        "min"
      );
    }
  }


  /* =========================================================
     EDITOR IDENTITY / SESSION
     ========================================================= */

  function getEditorById(editorId) {
    return (
      AUTHORIZED_EDITORS.find(
        (editor) =>
          editor.id === editorId
      ) || null
    );
  }


  function getActiveEditor() {
    try {
      const savedId =
        sessionStorage.getItem(
          EDITOR_SESSION_KEY
        );

      if (!savedId) {
        return null;
      }

      const editor =
        getEditorById(savedId);

      if (!editor) {
        sessionStorage.removeItem(
          EDITOR_SESSION_KEY
        );

        return null;
      }

      return editor;
    } catch (error) {
      console.error(
        "Unable to read editor session:",
        error
      );

      return null;
    }
  }


  function setActiveEditor(
    editorId
  ) {
    const editor =
      getEditorById(editorId);

    if (!editor) {
      return false;
    }

    activeEditor = editor;

    try {
      sessionStorage.setItem(
        EDITOR_SESSION_KEY,
        editor.id
      );
    } catch (error) {
      console.error(
        "Unable to save editor session:",
        error
      );
    }

    updateEditingUI();

    return true;
  }


  function clearActiveEditor() {
    activeEditor = null;

    try {
      sessionStorage.removeItem(
        EDITOR_SESSION_KEY
      );
    } catch (error) {
      console.error(
        "Unable to clear editor session:",
        error
      );
    }

    closeDialog();

    updateEditingUI();

    render();
  }


  function requireEditor() {
    if (activeEditor) {
      return true;
    }

    updateEditingUI();

    if (editorUser) {
      editorUser.focus();
    }

    alert(
      "Please select your name and start an editing session before making changes."
    );

    return false;
  }


  function populateEditorList() {
    if (!editorUser) {
      return;
    }

    /*
     * Keep the existing placeholder.
     * Rebuild the configured names.
     */
    editorUser.innerHTML =
      `<option value="">Select your name</option>`;

    AUTHORIZED_EDITORS.forEach(
      (editor) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          editor.id;

        option.textContent =
          editor.name;

        editorUser.appendChild(
          option
        );
      }
    );
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

        /*
         * Once editing starts, the name cannot
         * simply be changed from the dropdown.
         * The user must lock editing first.
         */
        editorUser.disabled = true;
      }

      if (startEditing) {
        startEditing.hidden = true;
        startEditing.disabled = true;
      }

      if (lockEditing) {
        lockEditing.hidden = false;
        lockEditing.disabled = false;
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
        editorUser.disabled = false;
      }

      if (startEditing) {
        startEditing.hidden = false;

        startEditing.disabled =
          !editorUser ||
          !editorUser.value;
      }

      if (lockEditing) {
        lockEditing.hidden = true;
      }
    }

    updateEditingControls();
  }


  function updateEditingControls() {
    if (newPostButton) {
      newPostButton.disabled =
        !activeEditor;

      newPostButton.setAttribute(
        "aria-disabled",
        String(!activeEditor)
      );

      newPostButton.title =
        activeEditor
          ? "Create a new post"
          : "Select your name to enable editing";
    }
  }


  /* =========================================================
     AUDIT / CHANGE HISTORY
     ========================================================= */

  function normalizeHistory(post) {
    if (
      !Array.isArray(
        post.changeHistory
      )
    ) {
      post.changeHistory = [];
      return true;
    }

    return false;
  }


  function addChangeHistory(
    post,
    field,
    fromValue,
    toValue,
    editorOverride = null
  ) {
    const editor =
      editorOverride ||
      activeEditor;

    if (!editor || !post) {
      return false;
    }

    const from =
      fromValue === null ||
      fromValue === undefined
        ? ""
        : String(fromValue);

    const to =
      toValue === null ||
      toValue === undefined
        ? ""
        : String(toValue);

    if (from === to) {
      return false;
    }

    if (
      !Array.isArray(
        post.changeHistory
      )
    ) {
      post.changeHistory = [];
    }

    post.changeHistory.push({
      id: createId("change"),
      field,
      from,
      to,
      changedBy: editor.name,
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
      let index =
        post.changeHistory.length - 1;
      index >= 0;
      index--
    ) {
      const change =
        post.changeHistory[index];

      if (
        change &&
        change.field === field
      ) {
        return change;
      }
    }

    return null;
  }


  function formatAuditDate(
    isoDate
  ) {
    if (!isoDate) {
      return "";
    }

    const date =
      new Date(isoDate);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }


  function getAuditValue(
    field,
    value
  ) {
    const safeValue =
      String(value || "");

    if (field === "platform") {
      return (
        PLATFORMS[safeValue] ||
        safeValue ||
        "—"
      );
    }

    if (field === "status") {
      return (
        POST_STATUSES[safeValue] ||
        safeValue ||
        "—"
      );
    }

    if (
      field ===
      "approvalStatus"
    ) {
      return (
        APPROVAL_STATUSES[
          safeValue
        ] ||
        safeValue ||
        "—"
      );
    }

    if (
      field === "date" &&
      safeValue
    ) {
      return formatPostDate(
        safeValue
      );
    }

    if (
      field === "time" &&
      safeValue
    ) {
      return formatTime(
        safeValue
      );
    }

    if (!safeValue) {
      return "—";
    }

    return safeValue;
  }


  function getAuditFieldName(
    field
  ) {
    const fieldNames = {
      platform: "Platform",
      caption: "Caption",
      hashtags: "Hashtags",
      date: "Date",
      time: "Time",
      approvalStatus:
        "Approval status",
      suggestions:
        "Suggestions / Feedback",
      status: "Post status",
      attachments: "Attachments"
    };

    return (
      fieldNames[field] ||
      field
    );
  }


  function renderStatusMeta(
    post,
    field,
    element
  ) {
    if (!element) {
      return;
    }

    const change =
      getLastChange(
        post,
        field
      );

    if (!change) {
      if (
        post &&
        post.createdBy &&
        post.createdAt
      ) {
        element.textContent =
          `Created by ${post.createdBy} on ${formatAuditDate(
            post.createdAt
          )}`;
      } else {
        element.textContent =
          "Last modified by: —";
      }

      return;
    }

    element.textContent =
      `Last modified by ${change.changedBy} on ${formatAuditDate(
        change.changedAt
      )}`;
  }


  function renderChangeHistory(
    post
  ) {
    if (!postChangeHistory) {
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

    const history =
      [...post.changeHistory]
        .reverse();

    postChangeHistory.innerHTML =
      history
        .map(
          (change) => {
            const field =
              getAuditFieldName(
                change.field
              );

            const from =
              getAuditValue(
                change.field,
                change.from
              );

            const to =
              getAuditValue(
                change.field,
                change.to
              );

            return `
              <article class="smc-change-history-item">

                <div class="smc-change-history-item-top">

                  <span class="smc-change-history-field">
                    ${escapeHTML(field)}
                  </span>

                  <span class="smc-change-history-date">
                    ${escapeHTML(
                      formatAuditDate(
                        change.changedAt
                      )
                    )}
                  </span>

                </div>

                <div class="smc-change-history-change">
                  ${escapeHTML(from)}
                  →
                  ${escapeHTML(to)}
                </div>

                <div class="smc-change-history-person">
                  ${escapeHTML(
                    change.changedBy
                  )}
                </div>

              </article>
            `;
          }
        )
        .join("");
  }


  function renderPostAudit(
    post
  ) {
    if (!post) {
      if (approvalStatusMeta) {
        approvalStatusMeta.textContent =
          "Last modified by: —";
      }

      if (postStatusMeta) {
        postStatusMeta.textContent =
          "Last modified by: —";
      }

      if (postChangeHistory) {
        postChangeHistory.innerHTML =
          `<p class="smc-no-history">No changes recorded yet.</p>`;
      }

      return;
    }

    renderStatusMeta(
      post,
      "approvalStatus",
      approvalStatusMeta
    );

    renderStatusMeta(
      post,
      "status",
      postStatusMeta
    );

    renderChangeHistory(
      post
    );
  }


  /* =========================================================
     DATA NORMALIZATION / MIGRATION
     ========================================================= */

  function normalizePost(post) {
    let changed = false;

    if (
      !post ||
      typeof post !== "object"
    ) {
      return false;
    }

    if (
      !POST_STATUSES[post.status]
    ) {
      post.status = "draft";
      changed = true;
    }

    if (
      !APPROVAL_STATUSES[
        post.approvalStatus
      ]
    ) {
      post.approvalStatus =
        "in-review";

      changed = true;
    }

    if (
      typeof post.suggestions !==
      "string"
    ) {
      post.suggestions = "";
      changed = true;
    }

    if (
      !Array.isArray(
        post.changeHistory
      )
    ) {
      post.changeHistory = [];
      changed = true;
    }

    if (
      !post.createdAt
    ) {
      post.createdAt =
        post.updatedAt ||
        new Date().toISOString();

      changed = true;
    }

    if (
      !post.createdBy
    ) {
      /*
       * Older posts did not have an editor
       * identity. Do not invent one.
       */
      post.createdBy = "";
      changed = true;
    }

    return changed;
  }


  function normalizeLoadedPosts() {
    let changed = false;

    state.posts.forEach(
      (post) => {
        if (
          normalizePost(post)
        ) {
          changed = true;
        }
      }
    );

    if (changed) {
      saveState();
    }
  }


  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  function loadState() {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) {
        state = {
          posts: []
        };

        return;
      }

      const parsed =
        JSON.parse(saved);

      if (
        parsed &&
        Array.isArray(
          parsed.posts
        )
      ) {
        state.posts =
          parsed.posts;
      } else {
        state.posts = [];
      }

      normalizeLoadedPosts();
    } catch (error) {
      console.error(
        "Unable to load Social Media Calendar data:",
        error
      );

      state = {
        posts: []
      };
    }
  }


  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error(
        "Unable to save Social Media Calendar data:",
        error
      );

      alert(
        "The post could not be saved. Your browser storage may be full."
      );
    }
  }


  /* =========================================================
     INDEXEDDB
     ========================================================= */

  function openAttachmentDB() {
    if (
      attachmentDBPromise
    ) {
      return attachmentDBPromise;
    }

    attachmentDBPromise =
      new Promise(
        (resolve, reject) => {
          if (
            !(
              "indexedDB" in
              window
            )
          ) {
            reject(
              new Error(
                "IndexedDB is not supported by this browser."
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
            () => {
              resolve(
                request.result
              );
            }
          );

          request.addEventListener(
            "error",
            () => {
              reject(
                request.error
              );
            }
          );
        }
      );

    return attachmentDBPromise;
  }


  function saveAttachment(
    postId,
    file
  ) {
    return openAttachmentDB()
      .then(
        (db) => {
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
                name: file.name,
                type:
                  file.type ||
                  "application/octet-stream",
                size: file.size,
                blob: file,
                createdAt:
                  new Date().toISOString()
              };

              const transaction =
                db.transaction(
                  ATTACHMENT_STORE,
                  "readwrite"
                );

              const store =
                transaction.objectStore(
                  ATTACHMENT_STORE
                );

              store.add(
                attachment
              );

              transaction.addEventListener(
                "complete",
                () => {
                  resolve(
                    attachment
                  );
                }
              );

              transaction.addEventListener(
                "error",
                () => {
                  reject(
                    transaction.error
                  );
                }
              );

              transaction.addEventListener(
                "abort",
                () => {
                  reject(
                    transaction.error ||
                    new Error(
                      "Attachment save was aborted."
                    )
                  );
                }
              );
            }
          );
        }
      );
  }


  function getPostAttachments(
    postId
  ) {
    return openAttachmentDB()
      .then(
        (db) => {
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

              const store =
                transaction.objectStore(
                  ATTACHMENT_STORE
                );

              const index =
                store.index(
                  "postId"
                );

              const request =
                index.getAll(
                  postId
                );

              request.addEventListener(
                "success",
                () => {
                  const attachments =
                    request.result ||
                    [];

                  attachments.sort(
                    (a, b) =>
                      String(
                        a.createdAt
                      ).localeCompare(
                        String(
                          b.createdAt
                        )
                      )
                  );

                  resolve(
                    attachments
                  );
                }
              );

              request.addEventListener(
                "error",
                () => {
                  reject(
                    request.error
                  );
                }
              );
            }
          );
        }
      );
  }


  function getAllAttachments() {
    return openAttachmentDB()
      .then(
        (db) => {
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

              const store =
                transaction.objectStore(
                  ATTACHMENT_STORE
                );

              const request =
                store.getAll();

              request.addEventListener(
                "success",
                () => {
                  resolve(
                    request.result ||
                    []
                  );
                }
              );

              request.addEventListener(
                "error",
                () => {
                  reject(
                    request.error
                  );
                }
              );
            }
          );
        }
      );
  }


  function deleteAttachment(
    attachmentId
  ) {
    return openAttachmentDB()
      .then(
        (db) => {
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

              const store =
                transaction.objectStore(
                  ATTACHMENT_STORE
                );

              store.delete(
                attachmentId
              );

              transaction.addEventListener(
                "complete",
                resolve
              );

              transaction.addEventListener(
                "error",
                () => {
                  reject(
                    transaction.error
                  );
                }
              );
            }
          );
        }
      );
  }


  function deletePostAttachments(
    postId
  ) {
    return getPostAttachments(
      postId
    ).then(
      (attachments) => {
        return Promise.all(
          attachments.map(
            (attachment) =>
              deleteAttachment(
                attachment.id
              )
          )
        );
      }
    );
  }


  function downloadAttachment(
    attachmentId
  ) {
    openAttachmentDB()
      .then(
        (db) => {
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

              const store =
                transaction.objectStore(
                  ATTACHMENT_STORE
                );

              const request =
                store.get(
                  attachmentId
                );

              request.addEventListener(
                "success",
                () => {
                  resolve(
                    request.result
                  );
                }
              );

              request.addEventListener(
                "error",
                () => {
                  reject(
                    request.error
                  );
                }
              );
            }
          );
        }
      )
      .then(
        (attachment) => {
          if (
            !attachment ||
            !attachment.blob
          ) {
            throw new Error(
              "Attachment could not be found."
            );
          }

          const url =
            URL.createObjectURL(
              attachment.blob
            );

          const link =
            document.createElement(
              "a"
            );

          link.href = url;
          link.download =
            attachment.name;

          document.body.appendChild(
            link
          );

          link.click();

          link.remove();

          window.setTimeout(
            () =>
              URL.revokeObjectURL(
                url
              ),
            1000
          );
        }
      )
      .catch(
        (error) => {
          console.error(
            "Unable to download attachment:",
            error
          );

          alert(
            "The attachment could not be downloaded."
          );
        }
      );
  }


  /* =========================================================
     LEGACY BASE64 IMAGE MIGRATION
     ========================================================= */

  function dataURLToBlob(
    dataURL
  ) {
    try {
      const parts =
        dataURL.split(",");

      if (
        parts.length !== 2
      ) {
        return null;
      }

      const mimeMatch =
        parts[0].match(
          /data:(.*?);base64/
        );

      if (!mimeMatch) {
        return null;
      }

      const mimeType =
        mimeMatch[1];

      const binary =
        atob(parts[1]);

      const bytes =
        new Uint8Array(
          binary.length
        );

      for (
        let index = 0;
        index < binary.length;
        index++
      ) {
        bytes[index] =
          binary.charCodeAt(
            index
          );
      }

      return new Blob(
        [bytes],
        {
          type: mimeType
        }
      );
    } catch (error) {
      console.error(
        "Unable to convert legacy image:",
        error
      );

      return null;
    }
  }


  async function migrateLegacyImage(
    post
  ) {
    if (
      !post ||
      !post.image
    ) {
      return;
    }

    try {
      const existing =
        await getPostAttachments(
          post.id
        );

      if (
        existing.length
      ) {
        return;
      }

      const blob =
        dataURLToBlob(
          post.image
        );

      if (!blob) {
        return;
      }

      let extension = "jpg";

      if (
        blob.type.includes(
          "png"
        )
      ) {
        extension = "png";
      } else if (
        blob.type.includes(
          "gif"
        )
      ) {
        extension = "gif";
      } else if (
        blob.type.includes(
          "webp"
        )
      ) {
        extension = "webp";
      }

      const file =
        new File(
          [blob],
          `social-post-image.${extension}`,
          {
            type: blob.type
          }
        );

      await saveAttachment(
        post.id,
        file
      );

      post.image = "";

      saveState();
    } catch (error) {
      console.error(
        "Unable to migrate legacy social post image:",
        error
      );
    }
  }


  /* =========================================================
     ATTACHMENT RENDERING
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
          (file, index) => `
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
            (attachment) => `
              <article
                class="smc-attachment"
                data-attachment-id="${escapeHTML(
                  attachment.id
                )}"
              >

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
        "Unable to load post attachments:",
        error
      );

      postAttachmentsList.innerHTML =
        `<p class="smc-no-media">Attachments could not be loaded.</p>`;
    }
  }


  function handleFileSelection(
    event
  ) {
    if (!requireEditor()) {
      event.target.value = "";
      return;
    }

    const files =
      Array.from(
        event.target.files || []
      );

    if (!files.length) {
      return;
    }

    const validFiles =
      files.filter(
        (file) => {
          const allowed =
            file.type.startsWith(
              "image/"
            ) ||
            [
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "application/vnd.ms-powerpoint",
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "text/plain",
              "text/csv"
            ].includes(
              file.type
            ) ||
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i.test(
              file.name
            );

          return allowed;
        }
      );

    if (
      validFiles.length !==
      files.length
    ) {
      alert(
        "One or more selected files are not supported."
      );
    }

    const postId =
      postIdInput.value;

    /*
     * New post:
     * Hold files until Save Post is clicked.
     */
    if (!postId) {
      pendingPostFiles.push(
        ...validFiles
      );

      renderPendingAttachments();

      event.target.value = "";

      return;
    }

    /*
     * Existing post:
     * Save files immediately to IndexedDB.
     */
    Promise.all(
      validFiles.map(
        (file) =>
          saveAttachment(
            postId,
            file
          )
      )
    )
      .then(
        (savedAttachments) => {
          const post =
            state.posts.find(
              (item) =>
                item.id ===
                postId
            );

          if (post) {
            const fileNames =
              savedAttachments
                .map(
                  (
                    attachment
                  ) =>
                    attachment.name
                )
                .join(", ");

            addChangeHistory(
              post,
              "attachments",
              "",
              `Added: ${fileNames}`
            );

            post.updatedAt =
              new Date().toISOString();

            saveState();
          }

          renderPostAttachments(
            postId
          );

          render();
        }
      )
      .catch(
        (error) => {
          console.error(
            "Unable to save attachment:",
            error
          );

          alert(
            "One or more attachments could not be saved."
          );
        }
      );

    event.target.value = "";
  }


  function removePendingAttachment(
    index
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    if (
      index < 0 ||
      index >=
        pendingPostFiles.length
    ) {
      return;
    }

    pendingPostFiles.splice(
      index,
      1
    );

    renderPendingAttachments();
  }


  function removePostAttachment(
    attachmentId,
    postId
  ) {
    if (!requireEditor()) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove this attachment?"
      );

    if (!confirmed) {
      return;
    }

    const post =
      state.posts.find(
        (item) =>
          item.id === postId
      );

    const attachment =
      postId
        ? null
        : null;

    getPostAttachments(
      postId
    )
      .then(
        (attachments) => {
          const target =
            attachments.find(
              (item) =>
                item.id ===
                attachmentId
            );

          return deleteAttachment(
            attachmentId
          ).then(
            () => ({
              target
            })
          );
        }
      )
      .then(
        ({ target }) => {
          if (post) {
            addChangeHistory(
              post,
              "attachments",
              target
                ? `Attached: ${target.name}`
                : "Attached file",
              target
                ? `Removed: ${target.name}`
                : "Removed file"
            );

            post.updatedAt =
              new Date().toISOString();

            saveState();
          }

          renderPostAttachments(
            postId
          );

          render();
        }
      )
      .catch(
        (error) => {
          console.error(
            "Unable to remove attachment:",
            error
          );

          alert(
            "The attachment could not be removed."
          );
        }
      );
  }


  /* =========================================================
     FILTERING
     ========================================================= */

  function getFilteredPosts() {
    const platform =
      platformFilter.value;

    const status =
      statusFilter.value;

    const search =
      postSearch.value
        .trim()
        .toLowerCase();

    return state.posts.filter(
      (post) => {
        if (
          platform !== "all" &&
          post.platform !==
            platform
        ) {
          return false;
        }

        if (
          status !== "all" &&
          post.status !==
            status
        ) {
          return false;
        }

        if (search) {
          const searchableText = [
            post.caption,
            post.hashtags,
            post.suggestions,
            PLATFORMS[
              post.platform
            ],
            POST_STATUSES[
              post.status
            ],
            APPROVAL_STATUSES[
              post.approvalStatus
            ]
          ]
            .join(" ")
            .toLowerCase();

          if (
            !searchableText.includes(
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
     CALENDAR
     ========================================================= */

  function renderCalendar() {
    if (
      !calendar ||
      !calendarTitle
    ) {
      return;
    }

    calendarTitle.textContent =
      formatMonthYear(
        currentDate
      );

    calendar.innerHTML = "";

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
      (day) => {
        const weekday =
          document.createElement(
            "div"
          );

        weekday.className =
          "smc-weekday";

        weekday.textContent =
          day;

        calendar.appendChild(
          weekday
        );
      }
    );

    const year =
      currentDate.getFullYear();

    const month =
      currentDate.getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1
      );

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      );

    const startingDay =
      firstDay.getDay();

    const daysInMonth =
      lastDay.getDate();

    const previousMonthLastDay =
      new Date(
        year,
        month,
        0
      ).getDate();

    const totalCells =
      Math.ceil(
        (
          startingDay +
          daysInMonth
        ) / 7
      ) * 7;

    const filteredPosts =
      getFilteredPosts();

    for (
      let index = 0;
      index < totalCells;
      index++
    ) {
      const dayCell =
        document.createElement(
          "div"
        );

      dayCell.className =
        "smc-day";

      let cellDate;
      let dayNumber;

      if (
        index < startingDay
      ) {
        dayNumber =
          previousMonthLastDay -
          startingDay +
          index +
          1;

        cellDate =
          new Date(
            year,
            month - 1,
            dayNumber
          );

        dayCell.classList.add(
          "other-month"
        );
      } else if (
        index >=
        startingDay +
        daysInMonth
      ) {
        dayNumber =
          index -
          startingDay -
          daysInMonth +
          1;

        cellDate =
          new Date(
            year,
            month + 1,
            dayNumber
          );

        dayCell.classList.add(
          "other-month"
        );
      } else {
        dayNumber =
          index -
          startingDay +
          1;

        cellDate =
          new Date(
            year,
            month,
            dayNumber
          );
      }

      const dateKey =
        getDateKey(
          cellDate
        );

      /*
       * Store the actual date on the cell.
       * This prevents drag/drop from guessing
       * which month an "other-month" day belongs to.
       */
      dayCell.dataset.date =
        dateKey;

      if (
        dateKey ===
        getTodayKey()
      ) {
        dayCell.classList.add(
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

      dayCell.appendChild(
        number
      );

      const dayPosts =
        document.createElement(
          "div"
        );

      dayPosts.className =
        "smc-day-posts";

      const postsForDay =
        filteredPosts
          .filter(
            (post) =>
              post.date ===
              dateKey
          )
          .sort(
            (a, b) =>
              getPostDateTime(
                a
              ) -
              getPostDateTime(
                b
              )
          );

      postsForDay.forEach(
        (post) => {
          const postElement =
            renderCalendarPost(
              post
            );

          dayPosts.appendChild(
            postElement
          );
        }
      );

      dayCell.appendChild(
        dayPosts
      );

      dayCell.addEventListener(
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

      calendar.appendChild(
        dayCell
      );
    }

    initializeCalendarEvents();
  }


  function renderCalendarPost(
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

    /*
     * Dragging is still enabled visually,
     * but the event handler prevents it when
     * editing is locked.
     */
    article.draggable = true;

    article.tabIndex = 0;

    const platform =
      PLATFORMS[
        post.platform
      ] ||
      post.platform;

    const caption =
      post.caption ||
      "Untitled social post";

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
          caption
        )}
      </div>
    `;

    return article;
  }


  function initializeCalendarEvents() {
    if (!calendar) {
      return;
    }

    calendar
      .querySelectorAll(
        ".smc-calendar-post"
      )
      .forEach(
        (postElement) => {
          const postId =
            postElement.dataset.id;

          /*
           * OPEN POST
           */
          postElement.addEventListener(
            "click",
            () => {
              if (
                postElement.dataset
                  .wasDragged ===
                "true"
              ) {
                delete postElement
                  .dataset
                  .wasDragged;

                return;
              }

              if (
                !requireEditor()
              ) {
                return;
              }

              openPost(
                postId
              );
            }
          );


          /*
           * KEYBOARD ACCESSIBILITY
           */
          postElement.addEventListener(
            "keydown",
            (event) => {
              if (
                event.key ===
                  "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();

                if (
                  !requireEditor()
                ) {
                  return;
                }

                openPost(
                  postId
                );
              }
            }
          );


          /*
           * RIGHT-CLICK DELETE
           */
          postElement.addEventListener(
            "contextmenu",
            (event) => {
              event.preventDefault();

              if (
                !requireEditor()
              ) {
                return;
              }

              deletePost(
                postId
              );
            }
          );


          /*
           * START DRAGGING
           */
          postElement.addEventListener(
            "dragstart",
            (event) => {
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
                postId
              );

              postElement.classList.add(
                "is-dragging"
              );

              postElement.dataset.wasDragged =
                "true";
            }
          );


          /*
           * END DRAGGING
           */
          postElement.addEventListener(
            "dragend",
            () => {
              postElement.classList.remove(
                "is-dragging"
              );

              calendar
                .querySelectorAll(
                  ".smc-day.is-drop-target"
                )
                .forEach(
                  (day) => {
                    day.classList.remove(
                      "is-drop-target"
                    );
                  }
                );
            }
          );
        }
      );


    /*
     * MAKE EVERY CALENDAR DAY A DROP TARGET
     */
    calendar
      .querySelectorAll(
        ".smc-day"
      )
      .forEach(
        (dayElement) => {
          dayElement.addEventListener(
            "dragover",
            (event) => {
              if (!activeEditor) {
                return;
              }

              event.preventDefault();

              event.dataTransfer.dropEffect =
                "move";

              dayElement.classList.add(
                "is-drop-target"
              );
            }
          );


          dayElement.addEventListener(
            "dragleave",
            (event) => {
              if (
                !dayElement.contains(
                  event.relatedTarget
                )
              ) {
                dayElement.classList.remove(
                  "is-drop-target"
                );
              }
            }
          );


          dayElement.addEventListener(
            "drop",
            (event) => {
              event.preventDefault();

              dayElement.classList.remove(
                "is-drop-target"
              );

              if (
                !requireEditor()
              ) {
                return;
              }

              const postId =
                event.dataTransfer.getData(
                  "text/plain"
                );

              if (!postId) {
                return;
              }

              /*
               * Use the exact date assigned to
               * this calendar cell.
               */
              const newDate =
                dayElement.dataset.date;

              movePostToDate(
                postId,
                newDate
              );
            }
          );
        }
      );
  }


  function getDateKeyFromDayCell(
    dayElement
  ) {
    if (
      !dayElement ||
      !dayElement.dataset.date
    ) {
      return null;
    }

    return (
      dayElement.dataset.date
    );
  }


  function movePostToDate(
    postId,
    newDate
  ) {
    if (
      !requireEditor()
    ) {
      return;
    }

    if (
      !postId ||
      !newDate
    ) {
      return;
    }

    const post =
      state.posts.find(
        (item) =>
          item.id ===
          postId
      );

    if (!post) {
      return;
    }

    if (
      isPastDate(newDate)
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

    saveState();

    render();
  }


  /* =========================================================
     UPCOMING POSTS
     ========================================================= */

  function renderUpcomingPosts() {
    const scheduledPosts =
      state.posts
        .filter(
          (post) =>
            post.status ===
            "scheduled"
        )
        .sort(
          (a, b) =>
            getPostDateTime(
              a
            ) -
            getPostDateTime(
              b
            )
        )
        .slice(0, 8);

    if (
      !scheduledPosts.length
    ) {
      upcomingPosts.innerHTML =
        `<div class="smc-empty">No scheduled posts yet.</div>`;

      return;
    }

    upcomingPosts.innerHTML =
      scheduledPosts
        .map(
          (post) => {
            const date =
              formatUpcomingDate(
                post.date,
                post.time
              );

            const platform =
              PLATFORMS[
                post.platform
              ] ||
              post.platform;

            const caption =
              post.caption ||
              "Untitled social post";

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
                        platform
                      )}
                    </span>

                    <span class="smc-status-badge scheduled">
                      Scheduled
                    </span>

                  </div>

                  <h3>
                    ${escapeHTML(
                      caption.slice(
                        0,
                        80
                      )
                    )}
                  </h3>

                  <p>
                    ${escapeHTML(
                      caption
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
        (item) => {
          item.addEventListener(
            "click",
            () => {
              if (
                !requireEditor()
              ) {
                return;
              }

              openPost(
                item.dataset.id
              );
            }
          );
        }
      );
  }


  /* =========================================================
     STATISTICS
     ========================================================= */

  function renderStats() {
    const posts =
      state.posts;

    const counts = {
      draft: 0,
      scheduled: 0,
      stuck: 0,
      running: 0,
      "on-hold": 0,
      published: 0
    };

    posts.forEach(
      (post) => {
        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            post.status
          )
        ) {
          counts[
            post.status
          ]++;
        }
      }
    );

    const currentMonth =
      `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

    const monthPosts =
      posts.filter(
        (post) =>
          getMonthKey(
            post.date
          ) ===
          currentMonth
      );

    const platforms =
      new Set(
        posts.map(
          (post) =>
            post.platform
        )
      );

    if (statTotal) {
      statTotal.textContent =
        posts.length;
    }

    if (statDraft) {
      statDraft.textContent =
        counts.draft;
    }

    if (statScheduled) {
      statScheduled.textContent =
        counts.scheduled;
    }

    if (statStuck) {
      statStuck.textContent =
        counts.stuck;
    }

    if (statRunning) {
      statRunning.textContent =
        counts.running;
    }

    if (statOnHold) {
      statOnHold.textContent =
        counts["on-hold"];
    }

    if (statPublished) {
      statPublished.textContent =
        counts.published;
    }

    if (statMonth) {
      statMonth.textContent =
        monthPosts.length;
    }

    if (statPlatforms) {
      statPlatforms.textContent =
        platforms.size;
    }
  }


  /* =========================================================
     MAIN RENDER
     ========================================================= */

  function render() {
    renderCalendar();
    renderUpcomingPosts();
    renderStats();
    updateEditingControls();
  }


  /* =========================================================
     CREATE / EDIT POST
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

    let post = null;

    if (postId) {
      post =
        state.posts.find(
          (item) =>
            item.id ===
            postId
        );
    }

    pendingPostFiles = [];

    if (post) {
      postDialogTitle.textContent =
        "Edit post";

      postIdInput.value =
        post.id;

      postPlatformInput.value =
        post.platform;

      postCaptionInput.value =
        post.caption || "";

      postHashtagsInput.value =
        post.hashtags || "";

      postDateInput.value =
        post.date;

      postTimeInput.value =
        post.time || "09:00";

      postApprovalStatusInput.value =
        post.approvalStatus ||
        "in-review";

      postSuggestionsInput.value =
        post.suggestions || "";

      postStatusInput.value =
        post.status ||
        "draft";

      /*
       * Convert old Base64 images to
       * proper downloadable attachments.
       */
      if (post.image) {
        await migrateLegacyImage(
          post
        );
      }

      await renderPostAttachments(
        post.id
      );

      renderPostAudit(
        post
      );
    } else {
      const defaultDateTime =
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
        defaultDateTime.date;

      postTimeInput.value =
        defaultDateTime.time;

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

    const postId =
      postIdInput.value;

    const existingPost =
      postId
        ? state.posts.find(
            (post) =>
              post.id ===
              postId
          )
        : null;

    const newStatus =
      postStatusInput.value;

    /*
     * Published posts can remain in the past.
     * New posts and non-published posts must
     * use a future date/time.
     */
    const requiresFutureDateTime =
      newStatus !==
      "published";

    if (
      requiresFutureDateTime &&
      isPastSchedule(
        date,
        time
      )
    ) {
      if (
        isPastDate(date)
      ) {
        alert(
          "You cannot create or schedule a post for a date that has already passed."
        );
      } else {
        alert(
          "You cannot create or schedule a post for a time that has already passed today. Please choose a future time."
        );
      }

      updateDateTimeMinimums();

      return;
    }

    const finalPostId =
      postId ||
      createId("post");

    const now =
      new Date().toISOString();

    const postData = {
      id: finalPostId,

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

      status:
        newStatus,

      /*
       * Kept for backwards compatibility,
       * but new attachments are no longer
       * stored here.
       */
      image: "",

      updatedAt: now
    };


    /* =======================================================
       EXISTING POST
       ======================================================= */

    if (existingPost) {
      const updatedPost = {
        ...existingPost,
        ...postData
      };

      /*
       * Track all meaningful field changes.
       */
      const trackedFields = [
        "platform",
        "caption",
        "hashtags",
        "date",
        "time",
        "approvalStatus",
        "suggestions",
        "status"
      ];

      let changed = false;

      trackedFields.forEach(
        (field) => {
          const oldValue =
            existingPost[
              field
            ];

          const newValue =
            updatedPost[
              field
            ];

          if (
            String(
              oldValue ??
                ""
            ) !==
            String(
              newValue ??
                ""
            )
          ) {
            if (
              addChangeHistory(
                updatedPost,
                field,
                oldValue,
                newValue
              )
            ) {
              changed = true;
            }
          }
        }
      );

      /*
       * If something actually changed, update the
       * modification timestamp.
       */
      if (changed) {
        updatedPost.updatedAt =
          now;
      } else {
        /*
         * No actual field change.
         * Keep the previous modification timestamp.
         */
        updatedPost.updatedAt =
          existingPost.updatedAt ||
          now;
      }

      state.posts[
        state.posts.findIndex(
          (post) =>
            post.id ===
            postId
        )
      ] = updatedPost;

      saveState();

      closeDialog();

      render();

      return;
    }


    /* =======================================================
       NEW POST
       ======================================================= */

    const newPost = {
      ...postData,

      createdAt: now,

      createdBy:
        activeEditor
          ? activeEditor.name
          : "",

      changeHistory: []
    };

    /*
     * Record the initial status and approval state
     * as part of the audit trail.
     */
    addChangeHistory(
      newPost,
      "approvalStatus",
      "",
      newPost.approvalStatus
    );

    addChangeHistory(
      newPost,
      "status",
      "",
      newPost.status
    );

    /*
     * Also record initial creation information.
     */
    if (activeEditor) {
      newPost.changeHistory.push({
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

    state.posts.push(
      newPost
    );

    /*
     * Save the post first so it has a
     * permanent ID before attachments are stored.
     */
    saveState();

    try {
      if (
        pendingPostFiles.length
      ) {
        const savedAttachments =
          await Promise.all(
            pendingPostFiles.map(
              (file) =>
                saveAttachment(
                  finalPostId,
                  file
                )
            )
          );

        if (
          savedAttachments.length
        ) {
          const fileNames =
            savedAttachments
              .map(
                (
                  attachment
                ) =>
                  attachment.name
              )
              .join(", ");

          addChangeHistory(
            newPost,
            "attachments",
            "",
            `Added: ${fileNames}`
          );

          newPost.updatedAt =
            new Date().toISOString();

          saveState();
        }
      }
    } catch (error) {
      console.error(
        "Unable to save one or more post attachments:",
        error
      );

      alert(
        "The post was saved, but one or more attachments could not be saved."
      );
    }

    pendingPostFiles = [];

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
        (item) =>
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

    state.posts =
      state.posts.filter(
        (item) =>
          item.id !==
          postId
      );

    saveState();

    /*
     * Remove all files belonging
     * to the deleted post.
     */
    try {
      await deletePostAttachments(
        postId
      );
    } catch (error) {
      console.error(
        "Unable to delete post attachments:",
        error
      );
    }

    render();
  }


  /* =========================================================
     CAPTION
     ========================================================= */

  function updateCaptionCount() {
    if (
      !captionCount ||
      !postCaptionInput
    ) {
      return;
    }

    captionCount.textContent =
      postCaptionInput.value.length;
  }


  /* =========================================================
     DIALOG
     ========================================================= */

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

    if (postForm) {
      postForm.reset();
    }

    if (postIdInput) {
      postIdInput.value =
        "";
    }

    pendingPostFiles = [];

    if (postFilesInput) {
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

    if (
      postChangeHistory
    ) {
      postChangeHistory.innerHTML =
        `<p class="smc-no-history">No changes recorded yet.</p>`;
    }

    updateCaptionCount();
  }


  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  const newPostButton =
    document.getElementById(
      "newPost"
    );


  if (newPostButton) {
    newPostButton.addEventListener(
      "click",
      () => {
        if (
          !requireEditor()
        ) {
          return;
        }

        openPost();
      }
    );
  }


  /*
   * EDITOR USER SELECTION
   */
  if (editorUser) {
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


  /*
   * START EDITING
   */
  if (startEditing) {
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

          if (editorUser) {
            editorUser.focus();
          }

          return;
        }

        const success =
          setActiveEditor(
            editorUser.value
          );

        if (!success) {
          alert(
            "The selected editor could not be recognized."
          );

          return;
        }

        render();
      }
    );
  }


  /*
   * LOCK EDITING
   */
  if (lockEditing) {
    lockEditing.addEventListener(
      "click",
      () => {
        const confirmed =
          window.confirm(
            "Lock editing for this session?"
          );

        if (!confirmed) {
          return;
        }

        clearActiveEditor();
      }
    );
  }


  const previousMonth =
    document.getElementById(
      "previousMonth"
    );


  if (previousMonth) {
    previousMonth.addEventListener(
      "click",
      goToPreviousMonth
    );
  }


  const nextMonth =
    document.getElementById(
      "nextMonth"
    );


  if (nextMonth) {
    nextMonth.addEventListener(
      "click",
      goToNextMonth
    );
  }


  const todayButton =
    document.getElementById(
      "todayButton"
    );


  if (todayButton) {
    todayButton.addEventListener(
      "click",
      goToToday
    );
  }


  if (platformFilter) {
    platformFilter.addEventListener(
      "change",
      render
    );
  }


  if (statusFilter) {
    statusFilter.addEventListener(
      "change",
      render
    );
  }


  if (postSearch) {
    postSearch.addEventListener(
      "input",
      render
    );
  }


  if (postForm) {
    postForm.addEventListener(
      "submit",
      savePost
    );
  }


  if (postCaptionInput) {
    postCaptionInput.addEventListener(
      "input",
      updateCaptionCount
    );
  }


  if (postFilesInput) {
    postFilesInput.addEventListener(
      "change",
      handleFileSelection
    );
  }


  if (postDateInput) {
    postDateInput.addEventListener(
      "change",
      updateDateTimeMinimums
    );
  }


  if (postTimeInput) {
    postTimeInput.addEventListener(
      "change",
      updateDateTimeMinimums
    );
  }


  /*
   * Re-render audit information if the user
   * changes status fields while the dialog is open.
   *
   * This does not write the change until Save
   * Post is clicked.
   */
  if (
    postApprovalStatusInput
  ) {
    postApprovalStatusInput.addEventListener(
      "change",
      () => {
        const postId =
          postIdInput.value;

        const post =
          state.posts.find(
            (item) =>
              item.id ===
              postId
          );

        if (post) {
          renderPostAudit(
            post
          );
        }
      }
    );
  }


  if (postStatusInput) {
    postStatusInput.addEventListener(
      "change",
      () => {
        const postId =
          postIdInput.value;

        const post =
          state.posts.find(
            (item) =>
              item.id ===
              postId
          );

        if (post) {
          renderPostAudit(
            post
          );
        }
      }
    );
  }


  /*
   * ATTACHMENT BUTTON HANDLING
   */
  if (
    postAttachmentsList
  ) {
    postAttachmentsList.addEventListener(
      "click",
      (event) => {
        const downloadButton =
          event.target.closest(
            "[data-download-attachment]"
          );

        if (
          downloadButton
        ) {
          downloadAttachment(
            downloadButton
              .dataset
              .downloadAttachment
          );

          return;
        }


        const removeButton =
          event.target.closest(
            "[data-remove-attachment]"
          );

        if (
          removeButton
        ) {
          removePostAttachment(
            removeButton
              .dataset
              .removeAttachment,
            postIdInput.value
          );

          return;
        }


        const pendingRemoveButton =
          event.target.closest(
            "[data-remove-pending-attachment]"
          );

        if (
          pendingRemoveButton
        ) {
          removePendingAttachment(
            Number(
              pendingRemoveButton
                .dataset
                .removePendingAttachment
            )
          );
        }
      }
    );
  }


  /*
   * CLOSE POST DIALOG BUTTONS
   */
  document
    .querySelectorAll(
      "[data-close='postDialog']"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          closeDialog
        );
      }
    );


  /*
   * CLOSE DIALOG WHEN CLICKING BACKDROP
   */
  if (postDialog) {
    postDialog.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          postDialog
        ) {
          closeDialog();
        }
      }
    );
  }


  /*
   * CLOSE DIALOG WITH ESCAPE
   *
   * Native <dialog> already handles Escape,
   * but closing cleanup is kept here.
   */
  if (postDialog) {
    postDialog.addEventListener(
      "close",
      () => {
        pendingPostFiles = [];

        if (postFilesInput) {
          postFilesInput.value =
            "";
        }
      }
    );
  }


  /* =========================================================
     CALENDAR NAVIGATION
     ========================================================= */

  function goToPreviousMonth() {
    currentDate =
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );

    render();
  }


  function goToNextMonth() {
    currentDate =
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );

    render();
  }


  function goToToday() {
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


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  const yearElement =
    document.getElementById(
      "year"
    );

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }


  /*
   * Build the editor list from the configured
   * authorized editor array.
   */
  populateEditorList();


  /*
   * Restore the editor only for the current
   * browser session.
   */
  activeEditor =
    getActiveEditor();


  /*
   * Make sure the existing data has the
   * fields required by the new system.
   */
  loadState();


  /*
   * Update the editor controls before rendering.
   */
  updateEditingUI();


  /*
   * Render the existing calendar.
   */
  render();

})();