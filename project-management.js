(() => {
  "use strict";

  const STORAGE_KEY =
    "kevin_project_manager_v1";

  const ATTACHMENT_DB_NAME =
    "kevin_project_manager_files";

  const ATTACHMENT_DB_VERSION = 1;

  const ATTACHMENT_STORE =
    "attachments";

  const COLUMNS = [
    {
      id: "backlog",
      label: "Backlog"
    },
    {
      id: "todo",
      label: "To Do"
    },
    {
      id: "in-progress",
      label: "In Progress"
    },
    {
      id: "review",
      label: "Review"
    },
    {
      id: "done",
      label: "Done"
    }
  ];

  const $ = (id) =>
    document.getElementById(id);

  /* =========================================================
     GENERAL HELPERS
     ========================================================= */

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(
      `${dateString}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes < 1) {
      return "0 KB";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB"
    ];

    const index = Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    );

    const safeIndex = Math.min(
      index,
      units.length - 1
    );

    const size =
      bytes /
      Math.pow(
        1024,
        safeIndex
      );

    return `${size.toFixed(
      safeIndex === 0 ? 0 : 1
    )} ${units[safeIndex]}`;
  }

  function getFileIcon(fileName) {
    const extension =
      fileName
        .split(".")
        .pop()
        .toLowerCase();

    const imageTypes = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico"
    ];

    const documentTypes = [
      "pdf",
      "doc",
      "docx",
      "txt",
      "rtf",
      "odt"
    ];

    const spreadsheetTypes = [
      "xls",
      "xlsx",
      "csv",
      "ods"
    ];

    const presentationTypes = [
      "ppt",
      "pptx",
      "odp"
    ];

    if (
      imageTypes.includes(
        extension
      )
    ) {
      return "IMG";
    }

    if (
      documentTypes.includes(
        extension
      )
    ) {
      return "DOC";
    }

    if (
      spreadsheetTypes.includes(
        extension
      )
    ) {
      return "XLS";
    }

    if (
      presentationTypes.includes(
        extension
      )
    ) {
      return "PPT";
    }

    if (extension === "zip") {
      return "ZIP";
    }

    return "FILE";
  }

  /* =========================================================
     INITIAL STATE
     ========================================================= */

  function createInitialState() {
    const projectId =
      createId("project");

    const taskId =
      createId("task");

    return {
      projects: [
        {
          id: projectId,
          name: "My First Project",
          description:
            "Your first project."
        }
      ],

      tasks: [
        {
          id: taskId,
          projectId: projectId,
          title:
            "Welcome to your project manager",
          description:
            "Click this task to edit it, or click Delete to remove it.",
          priority: "medium",
          due: "",
          labels: [],
          status: "backlog",
          order: 0,
          createdAt:
            new Date().toISOString()
        }
      ],

      activeProjectId:
        projectId
    };
  }

  function loadState() {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) {
        return createInitialState();
      }

      const parsed =
        JSON.parse(saved);

      if (
        !parsed ||
        !Array.isArray(
          parsed.projects
        ) ||
        !Array.isArray(
          parsed.tasks
        )
      ) {
        return createInitialState();
      }

      if (
        !parsed.activeProjectId ||
        !parsed.projects.some(
          (project) =>
            project.id ===
            parsed.activeProjectId
        )
      ) {
        parsed.activeProjectId =
          parsed.projects.length >
          0
            ? parsed.projects[0].id
            : null;
      }

      return parsed;
    } catch (error) {
      console.error(
        "Unable to load project manager data:",
        error
      );

      return createInitialState();
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
        "Unable to save project manager data:",
        error
      );
    }
  }

  let state = loadState();

  /* =========================================================
     TASK ORDERING
     ========================================================= */

  function normalizeTaskOrders() {
    const groups = {};

    state.tasks.forEach(
      (task) => {
        const key =
          `${task.projectId}__${task.status}`;

        if (!groups[key]) {
          groups[key] = [];
        }

        groups[key].push(task);
      }
    );

    Object.values(groups).forEach(
      (tasks) => {
        /*
          Older tasks may not have an
          order property. Preserve their
          existing array order when
          assigning their initial order.
        */
        tasks.forEach(
          (task, index) => {
            if (
              typeof task.order !==
              "number"
            ) {
              task.order = index;
            }
          }
        );

        /*
          Sort by their saved order.
        */
        tasks.sort(
          (a, b) =>
            (a.order ?? 0) -
            (b.order ?? 0)
        );

        /*
          Normalize the values so each
          column has clean sequential
          ordering.
        */
        tasks.forEach(
          (task, index) => {
            task.order = index;
          }
        );
      }
    );
  }

  function getNewTaskOrder(
    projectId,
    status
  ) {
    const tasksInColumn =
      state.tasks.filter(
        (task) =>
          task.projectId ===
            projectId &&
          task.status ===
            status
      );

    if (!tasksInColumn.length) {
      return 0;
    }

    const orders =
      tasksInColumn.map(
        (task, index) =>
          typeof task.order ===
          "number"
            ? task.order
            : index
      );

    return (
      Math.min(...orders) -
      1
    );
  }

  function normalizeColumnOrder(
    projectId,
    status
  ) {
    const columnTasks =
      state.tasks
        .filter(
          (task) =>
            task.projectId ===
              projectId &&
            task.status ===
              status
        )
        .sort(
          (a, b) =>
            (a.order ?? 0) -
            (b.order ?? 0)
        );

    columnTasks.forEach(
      (task, index) => {
        task.order = index;
      }
    );
  }

  normalizeTaskOrders();

  saveState();

  /* =========================================================
     DOM ELEMENTS
     ========================================================= */

  const projectSelect =
    $("projectSelect");

  const statusFilter =
    $("statusFilter");

  const priorityFilter =
    $("priorityFilter");

  const searchInput =
    $("search");

  const board =
    $("board");

  const projectCards =
    $("projectCards");

  const statTasks =
    $("statTasks");

  const statCompleted =
    $("statCompleted");

  const statProgress =
    $("statProgress");

  const statDue =
    $("statDue");

  const statOverdue =
    $("statOverdue");

  const taskDialog =
    $("taskDialog");

  const taskForm =
    $("taskForm");

  const projectDialog =
    $("projectDialog");

  const projectForm =
    $("projectForm");

  const taskIdInput =
    $("taskId");

  const taskStatusInput =
    $("taskStatus");

  const taskTitleInput =
    $("taskTitle");

  const taskDescriptionInput =
    $("taskDescription");

  const taskPriorityInput =
    $("taskPriority");

  const taskDueInput =
    $("taskDue");

  const taskLabelsInput =
    $("taskLabels");

  const projectNameInput =
    $("projectName");

  const projectDescriptionInput =
    $("projectDescription");

  const taskFilesInput =
    $("taskFiles");

  const taskAttachmentsList =
    $("taskAttachmentsList");

  /* =========================================================
     PENDING ATTACHMENTS FOR NEW TASKS
     ========================================================= */

  let pendingTaskFiles = [];

  /* =========================================================
     ATTACHMENT CACHE
     ========================================================= */

  const attachmentCounts = {};

  const taskAttachmentNames = {};

  let attachmentDBPromise =
    null;

  /* =========================================================
     INDEXEDDB
     ========================================================= */

  function openAttachmentDB() {
    if (attachmentDBPromise) {
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

          request.onupgradeneeded =
            (event) => {
              const db =
                event.target
                  .result;

              if (
                !db.objectStoreNames.contains(
                  ATTACHMENT_STORE
                )
              ) {
                const store =
                  db.createObjectStore(
                    ATTACHMENT_STORE,
                    {
                      keyPath: "id"
                    }
                  );

                store.createIndex(
                  "taskId",
                  "taskId",
                  {
                    unique: false
                  }
                );
              }
            };

          request.onsuccess =
            () => {
              resolve(
                request.result
              );
            };

          request.onerror =
            () => {
              reject(
                request.error ||
                  new Error(
                    "Unable to open attachment database."
                  )
              );
            };
        }
      );

    return attachmentDBPromise;
  }

  /* =========================================================
     SAVE ATTACHMENT
     ========================================================= */

  async function saveAttachment(
    taskId,
    file
  ) {
    const db =
      await openAttachmentDB();

    const attachment = {
      id: createId(
        "attachment"
      ),

      taskId: taskId,

      name: file.name,

      type:
        file.type ||
        "application/octet-stream",

      size: file.size,

      blob: file,

      createdAt:
        new Date().toISOString()
    };

    await new Promise(
      (resolve, reject) => {
        const transaction =
          db.transaction(
            [
              ATTACHMENT_STORE
            ],
            "readwrite"
          );

        const store =
          transaction.objectStore(
            ATTACHMENT_STORE
          );

        store.add(
          attachment
        );

        transaction.oncomplete =
          () => {
            resolve();
          };

        transaction.onerror =
          () => {
            reject(
              transaction.error
            );
          };

        transaction.onabort =
          () => {
            reject(
              transaction.error ||
                new Error(
                  "Attachment save was aborted."
                )
            );
          };
      }
    );

    attachmentCounts[
      taskId
    ] =
      (attachmentCounts[
        taskId
      ] || 0) + 1;

    if (
      !taskAttachmentNames[
        taskId
      ]
    ) {
      taskAttachmentNames[
        taskId
      ] = [];
    }

    taskAttachmentNames[
      taskId
    ].push({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type
    });
  }

  /* =========================================================
     GET TASK ATTACHMENTS
     ========================================================= */

  async function getTaskAttachments(
    taskId
  ) {
    const db =
      await openAttachmentDB();

    return new Promise(
      (resolve, reject) => {
        const transaction =
          db.transaction(
            [
              ATTACHMENT_STORE
            ],
            "readonly"
          );

        const store =
          transaction.objectStore(
            ATTACHMENT_STORE
          );

        const index =
          store.index(
            "taskId"
          );

        const request =
          index.getAll(taskId);

        request.onsuccess =
          () => {
            resolve(
              request.result ||
                []
            );
          };

        request.onerror =
          () => {
            reject(
              request.error
            );
          };
      }
    );
  }

  /* =========================================================
     GET ALL ATTACHMENTS
     ========================================================= */

  async function getAllAttachments() {
    const db =
      await openAttachmentDB();

    return new Promise(
      (resolve, reject) => {
        const transaction =
          db.transaction(
            [
              ATTACHMENT_STORE
            ],
            "readonly"
          );

        const store =
          transaction.objectStore(
            ATTACHMENT_STORE
          );

        const request =
          store.getAll();

        request.onsuccess =
          () => {
            resolve(
              request.result ||
                []
            );
          };

        request.onerror =
          () => {
            reject(
              request.error
            );
          };
      }
    );
  }

  /* =========================================================
     DELETE ATTACHMENT
     ========================================================= */

  async function deleteAttachment(
    attachmentId
  ) {
    const db =
      await openAttachmentDB();

    await new Promise(
      (resolve, reject) => {
        const transaction =
          db.transaction(
            [
              ATTACHMENT_STORE
            ],
            "readwrite"
          );

        const store =
          transaction.objectStore(
            ATTACHMENT_STORE
          );

        store.delete(
          attachmentId
        );

        transaction.oncomplete =
          () => {
            resolve();
          };

        transaction.onerror =
          () => {
            reject(
              transaction.error
            );
          };
      }
    );
  }

  /* =========================================================
     DELETE ALL ATTACHMENTS FOR A TASK
     ========================================================= */

  async function deleteTaskAttachments(
    taskId
  ) {
    const attachments =
      await getTaskAttachments(
        taskId
      );

    if (!attachments.length) {
      delete attachmentCounts[
        taskId
      ];

      delete taskAttachmentNames[
        taskId
      ];

      return;
    }

    await Promise.all(
      attachments.map(
        (attachment) =>
          deleteAttachment(
            attachment.id
          )
      )
    );

    delete attachmentCounts[
      taskId
    ];

    delete taskAttachmentNames[
      taskId
    ];
  }

  /* =========================================================
     REFRESH ATTACHMENT CACHE
     ========================================================= */

  async function refreshAttachmentCounts() {
    try {
      const attachments =
        await getAllAttachments();

      Object.keys(
        attachmentCounts
      ).forEach(
        (taskId) => {
          delete attachmentCounts[
            taskId
          ];
        }
      );

      Object.keys(
        taskAttachmentNames
      ).forEach(
        (taskId) => {
          delete taskAttachmentNames[
            taskId
          ];
        }
      );

      attachments.forEach(
        (attachment) => {
          const taskId =
            attachment.taskId;

          if (
            !attachmentCounts[
              taskId
            ]
          ) {
            attachmentCounts[
              taskId
            ] = 0;
          }

          attachmentCounts[
            taskId
          ]++;

          if (
            !taskAttachmentNames[
              taskId
            ]
          ) {
            taskAttachmentNames[
              taskId
            ] = [];
          }

          taskAttachmentNames[
            taskId
          ].push({
            id: attachment.id,
            name:
              attachment.name,
            size:
              attachment.size,
            type:
              attachment.type
          });
        }
      );

      renderBoard();
    } catch (error) {
      console.warn(
        "Unable to load attachment information:",
        error
      );
    }
  }

  /* =========================================================
     DOWNLOAD ATTACHMENT
     ========================================================= */

  async function downloadTaskAttachment(
    attachmentId
  ) {
    try {
      const db =
        await openAttachmentDB();

      const attachment =
        await new Promise(
          (resolve, reject) => {
            const transaction =
              db.transaction(
                [
                  ATTACHMENT_STORE
                ],
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

            request.onsuccess =
              () => {
                resolve(
                  request.result
                );
              };

            request.onerror =
              () => {
                reject(
                  request.error
                );
              };
          }
        );

      if (
        !attachment ||
        !attachment.blob
      ) {
        alert(
          "The attachment could not be found."
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

      link.href = url;

      link.download =
        attachment.name;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
      }, 1000);
    } catch (error) {
      console.error(
        "Unable to download attachment:",
        error
      );

      alert(
        "Unable to download this attachment."
      );
    }
  }

  /* =========================================================
     REMOVE SAVED ATTACHMENT
     ========================================================= */

  async function removeTaskAttachment(
    attachmentId,
    taskId
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to remove this attachment?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAttachment(
        attachmentId
      );

      if (
        attachmentCounts[
          taskId
        ] > 0
      ) {
        attachmentCounts[
          taskId
        ]--;
      }

      if (
        taskAttachmentNames[
          taskId
        ]
      ) {
        taskAttachmentNames[
          taskId
        ] =
          taskAttachmentNames[
            taskId
          ].filter(
            (attachment) =>
              attachment.id !==
              attachmentId
          );
      }

      await renderTaskAttachments(
        taskId
      );

      renderBoard();
    } catch (error) {
      console.error(
        "Unable to remove attachment:",
        error
      );

      alert(
        "Unable to remove this attachment."
      );
    }
  }

  /* =========================================================
     REMOVE PENDING ATTACHMENT
     ========================================================= */

  function removePendingAttachment(
    index
  ) {
    const numericIndex =
      Number(index);

    if (
      Number.isNaN(
        numericIndex
      )
    ) {
      return;
    }

    if (
      numericIndex < 0 ||
      numericIndex >=
        pendingTaskFiles.length
    ) {
      return;
    }

    pendingTaskFiles.splice(
      numericIndex,
      1
    );

    renderTaskAttachments();
  }

  /* =========================================================
     RENDER ATTACHMENTS INSIDE TASK POPUP
     ========================================================= */

  async function renderTaskAttachments(
    taskId = ""
  ) {
    if (!taskAttachmentsList) {
      return;
    }

    const activeTaskId =
      taskId ||
      (taskIdInput
        ? taskIdInput.value
        : "");

    /*
      NEW TASK:
      Show files selected before saving.
    */
    if (!activeTaskId) {
      if (
        !pendingTaskFiles.length
      ) {
        taskAttachmentsList.innerHTML = `
          <p class="attachment-empty">
            No attachments selected yet.
          </p>
        `;

        return;
      }

      taskAttachmentsList.innerHTML =
        pendingTaskFiles
          .map(
            (file, index) => `
              <div class="task-attachment">

                <div class="task-attachment-info">

                  <span class="task-attachment-icon">
                    ${escapeHTML(
                      getFileIcon(
                        file.name
                      )
                    )}
                  </span>

                  <div>

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

                </div>

                <div class="task-attachment-actions">

                  <button
                    type="button"
                    class="attachment-remove"
                    data-remove-pending-attachment="${index}"
                  >
                    Remove
                  </button>

                </div>

              </div>
            `
          )
          .join("");

      return;
    }

    taskAttachmentsList.innerHTML = `
      <p class="attachment-loading">
        Loading attachments...
      </p>
    `;

    try {
      const attachments =
        await getTaskAttachments(
          activeTaskId
        );

      if (!attachments.length) {
        taskAttachmentsList.innerHTML = `
          <p class="attachment-empty">
            No attachments yet.
          </p>
        `;

        return;
      }

      taskAttachmentsList.innerHTML =
        attachments
          .map(
            (attachment) => `
              <div class="task-attachment">

                <div class="task-attachment-info">

                  <span class="task-attachment-icon">
                    ${escapeHTML(
                      getFileIcon(
                        attachment.name
                      )
                    )}
                  </span>

                  <div>

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

                </div>

                <div class="task-attachment-actions">

                  <button
                    type="button"
                    class="attachment-download"
                    data-download-attachment="${escapeHTML(
                      attachment.id
                    )}"
                  >
                    Download
                  </button>

                  <button
                    type="button"
                    class="attachment-remove"
                    data-remove-attachment="${escapeHTML(
                      attachment.id
                    )}"
                    data-task-id="${escapeHTML(
                      activeTaskId
                    )}"
                  >
                    Remove
                  </button>

                </div>

              </div>
            `
          )
          .join("");
    } catch (error) {
      console.error(
        "Unable to load task attachments:",
        error
      );

      taskAttachmentsList.innerHTML = `
        <p class="attachment-empty">
          Unable to load attachments.
        </p>
      `;
    }
  }

  /* =========================================================
     HANDLE FILE SELECTION
     ========================================================= */

  async function handleFileSelection(
    event
  ) {
    const input =
      event.target;

    const taskId =
      taskIdInput
        ? taskIdInput.value
        : "";

    const files =
      Array.from(
        input.files || []
      );

    if (!files.length) {
      return;
    }

    /*
      NEW TASK:
      Keep selected files temporarily
      until the task is saved.
    */
    if (!taskId) {
      pendingTaskFiles =
        pendingTaskFiles.concat(
          files
        );

      input.value = "";

      renderTaskAttachments();

      return;
    }

    /*
      EXISTING TASK:
      Save files immediately.
    */
    try {
      for (const file of files) {
        await saveAttachment(
          taskId,
          file
        );
      }

      input.value = "";

      await renderTaskAttachments(
        taskId
      );

      renderBoard();
    } catch (error) {
      console.error(
        "Unable to save attachment:",
        error
      );

      alert(
        "Unable to save one or more attachments. Your browser may have reached its storage limit."
      );
    }
  }

  /* =========================================================
     OVERDUE TASK LOGIC
     ========================================================= */

  function updateOverdueTasks() {
    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    let hasChanges =
      false;

    state.tasks.forEach(
      (task) => {
        if (!task.due) {
          return;
        }

        if (
          task.status ===
          "done"
        ) {
          return;
        }

        const dueDate =
          new Date(
            `${task.due}T00:00:00`
          );

        if (
          Number.isNaN(
            dueDate.getTime()
          )
        ) {
          return;
        }

        if (
          dueDate < today &&
          task.priority !==
            "high"
        ) {
          task.priority =
            "high";

          hasChanges =
            true;
        }
      }
    );

    if (hasChanges) {
      saveState();
    }

    return hasChanges;
  }

  updateOverdueTasks();

  /* =========================================================
     PROJECT HELPERS
     ========================================================= */

  function getActiveProject() {
    return state.projects.find(
      (project) =>
        project.id ===
        state.activeProjectId
    );
  }

  function setActiveProject(
    projectId
  ) {
    const projectExists =
      state.projects.some(
        (project) =>
          project.id ===
          projectId
      );

    if (!projectExists) {
      return;
    }

    state.activeProjectId =
      projectId;

    saveState();

    render();
  }

  /* =========================================================
     PROJECT SELECTOR
     ========================================================= */

  function renderProjectSelector() {
    if (!projectSelect) {
      return;
    }

    projectSelect.innerHTML =
      state.projects
        .map(
          (project) => `
            <option value="${escapeHTML(
              project.id
            )}">
              ${escapeHTML(
                project.name
              )}
            </option>
          `
        )
        .join("");

    if (
      state.activeProjectId
    ) {
      projectSelect.value =
        state.activeProjectId;
    }
  }

  /* =========================================================
     FILTER TASKS
     ========================================================= */

  function getFilteredTasks() {
    const activeProjectId =
      state.activeProjectId;

    let tasks =
      state.tasks.filter(
        (task) =>
          task.projectId ===
          activeProjectId
      );

    const selectedStatus =
      statusFilter
        ? statusFilter.value
        : "";

    if (
      selectedStatus &&
      selectedStatus !==
        "all"
    ) {
      tasks =
        tasks.filter(
          (task) =>
            task.status ===
            selectedStatus
        );
    }

    const selectedPriority =
      priorityFilter
        ? priorityFilter.value
        : "";

    if (
      selectedPriority &&
      selectedPriority !==
        "all"
    ) {
      tasks =
        tasks.filter(
          (task) =>
            task.priority ===
            selectedPriority
        );
    }

    const searchTerm =
      searchInput
        ? searchInput.value
            .trim()
            .toLowerCase()
        : "";

    if (searchTerm) {
      tasks =
        tasks.filter(
          (task) => {
            const searchableText =
              [
                task.title,
                task.description,
                ...(Array.isArray(
                  task.labels
                )
                  ? task.labels
                  : [])
              ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(
              searchTerm
            );
          }
        );
    }

    /*
      Always render tasks according
      to their saved position.
    */
    return tasks.sort(
      (a, b) =>
        (a.order ?? 0) -
        (b.order ?? 0)
    );
  }

  /* =========================================================
     RENDER BOARD
     ========================================================= */

  function renderBoard() {
    if (!board) {
      return;
    }

    updateOverdueTasks();

    const tasks =
      getFilteredTasks();

    board.innerHTML =
      COLUMNS.map(
        (column) => {
          const columnTasks =
            tasks.filter(
              (task) =>
                task.status ===
                column.id
            );

          return `
            <section
              class="column"
              data-status="${escapeHTML(
                column.id
              )}"
            >

              <div class="column-head">

                <strong>
                  ${escapeHTML(
                    column.label
                  )}
                </strong>

                <span>
                  ${columnTasks.length}
                </span>

              </div>

              <button
                type="button"
                class="add-task"
                data-add-task="${escapeHTML(
                  column.id
                )}"
              >
                + Add task
              </button>

              <div
                class="task-list"
                data-status="${escapeHTML(
                  column.id
                )}"
              >

                ${
                  columnTasks.length
                    ? columnTasks
                        .map(
                          renderTask
                        )
                        .join("")
                    : `
                        <div class="empty-column">
                          No tasks here yet.
                        </div>
                      `
                }

              </div>

            </section>
          `;
        }
      ).join("");

    initializeDragAndDrop();
  }

 /* =========================================================
   RENDER TASK
   ========================================================= */

function renderTask(task) {
  const labels =
    Array.isArray(
      task.labels
    )
      ? task.labels
      : [];

  return `
    <article
      class="task"
      draggable="true"
      data-task-id="${escapeHTML(
        task.id
      )}"
    >

      <h3>
        ${escapeHTML(
          task.title
        )}
      </h3>

      ${
        task.priority
          ? `
              <span class="priority ${escapeHTML(
                task.priority
              )}">
                ${escapeHTML(
                  task.priority
                )}
              </span>
            `
          : ""
      }

      ${
        labels.length ||
        task.due
          ? `
              <div class="task-meta">

                ${labels
                  .map(
                    (label) => `
                      <span class="tag">
                        ${escapeHTML(
                          label
                        )}
                      </span>
                    `
                  )
                  .join("")}

                ${
                  task.due
                    ? `
                        <span class="due">
                          ${escapeHTML(
                            formatDate(
                              task.due
                            )
                          )}
                        </span>
                      `
                    : ""
                }

              </div>
            `
          : ""
      }

      <div class="task-actions">

        <button
          type="button"
          class="task-delete-button"
          data-delete-task="${escapeHTML(
            task.id
          )}"
          aria-label="Delete task"
          title="Delete task"
        >
          Delete
        </button>

      </div>

    </article>
  `;
}

  /* =========================================================
     PROJECT CARDS
     ========================================================= */

  function renderProjectCards() {
    if (!projectCards) {
      return;
    }

    if (
      !state.projects.length
    ) {
      projectCards.innerHTML = `
        <div class="empty-projects">

          <p>
            No projects yet.
          </p>

          <button
            type="button"
            class="primary"
            id="emptyCreateProject"
          >
            Create your first project
          </button>

        </div>
      `;

      const emptyCreateButton =
        $("emptyCreateProject");

      if (
        emptyCreateButton
      ) {
        emptyCreateButton.addEventListener(
          "click",
          openProject
        );
      }

      return;
    }

    projectCards.innerHTML =
      state.projects
        .map(
          (project) => {
            const projectTaskCount =
              state.tasks.filter(
                (task) =>
                  task.projectId ===
                  project.id
              ).length;

            const isActive =
              project.id ===
              state.activeProjectId;

            return `
              <article
                class="project-card ${
                  isActive
                    ? "active"
                    : ""
                }"
                data-project-id="${escapeHTML(
                  project.id
                )}"
              >

                <div class="project-card-content">

                  <h3>
                    ${escapeHTML(
                      project.name
                    )}
                  </h3>

                  ${
                    project.description
                      ? `
                          <p>
                            ${escapeHTML(
                              project.description
                            )}
                          </p>
                        `
                      : ""
                  }

                  <span class="project-task-count">
                    ${projectTaskCount}
                    ${
                      projectTaskCount ===
                      1
                        ? "task"
                        : "tasks"
                    }
                  </span>

                </div>

                <div class="project-card-actions">

                  <button
                    type="button"
                    class="project-delete-button"
                    data-delete-project="${escapeHTML(
                      project.id
                    )}"
                    aria-label="Delete ${escapeHTML(
                      project.name
                    )}"
                    title="Delete project"
                  >
                    Delete
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("");
  }

  /* =========================================================
     STATISTICS
     ========================================================= */

  function renderStats() {
    updateOverdueTasks();

    const tasks =
      state.tasks.filter(
        (task) =>
          task.projectId ===
          state.activeProjectId
      );

    const completed =
      tasks.filter(
        (task) =>
          task.status ===
          "done"
      ).length;

    const inProgress =
      tasks.filter(
        (task) =>
          task.status ===
          "in-progress"
      ).length;

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const dueTasks =
      tasks.filter(
        (task) => {
          if (
            !task.due ||
            task.status ===
              "done"
          ) {
            return false;
          }

          const dueDate =
            new Date(
              `${task.due}T00:00:00`
            );

          return (
            !Number.isNaN(
              dueDate.getTime()
            ) &&
            dueDate <= today
          );
        }
      ).length;

    const overdueTasks =
      tasks.filter(
        (task) => {
          if (
            !task.due ||
            task.status ===
              "done"
          ) {
            return false;
          }

          const dueDate =
            new Date(
              `${task.due}T00:00:00`
            );

          return (
            !Number.isNaN(
              dueDate.getTime()
            ) &&
            dueDate < today
          );
        }
      ).length;

    if (statTasks) {
      statTasks.textContent =
        tasks.length;
    }

    if (statCompleted) {
      statCompleted.textContent =
        completed;
    }

    if (statProgress) {
      statProgress.textContent =
        inProgress;
    }

    if (statDue) {
      statDue.textContent =
        dueTasks;
    }

    if (statOverdue) {
      statOverdue.textContent =
        overdueTasks;
    }
  }

  /* =========================================================
     RENDER EVERYTHING
     ========================================================= */

  function render() {
    renderProjectSelector();

    renderBoard();

    renderProjectCards();

    renderStats();
  }

  /* =========================================================
     OPEN TASK
     ========================================================= */

  function openTask(
    taskId = "",
    status = "backlog"
  ) {
    if (
      !taskDialog ||
      !taskForm
    ) {
      return;
    }

    const task =
      state.tasks.find(
        (item) =>
          item.id === taskId
      );

    taskForm.reset();

    /*
      Clear temporary files whenever
      a task popup is opened.
    */
    pendingTaskFiles = [];

    if (task) {
      taskIdInput.value =
        task.id;

      taskStatusInput.value =
        task.status;

      taskTitleInput.value =
        task.title || "";

      taskDescriptionInput.value =
        task.description || "";

      taskPriorityInput.value =
        task.priority ||
        "medium";

      taskDueInput.value =
        task.due || "";

      taskLabelsInput.value =
        Array.isArray(
          task.labels
        )
          ? task.labels.join(
              ", "
            )
          : "";

      if (taskFilesInput) {
        taskFilesInput.disabled =
          false;

        taskFilesInput.value =
          "";
      }

      taskDialog.showModal();

      renderTaskAttachments(
        task.id
      );

      return;
    }

    taskIdInput.value =
      "";

    taskStatusInput.value =
      COLUMNS.some(
        (column) =>
          column.id === status
      )
        ? status
        : "backlog";

    taskPriorityInput.value =
      "medium";

    /*
      New tasks can attach files
      before they are saved.
    */
    if (taskFilesInput) {
      taskFilesInput.disabled =
        false;

      taskFilesInput.value =
        "";
    }

    if (taskAttachmentsList) {
      taskAttachmentsList.innerHTML = `
        <p class="attachment-empty">
          No attachments selected yet.
        </p>
      `;
    }

    taskDialog.showModal();

    if (taskTitleInput) {
      taskTitleInput.focus();
    }
  }

  /* =========================================================
     SAVE TASK
     ========================================================= */

  async function saveTask(event) {
    event.preventDefault();

    const title =
      taskTitleInput.value.trim();

    if (!title) {
      taskTitleInput.focus();

      return;
    }

    const labels =
      taskLabelsInput.value
        .split(",")
        .map(
          (label) =>
            label.trim()
        )
        .filter(Boolean);

    const taskId =
      taskIdInput.value;

    /*
      EXISTING TASK
    */
    if (taskId) {
      const task =
        state.tasks.find(
          (item) =>
            item.id === taskId
        );

      if (task) {
        task.title =
          title;

        task.description =
          taskDescriptionInput.value.trim();

        task.priority =
          taskPriorityInput.value ||
          "medium";

        task.due =
          taskDueInput.value ||
          "";

        task.labels =
          labels;

        task.status =
          COLUMNS.some(
            (column) =>
              column.id ===
              taskStatusInput.value
          )
            ? taskStatusInput.value
            : "backlog";

        /*
          Make sure an older task
          without an order receives one.
        */
        if (
          typeof task.order !==
          "number"
        ) {
          const tasksInColumn =
            state.tasks.filter(
              (item) =>
                item.projectId ===
                  task.projectId &&
                item.status ===
                  task.status &&
                item.id !==
                  task.id
            );

          task.order =
            tasksInColumn.length;
        }
      }

      saveState();

      pendingTaskFiles = [];

      if (taskFilesInput) {
        taskFilesInput.value =
          "";
      }

      updateOverdueTasks();

      taskDialog.close();

      render();

      refreshAttachmentCounts();

      return;
    }

    /* =======================================================
       NEW TASK
       ======================================================= */

    const selectedStatus =
      COLUMNS.some(
        (column) =>
          column.id ===
          taskStatusInput.value
      )
        ? taskStatusInput.value
        : "backlog";

    const newTaskId =
      createId("task");

    /*
      New tasks receive an order
      smaller than every existing
      task in the column.

      This means the new task
      appears at the TOP.
    */
    const newTaskOrder =
      getNewTaskOrder(
        state.activeProjectId,
        selectedStatus
      );

    const newTask = {
      id: newTaskId,

      projectId:
        state.activeProjectId,

      title:
        title,

      description:
        taskDescriptionInput.value.trim(),

      priority:
        taskPriorityInput.value ||
        "medium",

      due:
        taskDueInput.value ||
        "",

      labels:
        labels,

      status:
        selectedStatus,

      order:
        newTaskOrder,

      createdAt:
        new Date().toISOString()
    };

    /*
      Save any files selected
      before the task was saved.
    */
    const filesToSave =
      pendingTaskFiles.slice();

    try {
      for (
        const file of filesToSave
      ) {
        await saveAttachment(
          newTaskId,
          file
        );
      }
    } catch (error) {
      console.error(
        "Unable to save new task attachments:",
        error
      );

      /*
        Clean up any attachments
        that were successfully saved
        before the failure.
      */
      try {
        await deleteTaskAttachments(
          newTaskId
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Unable to clean up failed task attachments:",
          cleanupError
        );
      }

      alert(
        "Unable to save one or more attachments. The task was not created. Please try again."
      );

      return;
    }

    /*
      Only add the task to state
      after its attachments have
      been successfully saved.
    */
    state.tasks.push(
      newTask
    );

    pendingTaskFiles = [];

    if (taskFilesInput) {
      taskFilesInput.value =
        "";
    }

    updateOverdueTasks();

    saveState();

    taskDialog.close();

    render();

    refreshAttachmentCounts();
  }

  /* =========================================================
     DELETE TASK
     ========================================================= */

  async function deleteTask(
    taskId
  ) {
    const task =
      state.tasks.find(
        (item) =>
          item.id === taskId
      );

    if (!task) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${task.title}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteTaskAttachments(
        taskId
      );

      state.tasks =
        state.tasks.filter(
          (item) =>
            item.id !== taskId
        );

      normalizeColumnOrder(
        task.projectId,
        task.status
      );

      saveState();

      render();
    } catch (error) {
      console.error(
        "Unable to delete task attachments:",
        error
      );

      state.tasks =
        state.tasks.filter(
          (item) =>
            item.id !== taskId
        );

      delete attachmentCounts[
        taskId
      ];

      delete taskAttachmentNames[
        taskId
      ];

      normalizeColumnOrder(
        task.projectId,
        task.status
      );

      saveState();

      render();
    }
  }

  /* =========================================================
     OPEN PROJECT
     ========================================================= */

  function openProject() {
    if (
      !projectDialog ||
      !projectForm
    ) {
      return;
    }

    projectForm.reset();

    projectDialog.showModal();

    if (projectNameInput) {
      projectNameInput.focus();
    }
  }

  /* =========================================================
     CREATE PROJECT
     ========================================================= */

  function createProject(event) {
    event.preventDefault();

    const name =
      projectNameInput.value.trim();

    if (!name) {
      projectNameInput.focus();

      return;
    }

    const newProject = {
      id: createId(
        "project"
      ),

      name,

      description:
        projectDescriptionInput.value.trim()
    };

    state.projects.push(
      newProject
    );

    state.activeProjectId =
      newProject.id;

    saveState();

    projectDialog.close();

    render();
  }

  /* =========================================================
     DELETE PROJECT
     ========================================================= */

  async function deleteProject(
    projectId
  ) {
    const project =
      state.projects.find(
        (item) =>
          item.id ===
          projectId
      );

    if (!project) {
      return;
    }

    const projectTasks =
      state.tasks.filter(
        (task) =>
          task.projectId ===
          projectId
      );

    const projectTaskCount =
      projectTasks.length;

    const taskMessage =
      projectTaskCount > 0
        ? ` This will also delete ${projectTaskCount} ${
            projectTaskCount ===
            1
              ? "task"
              : "tasks"
          } belonging to this project.`
        : "";

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${project.name}"?${taskMessage}`
      );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(
        projectTasks.map(
          (task) =>
            deleteTaskAttachments(
              task.id
            )
        )
      );

      state.projects =
        state.projects.filter(
          (item) =>
            item.id !==
            projectId
        );

      state.tasks =
        state.tasks.filter(
          (task) =>
            task.projectId !==
            projectId
        );

      if (
        state.activeProjectId ===
        projectId
      ) {
        state.activeProjectId =
          state.projects.length >
          0
            ? state.projects[0].id
            : null;
      }

      saveState();

      render();
    } catch (error) {
      console.error(
        "Unable to delete project attachments:",
        error
      );

      state.projects =
        state.projects.filter(
          (item) =>
            item.id !==
            projectId
        );

      state.tasks =
        state.tasks.filter(
          (task) =>
            task.projectId !==
            projectId
        );

      if (
        state.activeProjectId ===
        projectId
      ) {
        state.activeProjectId =
          state.projects.length >
          0
            ? state.projects[0].id
            : null;
      }

      saveState();

      render();
    }
  }

  /* =========================================================
     CLOSE DIALOG
     ========================================================= */

  function closeDialog(
    dialog
  ) {
    if (!dialog) {
      return;
    }

    if (
      typeof dialog.close ===
      "function"
    ) {
      dialog.close();
    }
  }

  /* =========================================================
     DRAG & DROP
     ========================================================= */

  let draggedTaskId =
    null;

  function initializeDragAndDrop() {
    const taskElements =
      document.querySelectorAll(
        ".task"
      );

    const dropZones =
      document.querySelectorAll(
        ".task-list"
      );

    taskElements.forEach(
      (taskElement) => {
        taskElement.addEventListener(
          "dragstart",
          handleDragStart
        );

        taskElement.addEventListener(
          "dragend",
          handleDragEnd
        );

        taskElement.addEventListener(
          "click",
          (event) => {
            if (
              event.target.closest(
                "[data-delete-task]"
              )
            ) {
              return;
            }

            if (
              event.target.closest(
                "[data-download-attachment]"
              )
            ) {
              return;
            }

            const taskId =
              taskElement.dataset
                .taskId;

            if (taskId) {
              openTask(
                taskId
              );
            }
          }
        );
      }
    );

    dropZones.forEach(
      (dropZone) => {
        dropZone.addEventListener(
          "dragover",
          handleDragOver
        );

        dropZone.addEventListener(
          "dragleave",
          handleDragLeave
        );

        dropZone.addEventListener(
          "drop",
          handleDrop
        );
      }
    );
  }

  function handleDragStart(
    event
  ) {
    const taskElement =
      event.currentTarget;

    draggedTaskId =
      taskElement.dataset
        .taskId;

    taskElement.classList.add(
      "dragging"
    );

    if (
      event.dataTransfer
    ) {
      event.dataTransfer.effectAllowed =
        "move";

      event.dataTransfer.setData(
        "text/plain",
        draggedTaskId
      );
    }
  }

  function handleDragEnd(
    event
  ) {
    event.currentTarget.classList.remove(
      "dragging"
    );

    draggedTaskId = null;

    document
      .querySelectorAll(
        ".task-list"
      )
      .forEach(
        (zone) =>
          zone.classList.remove(
            "drag-over"
          )
      );
  }

  function handleDragOver(
    event
  ) {
    event.preventDefault();

    const dropZone =
      event.currentTarget;

    dropZone.classList.add(
      "drag-over"
    );

    if (
      event.dataTransfer
    ) {
      event.dataTransfer.dropEffect =
        "move";
    }
  }

  function handleDragLeave(
    event
  ) {
    event.currentTarget.classList.remove(
      "drag-over"
    );
  }

  function handleDrop(
    event
  ) {
    event.preventDefault();

    const dropZone =
      event.currentTarget;

    dropZone.classList.remove(
      "drag-over"
    );

    const taskId =
      draggedTaskId ||
      (
        event.dataTransfer
          ? event.dataTransfer.getData(
              "text/plain"
            )
          : ""
      );

    const newStatus =
      dropZone.dataset.status;

    if (
      !taskId ||
      !newStatus
    ) {
      return;
    }

    const validStatus =
      COLUMNS.some(
        (column) =>
          column.id ===
          newStatus
      );

    if (!validStatus) {
      return;
    }

    const task =
      state.tasks.find(
        (item) =>
          item.id === taskId
      );

    if (!task) {
      return;
    }

    const oldStatus =
      task.status;

    const projectId =
      task.projectId;

    /*
      Get all visible task cards
      except the task being dragged.
    */
    const taskElements =
      Array.from(
        dropZone.querySelectorAll(
          ".task"
        )
      ).filter(
        (element) =>
          element.dataset.taskId !==
          taskId
      );

    /*
      Find the first card whose
      vertical midpoint is below
      the mouse pointer.
    */
    let targetTaskElement =
      null;

    for (
      const element of taskElements
    ) {
      const rect =
        element.getBoundingClientRect();

      const midpoint =
        rect.top +
        rect.height / 2;

      if (
        event.clientY <
        midpoint
      ) {
        targetTaskElement =
          element;

        break;
      }
    }

    /*
      Move the task to the new
      column.
    */
    task.status =
      newStatus;

    /*
      Get the destination column's
      tasks, excluding the dragged
      task.
    */
    const destinationTasks =
      state.tasks
        .filter(
          (item) =>
            item.projectId ===
              projectId &&
            item.status ===
              newStatus &&
            item.id !==
              taskId
        )
        .sort(
          (a, b) =>
            (a.order ?? 0) -
            (b.order ?? 0)
        );

    /*
      Insert the dragged task
      at the position where the
      user dropped it.
    */
    if (targetTaskElement) {
      const targetTaskId =
        targetTaskElement.dataset
          .taskId;

      const targetIndex =
        destinationTasks.findIndex(
          (item) =>
            item.id ===
            targetTaskId
        );

      if (
        targetIndex !== -1
      ) {
        destinationTasks.splice(
          targetIndex,
          0,
          task
        );
      } else {
        destinationTasks.push(
          task
        );
      }
    } else {
      /*
        If the user drops below all
        cards, place the task at the
        bottom.
      */
      destinationTasks.push(
        task
      );
    }

    /*
      Rebuild the order values based
      on the exact order selected by
      the user.
    */
    destinationTasks.forEach(
      (item, index) => {
        item.order = index;
      }
    );

    /*
      If the task came from another
      column, clean up that old
      column's order values.
    */
    if (
      oldStatus !== newStatus
    ) {
      normalizeColumnOrder(
        projectId,
        oldStatus
      );
    }

    saveState();

    render();
  }

  /* =========================================================
     PROJECT SELECT
     ========================================================= */

  if (projectSelect) {
    projectSelect.addEventListener(
      "change",
      (event) => {
        setActiveProject(
          event.target.value
        );
      }
    );
  }

  /* =========================================================
     FILTERS
     ========================================================= */

  if (statusFilter) {
    statusFilter.addEventListener(
      "change",
      renderBoardAndStats
    );
  }

  if (priorityFilter) {
    priorityFilter.addEventListener(
      "change",
      renderBoardAndStats
    );
  }

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      renderBoardAndStats
    );
  }

  /* =========================================================
     NEW PROJECT BUTTONS
     ========================================================= */

  if ($("newProject")) {
    $("newProject").addEventListener(
      "click",
      openProject
    );
  }

  if ($("newProject2")) {
    $("newProject2").addEventListener(
      "click",
      openProject
    );
  }

  /* =========================================================
     FORM EVENTS
     ========================================================= */

  if (taskForm) {
    taskForm.addEventListener(
      "submit",
      saveTask
    );
  }

  if (projectForm) {
    projectForm.addEventListener(
      "submit",
      createProject
    );
  }

  if (taskFilesInput) {
    taskFilesInput.addEventListener(
      "change",
      handleFileSelection
    );
  }

  /* =========================================================
     CLOSE BUTTONS
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const closeButton =
        event.target.closest(
          "[data-close]"
        );

      if (!closeButton) {
        return;
      }

      closeDialog(
        $(
          closeButton.dataset
            .close
        )
      );
    }
  );

  /* =========================================================
     ADD TASK BUTTONS
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const addButton =
        event.target.closest(
          "[data-add-task]"
        );

      if (!addButton) {
        return;
      }

      openTask(
        "",
        addButton.dataset
          .addTask ||
          "backlog"
      );
    }
  );

  /* =========================================================
     DELETE TASK BUTTONS
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const deleteButton =
        event.target.closest(
          "[data-delete-task]"
        );

      if (!deleteButton) {
        return;
      }

      event.stopPropagation();

      deleteTask(
        deleteButton.dataset
          .deleteTask
      );
    }
  );

  /* =========================================================
     DELETE PROJECT BUTTONS
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const deleteButton =
        event.target.closest(
          "[data-delete-project]"
        );

      if (!deleteButton) {
        return;
      }

      event.stopPropagation();

      deleteProject(
        deleteButton.dataset
          .deleteProject
      );
    }
  );

  /* =========================================================
     PROJECT CARD CLICK
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const projectCard =
        event.target.closest(
          "[data-project-id]"
        );

      if (!projectCard) {
        return;
      }

      if (
        event.target.closest(
          "[data-delete-project]"
        )
      ) {
        return;
      }

      setActiveProject(
        projectCard.dataset
          .projectId
      );
    }
  );

  /* =========================================================
     DOWNLOAD ATTACHMENT
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const link =
        event.target.closest(
          "[data-download-attachment]"
        );

      if (!link) {
        return;
      }

      event.preventDefault();

      event.stopPropagation();

      downloadTaskAttachment(
        link.dataset
          .downloadAttachment
      );
    }
  );

  /* =========================================================
     REMOVE SAVED ATTACHMENT
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-remove-attachment]"
        );

      if (!button) {
        return;
      }

      event.preventDefault();

      event.stopPropagation();

      removeTaskAttachment(
        button.dataset
          .removeAttachment,

        button.dataset.taskId
      );
    }
  );

  /* =========================================================
     REMOVE PENDING ATTACHMENT
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-remove-pending-attachment]"
        );

      if (!button) {
        return;
      }

      event.preventDefault();

      event.stopPropagation();

      removePendingAttachment(
        button.dataset
          .removePendingAttachment
      );
    }
  );

  /* =========================================================
     CLOSE DIALOG WHEN CLICKING OUTSIDE
     ========================================================= */

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof
        HTMLDialogElement
      ) {
        const dialog =
          event.target;

        const rect =
          dialog.getBoundingClientRect();

        const clickedInside =
          event.clientX >=
            rect.left &&
          event.clientX <=
            rect.right &&
          event.clientY >=
            rect.top &&
          event.clientY <=
            rect.bottom;

        if (
          !clickedInside
        ) {
          dialog.close();
        }
      }
    }
  );

  /* =========================================================
     BOARD + STATS
     ========================================================= */

  function renderBoardAndStats() {
    renderBoard();

    renderStats();
  }

  /* =========================================================
     FOOTER YEAR
     ========================================================= */

  const yearElement =
    $("year");

  if (yearElement) {
    yearElement.textContent =
      new Date().getFullYear();
  }

  /* =========================================================
     INITIAL RENDER
     ========================================================= */

  render();

  refreshAttachmentCounts();

  /* =========================================================
     CHECK OVERDUE TASKS EVERY MINUTE
     ========================================================= */

  setInterval(() => {
    const hasChanges =
      updateOverdueTasks();

    if (hasChanges) {
      render();
    }
  }, 60000);
})();