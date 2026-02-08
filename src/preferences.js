const {ipcRenderer, shell, clipboard} = require("electron");
const {accessSync, constants} = require("original-fs");
const {readdirSync, statSync} = require("fs");
const {join} = require("path");
const {homedir} = require("os");

const storageTheme = localStorage.getItem("theme");
if (storageTheme) {
	document.documentElement.setAttribute("theme", storageTheme);
} else {
	document.documentElement.setAttribute("theme", "frappe");
}

let rightToLeft = "false";
if (localStorage.getItem("rightToLeft")) {
	rightToLeft = localStorage.getItem("rightToLeft");
}
if (rightToLeft == "true") {
	document
		.querySelectorAll(".prefBox")
		.forEach((/** @type {HTMLElement} */ item) => {
			item.style.flexDirection = "row-reverse";
		});
} else {
	console.log("Change to left to right");
	document
		.querySelectorAll(".prefBox")
		.forEach((/** @type {HTMLElement} */ item) => {
			item.style.flexDirection = "row";
		});
}

// Download path
let downloadPath = localStorage.getItem("downloadPath");

if (!downloadPath) {
	downloadPath = join(homedir(), "Downloads");
}
getId("path").textContent = downloadPath;

/**
 *
 * @param {string} id
 * @returns {any}
 */
function getId(id) {
	return document.getElementById(id);
}

document.addEventListener("translations-loaded", () => {
	window.i18n.translatePage();

	document.title = window.i18n.__("preferences");

	if (process.env.FLATPAK_ID) {
		getId("flatpakTxt").addEventListener("click", () => {
			shell.openExternal(
				"https://flathub.org/apps/com.github.tchx84.Flatseal"
			);
		});

		getId("flatpakTxt").style.display = "block";
	}

	// re-render dynamic sections with translated labels
	renderCookieEntries();
});

getId("back").addEventListener("click", () => {
	ipcRenderer.send("close-secondary");
});

// Selecting download directory
getId("selectLocation").addEventListener("click", () => {
	ipcRenderer.send("select-location-secondary", "");
});

ipcRenderer.on("downloadPath", (_event, downloadPath) => {
	try {
		accessSync(downloadPath[0], constants.W_OK);

		console.log(downloadPath[0]);
		localStorage.setItem("downloadPath", downloadPath[0]);
		getId("path").textContent = downloadPath[0];
	} catch (error) {
		showPopup(i18n.__("unableToAccessDir"), true);
	}
});

// Selecting config directory

getId("configBtn").addEventListener("click", () => {
	ipcRenderer.send("select-config", "");
});

const editConfigBtn = getId("editConfigBtn");
function updateEditConfigBtnState() {
	if (!editConfigBtn) return;
	const p = localStorage.getItem("configPath") || "";
	editConfigBtn.disabled = !(configCheck?.checked && p);
}

if (editConfigBtn) {
	editConfigBtn.addEventListener("click", () => {
		const configPath = localStorage.getItem("configPath") || "";
		if (!configPath) {
			showPopup(i18n.__("noConfigSelected"), true);
			return;
		}
		try {
			accessSync(configPath, constants.R_OK);
			shell.openPath(configPath);
		} catch (_e) {
			showPopup(i18n.__("unableToAccessDir"), true);
		}
	});
}

ipcRenderer.on("configPath", (event, configPath) => {
	console.log(configPath);
	localStorage.setItem("configPath", configPath);
	getId("configPath").textContent = configPath;
	configCheck.checked = true;
	getId("configOpts").style.display = "flex";
	updateEditConfigBtnState();
});

const configCheck = getId("configCheck");
configCheck.addEventListener("change", (event) => {
	if (configCheck.checked) {
		getId("configOpts").style.display = "flex";
	} else {
		getId("configOpts").style.display = "none";
		localStorage.setItem("configPath", "");
	}
	updateEditConfigBtnState();
});

const configPath = localStorage.getItem("configPath");
if (configPath) {
	getId("configPath").textContent = configPath;
	configCheck.checked = true;
	getId("configOpts").style.display = "flex";
}
updateEditConfigBtnState();

// Language settings

const language = localStorage.getItem("locale");

if (language) {
	if (language.startsWith("en")) {
		getId("select").value = "en";
	} else {
		getId("select").value = language;
	}
}

function changeLanguage() {
	const language = getId("select").value;
	localStorage.setItem("locale", language);
	if (language === "fa" || language === "ar") {
		rightToLeft = "true";
		localStorage.setItem("rightToLeft", "true");
	} else {
		rightToLeft = "false";
		localStorage.setItem("rightToLeft", "false");
	}
}

// Download layout (list/grid)
const downloadLayoutSelect = getId("downloadLayout");
if (downloadLayoutSelect) {
	const storedLayout = localStorage.getItem("downloadLayout") || "grid";
	downloadLayoutSelect.value = storedLayout === "grid" ? "grid" : "list";

	downloadLayoutSelect.addEventListener("change", () => {
		const value = downloadLayoutSelect.value === "grid" ? "grid" : "list";
		localStorage.setItem("downloadLayout", value);
	});
}

// Grid columns
const gridColumnsInput = getId("gridColumns");
if (gridColumnsInput) {
	const storedCols = Number(localStorage.getItem("downloadGridColumns") || "5");
	gridColumnsInput.value = String(
		Number.isFinite(storedCols) && storedCols >= 1 ? Math.min(10, storedCols) : 5
	);

	gridColumnsInput.addEventListener("input", () => {
		const v = Number(gridColumnsInput.value);
		const cols = Number.isFinite(v) && v >= 1 ? Math.min(10, Math.floor(v)) : 5;
		localStorage.setItem("downloadGridColumns", String(cols));
	});
}

// Grid item height (px)
const gridItemHeightInput = getId("gridItemHeight");
if (gridItemHeightInput) {
	const storedHeight = Number(
		localStorage.getItem("downloadGridItemHeight") || "240"
	);
	gridItemHeightInput.value = String(
		Number.isFinite(storedHeight) && storedHeight >= 120
			? Math.min(800, Math.floor(storedHeight))
			: 240
	);

	gridItemHeightInput.addEventListener("input", () => {
		const v = Number(gridItemHeightInput.value);
		const h =
			Number.isFinite(v) && v >= 120 ? Math.min(800, Math.floor(v)) : 240;
		localStorage.setItem("downloadGridItemHeight", String(h));
	});
}

// Browser preferences
let browser = localStorage.getItem("browser");
if (browser) {
	getId("browser").value = browser;
}

getId("browser").addEventListener("change", () => {
	browser = getId("browser").value;
	localStorage.setItem("browser", browser);
});

// --- Custom cookies paths (multi entries) ---
const COOKIES_ENTRIES_KEY = "customCookiesPathEntries";
const COOKIES_SELECTED_KEY = "customCookiesPathSelected";

/**
 * @returns {Array<{id:string,browser:string,path:string}>}
 */
function loadCookieEntries() {
	try {
		const raw = localStorage.getItem(COOKIES_ENTRIES_KEY) || "[]";
		const arr = JSON.parse(raw);
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((x) => x && typeof x.id === "string")
			.map((x) => ({
				id: String(x.id),
				browser: String(x.browser || "chromium"),
				path: String(x.path || ""),
			}));
	} catch {
		return [];
	}
}

/**
 * @param {Array<{id:string,browser:string,path:string}>} entries
 */
function saveCookieEntries(entries) {
	localStorage.setItem(COOKIES_ENTRIES_KEY, JSON.stringify(entries));
}

function getSelectedCookieEntryId() {
	return localStorage.getItem(COOKIES_SELECTED_KEY) || "";
}

function setSelectedCookieEntryId(id) {
	localStorage.setItem(COOKIES_SELECTED_KEY, id || "");
}

function ensureBrowserCustomSelected() {
	const browserSelect = getId("browser");
	if (!browserSelect) return;
	browserSelect.value = "custom";
	localStorage.setItem("browser", "custom");
}

function renderCookieEntries() {
	const container = getId("customCookiesPaths");
	if (!container) return;
	container.innerHTML = "";

	const entries = loadCookieEntries();
	const selectedId = getSelectedCookieEntryId();

	const __ = (/** @type {string} */ key) =>
		// @ts-ignore
		(window.i18n && window.i18n.__(key)) || key;

	const fileExists = (p) => {
		try {
			accessSync(p, constants.F_OK);
			return true;
		} catch {
			return false;
		}
	};
	const isDir = (p) => {
		try {
			return statSync(p).isDirectory();
		} catch {
			return false;
		}
	};

	const chromiumFamily = new Set([
		"chromium",
		"chrome",
		"brave",
		"edge",
		"vivaldi",
		"opera",
	]);
	const firefoxFamily = new Set(["firefox", "librewolf", "waterfox"]);

	/**
	 * @param {string} browser
	 * @param {string} inputPath
	 * @returns {{cookiesPath: string, profilePath: string} | null}
	 */
	function resolveCookiesPath(browser, inputPath) {
		const p = (inputPath || "").trim();
		if (!p) return null;

		const chromiumCookies = (profileDir) => {
			const c1 = join(profileDir, "Network", "Cookies");
			const c2 = join(profileDir, "Cookies");
			if (fileExists(c1)) return c1;
			if (fileExists(c2)) return c2;
			return "";
		};

		if (chromiumFamily.has(browser)) {
			if (isDir(p)) {
				const direct = chromiumCookies(p);
				if (direct) return {cookiesPath: direct, profilePath: p};

				const def = join(p, "Default");
				const defCookies = chromiumCookies(def);
				if (defCookies) return {cookiesPath: defCookies, profilePath: def};

				try {
					const subs = readdirSync(p);
					for (const name of subs) {
						if (!name.startsWith("Profile")) continue;
						const candidate = join(p, name);
						const c = chromiumCookies(candidate);
						if (c) return {cookiesPath: c, profilePath: candidate};
					}
				} catch {}
			}
			return null;
		}

		if (firefoxFamily.has(browser)) {
			if (isDir(p)) {
				const direct = join(p, "cookies.sqlite");
				if (fileExists(direct)) return {cookiesPath: direct, profilePath: p};
				try {
					const subs = readdirSync(p);
					let first = "";
					let preferred = "";
					for (const name of subs) {
						const candidate = join(p, name);
						if (!isDir(candidate)) continue;
						const cookieDb = join(candidate, "cookies.sqlite");
						if (!fileExists(cookieDb)) continue;
						if (!first) first = candidate;
						if (name.includes("default-release")) {
							preferred = candidate;
							break;
						}
					}
					const chosen = preferred || first;
					if (chosen) {
						return {
							cookiesPath: join(chosen, "cookies.sqlite"),
							profilePath: chosen,
						};
					}
				} catch {}
			}
			return null;
		}

		return null;
	}

	entries.forEach((entry) => {
		const row = document.createElement("div");
		row.className = "cookiePathRow";

		const left = document.createElement("div");
		left.className = "left";

		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "cookieEntrySelected";
		radio.checked = entry.id === selectedId;
		radio.addEventListener("change", () => {
			setSelectedCookieEntryId(entry.id);
			ensureBrowserCustomSelected();
			renderCookieEntries();
		});

		const browserSel = document.createElement("select");
		browserSel.value = entry.browser;
		[
			{v: "chromium", t: "Chromium"},
			{v: "chrome", t: "Chrome"},
			{v: "brave", t: "Brave"},
			{v: "edge", t: "Edge"},
			{v: "vivaldi", t: "Vivaldi"},
			{v: "firefox", t: "Firefox"},
			{v: "librewolf", t: "LibreWolf"},
			{v: "waterfox", t: "Waterfox"},
		].forEach((opt) => {
			const o = document.createElement("option");
			o.value = opt.v;
			o.textContent = opt.t;
			browserSel.appendChild(o);
		});
		browserSel.value = entry.browser;
		browserSel.addEventListener("change", () => {
			const next = loadCookieEntries().map((e) =>
				e.id === entry.id ? {...e, browser: browserSel.value} : e
			);
			saveCookieEntries(next);
			renderCookieEntries();
		});

		left.appendChild(radio);
		left.appendChild(browserSel);

		const input = document.createElement("input");
		input.className = "pathInput";
		input.type = "text";
		input.placeholder = "/home/user/.config/chromium/Default";
		input.value = entry.path || "";
		input.addEventListener("input", () => {
			const next = loadCookieEntries().map((e) =>
				e.id === entry.id ? {...e, path: input.value} : e
			);
			saveCookieEntries(next);
			if (getSelectedCookieEntryId() === entry.id) {
				// Re-render to update status
				renderCookieEntries();
			}
		});

		const status = document.createElement("div");
		status.className = "cookieStatus";
		const isSelected = entry.id === selectedId;
		if (isSelected && input.value.trim()) {
			const found = resolveCookiesPath(entry.browser, input.value);
			if (found) {
				status.classList.add("ok");
				status.textContent =
					__( "cookiesFound") +
					"\n" +
					__( "cookiesFoundAt") +
					" " +
					found.cookiesPath;
			} else {
				status.classList.add("warn");
				status.textContent =
					__( "cookiesNotFound") + "\n" + __( "cookiesNotFoundHelp");
			}
		} else {
			status.style.display = "none";
		}

		const right = document.createElement("div");
		right.className = "right";

		const pasteBtn = document.createElement("button");
		pasteBtn.type = "button";
		pasteBtn.className = "blueBtn smallBtn";
		pasteBtn.textContent = __("paste") || "Paste";
		pasteBtn.addEventListener("click", () => {
			const txt = clipboard.readText().trim();
			if (!txt) return;
			input.value = txt;
			const next = loadCookieEntries().map((e) =>
				e.id === entry.id ? {...e, path: txt} : e
			);
			saveCookieEntries(next);
			if (getSelectedCookieEntryId() === entry.id) renderCookieEntries();
		});

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "redBtn smallBtn deleteBtn";
		delBtn.textContent = __("remove") || "Remove";
		delBtn.addEventListener("click", () => {
			const next = loadCookieEntries().filter((e) => e.id !== entry.id);
			saveCookieEntries(next);
			if (getSelectedCookieEntryId() === entry.id) {
				setSelectedCookieEntryId("");
			}
			renderCookieEntries();
		});

		right.appendChild(pasteBtn);
		right.appendChild(delBtn);

		row.appendChild(left);
		const mid = document.createElement("div");
		mid.className = "mid";
		mid.appendChild(input);
		mid.appendChild(status);
		row.appendChild(mid);
		row.appendChild(right);
		container.appendChild(row);
	});
}

const addCookiesPathBtn = getId("addCookiesPath");
if (addCookiesPathBtn) {
	addCookiesPathBtn.addEventListener("click", () => {
		const entries = loadCookieEntries();
		const id = "c_" + Math.random().toString(36).slice(2, 10);
		entries.push({id, browser: "chromium", path: ""});
		saveCookieEntries(entries);
		renderCookieEntries();
	});
}

// Keep in sync if user switches away from custom browser
getId("browser")?.addEventListener("change", () => {
	if (getId("browser").value !== "custom") {
		setSelectedCookieEntryId("");
		renderCookieEntries();
	}
});

renderCookieEntries();

// Handling preferred video quality
let preferredVideoQuality = localStorage.getItem("preferredVideoQuality");
if (preferredVideoQuality) {
	getId("preferredVideoQuality").value = preferredVideoQuality;
}

getId("preferredVideoQuality").addEventListener("change", () => {
	preferredVideoQuality = getId("preferredVideoQuality").value;
	localStorage.setItem("preferredVideoQuality", preferredVideoQuality);
});

// Handling preferred audio quality
let preferredAudioQuality = localStorage.getItem("preferredAudioQuality");
if (preferredAudioQuality) {
	getId("preferredAudioQuality").value = preferredAudioQuality;
}

getId("preferredAudioQuality").addEventListener("change", () => {
	preferredAudioQuality = getId("preferredAudioQuality").value;
	localStorage.setItem("preferredAudioQuality", preferredAudioQuality);
});

// Handling preferred video codec
let preferredVideoCodec = localStorage.getItem("preferredVideoCodec");
if (preferredVideoCodec) {
	getId("preferredVideoCodec").value = preferredVideoCodec;
}

getId("preferredVideoCodec").addEventListener("change", () => {
	preferredVideoCodec = getId("preferredVideoCodec").value;
	localStorage.setItem("preferredVideoCodec", preferredVideoCodec);
});

// Proxy
let proxy = localStorage.getItem("proxy");
if (proxy) {
	getId("proxyTxt").value = proxy;
}
getId("proxyTxt").addEventListener("change", () => {
	proxy = getId("proxyTxt").value;
	localStorage.setItem("proxy", proxy);
});

// Custom yt-dlp args
const ytDlpArgsInput = getId("customArgsInput");
let customYtDlpArgs = localStorage.getItem("customYtDlpArgs");
if (customYtDlpArgs) {
	ytDlpArgsInput.value = customYtDlpArgs;
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
}
ytDlpArgsInput.addEventListener("input", () => {
	customYtDlpArgs = getId("customArgsInput").value;
	localStorage.setItem("customYtDlpArgs", customYtDlpArgs.trim());
	ytDlpArgsInput.style.height = "auto";
	ytDlpArgsInput.style.height = ytDlpArgsInput.scrollHeight + "px";
});

getId("learnMoreLink").addEventListener("click", () => {
	shell.openExternal(
		"https://github.com/aandrew-me/ytDownloader/wiki/Custom-yt%E2%80%90dlp-options"
	);
});

// Reload
function reload() {
	ipcRenderer.send("reload");
}
getId("restart").addEventListener("click", () => {
	reload();
});

// Handling filename formats
getId("filenameFormat").addEventListener("input", () => {
	const text = getId("filenameFormat").value;
	localStorage.setItem("filenameFormat", text);
});

if (localStorage.getItem("filenameFormat")) {
	getId("filenameFormat").value = localStorage.getItem("filenameFormat");
}

getId("resetFilenameFormat").addEventListener("click", () => {
	getId("filenameFormat").value = "%(playlist_index)s.%(title)s.%(ext)s";
	localStorage.setItem(
		"filenameFormat",
		"%(playlist_index)s.%(title)s.%(ext)s"
	);
});

// Handling folder name formats
getId("foldernameFormat").addEventListener("input", () => {
	const text = getId("foldernameFormat").value;
	localStorage.setItem("foldernameFormat", text);
});

if (localStorage.getItem("foldernameFormat")) {
	getId("foldernameFormat").value = localStorage.getItem("foldernameFormat");
}

getId("resetFoldernameFormat").addEventListener("click", () => {
	getId("foldernameFormat").value = "%(playlist_title)s";
	localStorage.setItem("foldernameFormat", "%(playlist_title)s");
});

// Max active downloads
getId("maxDownloads").addEventListener("input", () => {
	const number = Number(getId("maxDownloads").value);

	if (number < 1) {
		localStorage.setItem("maxActiveDownloads", "1");
	} else {
		localStorage.setItem("maxActiveDownloads", String(number));
	}
});

if (localStorage.getItem("maxActiveDownloads")) {
	getId("maxDownloads").value = localStorage.getItem("maxActiveDownloads");
}

// Closing app to system tray
const closeToTray = getId("closeToTray");
closeToTray.addEventListener("change", (event) => {
	if (closeToTray.checked) {
		localStorage.setItem("closeToTray", "true");
		ipcRenderer.send("useTray", true);
	} else {
		localStorage.setItem("closeToTray", "false");
		ipcRenderer.send("useTray", false);
	}
});
const trayEnabled = localStorage.getItem("closeToTray");
if (trayEnabled == "true") {
	closeToTray.checked = true;
	ipcRenderer.send("useTray", true);
}

// Auto updates
const autoUpdateDisabled = getId("autoUpdateDisabled");
autoUpdateDisabled.addEventListener("change", (event) => {
	if (autoUpdateDisabled.checked) {
		localStorage.setItem("autoUpdate", "false");
	} else {
		localStorage.setItem("autoUpdate", "true");
	}
});
const autoUpdate = localStorage.getItem("autoUpdate");
if (autoUpdate == "false") {
	autoUpdateDisabled.checked = true;
}

// Show more format options
const showMoreFormats = getId("showMoreFormats");
showMoreFormats.addEventListener("change", (event) => {
	if (showMoreFormats.checked) {
		localStorage.setItem("showMoreFormats", "true");
	} else {
		localStorage.setItem("showMoreFormats", "false");
	}
});
const showMoreFormatOpts = localStorage.getItem("showMoreFormats");
if (showMoreFormatOpts == "true") {
	showMoreFormats.checked = true;
}

function showPopup(text, isError = false) {
	let popupContainer = document.getElementById("popupContainer");

	if (!popupContainer) {
		popupContainer = document.createElement("div");
		popupContainer.id = "popupContainer";
		popupContainer.className = "popup-container";
		document.body.appendChild(popupContainer);
	}

	const popup = document.createElement("span");
	popup.textContent = text;
	popup.classList.add("popup-item");

	popup.style.background = isError ? "#ff6b6b" : "#54abde";

	if (isError) {
		popup.classList.add("popup-error");
	}

	popupContainer.appendChild(popup);

	setTimeout(() => {
		popup.style.opacity = "0";
		setTimeout(() => {
			popup.remove();
			if (popupContainer.childElementCount === 0) {
				popupContainer.remove();
			}
		}, 1000);
	}, 2200);
}
