/* Marketing Content Calendar
   Public Supabase-powered calendar with multi-project support.

   Includes:
   - Project management and safe project deletion
   - Content transfer between projects
   - Multiple file attachments
   - File preview and download
   - Attachment removal
   - Inline images pasted into Description / brief and Notes
   - Supabase Storage persistence for inline images
   - Inline image resizing
   - Full-size inline image preview

   Supabase Storage bucket: marketing-content-attachments
   Database column: marketing_content.attachments (JSONB)

   Never use the service-role key in browser JavaScript.
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://qqvsfbpheacaqrvvdjbp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Dd7Nm5oTNLKuHj6JA_R01Q_yJqk8JCX";

  const TABLE = "marketing_content";
  const PROJECTS_TABLE = "marketing_projects";

  const STORAGE_BUCKET = "marketing-content-attachments";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const SIGNED_URL_EXPIRY = 60 * 60;

  const EDITOR_LIMITS = {
    contentBrief: 10000,
    contentNotes: 5000
  };

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
    },
    existingAttachments: [],
    pendingFiles: [],
    pendingInlineImages: [],
    removedAttachments: [],
    selectedInlineImage: null,
    resizeOverlay: null,
    previewDialog: null
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

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getSafeFileName(name) {
    return String(name || "attachment")
      .replace(/[\/\\]/g, "-")
      .replace(/[^\w.\-() ]/g, "_")
      .trim()
      .slice(0, 150) || "attachment";
  }

  function getUniqueFileId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getContentAttachments(item) {
    return Array.isArray(item?.attachments) ? item.attachments : [];
  }

  function isInlineImage(attachment) {
    return attachment?.kind === "inline-image";
  }

  function getEditorField(field) {
    return $(field);
  }

  function getEditorText(field) {
    return getEditorField(field)?.textContent?.trim() || "";
  }

  function setEditorHtml(field, html) {
    const editor = getEditorField(field);
    if (editor) editor.innerHTML = html || "";
    hideImageResizeOverlay();
  }

  function revokePendingImageUrls() {
    state.pendingInlineImages.forEach((image) => {
      if (image.objectUrl) {
        URL.revokeObjectURL(image.objectUrl);
      }
    });
  }

  function setFormMessage(message, isError = false) {
    $("formMessage").textContent = message;
    $("formMessage").classList.toggle("is-error", isError);
  }

  function setProjectMessage(message, isError = false) {
    $("projectFormMessage").textContent = message;
    $("projectFormMessage").classList.toggle("is-error", isError);
  }

  function getActiveProject() {
    return state.projects.find(
      (project) => String(project.id) === String(state.activeProjectId)
    );
  }

  function isDefaultProject(project) {
    return project?.name?.trim().toLowerCase() === "general content";
  }

  /* =====================================
     RICH TEXT EDITOR HELPERS
  ===================================== */

  const ALLOWED_EDITOR_TAGS = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U",
    "UL", "OL", "LI", "BLOCKQUOTE", "H2", "H3",
    "A", "IMG"
  ]);

  function isSafeLink(value) {
    if (!value) return false;

    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:", "mailto:"].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function sanitizeEditorHtml(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(String(html || ""), "text/html");

    function sanitizeNode(node) {
      const output = [];

      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          output.push(parsed.createTextNode(child.textContent));
          return;
        }

        if (child.nodeType !== Node.ELEMENT_NODE) return;

        const tag = child.tagName;

        if (
          ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT"]
            .includes(tag)
        ) {
          return;
        }

        const children = sanitizeNode(child);

        if (!ALLOWED_EDITOR_TAGS.has(tag)) {
          output.push(...children);
          return;
        }

        const element = parsed.createElement(tag.toLowerCase());

        children.forEach((childNode) => element.appendChild(childNode));

        if (tag === "A") {
          const href = child.getAttribute("href");

          if (isSafeLink(href)) {
            element.setAttribute("href", href);
            element.setAttribute("rel", "noopener noreferrer");
          }
        }

        if (tag === "IMG") {
          const imageId = child.getAttribute("data-inline-image-id");

          if (!imageId) return;

          element.setAttribute("data-inline-image-id", imageId);
          element.setAttribute(
            "alt",
            child.getAttribute("alt") || "Pasted image"
          );

          // Preserve a valid resized width when saving editor HTML.
          const width = Number(child.getAttribute("width"));

          if (
            Number.isInteger(width) &&
            width >= 40 &&
            width <= 4000
          ) {
            element.setAttribute("width", String(width));
          }
        }

        output.push(element);
      });

      return output;
    }

    const safeNodes = sanitizeNode(parsed.body);
    const wrapper = parsed.createElement("div");

    safeNodes.forEach((node) => wrapper.appendChild(node));

    return wrapper.innerHTML.trim();
  }

  function plainTextToEditorHtml(value) {
    const text = String(value || "");

    if (!text) return "";

    return text
      .split(/\r?\n/)
      .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
      .join("");
  }

  function normalizeStoredEditorContent(value) {
    const content = String(value || "");

    if (!content) return "";

    const looksLikeHtml =
      /<\/?(p|br|strong|b|em|i|u|ul|ol|li|blockquote|h2|h3|a|img)(\s|>|\/)/i
        .test(content);

    return looksLikeHtml
      ? sanitizeEditorHtml(content)
      : plainTextToEditorHtml(content);
  }

  function getEditorHtml(field) {
    const editor = getEditorField(field);
    if (!editor) return "";

    return sanitizeEditorHtml(editor.innerHTML);
  }

  function getInlineImageIds(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html || "", "text/html");

    return Array.from(
      parsed.querySelectorAll("img[data-inline-image-id]")
    ).map((image) => image.getAttribute("data-inline-image-id"));
  }

  function insertNodeAtCursor(editor, node) {
    editor.focus();

    const selection = window.getSelection();

    if (!selection || !selection.rangeCount) {
      editor.appendChild(node);
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
      editor.appendChild(node);
      return;
    }

    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertTextAtCursor(editor, text) {
    const selection = window.getSelection();

    if (!selection || !selection.rangeCount) {
      editor.appendChild(document.createTextNode(text));
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
      editor.appendChild(document.createTextNode(text));
      return;
    }

    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* =====================================
     INLINE IMAGE RESIZING
  ===================================== */

  function hideImageResizeOverlay() {
    if (state.resizeOverlay) {
      state.resizeOverlay.hidden = true;
    }

    state.selectedInlineImage = null;
  }

  function positionImageResizeOverlay() {
    const image = state.selectedInlineImage;
    const overlay = state.resizeOverlay;

    if (!image || !overlay || !image.isConnected) {
      hideImageResizeOverlay();
      return;
    }

    const field = image.closest(".mc-rich-field");
    const editor = image.closest(".mc-rich-editor");

    if (!field || !editor) {
      hideImageResizeOverlay();
      return;
    }

    const imageRect = image.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    if (
      imageRect.width <= 0 ||
      imageRect.height <= 0 ||
      imageRect.bottom < editorRect.top ||
      imageRect.top > editorRect.bottom ||
      imageRect.right < editorRect.left ||
      imageRect.left > editorRect.right
    ) {
      overlay.hidden = true;
      return;
    }

    overlay.style.left = `${imageRect.left - fieldRect.left + field.scrollLeft}px`;
    overlay.style.top = `${imageRect.top - fieldRect.top + field.scrollTop}px`;
    overlay.style.width = `${imageRect.width}px`;
    overlay.style.height = `${imageRect.height}px`;
    overlay.hidden = false;
  }

  function selectInlineImage(image) {
    if (!image || !image.dataset.inlineImageId) {
      hideImageResizeOverlay();
      return;
    }

    const field = image.closest(".mc-rich-field");

    if (!field) return;

    if (!state.resizeOverlay || state.resizeOverlay.parentElement !== field) {
      hideImageResizeOverlay();

      const overlay = document.createElement("div");
      overlay.className = "mc-image-resize-overlay";
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "mc-image-resize-handle";
      handle.setAttribute("aria-label", "Resize image");
      handle.setAttribute("title", "Drag to resize image");

      overlay.appendChild(handle);
      field.appendChild(overlay);

      state.resizeOverlay = overlay;

      handle.addEventListener("pointerdown", startImageResize);
    }

    state.selectedInlineImage = image;
    positionImageResizeOverlay();
  }

  function startImageResize(event) {
    if (event.button !== 0) return;

    const image = state.selectedInlineImage;
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();

    const startWidth = image.getBoundingClientRect().width;
    const startHeight = image.getBoundingClientRect().height;

    if (!startWidth || !startHeight) return;

    const editor = image.closest(".mc-rich-editor");
    if (!editor) return;

    const editorStyle = window.getComputedStyle(editor);
    const horizontalPadding =
      parseFloat(editorStyle.paddingLeft || 0) +
      parseFloat(editorStyle.paddingRight || 0);

    const maxWidth = Math.max(
      80,
      editor.clientWidth - horizontalPadding
    );

    const aspectRatio = startWidth / startHeight;
    const startX = event.clientX;

    const handle = event.currentTarget;

    handle.setPointerCapture(event.pointerId);

    function onPointerMove(moveEvent) {
      const difference = moveEvent.clientX - startX;

      const newWidth = Math.max(
        80,
        Math.min(maxWidth, startWidth + difference)
      );

      const roundedWidth = Math.round(newWidth);

      // The width attribute is preserved by sanitizeEditorHtml().
      image.setAttribute("width", String(roundedWidth));

      image.style.width = `${roundedWidth}px`;
      image.style.height = "auto";

      // Keep the displayed ratio correct while resizing.
      image.style.aspectRatio = `${aspectRatio}`;

      positionImageResizeOverlay();
    }

    function onPointerUp() {
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);

      image.style.removeProperty("aspect-ratio");
      image.style.removeProperty("height");
      image.style.removeProperty("width");

      positionImageResizeOverlay();
    }

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }

  /* =====================================
     INLINE IMAGE PREVIEW
  ===================================== */

  function createImagePreviewDialog() {
    if (state.previewDialog) return state.previewDialog;

    const dialog = document.createElement("dialog");
    dialog.className = "mc-image-preview-dialog";
    dialog.setAttribute("aria-label", "Image preview");

    dialog.innerHTML = `
      <div class="mc-image-preview-content">
        <button
          type="button"
          class="mc-image-preview-close"
          aria-label="Close image preview"
          title="Close preview">
          &times;
        </button>

        <img class="mc-image-preview-image" alt="Pasted image preview">
      </div>
    `;

    document.body.appendChild(dialog);

    const closeButton = dialog.querySelector(
      ".mc-image-preview-close"
    );

    const previewImage = dialog.querySelector(
      ".mc-image-preview-image"
    );

    closeButton.addEventListener("click", () => {
      dialog.close();
    });

    // Clicking the dark backdrop closes the preview.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    // Clear the source after closing.
    dialog.addEventListener("close", () => {
      previewImage.removeAttribute("src");
    });

    state.previewDialog = dialog;

    return dialog;
  }

  function openInlineImagePreview(image) {
    if (!image) return;

    const source = image.currentSrc || image.src;

    if (!source) return;

    const dialog = createImagePreviewDialog();
    const previewImage = dialog.querySelector(
      ".mc-image-preview-image"
    );

    previewImage.src = source;
    previewImage.alt = image.alt || "Pasted image preview";

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  /* =====================================
     PASTE INLINE IMAGES
  ===================================== */

  function addInlineImageToEditor(editor, field, file) {
    if (!file || !file.type.startsWith("image/")) {
      setFormMessage("Please paste a valid image file.", true);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormMessage(
        `${file.name || "The pasted image"} exceeds the 50 MB file size limit.`,
        true
      );
      return;
    }

    const id = getUniqueFileId();
    const objectUrl = URL.createObjectURL(file);

    const image = document.createElement("img");
    image.src = objectUrl;
    image.alt = file.name || "Pasted image";
    image.dataset.inlineImageId = id;
    image.dataset.inlineImagePending = "true";

    state.pendingInlineImages.push({
      id,
      field,
      file,
      objectUrl
    });

    insertNodeAtCursor(editor, image);

    setFormMessage("");
  }

  function bindRichEditorEvents() {
    Object.keys(EDITOR_LIMITS).forEach((field) => {
      const editor = getEditorField(field);

      if (!editor) {
        console.warn(`Rich-text editor "${field}" was not found.`);
        return;
      }

      editor.addEventListener("paste", (event) => {
        const clipboardItems = Array.from(
          event.clipboardData?.items || []
        );

        const imageItem = clipboardItems.find((item) =>
          item.type.startsWith("image/")
        );

        if (imageItem) {
          const file = imageItem.getAsFile();

          if (file) {
            event.preventDefault();
            addInlineImageToEditor(editor, field, file);
          }

          return;
        }

        const plainText = event.clipboardData?.getData("text/plain");

        if (plainText) {
          event.preventDefault();
          insertTextAtCursor(editor, plainText);
        }
      });

      editor.addEventListener("click", (event) => {
        const image = event.target.closest(
          "img[data-inline-image-id]"
        );

        if (image && editor.contains(image)) {
          selectInlineImage(image);
        } else if (
          !event.target.closest(".mc-image-resize-overlay")
        ) {
          hideImageResizeOverlay();
        }
      });

      editor.addEventListener("dblclick", (event) => {
        const image = event.target.closest(
          "img[data-inline-image-id]"
        );

        if (image && editor.contains(image)) {
          event.preventDefault();
          openInlineImagePreview(image);
        }
      });

      editor.addEventListener("input", () => {
        const textLength = editor.textContent.length;
        const limit = EDITOR_LIMITS[field];

        if (textLength > limit) {
          setFormMessage(
            `${field === "contentBrief" ? "Description / brief" : "Notes"} has reached its ${limit.toLocaleString()} character limit.`,
            true
          );
        } else {
          setFormMessage("");
        }

        if (
          state.selectedInlineImage &&
          !state.selectedInlineImage.isConnected
        ) {
          hideImageResizeOverlay();
        }
      });

      editor.addEventListener("scroll", positionImageResizeOverlay);
    });

    window.addEventListener("resize", positionImageResizeOverlay);
    window.addEventListener("scroll", positionImageResizeOverlay, true);
  }

  async function hydrateEditorImages(field, html, attachments) {
    const editor = getEditorField(field);

    if (!editor) return;

    editor.innerHTML = normalizeStoredEditorContent(html);

    const images = Array.from(
      editor.querySelectorAll("img[data-inline-image-id]")
    );

    for (const image of images) {
      const imageId = image.dataset.inlineImageId;

      const attachment = attachments.find((item) =>
        isInlineImage(item) &&
        String(item.id) === String(imageId) &&
        item.field === field
      );

      if (!attachment?.path) {
        image.remove();
        continue;
      }

      try {
        const url = await getAttachmentUrl(attachment, false);

        image.src = url;
        image.alt = attachment.name || "Pasted image";
        image.removeAttribute("data-inline-image-pending");

      } catch (error) {
        console.error("Inline image loading error:", error);

        image.alt = "Image could not be loaded";
        image.removeAttribute("src");
      }
    }
  }

  /* =====================================
     PROJECT MANAGEMENT
  ===================================== */

  function updateProjectSelector() {
    const select = $("projectSelect");
    const deleteButton = $("deleteProject");

    if (!state.projects.length) {
      select.innerHTML = '<option value="">No projects available</option>';

      $("projectDescription").textContent =
        "Create a project to start organizing your marketing content.";

      $("addContent").disabled = true;

      if (deleteButton) deleteButton.disabled = true;

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

    if (deleteButton) {
      deleteButton.disabled =
        !activeProject ||
        isDefaultProject(activeProject) ||
        state.projects.length <= 1;

      deleteButton.title = isDefaultProject(activeProject)
        ? "The General Content project cannot be deleted."
        : state.projects.length <= 1
          ? "You need another project before deleting this one."
          : "Delete the selected project";
    }
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
          (project) => isDefaultProject(project)
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

    try {
      const { data, error } = await state.client
        .from(PROJECTS_TABLE)
        .insert({
          name,
          description: description || null
        })
        .select()
        .single();

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

    } catch (error) {
      console.error("Project creation error:", error);
      setProjectMessage(error.message || "Unable to create the project.", true);

    } finally {
      button.disabled = false;
      button.textContent = "Create project";
    }
  }

  /* =====================================
     DELETE PROJECT AND MOVE CONTENT
  ===================================== */

  function openDeleteProjectDialog() {
    const project = getActiveProject();

    if (!project) return;
    if (isDefaultProject(project) || state.projects.length <= 1) return;

    const destinationSelect = $("destinationProject");

    const otherProjects = state.projects.filter(
      (item) => String(item.id) !== String(project.id)
    );

    destinationSelect.innerHTML =
      '<option value="">Select a destination project</option>' +
      otherProjects.map((item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
      ).join("");

    $("deleteProjectMessage").textContent =
      `You are about to delete "${project.name}". This project currently contains ${state.items.length} content item(s). Choose another project to receive its content before deletion.`;

    $("deleteProjectFormMessage").textContent = "";
    $("deleteProjectFormMessage").classList.remove("is-error");

    $("confirmDeleteProject").disabled = false;
    $("confirmDeleteProject").textContent = "Move content & delete project";

    $("deleteProjectDialog").showModal();
  }

  async function deleteActiveProject(event) {
    event.preventDefault();

    const project = getActiveProject();
    const destinationId = $("destinationProject").value;

    if (!project || !destinationId) {
      $("deleteProjectFormMessage").textContent =
        "Please select a destination project.";
      return;
    }

    if (
      String(project.id) === String(destinationId) ||
      isDefaultProject(project) ||
      state.projects.length <= 1
    ) {
      $("deleteProjectFormMessage").textContent =
        "This project cannot be deleted with the selected settings.";
      return;
    }

    const destinationProject = state.projects.find(
      (item) => String(item.id) === String(destinationId)
    );

    if (!destinationProject) {
      $("deleteProjectFormMessage").textContent =
        "The destination project could not be found. Please refresh and try again.";
      return;
    }

    const button = $("confirmDeleteProject");

    button.disabled = true;
    button.textContent = "Moving content...";

    $("deleteProjectFormMessage").textContent = "";
    $("deleteProjectFormMessage").classList.remove("is-error");

    try {
      const { error: moveError } = await state.client
        .from(TABLE)
        .update({
          project_id: Number(destinationId),
          updated_at: new Date().toISOString()
        })
        .eq("project_id", project.id);

      if (moveError) {
        throw new Error(
          `Unable to move the content. The project was not deleted. ${moveError.message}`
        );
      }

      button.textContent = "Deleting project...";

      const { data: deletedProjects, error: deleteError } =
        await state.client
          .from(PROJECTS_TABLE)
          .delete()
          .eq("id", project.id)
          .select("id");

      if (deleteError) {
        throw new Error(
          `The content may have been moved successfully, but the project could not be deleted. ${deleteError.message}`
        );
      }

      if (!deletedProjects || deletedProjects.length === 0) {
        throw new Error(
          "The content may have been moved, but the project was not deleted. Please refresh and try again."
        );
      }

      state.activeProjectId = destinationProject.id;

      $("deleteProjectDialog").close();

      const projectsLoaded = await loadProjects();

      if (projectsLoaded) await loadItems();

    } catch (error) {
      console.error("Project deletion error:", error);

      $("deleteProjectFormMessage").textContent =
        error.message || "An unexpected error occurred.";

      $("deleteProjectFormMessage").classList.add("is-error");

      const projectsLoaded = await loadProjects();

      if (projectsLoaded) await loadItems();

    } finally {
      button.disabled = false;
      button.textContent = "Move content & delete project";
    }
  }

  /* =====================================
     CONTENT FILTERING AND DISPLAY
  ===================================== */

  function stripHtml(value) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(String(value || ""), "text/html");

    return parsed.body.textContent || "";
  }

  function visibleItems() {
    return state.items.filter((item) => {
      const query = state.filters.search.toLowerCase();

      const matchesSearch = !query ||
        [
          item.title,
          stripHtml(item.brief),
          stripHtml(item.notes),
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

    $("calendar").innerHTML = `
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

  /* =====================================
     CONTENT ATTACHMENTS
  ===================================== */

  function resetAttachmentState() {
    revokePendingImageUrls();

    state.existingAttachments = [];
    state.pendingFiles = [];
    state.pendingInlineImages = [];
    state.removedAttachments = [];

    hideImageResizeOverlay();

    const input = $("contentAttachments");

    if (input) input.value = "";

    setEditorHtml("contentBrief", "");
    setEditorHtml("contentNotes", "");

    renderAttachmentList();
  }

  function getRemainingAttachments() {
    return state.existingAttachments.filter(
      (attachment) =>
        !isInlineImage(attachment) &&
        !state.removedAttachments.includes(attachment.path)
    );
  }

  function getRemainingInlineAttachments() {
    return state.existingAttachments.filter(
      (attachment) =>
        isInlineImage(attachment) &&
        !state.removedAttachments.includes(attachment.path)
    );
  }

  function renderAttachmentList() {
    const list = $("contentAttachmentList");

    if (!list) return;

    const existing = getRemainingAttachments();

    const existingHtml = existing.map((attachment) => {
      const originalIndex = state.existingAttachments.indexOf(attachment);

      return `
        <div class="mc-attachment-item">
          <div class="mc-attachment-item-name">
            <button
              type="button"
              class="mc-attachment-preview"
              data-preview-existing="${originalIndex}"
              title="Preview ${escapeHtml(attachment.name)}">
              ${escapeHtml(attachment.name)}
            </button>

            <small class="mc-attachment-item-size">
              ${formatFileSize(Number(attachment.size) || 0)}
            </small>
          </div>

          <div class="mc-attachment-actions">
            <button
              type="button"
              class="mc-attachment-download"
              data-download-existing="${originalIndex}"
              aria-label="Download ${escapeHtml(attachment.name)}">
              Download
            </button>

            <button
              type="button"
              class="mc-attachment-remove"
              data-remove-existing="${originalIndex}"
              aria-label="Remove ${escapeHtml(attachment.name)}">
              Remove
            </button>
          </div>
        </div>
      `;
    }).join("");

    const pendingHtml = state.pendingFiles.map((file, index) => `
      <div class="mc-attachment-item is-pending">
        <div class="mc-attachment-item-name">
          <button
            type="button"
            class="mc-attachment-preview"
            data-preview-pending="${index}"
            title="Preview ${escapeHtml(file.name)}">
            ${escapeHtml(file.name)}
          </button>

          <small class="mc-attachment-item-size">
            ${formatFileSize(file.size)} · Waiting to upload
          </small>
        </div>

        <div class="mc-attachment-actions">
          <button
            type="button"
            class="mc-attachment-download"
            data-download-pending="${index}">
            Download
          </button>

          <button
            type="button"
            class="mc-attachment-remove"
            data-remove-pending="${index}"
            aria-label="Remove ${escapeHtml(file.name)}">
            Remove
          </button>
        </div>
      </div>
    `).join("");

    if (!existingHtml && !pendingHtml) {
      list.innerHTML =
        '<p class="mc-attachments-help">No attachments added yet.</p>';
      return;
    }

    list.innerHTML = existingHtml + pendingHtml;
  }

  function addPendingFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    const acceptedFiles = [];
    const errors = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `${file.name} exceeds the 50 MB file size limit.`
        );
        return;
      }

      const duplicate = [
        ...state.pendingFiles,
        ...getRemainingAttachments()
      ].some((item) =>
        item.name === file.name && Number(item.size) === file.size
      );

      if (duplicate) {
        errors.push(`${file.name} is already attached.`);
        return;
      }

      acceptedFiles.push(file);
    });

    state.pendingFiles.push(...acceptedFiles);
    renderAttachmentList();

    if (errors.length) {
      setFormMessage(errors.join(" "), true);
    }
  }

  async function uploadPendingFiles(contentId, projectId) {
    const uploadedAttachments = [];

    for (const file of state.pendingFiles) {
      const safeName = getSafeFileName(file.name);

      const path =
        `project-${projectId}/content-${contentId}/${getUniqueFileId()}-${safeName}`;

      const { error } = await state.client.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });

      if (error) {
        if (uploadedAttachments.length) {
          const paths = uploadedAttachments.map((item) => item.path);

          const { error: cleanupError } = await state.client.storage
            .from(STORAGE_BUCKET)
            .remove(paths);

          if (cleanupError) {
            console.error("Attachment cleanup error:", cleanupError);
          }
        }

        throw new Error(
          `Unable to upload "${file.name}". ${error.message}`
        );
      }

      uploadedAttachments.push({
        name: file.name,
        path,
        size: file.size,
        type: file.type || "application/octet-stream"
      });
    }

    return uploadedAttachments;
  }

  async function uploadPendingInlineImages(contentId, projectId, editorHtml) {
    const uploadedImages = [];

    const briefIds = getInlineImageIds(editorHtml.contentBrief);
    const notesIds = getInlineImageIds(editorHtml.contentNotes);

    const referencedIds = new Set([...briefIds, ...notesIds]);

    const imagesToUpload = state.pendingInlineImages.filter((image) =>
      referencedIds.has(image.id)
    );

    try {
      for (const image of imagesToUpload) {
        const safeName = getSafeFileName(
          image.file.name || `pasted-image-${image.id}.png`
        );

        const path =
          `project-${projectId}/content-${contentId}/${getUniqueFileId()}-${safeName}`;

        const { error } = await state.client.storage
          .from(STORAGE_BUCKET)
          .upload(path, image.file, {
            upsert: false,
            contentType: image.file.type || "image/png"
          });

        if (error) {
          throw new Error(
            `Unable to upload a pasted image. ${error.message}`
          );
        }

        uploadedImages.push({
          kind: "inline-image",
          id: image.id,
          field: briefIds.includes(image.id)
            ? "contentBrief"
            : "contentNotes",
          name: image.file.name || "Pasted image",
          path,
          size: image.file.size,
          type: image.file.type || "image/png"
        });
      }

      return uploadedImages;

    } catch (error) {
      if (uploadedImages.length) {
        const paths = uploadedImages.map((image) => image.path);

        const { error: cleanupError } = await state.client.storage
          .from(STORAGE_BUCKET)
          .remove(paths);

        if (cleanupError) {
          console.error("Inline image cleanup error:", cleanupError);
        }
      }

      throw error;
    }
  }

  async function removeStoredAttachments(attachments) {
    const paths = attachments
      .map((attachment) => attachment.path)
      .filter(Boolean);

    if (!paths.length) return;

    const { error } = await state.client.storage
      .from(STORAGE_BUCKET)
      .remove(paths);

    if (error) {
      console.error("Attachment removal error:", error);

      throw new Error(
        `The content was updated, but one or more stored files could not be deleted. ${error.message}`
      );
    }
  }

  async function getAttachmentUrl(attachment, download = false) {
    if (!attachment?.path) {
      throw new Error("This attachment does not have a valid file path.");
    }

    const options = download
      ? { download: attachment.name || true }
      : undefined;

    const { data, error } = await state.client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(
        attachment.path,
        SIGNED_URL_EXPIRY,
        options
      );

    if (error || !data?.signedUrl) {
      throw new Error(
        error?.message || "Unable to create an attachment link."
      );
    }

    return data.signedUrl;
  }

  async function previewStoredAttachment(attachment) {
    try {
      const url = await getAttachmentUrl(attachment, false);
      window.open(url, "_blank", "noopener,noreferrer");

    } catch (error) {
      console.error("Attachment preview error:", error);
      setFormMessage(error.message || "Unable to preview this attachment.", true);
    }
  }

  async function downloadStoredAttachment(attachment) {
    try {
      const url = await getAttachmentUrl(attachment, true);
      window.open(url, "_blank", "noopener,noreferrer");

    } catch (error) {
      console.error("Attachment download error:", error);
      setFormMessage(error.message || "Unable to download this attachment.", true);
    }
  }

  function previewPendingAttachment(file) {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const previewWindow = window.open(
      objectUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!previewWindow) {
      URL.revokeObjectURL(objectUrl);
      setFormMessage(
        "Your browser blocked the preview window. Please allow pop-ups for this website.",
        true
      );
      return;
    }

    window.addEventListener("beforeunload", () => {
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
  }

  function downloadPendingAttachment(file) {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function bindAttachmentEvents() {
    const input = $("contentAttachments");
    const list = $("contentAttachmentList");

    if (!input || !list) {
      console.warn(
        "Attachment interface not found. Add contentAttachments and contentAttachmentList to the content dialog HTML."
      );
      return;
    }

    input.addEventListener("change", (event) => {
      addPendingFiles(event.target.files);
      input.value = "";
    });

    list.addEventListener("click", async (event) => {
      const previewExisting = event.target.closest("[data-preview-existing]");

      if (previewExisting) {
        const index = Number(previewExisting.dataset.previewExisting);
        const attachment = state.existingAttachments[index];

        if (attachment) await previewStoredAttachment(attachment);
        return;
      }

      const downloadExisting = event.target.closest("[data-download-existing]");

      if (downloadExisting) {
        const index = Number(downloadExisting.dataset.downloadExisting);
        const attachment = state.existingAttachments[index];

        if (attachment) await downloadStoredAttachment(attachment);
        return;
      }

      const previewPending = event.target.closest("[data-preview-pending]");

      if (previewPending) {
        const index = Number(previewPending.dataset.previewPending);
        previewPendingAttachment(state.pendingFiles[index]);
        return;
      }

      const downloadPending = event.target.closest("[data-download-pending]");

      if (downloadPending) {
        const index = Number(downloadPending.dataset.downloadPending);
        downloadPendingAttachment(state.pendingFiles[index]);
        return;
      }

      const removePending = event.target.closest("[data-remove-pending]");

      if (removePending) {
        const index = Number(removePending.dataset.removePending);

        if (Number.isInteger(index)) {
          state.pendingFiles.splice(index, 1);
          renderAttachmentList();
        }

        return;
      }

      const removeExisting = event.target.closest("[data-remove-existing]");

      if (removeExisting) {
        const index = Number(removeExisting.dataset.removeExisting);
        const attachment = state.existingAttachments[index];

        if (attachment?.path) {
          if (!state.removedAttachments.includes(attachment.path)) {
            state.removedAttachments.push(attachment.path);
          }

          renderAttachmentList();
        }
      }
    });
  }

  /* =====================================
     CONTENT DIALOGS
  ===================================== */

  function openNewContent(date = dateKey(state.cursor)) {
    if (!state.activeProjectId) return;

    $("contentForm").reset();
    $("contentId").value = "";
    $("dialogTitle").textContent = "Add marketing content";
    $("contentDate").value = date;
    $("contentStatus").value = "idea";
    $("deleteContent").hidden = true;

    setFormMessage("");
    resetAttachmentState();

    $("contentDialog").showModal();
  }

  async function openEditContent(id) {
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

    revokePendingImageUrls();
    state.pendingInlineImages = [];

    hideImageResizeOverlay();

    state.existingAttachments = [...getContentAttachments(item)];
    state.pendingFiles = [];
    state.removedAttachments = [];

    renderAttachmentList();

    $("deleteContent").hidden = false;
    setFormMessage("");

    $("contentDialog").showModal();

    await Promise.all([
      hydrateEditorImages(
        "contentBrief",
        item.brief,
        state.existingAttachments
      ),
      hydrateEditorImages(
        "contentNotes",
        item.notes,
        state.existingAttachments
      )
    ]);
  }

  function validateEditorLengths() {
    const briefLength = getEditorText("contentBrief").length;
    const notesLength = getEditorText("contentNotes").length;

    if (briefLength > EDITOR_LIMITS.contentBrief) {
      setFormMessage(
        `Description / brief cannot exceed ${EDITOR_LIMITS.contentBrief.toLocaleString()} characters.`,
        true
      );
      return false;
    }

    if (notesLength > EDITOR_LIMITS.contentNotes) {
      setFormMessage(
        `Notes cannot exceed ${EDITOR_LIMITS.contentNotes.toLocaleString()} characters.`,
        true
      );
      return false;
    }

    return true;
  }

  async function saveContent(event) {
    event.preventDefault();

    if (!state.activeProjectId) return;
    if (!validateEditorLengths()) return;

    const id = $("contentId").value;
    const projectId = Number(state.activeProjectId);

    const editorHtml = {
      contentBrief: getEditorHtml("contentBrief"),
      contentNotes: getEditorHtml("contentNotes")
    };

    const payload = {
      project_id: projectId,
      title: $("contentTitle").value.trim(),
      content_type: $("contentType").value,
      channel: $("contentChannel").value,
      status: $("contentStatus").value,
      publish_date: $("contentDate").value,
      publish_time: $("contentTime").value || null,
      campaign: $("contentCampaign").value.trim() || null,
      content_url: $("contentUrl").value.trim() || null,
      brief: editorHtml.contentBrief || null,
      notes: editorHtml.contentNotes || null,
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.publish_date) {
      setFormMessage("Please complete the required fields.", true);
      return;
    }

    const button = $("saveContent");
    const originalButtonText = button.textContent;

    button.disabled = true;
    button.textContent = "Saving...";

    let savedContentId = id || null;
    let uploadedAttachments = [];
    let uploadedInlineImages = [];
    let attachmentsPersisted = false;

    try {
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

      if (result.error) {
        throw new Error(result.error.message);
      }

      const savedItem = result.data;
      savedContentId = savedItem.id;

      $("contentId").value = savedContentId;

      button.textContent = "Uploading attachments...";

      const remainingFiles = getRemainingAttachments();
      const remainingInlineImages = getRemainingInlineAttachments();

      if (state.pendingFiles.length) {
        uploadedAttachments = await uploadPendingFiles(
          savedContentId,
          projectId
        );
      }

      uploadedInlineImages = await uploadPendingInlineImages(
        savedContentId,
        projectId,
        editorHtml
      );

      const allInlineAttachments = [
        ...remainingInlineImages,
        ...uploadedInlineImages
      ];

      const briefImageIds = new Set(
        getInlineImageIds(editorHtml.contentBrief)
      );

      const notesImageIds = new Set(
        getInlineImageIds(editorHtml.contentNotes)
      );

      const finalInlineAttachments = allInlineAttachments
        .map((attachment) => {
          if (briefImageIds.has(attachment.id)) {
            return { ...attachment, field: "contentBrief" };
          }

          if (notesImageIds.has(attachment.id)) {
            return { ...attachment, field: "contentNotes" };
          }

          return null;
        })
        .filter(Boolean);

      const finalAttachments = [
        ...remainingFiles,
        ...uploadedAttachments,
        ...finalInlineAttachments
      ];

      const { error: attachmentUpdateError } = await state.client
        .from(TABLE)
        .update({
          attachments: finalAttachments,
          brief: editorHtml.contentBrief || null,
          notes: editorHtml.contentNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", savedContentId)
        .eq("project_id", projectId);

      if (attachmentUpdateError) {
        throw new Error(
          `Content was saved, but attachment information could not be updated. ${attachmentUpdateError.message}`
        );
      }

      attachmentsPersisted = true;

      const retainedPaths = new Set(
        finalAttachments.map((attachment) => attachment.path)
      );

      const removedStoredFiles = state.existingAttachments.filter(
        (attachment) =>
          attachment.path && !retainedPaths.has(attachment.path)
      );

      if (removedStoredFiles.length) {
        try {
          await removeStoredAttachments(removedStoredFiles);
        } catch (cleanupError) {
          console.warn(cleanupError.message);
        }
      }

      $("contentDialog").close();
      resetAttachmentState();

      await loadItems();

    } catch (error) {
      console.error("Content saving error:", error);

      // Roll back newly uploaded files if their attachment metadata
      // was not successfully saved to the database.
      if (!attachmentsPersisted) {
        const newPaths = [
          ...uploadedAttachments,
          ...uploadedInlineImages
        ].map((attachment) => attachment.path).filter(Boolean);

        if (newPaths.length) {
          const { error: cleanupError } = await state.client.storage
            .from(STORAGE_BUCKET)
            .remove(newPaths);

          if (cleanupError) {
            console.error("Attachment rollback error:", cleanupError);
          }
        }
      }

      setFormMessage(
        error.message || "Unable to save content.",
        true
      );

      if (savedContentId) {
        $("contentId").value = savedContentId;
      }

    } finally {
      button.disabled = false;
      button.textContent = originalButtonText || "Save content";
    }
  }

  async function deleteContent() {
    const id = $("contentId").value;

    if (!id || !window.confirm(
      "Delete this content item and its attachments? This cannot be undone."
    )) {
      return;
    }

    const item = state.items.find(
      (entry) => String(entry.id) === String(id)
    );

    const button = $("deleteContent");

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      const { error } = await state.client
        .from(TABLE)
        .delete()
        .eq("id", id)
        .eq("project_id", state.activeProjectId);

      if (error) {
        throw new Error(error.message);
      }

      try {
        await removeStoredAttachments(getContentAttachments(item));
      } catch (cleanupError) {
        console.warn(
          "Content was deleted, but attachment cleanup failed:",
          cleanupError.message
        );
      }

      $("contentDialog").close();
      resetAttachmentState();

      await loadItems();

    } catch (error) {
      console.error("Content deletion error:", error);
      setFormMessage(error.message || "Unable to delete content.", true);

    } finally {
      button.disabled = false;
      button.textContent = "Delete";
    }
  }

  /* =====================================
     CALENDAR NAVIGATION
  ===================================== */

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

  /* =====================================
     EVENT LISTENERS
  ===================================== */

  function bindEvents() {
    $("addProject").addEventListener("click", () => {
      $("projectForm").reset();
      setProjectMessage("");
      $("projectDialog").showModal();
    });

    $("projectForm").addEventListener("submit", createProject);

    $("deleteProject").addEventListener(
      "click",
      openDeleteProjectDialog
    );

    $("deleteProjectForm").addEventListener(
      "submit",
      deleteActiveProject
    );

    document.querySelectorAll("[data-close-delete-project]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          $("deleteProjectDialog").close();
        });
      });

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

    bindAttachmentEvents();
    bindRichEditorEvents();

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

  /* =====================================
     INITIALIZATION
  ===================================== */

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
