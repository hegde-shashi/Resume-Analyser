const API = "http://localhost:5001";
const MODEL_STORAGE_KEY = "selectedModel";
const DEFAULT_API_MODE = "default";
const USER_API_MODE = "user";

let currentJob = null;
let currentJobId = null; // DB row id from Jobs.id (required by /analyze_job)
let activeJobLink = "";
let jobExistsInDatabase = false;
let analysisReady = false;
let isBusy = false;
let llmMode = DEFAULT_API_MODE;
let activeCustomApiKey = "";
let customValidationPending = false;
let isCurrentPageBlocked = false;
let isCurrentTabSupported = false;
let statusPollingTimeout = null;

window.onload = () => {
    const token = getStoredToken();

    if (token) {
        showApp();
    } else {
        showLogin();
    }
};

function showLogin() {
    document.getElementById("loginView").style.display = "block";
    document.getElementById("appView").style.display = "none";
}

function showApp() {
    document.getElementById("loginView").style.display = "none";
    document.getElementById("appView").style.display = "block";
    clearStatus();
    document.getElementById("apiModeSelect").value = llmMode;
    applyApiModeSelection();
    initializePopupState();
}

function setStatus(message, type = "info") {
    const status = document.getElementById("statusMessage");
    status.style.display = "block";
    status.className = `status ${type}`;
    status.textContent = message;
}

function clearStatus() {
    const status = document.getElementById("statusMessage");
    status.style.display = "none";
    status.className = "status";
    status.textContent = "";
}

function getStoredToken() {
    const token = (localStorage.getItem("token") || "").trim();
    return token || null;
}

function extractAuthToken(data) {
    if (!data || typeof data !== "object") {
        return null;
    }

    const token = data.token || data.access_token || data.jwt || data.auth_token || "";
    return typeof token === "string" && token.trim() ? token.trim() : null;
}

function getSelectedModel() {
    return document.getElementById("modelSelect").value || "";
}

function getApiModeSelection() {
    return document.getElementById("apiModeSelect").value || DEFAULT_API_MODE;
}

function getLlmRequestConfig() {
    if (llmMode === USER_API_MODE) {
        return {
            mode: USER_API_MODE,
            api_key: activeCustomApiKey
        };
    }

    return {
        mode: DEFAULT_API_MODE
    };
}

function isLlmReady() {
    return llmMode !== USER_API_MODE || Boolean(activeCustomApiKey);
}

function clearJobAndAnalysisViews() {
    document.getElementById("jobDetails").innerHTML = "";
    document.getElementById("analysis").innerHTML = "";
    setVisible("jobDetails", false);
    setVisible("analysis", false);
}

async function parseApiResponse(res) {
    const text = await res.text();

    if (!text) {
        return { data: null, text: "" };
    }

    try {
        return { data: JSON.parse(text), text };
    } catch (_error) {
        return { data: null, text };
    }
}

function getApiError(res, data, fallbackMessage) {
    if (data && typeof data === "object" && typeof data.error === "string") {
        return data.error;
    }

    return `${fallbackMessage} (HTTP ${res.status})`;
}

async function requestWithRouteFallback(routeConfigs) {
    let lastResponse = null;

    for (const config of routeConfigs) {
        const res = await fetch(`${API}${config.path}`, config.options);
        if (res.status !== 404) {
            return res;
        }
        lastResponse = res;
    }

    return lastResponse;
}

function normalizeJobLink(link) {
    if (typeof link !== "string") {
        return "";
    }

    return link.trim().replace(/\/$/, "");
}

function isIpAddressHost(hostname) {
    if (!hostname || typeof hostname !== "string") {
        return false;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        return true;
    }

    const ipv6Host = hostname.replace(/^\[|\]$/g, "");
    return /^[0-9a-fA-F:]+$/.test(ipv6Host) && ipv6Host.includes(":");
}

function isBlockedPageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
        return false;
    }

    try {
        const parsed = new URL(rawUrl);
        const hostname = (parsed.hostname || "").toLowerCase();
        const pathname = parsed.pathname || "";

        const isGoogleSearch = (hostname === "google.com" || hostname === "www.google.com")
            && pathname.startsWith("/search");
        const isBlockedAppDomain = hostname === "yellow-plant-053b33600.4.azurestaticapps.net";
        const isLocalhost = hostname === "localhost" || hostname.endsWith(".localhost");
        const isIpHost = isIpAddressHost(hostname);

        return isGoogleSearch || isBlockedAppDomain || isLocalhost || isIpHost;
    } catch (_error) {
        return false;
    }
}

function normalizeJobPayload(payload) {
    const source = payload && typeof payload === "object"
        ? (payload.job_data && typeof payload.job_data === "object" ? payload.job_data : payload)
        : {};

    return {
        ...source,
        scrape_success: payload && typeof payload === "object" ? payload.scrape_success : undefined,
        id: source.id ?? payload.id ?? null,
        job_id: source.job_id ?? payload.job_id ?? null,
        title: source.title ?? source.job_title ?? null,
        company: source.company ?? null,
        location: source.location ?? null,
        experience: source.experience ?? source.experience_required ?? null,
        job_link: source.job_link ?? source.url ?? source.link ?? null,
        progress: source.progress ?? null,
        is_parsed: source.is_parsed ?? payload.is_parsed ?? false,
        error_message: source.error_message ?? payload.error ?? null
    };

}

function formatJobValue(value) {
    if (value === null || value === undefined || value === "") {
        return "Not found";
    }

    return value;
}

function countFilledCoreFields(job) {
    return [job.title, job.company, job.location, job.experience]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .length;
}

function setVisible(id, isVisible) {
    document.getElementById(id).style.display = isVisible ? "block" : "none";
}

function setModelVisibility(isVisible) {
    const display = isVisible ? "block" : "none";
    document.querySelector('label[for="modelSelect"]').style.display = display;
    document.getElementById("modelSelect").style.display = display;
    document.getElementById("modelError").style.display = display;
}

function setApiModeControlVisibility(isVisible) {
    const display = isVisible ? "block" : "none";
    document.querySelector('label[for="apiModeSelect"]').style.display = display;
    document.getElementById("apiModeSelect").style.display = display;
    if (!isVisible) {
        document.getElementById("apiKeyError").style.display = "none";
    }
    if (!isVisible) {
        document.getElementById("customApiKey").style.display = "none";
        document.getElementById("validateApiKey").style.display = "none";
    } else {
        const shouldShowCustomControls = getApiModeSelection() === USER_API_MODE && customValidationPending;
        setApiModeVisibility(shouldShowCustomControls);
    }
}

function setApiModeVisibility(isUserMode) {
    document.getElementById("customApiKey").style.display = isUserMode ? "block" : "none";
    document.getElementById("validateApiKey").style.display = isUserMode ? "block" : "none";
}

function setApiKeyError(message = "") {
    const node = document.getElementById("apiKeyError");
    node.innerText = message;
    node.style.display = message ? "block" : "none";
}

function setModelSelectEnabled(enabled) {
    document.getElementById("modelSelect").disabled = !enabled;
}

function setBusyState(flag, message = "") {
    isBusy = flag;
    const appButtons = document.querySelectorAll("#appView button");
    appButtons.forEach((button) => {
        button.disabled = flag;
    });

    const loading = document.getElementById("loading");
    if (flag && message) {
        loading.innerText = message;
        loading.style.display = "block";
    } else if (!flag) {
        loading.style.display = "none";
        loading.innerText = "Parsing job description...";
        updateActionButtons();
    }
}

function clampScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getScoreColor(score) {
    if (score >= 71) {
        return "#16a34a";
    }
    if (score >= 41) {
        return "#f59e0b";
    }
    return "#dc2626";
}

function normalizeSkills(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => String(item).trim() !== "");
    }

    if (typeof value !== "string") {
        return [];
    }

    const text = value.trim();
    if (!text || text.toLowerCase() === "none" || text.toLowerCase() === "null") {
        return [];
    }

    try {
        const parsed = JSON.parse(text.replace(/'/g, "\""));
        if (Array.isArray(parsed)) {
            return parsed.filter((item) => String(item).trim() !== "");
        }
    } catch (_error) {
        // fallback below
    }

    return text
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
}

function extractModels(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== "object") {
        return [];
    }

    const candidates = [
        payload.models,
        payload.available_models,
        payload.llms,
        payload.data
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

function renderModelOptions(models) {
    const select = document.getElementById("modelSelect");
    const modelError = document.getElementById("modelError");
    const validModels = models
        .map((model) => {
            if (typeof model === "string") {
                return model.trim();
            }

            if (model && typeof model === "object") {
                const value = model.model || model.name || model.id || "";
                return typeof value === "string" ? value.trim() : "";
            }

            return "";
        })
        .filter((model) => model !== "");
    const previous = localStorage.getItem(MODEL_STORAGE_KEY);

    select.innerHTML = "";

    if (!validModels.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Default";
        select.appendChild(option);
        modelError.innerText = "";
        return;
    }

    for (const model of validModels) {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        select.appendChild(option);
    }

    if (previous && validModels.includes(previous)) {
        select.value = previous;
    }

    modelError.innerText = "";
}

async function loadModels({ mode = llmMode, apiKey = activeCustomApiKey } = {}) {
    const modelError = document.getElementById("modelError");
    modelError.innerText = "";
    setModelSelectEnabled(false);

    try {
        const requestBody = mode === USER_API_MODE
            ? { mode, api_key: apiKey }
            : { mode: DEFAULT_API_MODE };
        const res = await fetch(`${API}/check_models`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });
        const { data: payload } = await parseApiResponse(res);

        if (!res.ok) {
            throw new Error(getApiError(res, payload, "Failed to load models"));
        }

        renderModelOptions(extractModels(payload));
        setModelSelectEnabled(true);
        return true;
    } catch (error) {
        renderModelOptions([]);
        modelError.innerText = error.message || "Failed to load models";
        setModelSelectEnabled(mode !== USER_API_MODE);
        return false;
    }
}

async function applyApiModeSelection() {
    const selectedMode = getApiModeSelection();
    setApiKeyError("");

    if (selectedMode === DEFAULT_API_MODE) {
        customValidationPending = false;
        activeCustomApiKey = "";
        llmMode = DEFAULT_API_MODE;
        document.getElementById("customApiKey").value = "";
        setApiModeVisibility(false);
        await loadModels({ mode: DEFAULT_API_MODE });
        updateActionButtons();
        return;
    }

    customValidationPending = true;
    setApiModeVisibility(true);
    updateActionButtons();
}

function displayJob(job) {
    currentJob = job;

    const div = document.getElementById("jobDetails");
    const detailsMarkup = `
    <p><b>Title:</b> ${formatJobValue(job.title)}</p>
    <p><b>Company:</b> ${formatJobValue(job.company)}</p>
    <p><b>Location:</b> ${formatJobValue(job.location)}</p>
    <p><b>Experience:</b> ${formatJobValue(job.experience)}</p>
    <p><b>Progress:</b> ${formatJobValue(job.progress || "Checking")}</p>
    `;

    div.innerHTML = detailsMarkup;
    setVisible("jobDetails", !analysisReady);

    updateActionButtons();
}

function renderAnalysisResult(result) {
    const normalized = result && typeof result === "object" && result.analysis
        ? result.analysis
        : result;
    const score = clampScore(normalized && normalized.score);

    const matchedSkills = normalizeSkills(
        normalized && (normalized.matched_skills || normalized.matchedSkills || normalized["Matched Skills"])
    );
    const missingSkills = normalizeSkills(
        normalized && (normalized.missing_skills || normalized.missingSkills || normalized["Missing Skills"])
    );
    const color = getScoreColor(score);

    document.getElementById("analysis").innerHTML = `
    <div class="analysisTop">
        <div class="scoreRing" style="--score:${score};--ring-color:${color};">
            <div class="scoreInner">${score}%</div>
        </div>
    </div>
    <p>Matching Skills:</p>
    <ul>
        ${matchedSkills.length ? matchedSkills.map((skill) => `<li>${skill}</li>`).join("") : "<li>None</li>"}
    </ul>
    <p>Missing Skills:</p>
    <ul>
        ${missingSkills.length ? missingSkills.map((skill) => `<li>${skill}</li>`).join("") : "<li>None</li>"}
    </ul>
    `;

    analysisReady = true;
    setVisible("analysis", true);
    setVisible("jobDetails", false);
    clearStatus();
    updateActionButtons();
}

function updateActionButtons() {
    const sendButton = document.getElementById("send");
    const analyseButton = document.getElementById("analyse");
    const shouldHideControls = !isCurrentTabSupported || isCurrentPageBlocked;

    if (analysisReady || shouldHideControls) {
        setModelVisibility(false);
        setApiModeControlVisibility(false);
        sendButton.style.display = "none";
        analyseButton.style.display = "none";
        return;
    }

    setModelVisibility(true);
    setApiModeControlVisibility(true);
    sendButton.style.display = "block";

    if (customValidationPending) {
        sendButton.style.display = "none";
        analyseButton.style.display = "none";
        return;
    }

    if (!activeJobLink) {
        sendButton.disabled = true;
        sendButton.classList.add("disabled");
        sendButton.textContent = "Open a website tab";
        analyseButton.style.display = "none";
    } else if (jobExistsInDatabase) {
        sendButton.disabled = true;
        sendButton.classList.add("disabled");
        sendButton.textContent = "Page Already Saved";
        analyseButton.style.display = (currentJobId && currentJob?.is_parsed) ? "block" : "none";
    } else {
        sendButton.disabled = false;
        sendButton.classList.remove("disabled");
        sendButton.textContent = "Send Page To Analyzer";
        analyseButton.style.display = "none";
    }

    analyseButton.disabled = false;
    analyseButton.classList.remove("disabled");
    analyseButton.textContent = "Analyse Resume Match";

    if (isBusy) {
        sendButton.disabled = true;
        analyseButton.disabled = true;
    }

    if (!isLlmReady()) {
        sendButton.disabled = true;
        analyseButton.disabled = true;
    }
}

function sendExtractMessage(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: "extract" }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (!response) {
                reject(new Error("No data received from content script"));
                return;
            }

            resolve(response);
        });
    });
}

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tab;
}

async function getPageData(tab) {
    if (!tab || !tab.id) {
        throw new Error("No active tab found");
    }

    const url = tab.url || "";
    const isSupportedUrl = url.startsWith("http://") || url.startsWith("https://");

    if (!isSupportedUrl) {
        throw new Error("Open a regular website tab (http/https) and try again");
    }

    if (isBlockedPageUrl(url)) {
        throw new Error("This page is excluded from analysis. Open a supported job page.");
    }

    try {
        return await sendExtractMessage(tab.id);
    } catch (error) {
        if (!error.message.includes("Receiving end does not exist")) {
            throw error;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
        });

        return await sendExtractMessage(tab.id);
    }
}

function extractJobs(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== "object") {
        return [];
    }

    if (Array.isArray(payload.jobs)) {
        return payload.jobs;
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    return [];
}

function findJobByLink(jobs, link) {
    const targetLink = normalizeJobLink(link);

    return jobs.find((job) => {
        const source = job && typeof job === "object"
            ? (job.job_data && typeof job.job_data === "object" ? job.job_data : job)
            : {};
        const jobLink = normalizeJobLink(source.job_link || source.url || source.link || "");
        return jobLink && jobLink === targetLink;
    }) || null;
}

function extractSavedAnalysis(jobRecord) {
    if (!jobRecord || typeof jobRecord !== "object") {
        return null;
    }

    if (jobRecord.analysis && typeof jobRecord.analysis === "object") {
        const missing = normalizeSkills(jobRecord.analysis.missing_skills);
        return {
            payload: { ...jobRecord.analysis, missing_skills: missing },
            has_missing_skills: missing.length > 0
        };
    }

    if (typeof jobRecord.score === "number") {
        const missing = normalizeSkills(jobRecord.missing_skills);
        return {
            payload: { score: jobRecord.score, missing_skills: missing },
            has_missing_skills: missing.length > 0
        };
    }

    if (typeof jobRecord.analysis_score === "number") {
        const missing = normalizeSkills(jobRecord.missing_skills);
        return {
            payload: { score: jobRecord.analysis_score, missing_skills: missing },
            has_missing_skills: missing.length > 0
        };
    }

    if (typeof jobRecord.matchScore === "number") {
        const missing = normalizeSkills(jobRecord.missing_skills);
        return {
            payload: { score: jobRecord.matchScore, missing_skills: missing },
            has_missing_skills: missing.length > 0
        };
    }

    return null;
}

async function initializePopupState() {
    currentJob = null;
    currentJobId = null;
    activeJobLink = "";
    jobExistsInDatabase = false;
    analysisReady = false;
    isCurrentPageBlocked = false;
    isCurrentTabSupported = false;
    clearJobAndAnalysisViews();

    const tab = await getActiveTab();
    const currentUrl = normalizeJobLink(tab && tab.url ? tab.url : "");

    activeJobLink = currentUrl;
    isCurrentTabSupported = Boolean(
        activeJobLink && (activeJobLink.startsWith("http://") || activeJobLink.startsWith("https://"))
    );
    isCurrentPageBlocked = isBlockedPageUrl(activeJobLink);
    updateActionButtons();

    if (!isCurrentTabSupported) {
        setStatus("Open a regular website tab to continue.", "warn");
        return;
    }

    if (isCurrentPageBlocked) {
        setStatus("This page is excluded from analysis. Open a supported job page.", "warn");
        return;
    }

    await fetchExistingJobForCurrentUrl();
}

async function fetchExistingJobForCurrentUrl() {
    const token = getStoredToken();

    if (!token || !activeJobLink) {
        return;
    }

    try {
        const commonHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
        const res = await requestWithRouteFallback([
            {
                path: "/get_jobs",
                options: { method: "GET", headers: commonHeaders }
            },
            {
                path: "/get_jobs",
                options: { method: "POST", headers: commonHeaders, body: JSON.stringify({}) }
            },
            {
                path: "/jobs/get_jobs",
                options: { method: "GET", headers: commonHeaders }
            },
            {
                path: "/jobs/get_jobs",
                options: { method: "POST", headers: commonHeaders, body: JSON.stringify({}) }
            }
        ]);

        const { data } = await parseApiResponse(res);

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem("token");
                showLogin();
            }
            return;
        }

        const jobs = extractJobs(data);
        const existingJob = findJobByLink(jobs, activeJobLink);

        if (!existingJob) {
            jobExistsInDatabase = false;
            currentJobId = null;
            clearTimeout(statusPollingTimeout);
            setStatus("No saved job found for this page.", "info");
            updateActionButtons();
            return;
        }

        jobExistsInDatabase = true;
        const normalizedJob = normalizeJobPayload(existingJob);
        normalizedJob.job_link = activeJobLink;
        currentJobId = existingJob.id || normalizedJob.id || null;
        displayJob(normalizedJob);
        
        if (normalizedJob.error_message) {
            const shortError = normalizedJob.error_message.split('\n')[0];
            setStatus(`Error: ${shortError}`, "warn");
        } else {

            setStatus(normalizedJob.is_parsed ? "Job details loaded." : "Job already saved. AI is parsing...", "success");
        }


        // START POLLING if not parsed yet
        if (!normalizedJob.is_parsed) {
            console.log("Job not parsed yet, polling in 3s...");
            clearTimeout(statusPollingTimeout);
            statusPollingTimeout = setTimeout(fetchExistingJobForCurrentUrl, 3000);
        } else {
            clearTimeout(statusPollingTimeout);
        }

        const savedAnalysis = extractSavedAnalysis(existingJob);
        if (savedAnalysis) {
            renderAnalysisResult(savedAnalysis.payload);
            if (!savedAnalysis.has_missing_skills && currentJobId) {
                await runAnalysis({ silent: true });
            }
        }
    } catch (error) {
        console.error("Failed to fetch jobs:", error);
    }

    updateActionButtons();
}

async function runAnalysis({ silent = false } = {}) {
    setBusyState(true, "Analysing resume match...");
    try {
        if (!isLlmReady()) {
            throw new Error("Validate custom API key before analysis.");
        }

        const token = getStoredToken();
        if (!token) {
            localStorage.removeItem("token");
            showLogin();
            throw new Error("Session expired. Please login again.");
        }

        if (!currentJobId) {
            await fetchExistingJobForCurrentUrl();
        }

        if (!currentJobId) {
            throw new Error("Job ID not found. Save the page data first.");
        }

        const model = getSelectedModel();
        const body = JSON.stringify({
            model,
            job_id: currentJobId,
            ...getLlmRequestConfig()
        });

        console.log("Sending analysis request with payload:", { model, job_id: currentJobId, body });
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
        const res = await requestWithRouteFallback([
            {
                path: "/analyze_job",
                options: { method: "POST", headers, body }
            },
        ]);

        const { data: result } = await parseApiResponse(res);

        if (res.status === 401) {
            localStorage.removeItem("token");
            showLogin();
            throw new Error("Unauthorized (401). Please login again.");
        }

        if (!res.ok) {
            throw new Error(getApiError(res, result, "Analysis failed"));
        }

        if (!result || typeof result !== "object") {
            throw new Error("Invalid response from analyze_job");
        }

        renderAnalysisResult(result);
        if (!silent) {
            setStatus("Analysis completed.", "success");
        }
    } finally {
        setBusyState(false);
    }
}

async function saveCurrentJob({ silent = false, overrides = null } = {}) {
    const token = getStoredToken();
    const model = getSelectedModel();

    if (!currentJob && !overrides) {
        throw new Error("No job details to save");
    }

    if (!token) {
        throw new Error("Session expired. Please login again.");
    }

    const payload = overrides || {
        ...currentJob,
        job_link: activeJobLink || currentJob.job_link || "",
        model,
        progress: "Checking"
    };

    console.log("Saving job payload:", payload);

    const res = await fetch(`${API}/save_job`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const { data } = await parseApiResponse(res);

    if (res.status === 401) {
        localStorage.removeItem("token");
        showLogin();
        throw new Error("Unauthorized (401). Please login again.");
    }

    if (!res.ok) {
        throw new Error(getApiError(res, data, "Error saving job"));
    }

    jobExistsInDatabase = true;
    currentJobId = (data && (data.job_id || data.id)) || currentJobId;
    updateActionButtons();

    if (!silent) {
        setStatus("Job saved successfully.", "success");
    }

    return data;
}

document.getElementById("modelSelect").onchange = (event) => {
    localStorage.setItem(MODEL_STORAGE_KEY, event.target.value || "");
};

document.getElementById("apiModeSelect").onchange = async () => {
    if (isBusy) {
        return;
    }

    clearStatus();
    await applyApiModeSelection();
};

document.getElementById("validateApiKey").onclick = async () => {
    if (isBusy) {
        return;
    }

    const keyInput = document.getElementById("customApiKey");
    const enteredKey = (keyInput.value || "").trim();

    if (!enteredKey) {
        setApiKeyError("");
        return;
    }

    setApiKeyError("");
    clearStatus();
    setBusyState(true, "Validating API key...");

    try {
        const ok = await loadModels({ mode: USER_API_MODE, apiKey: enteredKey });
        if (!ok) {
            customValidationPending = true;
            setApiModeVisibility(true);
            setApiKeyError("");
            return;
        }

        llmMode = USER_API_MODE;
        activeCustomApiKey = enteredKey;
        customValidationPending = false;
        setApiModeVisibility(false);
        setApiKeyError("");
        setStatus("Custom API key validated. Models loaded.", "success");
    } finally {
        setBusyState(false);
        updateActionButtons();
    }
};

document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    document.getElementById("loginError").innerText = "";

    try {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const { data } = await parseApiResponse(res);
        const token = extractAuthToken(data);

        if (res.ok && token) {
            localStorage.setItem("token", token);
            showApp();
        } else {
            document.getElementById("loginError").innerText =
                (data && data.error) || getApiError(res, data, "Login failed");
        }
    } catch (error) {
        document.getElementById("loginError").innerText =
            error.message || "Login failed";
    }
};

document.getElementById("send").onclick = async () => {
    if (isBusy) return;

    const loading = document.getElementById("loading");
    loading.innerText = "Extracting page data...";
    loading.style.display = "block";
    clearStatus();
    setBusyState(true, "Sending data to backend...");

    try {
        const tab = await getActiveTab();
        const data = await getPageData(tab);

        activeJobLink = normalizeJobLink(data.url || tab.url || "");

        setStatus("Data sent to backend. AI is working on this...", "success");
        loading.innerText = "LLM is processing this in background...";

        const model = getSelectedModel();
        const llmConfig = getLlmRequestConfig();

        // Immediate Save as unparsed - this is the "non-blocking" part
        // We don't wait for a 20-second LLM parse anymore here
        const payload = {
            is_parsed: false,
            job_description: data.text || "",
            job_link: activeJobLink,
            // Temporary company name from URL
            company: activeJobLink ? new URL(activeJobLink).hostname.replace('www.', '') : 'Processing...',
            job_title: 'AI is parsing details...',
            progress: "Checking",
            model: model,
            api_key: llmConfig.api_key || null
        };

        console.log("Sending immediate save payload:", payload);

        const token = getStoredToken();
        const res = await fetch(`${API}/save_job`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const { data: resData } = await parseApiResponse(res);
        if (!res.ok) {
            throw new Error(getApiError(res, resData, "Failed to send data"));
        }

        // Final feedback
        currentJobId = resData.job_id || null;
        jobExistsInDatabase = true;
        
        // Show the job box immediately with the temporary data we just sent
        displayJob(normalizeJobPayload(payload));
        
        setStatus("Job saved to queue! Parsing in background.", "success");

        // We can still call this to sync state, but the UI is already updated
        fetchExistingJobForCurrentUrl();

    } catch (error) {
        console.error("Non-blocking send failed:", error);
        setStatus(error.message || "Failed to send data.", "warn");
        loading.innerText = "Error occurred.";
    } finally {
        setBusyState(false);
    }
};

document.getElementById("analyse").onclick = async () => {
    try {
        if (isBusy) {
            return;
        }
        if (analysisReady) {
            return;
        }
        await runAnalysis();
    } catch (error) {
        setStatus(error.message || "Analysis failed", "warn");
        setVisible("analysis", false);
    }
};

document.getElementById("logout").onclick = () => {
    localStorage.removeItem("token");
    showLogin();
};
