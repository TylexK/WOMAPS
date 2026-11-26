import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const mapperList = document.querySelector("#mapper-list");
const adminDialog = document.querySelector("#catalog-admin");
const adminDashboard = document.querySelector("#admin-dashboard");
const adminLogin = document.querySelector("#admin-login");
const loginStatus = document.querySelector("#admin-login-status");
const dashboardStatus = document.querySelector("#admin-dashboard-status");
let currentUser = null;
let currentProfile = null;
let currentAdminUsername = "";
let catalogueFolders = [];
let catalogueMappers = [];
let catalogueSetupError = "";

function showMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("admin-status-error", isError);
  if (target.classList.contains("catalog-status")) target.hidden = false;
}

function reportError(target, prefix, error) {
  console.error(prefix, error);
  showMessage(target, `${prefix} ${error.message || "Inténtalo de nuevo."}`, true);
}

function createAuthDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "admin-dialog auth-dialog";
  dialog.id = "account-dialog";
  dialog.setAttribute("aria-labelledby", "account-dialog-title");
  dialog.innerHTML = `
    <div class="admin-dialog-header">
      <div>
        <p class="section-kicker">CUENTA GG MAPEADORES</p>
        <h2 id="account-dialog-title">Inicia sesión</h2>
      </div>
      <button class="admin-close" type="button" aria-label="Cerrar">×</button>
    </div>
    <p class="admin-security-note">Regístrate o inicia sesión de forma segura con tu cuenta de Google.</p>
    <button class="admin-button google-sign-in" type="button">
      <span aria-hidden="true">G</span> CONTINUAR CON GOOGLE
    </button>
    <p class="admin-status" role="status" aria-live="polite"></p>
  `;
  document.body.append(dialog);
  dialog.querySelector(".admin-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector(".google-sign-in").addEventListener("click", async () => {
    const status = dialog.querySelector(".admin-status");
    if (!supabase) {
      showMessage(status, "Falta conectar las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.", true);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error) {
      reportError(status, "No se pudo iniciar sesión con Google.", error);
    }
  });
  return dialog;
}

const accountDialog = createAuthDialog();

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else showMessage(dialog.querySelector(".admin-status"), "Este navegador no es compatible con el acceso.", true);
}

function safeAvatarSource(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function updateHeaderAccount() {
  const topbar = document.querySelector(".topbar");
  const nav = topbar?.querySelector(".top-nav");
  if (!topbar || !nav) return;
  let widget = topbar.querySelector(".auth-widget");

  if (!widget) {
    widget = document.createElement("div");
    widget.className = "auth-widget";
    nav.after(widget);
  }

  if (!currentUser) {
    widget.innerHTML = '<button class="admin-button auth-sign-in" type="button">INICIAR SESIÓN</button>';
    widget.querySelector(".auth-sign-in").addEventListener("click", () => openDialog(accountDialog));
    return;
  }

  const displayName = currentProfile?.display_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "Mi cuenta";
  const avatarUrl = safeAvatarSource(currentProfile?.avatar_url || currentUser.user_metadata?.picture || currentUser.user_metadata?.avatar_url);
  const initial = displayName.trim().charAt(0).toLocaleUpperCase("es") || "U";
  widget.replaceChildren();
  const avatarButton = document.createElement("button");
  avatarButton.className = "account-avatar-button";
  avatarButton.type = "button";
  avatarButton.setAttribute("aria-label", `Abrir perfil de ${displayName}`);
  avatarButton.setAttribute("aria-expanded", "false");
  if (avatarUrl) {
    const image = document.createElement("img");
    image.className = "account-avatar";
    image.alt = "";
    image.src = avatarUrl;
    avatarButton.append(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "account-avatar-fallback";
    fallback.textContent = initial;
    avatarButton.append(fallback);
  }
  const menu = document.createElement("div");
  menu.className = "account-menu";
  menu.hidden = true;
  const name = document.createElement("span");
  name.className = "account-menu-name";
  name.textContent = displayName;
  const photoButton = document.createElement("button");
  photoButton.className = "account-menu-button";
  photoButton.type = "button";
  photoButton.textContent = "Cambiar foto de perfil";
  const photoInput = document.createElement("input");
  photoInput.className = "account-photo-input";
  photoInput.type = "file";
  photoInput.accept = "image/jpeg,image/png,image/webp,image/avif";
  photoInput.hidden = true;
  const signOutButton = document.createElement("button");
  signOutButton.className = "account-menu-button account-sign-out";
  signOutButton.type = "button";
  signOutButton.textContent = "Cerrar sesión";
  menu.append(name, photoButton, photoInput, signOutButton);
  widget.append(avatarButton, menu);
  avatarButton.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    avatarButton.setAttribute("aria-expanded", String(!menu.hidden));
  });
  photoButton.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", handleProfilePhoto);
  signOutButton.addEventListener("click", signOut);
}

async function signOut() {
  if (!supabase) return;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    accountDialog.close();
    adminDialog?.close();
  } catch (error) {
    console.error("No se pudo cerrar la sesión.", error);
  }
}

async function handleProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file || !supabase || !currentUser) return;
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    window.alert("Elige una imagen JPG, PNG, WebP o AVIF de hasta 5 MB.");
    event.target.value = "";
    return;
  }

  try {
    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const objectPath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(objectPath);
    const { error: profileError } = await supabase.from("profiles").update({
      avatar_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", currentUser.id);
    if (profileError) throw profileError;
    currentProfile = { ...currentProfile, avatar_url: data.publicUrl };
    updateHeaderAccount();
  } catch (error) {
    console.error("No se pudo actualizar la foto de perfil.", error);
    window.alert(`No se pudo actualizar la foto de perfil. ${error.message || ""}`);
  } finally {
    event.target.value = "";
  }
}

async function refreshSession(user) {
  currentUser = user;
  currentProfile = null;
  currentAdminUsername = "";
  if (!user || !supabase) {
    updateHeaderAccount();
    updateAdminAccess();
    return;
  }

  const [{ data: profile, error: profileError }, { data: admins, error: adminError }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("catalog_admins").select("username").eq("user_id", user.id),
  ]);
  if (profileError) console.error("No se pudo cargar el perfil.", profileError);
  if (adminError) console.error("No se pudo comprobar el permiso de administración.", adminError);
  currentProfile = profile;
  currentAdminUsername = admins?.map((row) => row.username).sort().join(" / ") || "";
  updateHeaderAccount();
  updateAdminAccess();
  refreshAdminControls();
  if (currentAdminUsername && catalogueFolders.length === 0) {
    document.querySelector("#catalog-seed")?.removeAttribute("hidden");
  }
}

function setMapperSearchTerms(row, extraTerms = "") {
  const title = row.querySelector(".mapper-details h3")?.textContent || "";
  const description = [...row.querySelectorAll(".mapper-details p")].map((paragraph) => paragraph.textContent).join(" ");
  const fileType = row.querySelector(".version-tag, .pending-tag")?.textContent || "";
  row.dataset.search = `${title} ${description} ${fileType} ${extraTerms}`.toLocaleLowerCase("es");
}

function createMapperRow(mapper, index) {
  const row = document.createElement("article");
  row.className = "mapper-row";
  row.dataset.mapperId = mapper.id;
  const identity = document.createElement("div");
  identity.className = "mapper-identity";
  const mapperIndex = document.createElement("span");
  mapperIndex.className = "mapper-index";
  mapperIndex.textContent = String(index + 1).padStart(2, "0");
  const mark = document.createElement("span");
  mark.className = "mapper-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = mapper.name.slice(0, 2).toLocaleUpperCase("es");
  const details = document.createElement("div");
  details.className = "mapper-details";
  const title = document.createElement("h3");
  title.textContent = mapper.name;
  const description = document.createElement("p");
  description.textContent = mapper.description || "";
  details.append(title, description);
  identity.append(mapperIndex, mark, details);

  const badge = document.createElement("span");
  badge.className = "version-tag";
  badge.textContent = mapper.file_type || "MAPEADOR";
  row.append(identity, badge);
  if (mapper.download_url) {
    const link = document.createElement("a");
    link.className = "download-link";
    link.href = mapper.download_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Descargar ${mapper.name}`);
    link.innerHTML = 'DESCARGAR <span class="external-arrow" aria-hidden="true">↗</span>';
    row.append(link);
  } else {
    const unavailable = document.createElement("span");
    unavailable.className = "unavailable-label";
    unavailable.textContent = "ENLACE NO DISPONIBLE";
    row.append(unavailable);
  }
  setMapperSearchTerms(row, mapper.search_terms || "");
  return row;
}

function createFolderElement(folder, mappers) {
  const details = document.createElement("details");
  details.className = `mapper-folder${folder.kind === "module" ? " mapper-folder-group" : ""}`;
  if (folder.name.toLocaleLowerCase("es").includes("gg")) details.classList.add("mapper-folder-gg");
  details.dataset.folderId = folder.id;
  details.dataset.kind = folder.kind;
  details.dataset.categorySearch = folder.name.toLocaleLowerCase("es");

  const summary = document.createElement("summary");
  summary.className = "mapper-folder-summary";
  summary.innerHTML = '<span class="folder-icon" aria-hidden="true"></span>';
  const name = document.createElement("span");
  name.className = "folder-name";
  name.textContent = folder.name;
  const count = document.createElement("span");
  count.className = "folder-count";
  count.textContent = `${mappers.length} ${folder.kind === "module" ? "MÓDULOS" : "MAPEADORES"}`;
  const chevron = document.createElement("span");
  chevron.className = "folder-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "v";
  summary.append(name, count, chevron);
  details.append(summary);

  if (folder.kind === "mapper" && folder.name.toLocaleLowerCase("es").includes("gg")) {
    const contents = document.createElement("div");
    contents.className = "mapper-contents";
    for (const [index, mapper] of mappers.entries()) contents.append(createMapperRow(mapper, index));
    details.append(contents);
  } else {
    for (const [index, mapper] of mappers.entries()) details.append(createMapperRow(mapper, index));
  }
  return details;
}

function updateCatalogueSummary(folders, mappers) {
  const asideNumber = document.querySelector(".intro-aside .aside-number");
  const asideCaption = document.querySelector(".intro-aside .aside-caption");
  const asideNote = document.querySelector(".intro-aside .aside-note");
  if (!asideNumber || !asideCaption || !asideNote) return;

  const mapperFolders = folders.filter((folder) => folder.kind === "mapper");
  const counts = mapperFolders.map((folder) => ({
    name: folder.name,
    count: mappers.filter((mapper) => mapper.folder_id === folder.id).length,
  })).filter((folder) => folder.count > 0);
  const total = counts.reduce((sum, folder) => sum + folder.count, 0);
  asideNumber.textContent = String(total);
  asideCaption.textContent = `mapeadores disponibles actualmente`;
  asideNote.textContent = "Cargando categorías…";
  if (!counts.length) {
    asideNote.textContent = "SIN MAPEADORES DISPONIBLES";
    return;
  }

  let previousIndex = -1;
  const updateSpotlight = () => {
    let index = Math.floor(Math.random() * counts.length);
    if (counts.length > 1 && index === previousIndex) index = (index + 1) % counts.length;
    previousIndex = index;
    const folder = counts[index];
    asideNote.textContent = `${folder.name}: ${folder.count} DISPONIBLES`;
  };
  updateSpotlight();
  if (window.catalogueSpotlightTimer) window.clearInterval(window.catalogueSpotlightTimer);
  if (counts.length > 1) window.catalogueSpotlightTimer = window.setInterval(updateSpotlight, 6000);
}

function updateStaticCatalogueSummary() {
  if (!mapperList) return;
  const folders = [...mapperList.querySelectorAll(".mapper-folder")];
  const mapperFolders = folders.filter((folder) => !folder.classList.contains("mapper-folder-group"));
  const counts = mapperFolders.map((folder) => {
    const count = folder.querySelectorAll(".mapper-row").length;
    const label = folder.querySelector(".folder-name").textContent.trim();
    const countLabel = folder.querySelector(".folder-count");
    if (countLabel) countLabel.textContent = `${count} MAPEADORES`;
    return { name: label, count };
  }).filter((folder) => folder.count > 0);
  const total = counts.reduce((sum, folder) => sum + folder.count, 0);
  const asideNumber = document.querySelector(".intro-aside .aside-number");
  const asideCaption = document.querySelector(".intro-aside .aside-caption");
  const asideNote = document.querySelector(".intro-aside .aside-note");
  if (!asideNumber || !asideCaption || !asideNote) return;
  asideNumber.textContent = String(total);
  asideCaption.textContent = "mapeadores disponibles actualmente";
  let previousIndex = -1;
  const updateSpotlight = () => {
    let index = Math.floor(Math.random() * counts.length);
    if (counts.length > 1 && index === previousIndex) index = (index + 1) % counts.length;
    previousIndex = index;
    asideNote.textContent = `${counts[index].name}: ${counts[index].count} DISPONIBLES`;
  };
  if (!counts.length) return;
  updateSpotlight();
  if (window.catalogueSpotlightTimer) window.clearInterval(window.catalogueSpotlightTimer);
  if (counts.length > 1) window.catalogueSpotlightTimer = window.setInterval(updateSpotlight, 6000);
}

function updateFolderOptions(selectedId = "") {
  const select = document.querySelector("#admin-mapper-form [name='folderId']");
  if (!select) return;
  select.replaceChildren();
  for (const folder of catalogueFolders) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    option.selected = folder.id === selectedId;
    select.append(option);
  }
}

function updateAdminAccess() {
  if (!adminDialog) return;
  const login = document.querySelector("#admin-login");
  const noAdmin = document.querySelector("#admin-no-permission");
  const session = document.querySelector("#admin-session");
  const openButton = document.querySelector("#admin-open");
  const isAdmin = Boolean(currentUser && currentAdminUsername);
  login.hidden = Boolean(currentUser);
  noAdmin.hidden = !currentUser || isAdmin;
  if (currentUser && !isAdmin) {
    noAdmin.textContent = catalogueSetupError || "Tu cuenta está conectada, pero no tiene permisos de administración.";
  }
  session.hidden = !isAdmin;
  adminDashboard.hidden = !isAdmin;
  if (openButton) openButton.textContent = isAdmin ? "ADMINISTRAR CATÁLOGO" : "ACCESO DE ADMINISTRADOR";
  if (isAdmin) {
    document.querySelector("#admin-user-label").textContent = `Administrador: ${currentAdminUsername}`;
    updateFolderOptions();
  }
}

async function loadCatalogue() {
  if (!supabase || !mapperList) return;
  const [{ data: folders, error: folderError }, { data: mappers, error: mapperError }] = await Promise.all([
    supabase.from("mapper_folders").select("id, name, kind, sort_order").order("sort_order").order("name"),
    supabase.from("mappers").select("id, folder_id, name, description, file_type, download_url, search_terms, sort_order").order("sort_order").order("name"),
  ]);
  if (folderError || mapperError) {
    const error = folderError || mapperError;
    console.error("No se pudo cargar el catálogo de Supabase.", error);
    const status = document.querySelector("#catalog-status");
    catalogueSetupError = error.code === "PGRST205"
      ? "Faltan las tablas del catálogo. Ejecuta supabase/schema.sql en el SQL Editor de Supabase y vuelve a cargar."
      : "Supabase rechazó la consulta. Revisa la configuración y las políticas RLS.";
    showMessage(status, catalogueSetupError, true);
    return;
  }

  catalogueSetupError = "";
  catalogueFolders = folders || [];
  catalogueMappers = mappers || [];
  if (!catalogueFolders.length) return;
  mapperList.replaceChildren();
  for (const folder of catalogueFolders) {
    const folderMappers = catalogueMappers.filter((mapper) => mapper.folder_id === folder.id);
    mapperList.append(createFolderElement(folder, folderMappers));
  }
  const status = document.querySelector("#catalog-status");
  if (status) status.hidden = true;
  updateCatalogueSummary(catalogueFolders, catalogueMappers);
  updateFolderOptions();
  document.querySelector("#mapper-search")?.dispatchEvent(new Event("input", { bubbles: true }));
  refreshAdminControls();
}

function createAdminButton(label, action, id) {
  const button = document.createElement("button");
  button.className = "admin-inline-button";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  return button;
}

function refreshAdminControls() {
  if (!mapperList) return;
  for (const folder of mapperList.querySelectorAll(".mapper-folder")) {
    folder.querySelector(".mapper-folder-admin-actions")?.remove();
    const folderActions = document.createElement("div");
    folderActions.className = "mapper-folder-admin-actions";
    folderActions.hidden = !currentAdminUsername;
    folderActions.append(
      createAdminButton("Editar carpeta", "edit-folder", folder.dataset.folderId),
      createAdminButton("Eliminar carpeta", "delete-folder", folder.dataset.folderId),
    );
    folder.querySelector(".mapper-folder-summary").after(folderActions);

    for (const row of folder.querySelectorAll(".mapper-row")) {
      row.querySelector(".mapper-admin-actions")?.remove();
      const actions = document.createElement("div");
      actions.className = "mapper-admin-actions";
      actions.hidden = !currentAdminUsername;
      actions.append(
        createAdminButton("Editar", "edit-mapper", row.dataset.mapperId),
        createAdminButton("Eliminar", "delete-mapper", row.dataset.mapperId),
      );
      row.append(actions);
    }
  }
  updateFolderOptions(document.querySelector("#admin-mapper-form [name='folderId']")?.value);
}

function mapperFieldsFromForm(form) {
  const data = new FormData(form);
  return {
    folder_id: String(data.get("folderId") || ""),
    name: String(data.get("name") || "").trim(),
    description: String(data.get("description") || "").trim(),
    file_type: String(data.get("fileType") || "").trim() || "MAPEADOR",
    download_url: String(data.get("url") || "").trim(),
  };
}

function startMapperEdit(row) {
  const form = document.querySelector("#admin-mapper-form");
  const mapper = catalogueMappers.find((item) => item.id === row.dataset.mapperId);
  if (!mapper || !form) return;
  form.elements.mapperId.value = mapper.id;
  updateFolderOptions(mapper.folder_id);
  form.elements.name.value = mapper.name;
  form.elements.description.value = mapper.description || "";
  form.elements.fileType.value = mapper.file_type || "";
  form.elements.url.value = mapper.download_url || "";
  document.querySelector("#mapper-form-title").textContent = "Editar mapeador";
  document.querySelector("#mapper-form-submit").textContent = "GUARDAR CAMBIOS";
  document.querySelector("#mapper-form-cancel").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  form.elements.name.focus();
}

function resetMapperForm() {
  const form = document.querySelector("#admin-mapper-form");
  form.reset();
  form.elements.mapperId.value = "";
  document.querySelector("#mapper-form-title").textContent = "Agregar mapeador";
  document.querySelector("#mapper-form-submit").textContent = "AGREGAR MAPEADOR";
  document.querySelector("#mapper-form-cancel").hidden = true;
}

async function initializeStaticCatalogue() {
  if (!supabase || !currentAdminUsername || !mapperList) return;
  const staticFolders = [...mapperList.querySelectorAll(".mapper-folder")];
  const folderRows = staticFolders.map((folder, sortOrder) => ({
    name: folder.querySelector(".folder-name").textContent.trim(),
    kind: folder.classList.contains("mapper-folder-group") ? "module" : "mapper",
    sort_order: sortOrder,
    node: folder,
  }));
  const { data: savedFolders, error: folderError } = await supabase
    .from("mapper_folders")
    .upsert(folderRows.map(({ name, kind, sort_order }) => ({ name, kind, sort_order })), { onConflict: "name" })
    .select("id, name");
  if (folderError) throw folderError;
  const savedFolderIds = new Map(savedFolders.map((folder) => [folder.name, folder.id]));
  const mapperRows = [];
  for (const [folderOrder, folder] of folderRows.entries()) {
    const folderId = savedFolderIds.get(folder.name);
    for (const [sortOrder, row] of [...folder.node.querySelectorAll(".mapper-row")].entries()) {
      const details = row.querySelector(".mapper-details");
      mapperRows.push({
        folder_id: folderId,
        name: details.querySelector("h3").textContent.trim(),
        description: details.querySelector("p")?.textContent.trim() || "",
        file_type: row.querySelector(".version-tag, .pending-tag")?.textContent.trim() || "MAPEADOR",
        download_url: row.querySelector(".download-link")?.href || null,
        search_terms: row.dataset.search || "",
        sort_order: folderOrder * 1000 + sortOrder,
      });
    }
  }
  if (mapperRows.length) {
    const { error } = await supabase.from("mappers").upsert(mapperRows, { onConflict: "folder_id,name" });
    if (error) throw error;
  }
  await loadCatalogue();
  showMessage(dashboardStatus, "Catálogo inicial publicado en Supabase.");
}

function connectAdminInterface() {
  if (!adminDialog || !supabase) return;
  document.querySelector("#admin-open").addEventListener("click", () => {
    if (!currentUser) {
      adminLogin.hidden = false;
      document.querySelector("#admin-no-permission").hidden = true;
      adminDashboard.hidden = true;
      showMessage(loginStatus, "");
    } else if (currentAdminUsername) {
      adminLogin.hidden = true;
      document.querySelector("#admin-no-permission").hidden = true;
      adminDashboard.hidden = false;
    } else {
      adminLogin.hidden = true;
      document.querySelector("#admin-no-permission").hidden = false;
      adminDashboard.hidden = true;
    }
    openDialog(adminDialog);
  });
  document.querySelector("#admin-close").addEventListener("click", () => adminDialog.close());
  adminDialog.addEventListener("click", (event) => {
    if (event.target === adminDialog) adminDialog.close();
  });
  adminLogin.addEventListener("submit", (event) => {
    event.preventDefault();
    openDialog(accountDialog);
  });
  document.querySelector("#admin-logout").addEventListener("click", signOut);
  document.querySelector("#catalog-seed").addEventListener("click", async () => {
    const button = document.querySelector("#catalog-seed");
    button.disabled = true;
    try {
      await initializeStaticCatalogue();
      button.hidden = true;
    } catch (error) {
      reportError(dashboardStatus, "No se pudo publicar el catálogo inicial.", error);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#admin-folder-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name || !currentAdminUsername) return;
    try {
      const { error } = await supabase.from("mapper_folders").insert({
        name,
        kind: "mapper",
        sort_order: catalogueFolders.length,
      });
      if (error) throw error;
      form.reset();
      await loadCatalogue();
      showMessage(dashboardStatus, "Carpeta agregada para todos los visitantes.");
    } catch (error) {
      reportError(dashboardStatus, "No se pudo agregar la carpeta.", error);
    }
  });

  document.querySelector("#admin-mapper-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!currentAdminUsername) return;
    const fields = mapperFieldsFromForm(form);
    const mapperId = form.elements.mapperId.value;
    if (!fields.name || !fields.folder_id || !fields.download_url) {
      showMessage(dashboardStatus, "Nombre, carpeta y enlace de descarga son obligatorios.", true);
      return;
    }
    try {
      if (!["http:", "https:"].includes(new URL(fields.download_url).protocol)) throw new Error("Protocolo no permitido");
    } catch {
      showMessage(dashboardStatus, "El enlace debe ser una URL válida con http o https.", true);
      return;
    }
    try {
      const operation = mapperId
        ? supabase.from("mappers").update(fields).eq("id", mapperId)
        : supabase.from("mappers").insert({
          ...fields,
          sort_order: catalogueMappers.filter((mapper) => mapper.folder_id === fields.folder_id).length,
        });
      const { error } = await operation;
      if (error) throw error;
      resetMapperForm();
      await loadCatalogue();
      showMessage(dashboardStatus, mapperId ? "Mapeador actualizado para todos los visitantes." : "Mapeador agregado para todos los visitantes.");
    } catch (error) {
      reportError(dashboardStatus, "No se pudo guardar el mapeador.", error);
    }
  });

  document.querySelector("#mapper-form-cancel").addEventListener("click", resetMapperForm);
  mapperList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !currentAdminUsername) return;
    const { action, id } = button.dataset;

    if (action === "edit-mapper") {
      startMapperEdit(button.closest(".mapper-row"));
      return;
    }

    if (action === "edit-folder") {
      const folder = catalogueFolders.find((item) => item.id === id);
      const name = window.prompt("Nuevo nombre para la carpeta:", folder?.name)?.trim();
      if (!name || !folder) return;
      try {
        const { error } = await supabase.from("mapper_folders").update({ name }).eq("id", id);
        if (error) throw error;
        await loadCatalogue();
        showMessage(dashboardStatus, "Carpeta actualizada para todos los visitantes.");
      } catch (error) {
        reportError(dashboardStatus, "No se pudo actualizar la carpeta.", error);
      }
      return;
    }

    const isFolder = action === "delete-folder";
    const confirmMessage = isFolder
      ? "¿Eliminar esta carpeta y todos sus mapeadores para todos los visitantes?"
      : "¿Eliminar este mapeador para todos los visitantes?";
    if (!window.confirm(confirmMessage)) return;
    try {
      const { error } = isFolder
        ? await supabase.from("mapper_folders").delete().eq("id", id)
        : await supabase.from("mappers").delete().eq("id", id);
      if (error) throw error;
      if (document.querySelector("#admin-mapper-form").elements.mapperId.value === id) resetMapperForm();
      await loadCatalogue();
      showMessage(dashboardStatus, isFolder ? "Carpeta y contenido eliminados para todos los visitantes." : "Mapeador eliminado para todos los visitantes.");
    } catch (error) {
      reportError(dashboardStatus, "No se pudo eliminar el elemento.", error);
    }
  });
}

async function initializeApp() {
  updateStaticCatalogueSummary();
  updateHeaderAccount();
  connectAdminInterface();
  if (!supabase) {
    if (adminDialog) {
      showMessage(loginStatus, "Falta configurar Supabase. Consulta .env.example y la guía de despliegue.", true);
      adminLogin?.addEventListener("submit", (event) => {
        event.preventDefault();
        showMessage(loginStatus, "Conecta Supabase y habilita Google OAuth para iniciar sesión.", true);
      });
      document.querySelector("#admin-open")?.addEventListener("click", () => {
        adminLogin.hidden = false;
        showMessage(loginStatus, "Falta configurar Supabase. Consulta .env.example y la guía de despliegue.", true);
        openDialog(adminDialog);
      });
    }
    return;
  }

  await loadCatalogue();
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("No se pudo recuperar la sesión.", error);
  await refreshSession(data?.session?.user || null);
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => refreshSession(session?.user || null), 0);
  });
}

void initializeApp().catch((error) => {
  console.error("No se pudo inicializar la aplicación de Supabase.", error);
  showMessage(loginStatus, "No se pudo inicializar Supabase. Revisa la configuración y vuelve a cargar la página.", true);
});
