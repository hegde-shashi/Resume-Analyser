// ═══════════════════════════════════════════════
// AUTOFILL CONTENT SCRIPT v4.1 — Universal
// Wrapped in IIFE to prevent duplicate execution
// ═══════════════════════════════════════════════
(function() {
    window.__autofillVersion = (window.__autofillVersion || 0) + 1;
    const myVer = window.__autofillVersion;
    console.log(`[AF v4.1] Loaded (instance #${myVer})`);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Only the LATEST instance responds
        if (myVer !== window.__autofillVersion) return;

        if (request.action === "extract") {
            sendResponse({ url: window.location.href, title: document.title, text: document.body.innerText });
        }

        if (request.action === "check_form") {
            const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
            const hasForm = inputs.length >= 3;
            sendResponse({ hasForm });
        }

        if (request.action === "job_saved") {
            window.postMessage({ type: "MAARGA_JOB_SAVED" }, "*");
            sendResponse({ success: true });
        }

        if (request.action === "autofill") {
            const myVer = window.__autofillVersion;
            console.log(`[AF v4.1 #${myVer}] Starting autofill`);
            window.autofillForm(request.data).then(n => sendResponse({ success: true, count: n }));
            return true;
        }
    });

    let sidebarInitTimer = null;

    // AUTO-INJECT & RE-INJECT ON NAVIGATION
    if (myVer === window.__autofillVersion) {
        initFloatingSidebar();
        
        // Listen for dynamic changes (SPAs like Workday)
        let lastUrl = window.location.href;
        const obs = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                scheduleSidebarInit(80);
            } else {
                // If the URL is same but the form just appeared
                if (!document.getElementById('maarga-floater')) {
                    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
                    if (inputs.length >= 3) scheduleSidebarInit(200);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function scheduleSidebarInit(delayMs) {
        if (sidebarInitTimer) clearTimeout(sidebarInitTimer);
        sidebarInitTimer = setTimeout(() => {
            sidebarInitTimer = null;
            initFloatingSidebar();
        }, delayMs || 150);
    }

    // EXPOSE GLOBALLY FOR FRAME-AWARE POPUP
    window.autofillForm = autofillForm;

    async function initFloatingSidebar() {
        if (!hasLiveExtensionContext()) {
            console.warn('[AF][sidebar] Skipping sidebar init: extension context unavailable');
            removeFloatingSidebar();
            return;
        }

        if (isSidebarBlockedHost()) {
            removeFloatingSidebar();
            return;
        }

        if (window.maargaClosed) return;
        if (document.getElementById('maarga-floater')) return;

        // Show sidebar only when form fields match our autofill target data model.
        const fieldMatch = detectAutofillFieldMatch();
        if (!fieldMatch.shouldShow) {
            console.log('[AF] Sidebar hidden - no relevant autofill fields found', fieldMatch);
            return;
        }

        const container = document.createElement('div');
        container.id = 'maarga-floater';
        container.innerHTML = `
            <button id="maarga-close" title="Close Maarga">×</button>
            <div class="maarga-tab">
                <div class="maarga-btn-main" title="Autofill with Maarga AI">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="maarga-btn-edit" title="Edit My Resume Data">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.id = 'maarga-floater-style';
        style.innerText = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap');
            
            #maarga-floater {
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 2147483647;
                font-family: 'Outfit', sans-serif;
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            #maarga-floater:hover {
                transform: translateY(-50%) scale(1.05);
            }
            #maarga-close {
                position: absolute;
                top: -12px;
                left: -12px;
                background: #B94040;
                color: white;
                width: 24px;
                height: 24px;
                border: none;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 2147483648;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: auto;
            }
            #maarga-floater:hover #maarga-close {
                opacity: 1 !important;
            }
            .maarga-tab {
                background: rgba(25, 18, 15, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
                display: flex;
                flex-direction: column;
                padding: 10px;
                gap: 12px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
                align-items: center;
            }
            .maarga-btn-main, .maarga-btn-edit {
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border-radius: 50%;
            }
            .maarga-btn-main {
                background: #D4AF37;
                color: #19120F;
                width: 42px;
                height: 42px;
                border: none;
                box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
            }
            .maarga-btn-main:hover {
                transform: rotate(15deg);
                background: #E5C354;
            }
            .maarga-btn-edit {
                color: white;
                background: rgba(255, 255, 255, 0.05);
                width: 36px;
                height: 36px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .maarga-btn-edit:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(container);

        container.addEventListener('click', (e) => {
            if (e.target.id === 'maarga-close') {
                console.log('[AF] Maarga Sidebar closing...');
                window.maargaClosed = true;
                e.preventDefault();
                e.stopPropagation();
                container.remove();
                const s = document.getElementById('maarga-floater-style');
                if (s) s.remove();
            }
        });

        const closeBtn = container.querySelector('#maarga-close');
        if (closeBtn) {
            closeBtn.onmouseover = (e) => e.target.style.background = '#321911';
            closeBtn.onmouseout = (e) => e.target.style.background = '#5D4037';
        }

        container.querySelector('.maarga-btn-main').onclick = () => {
            if (!hasLiveExtensionContext()) {
                console.warn('[AF][sidebar] Click ignored: extension context lost');
                removeFloatingSidebar();
                return;
            }
            chrome.storage.local.get(['token', 'profile'], (res) => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn('[AF][sidebar] chrome.storage.local.get error:', chrome.runtime.lastError.message);
                    removeFloatingSidebar();
                    return;
                }
                if (res.profile) {
                    window.autofillForm(res.profile);
                } else if (!res.token) {
                    showInlineLogin();
                } else {
                    chrome.runtime.sendMessage({ action: "load_profile" }, (pRes) => {
                        if (chrome.runtime && chrome.runtime.lastError) {
                            console.warn('[AF][sidebar] load_profile error:', chrome.runtime.lastError.message);
                            return;
                        }
                        if (pRes && pRes.success) {
                            window.autofillForm(pRes.profile);
                        } else {
                            alert("Resume details not found. Please open the Maarga extension and upload/analyze your resume first.");
                        }
                    });
                }
            });
        };
        container.querySelector('.maarga-btn-edit').onclick = () => {
             window.open("http://localhost:3000/profile", "_blank");
        };

        function showInlineLogin() {
            if (document.getElementById('maarga-login-box')) return;
            
            const box = document.createElement('div');
            box.id = 'maarga-login-box';
            box.style.cssText = `
                position: fixed;
                right: 80px;
                top: 60%;
                transform: translateY(-50%);
                background: #FDFAF4;
                border: 2px solid #5D4037;
                border-radius: 12px;
                padding: 20px;
                width: 240px;
                box-shadow: 0 10px 40px rgba(93, 64, 55, 0.4);
                z-index: 2147483647;
                font-family: 'Inter', sans-serif;
            `;
            
            box.innerHTML = `
                <div style="font-weight:bold; color:#5D4037; margin-bottom:15px; text-align:center; text-transform:uppercase; font-size:14px; letter-spacing:1px;">Maarga Login</div>
                <input type="text" id="m-email" placeholder="Email Address" style="width:100%; box-sizing:border-box; padding:10px; margin-bottom:10px; border:1px solid #C8B89A; border-radius:8px; background:#fff; font-size:13px; outline:none; color:#2C2420;">
                <input type="password" id="m-pass" placeholder="Password" style="width:100%; box-sizing:border-box; padding:10px; margin-bottom:15px; border:1px solid #C8B89A; border-radius:8px; background:#fff; font-size:13px; outline:none; color:#2C2420;">
                <div id="m-error" style="color:#B94040; font-size:11px; margin-bottom:10px; text-align:center; display:none;"></div>
                <button id="m-login-btn" style="width:100%; padding:12px; background:#5D4037; color:#FDFAF4; border:none; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s; font-size:13px;">SIGN IN</button>
                <div id="m-cancel" style="text-align:center; margin-top:12px; font-size:12px; color:#9E8D7E; cursor:pointer; text-decoration:underline;">Cancel</div>
            `;
            
            document.body.appendChild(box);
            
            box.querySelector('#m-cancel').onclick = () => box.remove();
            
            const btn = box.querySelector('#m-login-btn');
            btn.onmouseover = () => btn.style.background = '#795548';
            btn.onmouseout = () => btn.style.background = '#5D4037';

            btn.onclick = async () => {
                const email = box.querySelector('#m-email').value;
                const password = box.querySelector('#m-pass').value;
                const error = box.querySelector('#m-error');
                
                if (!email || !password) {
                    error.innerText = "Email and Password required";
                    error.style.display = 'block';
                    return;
                }

                error.style.display = 'none';
                btn.innerText = "SIGNING IN...";
                btn.disabled = true;
                
                chrome.runtime.sendMessage({ action: "login", email, password }, (response) => {
                    if (response && response.success) {
                        // Success! Now fetch profile
                        chrome.runtime.sendMessage({ action: "load_profile" }, (pRes) => {
                            if (pRes && pRes.success) {
                                box.remove();
                                window.autofillForm(pRes.profile);
                            } else {
                                btn.disabled = false;
                                btn.innerText = "SIGN IN";
                                error.innerText = "Login OK, but profile load failed.";
                                error.style.display = 'block';
                            }
                        });
                    } else {
                        btn.disabled = false;
                        btn.innerText = "SIGN IN";
                        error.innerText = (response && response.error) || "Connection error";
                        error.style.display = 'block';
                    }
                });
            };
        }
    }

    function isSidebarBlockedHost() {
        const host = (window.location.hostname || '').toLowerCase();
        const blocked = [
            'linkedin.com',
            'naukri.com',
            'indeed.com',
            'monster.com',
            'monsterindia.com',
            'shine.com',
            'foundit.in',
            'foundit.com',
            'timesjobs.com',
            'instahyre.com',
            'wellfound.com'
        ];
        return blocked.some(d => host === d || host.endsWith(`.${d}`));
    }

    function removeFloatingSidebar() {
        const floater = document.getElementById('maarga-floater');
        if (floater) floater.remove();
        const style = document.getElementById('maarga-floater-style');
        if (style) style.remove();
    }

    function hasLiveExtensionContext() {
        return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    }

    function detectAutofillFieldMatch() {
        // Structural fallback: some pages render section headers and Add buttons before inputs.
        const structuralText = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,label,button'))
            .slice(0, 250)
            .map(el => (el.innerText || el.textContent || '').trim().toLowerCase())
            .filter(Boolean)
            .join(' | ');

        if (structuralText) {
            const structuralGroups = {
                name: /legal\s*name|first\s*name|last\s*name|full\s*name/.test(structuralText),
                company: /work\s*experience|employment|job\s*title|company/.test(structuralText),
                summary: /summary|objective|profile|about\s*you|cover\s*letter/.test(structuralText),
                education: /\beducation\b|school|college|university|degree/.test(structuralText)
            };
            const structuralScore = Object.values(structuralGroups).filter(Boolean).length;
            if (structuralScore >= 2) {
                return { shouldShow: true, score: structuralScore, groups: structuralGroups, reason: 'structural-markers' };
            }
        }

        const candidates = document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea, [role="combobox"], [role="textbox"]'
        );

        const groups = {
            name: false,
            company: false,
            summary: false,
            education: false
        };

        let visibleCount = 0;
        let scanned = 0;
        const maxScan = 80;
        const fallbackEls = [];

        for (const el of candidates) {
            if (scanned >= maxScan) break;
            if (!el || el.disabled) continue;
            if (el.closest('header, nav, footer, .wd-header, .top-bar, .site-nav, .wd-Navigation')) continue;
            const rect = el.getBoundingClientRect();
            if (!(rect.width > 0 || rect.height > 0)) continue;

            visibleCount++;
            scanned++;
            if (fallbackEls.length < 24) fallbackEls.push(el);

            // Fast text extraction only; avoid expensive deep label lookup here.
            const txt = [
                el.placeholder || '',
                el.name || '',
                el.id || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('data-automation-id') || '',
                el.getAttribute('aria-labelledby') || '',
                el.getAttribute('title') || ''
            ].join(' ').toLowerCase();

            if (!groups.name && /first\s*name|last\s*name|full\s*name|given\s*name|family\s*name|\bname\b/.test(txt)) {
                groups.name = true;
            }
            if (!groups.company && /company|employer|organization|firm|current\s*company/.test(txt)) {
                groups.company = true;
            }
            if (!groups.summary && /summary|objective|bio|about\s*you|profile|role\s*description|cover\s*letter/.test(txt)) {
                groups.summary = true;
            }
            if (!groups.education && /education|school|college|university|degree|field\s*of\s*study|major|graduation/.test(txt)) {
                groups.education = true;
            }

            // Early exit as soon as threshold reached.
            const scoreNow = Object.values(groups).filter(Boolean).length;
            if (scoreNow >= 2) {
                return { shouldShow: true, score: scoreNow, groups, count: visibleCount, scanned };
            }
        }

        // Limited fallback: some forms keep keywords only in <label> text.
        for (const el of fallbackEls) {
            const txt = [getLabel(el) || '', el.getAttribute('aria-labelledby') || ''].join(' ').toLowerCase();
            if (!groups.name && /first\s*name|last\s*name|full\s*name|given\s*name|family\s*name|\bname\b/.test(txt)) groups.name = true;
            if (!groups.company && /company|employer|organization|firm|current\s*company/.test(txt)) groups.company = true;
            if (!groups.summary && /summary|objective|bio|about\s*you|profile|role\s*description|cover\s*letter/.test(txt)) groups.summary = true;
            if (!groups.education && /education|school|college|university|degree|field\s*of\s*study|major|graduation/.test(txt)) groups.education = true;
            const scoreNow = Object.values(groups).filter(Boolean).length;
            if (scoreNow >= 2) {
                return { shouldShow: true, score: scoreNow, groups, count: visibleCount, scanned };
            }
        }

        if (visibleCount < 4) {
            return { shouldShow: false, reason: 'too-few-visible-inputs', count: visibleCount, scanned };
        }

        const score = Object.values(groups).filter(Boolean).length;
        const shouldShow = score >= 2;
        return { shouldShow, score, groups, count: visibleCount, scanned };
    }

    // ═══════════════════════════════════════════════
    // MAIN AUTOFILL
    // ═══════════════════════════════════════════════

    async function autofillForm(data) {
        let filled = 0;

        const fullName = data.name || '';
        const parts = fullName.trim().split(/\s+/);
        const first = data.first_name || parts[0] || '';
        const last = data.last_name || (parts.length > 1 ? parts[parts.length - 1] : '') || '';
        const middle = data.middle_name || (parts.length > 2 ? parts.slice(1, -1).join(' ') : '');

        const expArr = Array.isArray(data.experience) ? data.experience :
            (data.experience ? [{ company: data.experience }] : (data.last_company ? [{ company: data.last_company }] : []));
        const eduArr = Array.isArray(data.education) ? data.education :
            (data.education ? [{ college: data.education }] : []);

        console.log(`[AF] Full profile data to fill:`, data);
        console.log(`[AF] first="${first}" last="${last}" exp=${expArr.length} edu=${eduArr.length}`);

        // ══════ STEP 1: Expand collapsed sections ══════
        const langArr = typeof data.languages === 'string' ? data.languages.split(',').map(s=>s.trim()).filter(Boolean) : Array.isArray(data.languages) ? data.languages : [];
        await expandSections(expArr.length, eduArr.length, data.primary_skills, langArr);

        // Ensure website/social "Add" sections are expanded so URL fields exist.
        await expandLinkSections(data);

        // ══════ STEP 2: Fill Skills (Workday multi-select — must be done before main loop) ══════
        await fillWorkdaySkills(data);

        // ══════ STEP 3: Fill all fields ══════
        // PRE-SORT & DEDUPLICATE INPUTS
        // We collect all potential targets, then filter out ancestors of other targets 
        // (e.g. if we have a div[role="combobox"] that contains a button[aria-haspopup], we only want the button for interaction)
        let allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="combobox"], [role="textbox"], [role="checkbox"], [role="radio"], button[aria-haspopup="listbox"], button[title*="Select"]'));
        
        let inputs = allInputs.filter(el => {
            // 1. Skip if element is a parent of another target (keep the most specific element)
            const hasTargetChild = allInputs.some(other => el !== other && el.contains(other) && other.offsetWidth > 0);
            if (hasTargetChild) return false;

            // 2. Skip site header/nav/footer
            if (el.closest('header, nav, footer, .wd-header, .top-bar, .site-nav, .wd-Navigation, .candidateHome-header')) return false;
            
            // 3. Ignore things in the top 120 pixels of the page that aren't inside the main form
            const rect = el.getBoundingClientRect();
            if (rect.top + window.scrollY < 120 && !el.closest('form, [role="main"], article, .wd-WorkdayContent')) return false;
            
            return true;
        });

        inputs.sort((a,b) => {
            const al = (getLabel(a) + ' ' + (a.getAttribute('data-automation-id') || '') + ' ' + (a.id || '')).toLowerCase();
            const bl = (getLabel(b) + ' ' + (b.getAttribute('data-automation-id') || '') + ' ' + (b.id || '')).toLowerCase();
            const ap = P(al, [/country/i, /code/i, /isd/i, /phone/i]) && !P(al, [/number/i]) ? 0 : 1;
            const bp = P(bl, [/country/i, /code/i, /isd/i, /phone/i]) && !P(bl, [/number/i]) ? 0 : 1;
            if (ap !== bp) return ap - bp;
            // Otherwise, sort by DOM position
            const pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
        
        let curExp = -1, curEdu = -1;
        let si = 0, li = 0, nameUsed = false;
        let lastBlockId = null; 
        const cleanLink = (v) => {
            if (!v) return '';
            const s = String(v).trim();
            if (!s) return '';
            if (/^https?:\/\//i.test(s)) return s;
            if (/^(www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s.replace(/^www\./i, 'www.')}`;
            return s;
        };
        const linkValues = {
            linkedin: cleanLink(data.linkedin_link),
            github: cleanLink(data.github_link),
            website: cleanLink(data.portfolio_link || data.website || data.portfolio)
        };

        const hasDedicatedLinkField = (rx) => inputs.some(el => {
            const txt = [
                getLabel(el) || '',
                el.placeholder || '',
                el.name || '',
                el.id || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('data-automation-id') || ''
            ].join(' ').toLowerCase();
            return rx.test(txt);
        });

        const hasDedicatedLinkedin = hasDedicatedLinkField(/linkedin/);
        const hasDedicatedGithub = hasDedicatedLinkField(/github|git\s*hub/);
        const pageTextLower = (document.body.innerText || '').toLowerCase();
        const hasLinkedinSectionMarker = /social\s*network\s*urls?|social\s*links?|\blinkedin\b/.test(pageTextLower);
        const allowGenericType = {
            website: !!linkValues.website,
            linkedin: !!linkValues.linkedin && !hasDedicatedLinkedin && !hasLinkedinSectionMarker,
            github: !!linkValues.github && !hasDedicatedGithub
        };
        console.log(`[AF][link] dedicated fields: linkedin=${hasDedicatedLinkedin} github=${hasDedicatedGithub} linkedinMarker=${hasLinkedinSectionMarker}`);

        const genericLinkQueue = [
            allowGenericType.website ? linkValues.website : '',
            allowGenericType.linkedin ? linkValues.linkedin : '',
            allowGenericType.github ? linkValues.github : ''
        ].filter(Boolean);
        const usedGenericLinks = new Set();
        const usedTypedLinks = new Set();
        let pendingLinkType = '';
        const nextGenericLink = () => {
            for (const u of genericLinkQueue) {
                if (!usedGenericLinks.has(u)) {
                    usedGenericLinks.add(u);
                    return u;
                }
            }
            return '';
        };
        const normalizeLinkType = (txt) => {
            const t = String(txt || '').toLowerCase();
            if (/linkedin/.test(t)) return 'linkedin';
            if (/github|git\s*hub/.test(t)) return 'github';
            if (/website|portfolio|personal\s*site|homepage|web\s*address/.test(t)) return 'website';
            return '';
        };
        const nextLinkType = () => {
            if (allowGenericType.website && !usedTypedLinks.has('website')) return 'website';
            if (allowGenericType.linkedin && !usedTypedLinks.has('linkedin')) return 'linkedin';
            if (allowGenericType.github && !usedTypedLinks.has('github')) return 'github';
            return '';
        };
        const typeLabel = (type) => {
            if (type === 'linkedin') return 'LinkedIn';
            if (type === 'github') return 'GitHub';
            if (type === 'website') return 'Website';
            return '';
        };
        const takeLinkByType = (type) => {
            const t = normalizeLinkType(type);
            if (!t) return '';
            const u = linkValues[t] || '';
            if (!u) return '';
            usedTypedLinks.add(t);
            usedGenericLinks.add(u);
            return u;
        };
        const parseRangeDates = (x) => {
            if (!x) return { start: '', end: '' };
            const blob = String(x.date_range || x.daterange || x.duration || x.period || x.tenure || x.employment_duration || '').trim();
            if (!blob) return { start: '', end: '' };
            const m = blob.match(/^(.+?)\s*(?:-|to|–|—)\s*(.+)$/i);
            if (!m) return { start: '', end: '' };
            return { start: String(m[1] || '').trim(), end: String(m[2] || '').trim() };
        };
        const getExpPosition = (x) => x ? (
            x.position || x.job_title || x.jobTitle || x.title || x.role || x.designation || x.current_position || x.current_role || x.current_designation || x.job || ''
        ) : '';
        const getExpStartRaw = (x) => {
            if (!x) return '';
            const direct = x.start_date || x.startDate || x.start || x.from_date || x.fromDate || x.from || x.start_year || x.startMonthYear || '';
            if (direct) return direct;
            return parseRangeDates(x).start;
        };
        const getExpEndRaw = (x) => {
            if (!x) return '';
            const direct = x.end_date || x.endDate || x.end || x.to_date || x.toDate || x.to || x.end_year || x.endMonthYear || '';
            if (direct) return direct;
            return parseRangeDates(x).end;
        };
        const isExpCurrent = (x) => {
            if (!x) return false;
            const er = String(getExpEndRaw(x) || '').toLowerCase();
            const truthy = (v) => {
                if (v === true) return true;
                const t = String(v || '').trim().toLowerCase();
                return t === 'true' || t === 'yes' || t === 'y' || t === '1';
            };
            return /present|current|till|ongoing/.test(er) ||
                truthy(x.current) || truthy(x.current_job) || truthy(x.is_current) || truthy(x.present) || truthy(x.currently_working);
        };

        for (let i = 0; i < inputs.length; i++) {
            const inp = inputs[i];
            const isCheckLikeEl = (inp.type === 'checkbox' || inp.type === 'radio' || inp.getAttribute('role') === 'checkbox' || inp.getAttribute('role') === 'radio');
            
            const isDropdownBtn = inp.tagName === 'BUTTON' && (inp.hasAttribute('aria-haspopup') || inp.getAttribute('role') === 'combobox' || (inp.title || '').includes('Select'));
            if (!isDropdownBtn) {
                if (inp.type === 'hidden' || inp.disabled) continue;
                if (['submit', 'button', 'file', 'image', 'reset'].includes(inp.type)) continue;
                if (!isElementInteractable(inp) && !isCheckLikeEl) continue;
            }

            // Important: Dismiss any stuck popups before starting a complex field
            if (isDropdownBtn || inp.tagName === 'SELECT') {
                await dismissPopups();
            }

            const lab = getLabel(inp).toLowerCase();
            const ph = (inp.placeholder || '').toLowerCase();
            const nm = (inp.name || '').toLowerCase();
            const id = (inp.id || '').toLowerCase();
            const ar = (inp.getAttribute('aria-label') || '').toLowerCase();
            const da = (inp.getAttribute('data-automation-id') || '').toLowerCase();
            const sec = detectSection(inp);

            const disp = [lab, ph, ar, da].join(' ');
            const full = disp + ' ' + nm + ' ' + id;
            const expCtxText = (full + ' ' + getNearbyText(inp)).toLowerCase();
            const isExpLike = sec === 'experience' || P(expCtxText + ' ' + da + ' ' + id, [/experience/i, /work\s*experience/i, /employer/i, /job\s*title/i, /start\s*date/i, /end\s*date/i, /current\s*job/i, /work\b/i, /employment/i]);
            const eduCtxText = `${full} ${da} ${id} ${nm} ${lab} ${ph}`.toLowerCase();
            const isEduLike = sec === 'education' || (!isExpLike && P(eduCtxText, [/education/i, /school/i, /college/i, /university/i, /degree/i, /area\s*of\s*study/i, /field\s*of\s*study/i, /graduation/i, /passing\s*year/i]));

            let ok = false;

            // ──── PERSONAL INFO ────
            if (!ok && sec !== 'education' && sec !== 'experience') {
                if (P(full, [/first\s*name/i, /\bfname\b/i, /given\s*name/i]) && !P(full, [/\blocal\b/i])) {
                    await setInput(inp, first); ok = true; L(i, 'first', first);
                }
            }
            if (!ok && sec !== 'education' && sec !== 'experience') {
                if (P(full, [/last\s*name/i, /\blname\b/i, /sur\s*name/i, /family\s*name/i]) && !P(full, [/\blocal\b/i])) {
                    await setInput(inp, last); ok = true; L(i, 'last', last);
                }
            }
            if (!ok && sec !== 'education' && sec !== 'experience') {
                if (P(full, [/middle\s*name/i, /\bmname\b/i]) && !P(full, [/\blocal\b/i])) { await setInput(inp, middle); ok = true; }
            }
            if (!ok && sec !== 'education' && sec !== 'experience' && !nameUsed) {
                if (P(disp, [/\bname\b/i, /full\s*name/i]) &&
                    !P(full, [/company|school|university|college|employer|degree|institution|organization|role|title|job|position|first|last|middle/i])) {
                    await setInput(inp, fullName); nameUsed = true; ok = true; L(i, 'fullName', fullName);
                }
            }

            if (!ok && P(full, [/\bemail\b/i, /e-?mail/i])) { await setInput(inp, data.email); ok = true; }

            // Resolve phone country-code controls before numeric phone fields.
            const isPhoneSection = detectSection(inp) === 'phone';
            const phoneContext = P(full + ' ' + getNearbyText(inp), [/phone|mobile|tel\b|contact\s*number|country\s*code|dial|isd|calling/i]);
            const looksLikeCodeControl =
                P(full, [/country\s*code/i, /dialing\s*code/i, /isd\s*code/i, /phone\s*code/i, /area\s*code/i, /calling\s*code/i, /international\s*code/i]) ||
                (isPhoneSection && phoneContext && (inp.getAttribute('role') === 'combobox' || inp.tagName === 'SELECT' || P(id + ' ' + da, [/country|code|isd|dial/i])));

            if (!ok && looksLikeCodeControl) {
                const done = await setPhoneCountryCode(inp, data.country);
                if (done) {
                    await dismissPopups();
                    await forceCloseDropdown(inp);
                    try { inp.blur(); } catch (e) {}
                    await sleep(150);
                    ok = true;
                    L(i, 'dialingCode', data.country);
                }
            }

            if (!ok && P(full, [/phone/i, /mobile/i, /\btel\b/i]) && !P(full, [/company|extension|code|country\s*code|isd|zip|postal|pin|type|dial|calling/i])) {
                await setInput(inp, data.phone);
                ok = true;
            }
            if (!ok && (P(full, [/\bdevice\s*type/i, /phone\s*type/i]) || (P(full, [/\btype\b/i]) && (detectSection(inp) === 'personal' || detectSection(inp) === 'unknown')))) { await setSelect(inp, 'Mobile'); ok = true; }
            if (!ok && P(disp, [/\baddress\b/i, /\bstreet\b/i]) && !P(full, [/email|company/i])) { await setInput(inp, data.address); ok = true; }
            if (!ok && P(full, [/\bcity\b/i]) && !P(full, [/state|country|university/i])) { await setInput(inp, data.city); ok = true; }
            // ──── PHONE COUNTRY/DIALING CODE ────
            if (!ok && (isPhoneSection || phoneContext) && P(full, [/country\s*code/i, /dialing\s*code/i, /isd\s*code/i, /phone\s*code/i, /area\s*code/i])) {
                const isActualPhoneNum = P(full, [/number/i]) && !P(full, [/code|isd|dial/i]);
                const isCodeField = P(full, [/code/i, /isd/i]) || da.includes('code');
                if (!isActualPhoneNum || isCodeField) {
                    const done = await setPhoneCountryCode(inp, data.country);
                    if (done) {
                        await dismissPopups();
                        await forceCloseDropdown(inp);
                        try { inp.blur(); } catch (e) {}
                        await sleep(150);
                        ok = true;
                        L(i, 'dialingCode', data.country);
                    }
                }
            }

            // ──── COUNTRY ────
            if (!ok && (P(full, [/\bcountry\b/i, /\bnation\b/i]) || da.includes('country')) && !P(full, [/code/i, /phone/i, /dial/i, /isd/i, /pin/i]) && detectSection(inp) !== 'phone' && !id.includes('phone') && !da.includes('phone')) { 
                const done = await setLocationCountry(inp, data.country);
                if (done) {
                    await sleep(200);
                    ok = true;
                    L(i, 'country', data.country);
                }
            }
            if (!ok && P(full, [/\bstate\b/i, /province/i, /territory/i, /region/i]) && detectSection(inp) !== 'phone' && !id.includes('phone')) { 
                const isLikelyCountryOnly = P(full, [/country/i, /nation\b/i]) && !P(full, [/\bstate\b/i, /province/i, /region/i, /territory/i]);
                
                if (!isLikelyCountryOnly) {
                    const s = normalizeState(data.state);
                    if (s) {
                        console.log(`[AF] State: filling "${s}" (full label was "${full}")`);
                        await setSelect(inp, s); 
                        ok = true; 
                        L(i, 'state', s);
                    }
                }
            }
            if (!ok && P(full, [/pincode/i, /\bzip\b/i, /postal/i])) { await setInput(inp, data.pincode); ok = true; }
            // ──── SOCIAL LINKS (specific fields first, then generic URL fields) ────
            if (!ok) {
                const isLinkTypeField = P(full, [/link\s*type/i, /url\s*type/i, /website\s*type/i, /social\s*type/i, /type\s*of\s*(link|url)/i]) &&
                    !P(full, [/phone\s*type|device\s*type|employment\s*type|worker\s*type/i]);
                if (isLinkTypeField) {
                    const pickedType = nextLinkType();
                    if (pickedType) {
                        const pickedLabel = typeLabel(pickedType);
                        const selected = await setSelect(inp, pickedLabel, true);
                        if (selected) {
                            pendingLinkType = pickedType;
                            ok = true;
                            L(i, 'linkType', pickedLabel);
                            console.log(`[AF][link] Link type selected: ${pickedLabel}`);
                        }
                    }
                }
            }
            if (!ok && (P(full, [/linkedin/i]) || P(id + ' ' + nm, [/linkedin/i]))) {
                const u = linkValues.linkedin || nextGenericLink();
                if (u) { await setInput(inp, u); ok = true; L(i, 'linkedin', u); }
            }
            if (!ok && (P(full, [/github/i]) || P(id + ' ' + nm, [/github/i]))) {
                const u = linkValues.github || nextGenericLink();
                if (u) { await setInput(inp, u); ok = true; L(i, 'github', u); }
            }
            if (!ok) {
                const isGenericLinkField = (P(full, [/portfolio/i, /\bwebsite\b/i, /\burl\b/i, /social\s*link/i, /personal\s*site/i, /homepage/i, /web\s*address/i]) ||
                    P(id + ' ' + nm, [/portfolio/i, /website/i, /\burl\b/i, /link/i])) &&
                    !P(full + ' ' + id + ' ' + nm, [/linkedin|github|company\s*website|employer\s*website|school\s*website|university\s*website|resume|cover\s*letter|attachment|upload|image|photo|reference|source|job\s*url|posting/i]);

                if (isGenericLinkField && sec !== 'experience' && sec !== 'education') {
                    let preferred = '';
                    if (pendingLinkType) {
                        preferred = takeLinkByType(pendingLinkType);
                        console.log(`[AF][link] Applying pending link type ${pendingLinkType} -> ${preferred || 'none'}`);
                        pendingLinkType = '';
                    }
                    if (!preferred) {
                        preferred = linkValues.website && !usedGenericLinks.has(linkValues.website)
                            ? (usedGenericLinks.add(linkValues.website), linkValues.website)
                            : nextGenericLink();
                    }
                    if (preferred) {
                        await setInput(inp, preferred);
                        ok = true;
                        L(i, 'website', preferred);
                    }
                }
            }
            if (!ok && P(disp, [/\bsummary\b/i, /\bbio\b/i, /\bobjective\b/i]) && !P(full, [/company|school/i])) { await setInput(inp, data.summary); ok = true; }
            
            // ──── PERSONAL / DOB ────
            if (!ok && P(full, [/birth\s*date/i, /date\s*of\s*birth/i, /\bdob\b/i, /born\s*on/i, /birthday/i])) {
                if (data.date_of_birth) { 
                    console.log(`[AF] Filling Date of Birth: ${data.date_of_birth}`);
                    await fillDate(inp, data.date_of_birth); 
                    ok = true; 
                    L(i, 'dob', data.date_of_birth); 
                }
            }

            // ──── EXPERIENCE / EDUCATION "CURRENT" CHECKBOXES ────
            const isCheckLike = isCheckLikeEl;
            if (!ok && isCheckLike) {
                const isExp = sec === 'experience';
                const isEdu = sec === 'education';
                const label = (getLabel(inp) + ' ' + getNearbyText(inp)).toLowerCase();
                const checkMeta = `${label} ${id} ${nm} ${da} ${ar} ${ph}`.toLowerCase();
                const looksLikeCurrentJob = P(checkMeta, [/current\s*job/i, /currentjob/i, /is\s*current/i, /iscurrent/i, /currently\s*work/i, /current\s*employer/i, /present/i]);
                const treatAsExp = isExpLike || (!isEdu && looksLikeCurrentJob);
                if (treatAsExp || isEdu) {
                    const isPresentCheck = P(checkMeta, [/current\s*job/i, /currentjob/i, /is\s*current/i, /iscurrent/i, /currently\s*work/i, /current\s*employer/i, /present/i, /currently\s*enrolled/i, /pursuing/i, /in\s*progress/i]);
                    
                    if (isPresentCheck) {
                        const item = treatAsExp ? expArr[Math.max(0, curExp)] : eduArr[Math.max(0, curEdu)];
                        if (item) {
                            const endDate = String(getExpEndRaw(item) || '').toLowerCase();
                            const isPresent = treatAsExp ? isExpCurrent(item) : (/present|current|till/i.test(endDate) || item.current === true);
                            
                            // Check if date is in the future
                            let isFuture = false;
                            const parsedEnd = parseMonthYear(endDate);
                            if (parsedEnd) {
                                const now = new Date();
                                const end = new Date(parsedEnd.year, parsedEnd.month - 1);
                                if (end > now) isFuture = true;
                            }

                            if (isPresent || isFuture || !endDate) {
                                const ariaChecked = (inp.getAttribute('aria-checked') || '').toLowerCase() === 'true';
                                const checked = !!inp.checked || ariaChecked;
                                if (!checked) {
                                    const actionEl = inp.closest('label, [role="checkbox"], [role="radio"]') || inp;
                                    try { await clickRobust(actionEl); } catch (e) {}
                                    try { inp.click(); } catch (e) {}
                                    if ('checked' in inp) inp.checked = true;
                                    if (inp.getAttribute('role') === 'checkbox' || inp.getAttribute('role') === 'radio') {
                                        inp.setAttribute('aria-checked', 'true');
                                    }
                                    fire(inp);
                                }
                                ok = true; 
                                L(i, treatAsExp ? 'curExp' : 'curEdu', 'true');
                            }
                        }
                    }
                }
            }

            // ──── EXPERIENCE FIELDS ────
            if (!ok && P(disp, [/company/i, /employer/i, /organization/i, /firm/i]) && !P(full, [/school|university/i])) {
                const isFirstField = !P(id + nm, [/url|link|desc|title|role/i]);
                if (isFirstField) {
                    const blockId = (id.match(/\d+/) || [""])[0];
                    if (blockId !== lastBlockId) {
                        curExp++; 
                        lastBlockId = blockId;
                        console.log(`[AF] Experience Block detected. Index now: ${curExp}`);
                    }
                }
                const x = expArr[curExp]; if (x) { await smartSet(inp, x.company); ok = true; L(i, 'company', x.company); }
            }
            if (!ok && P(full, [/total.*experience/i, /years.*experience/i]) && !P(full, [/current/i])) {
                if (data.total_experience_years) { await setInput(inp, String(data.total_experience_years)); ok = true; }
            }
            if (!ok && (P(disp, [/job\s*title/i, /position/i, /\brole\b(?!\s*desc)/i, /designation/i]) || P(id + ' ' + nm + ' ' + da, [/job\s*title/i, /jobtitle/i, /position/i, /designation/i, /role/i])) &&
                isExpLike) {
                const x = expArr[Math.max(0, curExp)];
                if (x) {
                    const pos = getExpPosition(x) || data.current_position || data.current_role || data.current_designation || data.job_title || data.position || data.designation || data.title || '';
                    if (pos) { await smartSet(inp, pos); ok = true; L(i, 'position', pos); }
                }
            }
            if (!ok && isExpLike && P(disp, [/description/i, /responsibilit/i, /duties/i])) {
                const x = expArr[Math.max(0, curExp)]; if (x && x.description) { await setInput(inp, x.description); ok = true; }
            }

            if (!ok && isExpLike && P(full + ' ' + id + ' ' + da, [/employer\s*country/i, /work\s*country/i, /countrycode/i])) {
                const done = await setLocationCountry(inp, data.country);
                if (done) {
                    ok = true;
                    L(i, 'employerCountry', data.country);
                }
            }

            if (!ok && isExpLike && !P(full, [/skill|language|hobby/i])) {
                const x = expArr[Math.max(0, curExp)];
                if (x) {
                    const startParsed = parseMonthYear(String(getExpStartRaw(x) || ''));
                    const endParsed = parseMonthYear(String(getExpEndRaw(x) || ''));

                    // Generic split Month/Year controls (non-Workday IDs).
                    const ctx = (full + ' ' + getNearbyText(inp)).toLowerCase();
                    const meta = `${id} ${nm} ${da} ${ctx}`;
                    const isMonthControl = /\bmonth\b/.test(disp) || ph.trim() === 'month' || /month/.test(meta);
                    const isYearControl = /\byear\b/.test(disp) || ph.trim() === 'year' || /year/.test(meta);
                    const isEndSide = /end\s*date|\bto\b|enddate/.test(meta);
                    const datePart = isEndSide ? endParsed : startParsed;

                    if (!ok && isMonthControl && datePart?.month) {
                        const done = await setMonthControl(inp, datePart.month);
                        if (done) {
                            ok = true;
                            L(i, isEndSide ? 'expEndMonth' : 'expStartMonth', String(datePart.month));
                        }
                    }

                    if (!ok && isYearControl && datePart?.year) {
                        const yy = String(datePart.year);
                        const done = await setSelect(inp, yy, true);
                        if (!done) await setInput(inp, yy);
                        ok = true;
                        L(i, isEndSide ? 'expEndYear' : 'expStartYear', yy);
                    }

                    // Workday split date controls
                    if (!ok && (da.includes('datesectionmonth') || id.includes('datesectionmonth'))) {
                        const isEndMonthField = P(full + ' ' + id + ' ' + da, [/\bto\b/i, /\bend\b/i, /enddate/i]);
                        const mo = isEndMonthField ? (endParsed ? endParsed.month : null) : (startParsed ? startParsed.month : null);
                        if (mo) {
                            const mm = String(mo).padStart(2, '0');
                            await setDateSegmentValue(inp, mm, isEndMonthField ? 'exp-end-month' : 'exp-start-month');
                            ok = true;
                            L(i, isEndMonthField ? 'expEndMonth' : 'expStartMonth', mm);
                        }
                    }

                    if (!ok && (da.includes('datesectionyear') || id.includes('datesectionyear'))) {
                        const isEndYearField = P(full + ' ' + id + ' ' + da, [/\bto\b/i, /\bend\b/i, /enddate/i]);
                        const yr = isEndYearField ? (endParsed ? endParsed.year : null) : (startParsed ? startParsed.year : null);
                        if (yr) {
                            const yyyy = String(yr);
                            await setDateSegmentValue(inp, yyyy, isEndYearField ? 'exp-end-year' : 'exp-start-year');
                            ok = true;
                            L(i, isEndYearField ? 'expEndYear' : 'expStartYear', yyyy);
                        }
                    }
                }
            }

            // ──── EDUCATION ────
            if (!ok && (P(disp, [/school/i, /university/i, /college/i, /institution/i]) || id.includes('school') || da.includes('schoolname'))) {
                const blockId = (id.match(/\d+/) || [""])[0];
                if (blockId !== lastBlockId) {
                    curEdu++; 
                    lastBlockId = blockId;
                    console.log(`[AF] Education Block detected. Index now: ${curEdu}`);
                }
                const x = eduArr[curEdu];
                if (x) { await smartSet(inp, x.college); ok = true; L(i, 'college', x.college); }
            }
            if (!ok && P(disp, [/\bdegree\b/i, /qualification/i, /level\s*of\s*education/i])) {
                const x = eduArr[Math.max(0, curEdu)]; if (x) { await smartSet(inp, normalizeDegree(x.degree)); ok = true; L(i, 'degree', x.degree); }
            }
            if (!ok && P(disp, [/field\s*(of\s*)?study/i, /\bmajor\b/i, /\bsubject\b/i, /specializ/i, /\bbranch\b/i, /area\s*of\s*study/i])) {
                const x = eduArr[Math.max(0, curEdu)];
                if (x) {
                    const fieldVal = x.field_of_study || x.field || '';
                    await smartSet(inp, fieldVal); ok = true; L(i, 'field', fieldVal);
                }
            }

            if (!ok && isEduLike && !isExpLike && P(full, [/\bcountry\b/i]) && !P(full, [/code|phone|dial|isd/i])) {
                const done = await setLocationCountry(inp, data.country);
                if (done) {
                    ok = true;
                    L(i, 'eduCountry', data.country);
                }
            }

            if (!ok && isEduLike && !isExpLike) {
                const x = eduArr[Math.max(0, curEdu)];
                const endRaw = String(x?.end_date || x?.to_date || x?.end_year || x?.to_year || x?.graduation_date || x?.graduation_year || x?.passing_year || '');
                const endParsed = parseMonthYear(endRaw);
                const emeta = `${id} ${nm} ${da} ${full} ${getNearbyText(inp)}`.toLowerCase();
                const isMonthControl = /\bmonth\b/.test(disp) || ph.trim() === 'month' || /month/.test(emeta);
                const isYearControl = /\byear\b/.test(disp) || ph.trim() === 'year' || /year/.test(emeta);

                if (x && endParsed) {
                    if (!ok && isMonthControl && endParsed.month) {
                        const done = await setMonthControl(inp, endParsed.month);
                        if (done) { ok = true; L(i, 'eduEndMonth', String(endParsed.month)); }
                    }
                    if (!ok && isYearControl && endParsed.year) {
                        const yy = String(endParsed.year);
                        const done = await setSelect(inp, yy, true);
                        if (!done) await setInput(inp, yy);
                        ok = true;
                        L(i, 'eduEndYear', yy);
                    }
                }
            }

            // ──── EDUCATION YEAR (Workday dateSectionYear-input) ────
            if (!ok && (da.includes('datesectionyear') || da === 'dateinputwrapper') && sec === 'education') {
                const x = eduArr[Math.max(0, curEdu)];
                if (x) {
                    const yr = P(full + id, [/first|start|from/i]) ? (x.start_year || x.from_year || '') : (x.end_year || x.to_year || x.end_date || '');
                    if (yr) { await setInput(inp, String(yr).replace(/\D/g, '').substring(0,4)); ok = true; L(i, 'eduYear', yr); }
                }
            }
            if (!ok && (sec === 'education' || P(full, [/edu|acad|school/i]))) {
                const x = eduArr[Math.max(0, curEdu)];
                if (x) {
                    if (P(full, [/gpa/i, /grade/i, /result/i, /score/i, /average/i])) { if (x.gpa) { await setInput(inp, String(x.gpa)); ok = true; } }
                    else if (P(full, [/from/i, /start/i, /first.*year|year.*start/i])) { await setInput(inp, String(x.start_year || x.from_year || x.start_date || '')); ok = true; }
                    else if (P(full, [/to\b/i, /end|expected/i, /last.*year|year.*end/i])) { await setInput(inp, String(x.end_year || x.to_year || x.end_date || '')); ok = true; }
                }
            }

            // ──── SKILLS ──── (handled separately by fillWorkdaySkills; skip in main loop)
            // Individual skill fields in multi-select search boxes are handled above.

            // ──── LANGUAGES ────
            if (!ok && (sec === 'language' || P(full, [/\blanguage\b/i]))) {
                const langs = Array.isArray(data.languages) ? data.languages : String(data.languages || '').split(',').map(s=>s.trim()).filter(Boolean);
                const isProficiency = P(full, [/fluency/i, /proficiency/i, /reading/i, /writing/i, /speaking/i, /translation/i, /level/i]);
                const isFluentCheckbox = (inp.type === 'checkbox' || inp.type === 'radio') && P(full, [/fluent/i, /native/i]);
                
                if (isFluentCheckbox) {
                    ok = false; 
                } else if (isProficiency) {
                    const targets = ['Fluent', 'Native or bilingual proficiency', 'Advanced', 'Intermediate', 'Professional working proficiency', 'Full professional proficiency'];
                    let doneProf = false;
                    for(const t of targets) {
                        if (await setSelect(inp, t)) { doneProf = true; break; }
                    }
                    ok = doneProf;
                } else if (langs[li]) {
                    // Check if the current element is actually a Language Name field
                    const isNameField = P(full, [/language/i]) && !isProficiency;
                    
                    if (isNameField) {
                        // Skip if already filled
                        const currentVal = (inp.getAttribute('aria-label') || inp.innerText || inp.value || '').toLowerCase();
                        const alreadyFilled = langs.some(l => currentVal === l.toLowerCase() || currentVal.includes(': ' + l.toLowerCase()));
                        
                        if (!alreadyFilled) {
                            await setSelect(inp, langs[li]); 
                            li++; 
                            ok = true; 
                            L(i, 'lang', langs[li-1]);
                        } else {
                            li++;
                            ok = true;
                            L(i, 'lang-skip (already set)', langs[li-1]);
                        }
                    }
                }
            }

            // ──── BOOLEANS / MISC ────
            if (!ok && P(full, [/citizen/i, /nationality/i]) && !P(full, [/visa/i])) { boolFill(inp, data.is_citizen_of_india); ok = true; }
            if (!ok && P(full, [/visa/i, /sponsorship/i, /authorized\s*to\s*work/i])) { boolFill(inp, data.requires_visa_sponsorship); ok = true; }
            if (!ok && P(full, [/current\s*salary/i, /ctc/i])) { await setInput(inp, data.current_salary); ok = true; }
            if (!ok && P(full, [/expected\s*salary/i, /expectation/i])) { await setInput(inp, data.expected_salary); ok = true; }
            if (!ok && P(full, [/notice\s*period/i, /availability/i, /joining/i])) { await setInput(inp, data.notice_period || 'Immediate'); ok = true; }

            if (ok) filled++;
        }

        console.log(`[AF] Done. ${filled} fields filled.`);
        return filled;
    }

    /**
     * Special handler for Workday Skills multi-select tagging
     */
    async function fillWorkdaySkills(data) {
        try {
            const sks = data.primary_skills || data.skills || '';
            const arr = Array.isArray(sks) ? sks : String(sks).split(',').map(x => x.trim()).filter(Boolean);
            if (arr.length === 0) return;

            // Find Workday skills container
            const skillsField = document.querySelector('[data-automation-id="formField-skills"]');
            if (!skillsField) return;

            const input = skillsField.querySelector('input');
            if (!input) return;

            console.log(`[AF] Starting skills tagger for ${arr.length} skills`);

            for (const skill of arr) {
                // Check if already added
                const existing = Array.from(skillsField.querySelectorAll('[data-automation-id="selectedItem"]')).map(el => el.innerText.toLowerCase().trim());
                if (existing.some(s => s.includes(skill.toLowerCase()) || skill.toLowerCase().includes(s))) continue;

                // 1. Clear input strictly for tagging
                input.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await sleep(200);

                await setInput(input, skill);
                
                // 2. Wait for suggestions that match our skill (or at least are new)
                const suggestionsFound = await waitFor(() => {
                    const opts = document.querySelectorAll('[role="option"], [data-automation-id*="Option"], [data-automation-id*="promptOption"]');
                    return Array.from(opts).some(o => {
                        const t = (o.innerText || '').toLowerCase();
                        return (o.offsetWidth > 0) && (t.includes(skill.toLowerCase()) || skill.toLowerCase().includes(t));
                    });
                }, 4000);

                if (!suggestionsFound) {
                    console.log(`[AF] No suggestions for skill "${skill}", skipping...`);
                    input.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('delete', false, null);
                    continue;
                }

                const options = document.querySelectorAll('[role="option"], [data-automation-id*="Option"], [data-automation-id*="promptOption"]');
                let clicked = false;
                for (const opt of options) {
                    const text = (opt.innerText || '').toLowerCase().trim();
                    if (text === skill.toLowerCase() || text.includes(skill.toLowerCase()) || skill.toLowerCase().includes(text)) {
                        console.log(`[AF] Skill match: clicking "${text}" for "${skill}"`);
                        await clickRobust(opt);
                        clicked = true;
                        break;
                    }
                }

                if (!clicked && options.length > 0) {
                    await clickRobust(options[0]);
                    clicked = true;
                }
                
                if (clicked) {
                    // Dynamic wait for dropdown to close (tagging animation)
                    await waitFor(() => {
                        const popups = document.querySelectorAll('[role="listbox"], [role="menu"]');
                        return !Array.from(popups).some(p => p.offsetWidth > 0);
                    }, 3000);
                    await sleep(500); // Small cooldown breadcrumb
                }
            }
        } catch (e) {
            console.error('[AF] Error in fillWorkdaySkills:', e);
        }
    }

    function countBlocksByDelete(keyword) {
        // Count entries by finding "Delete" buttons or ID markers, NOT headers
        const containers = document.querySelectorAll('[aria-labelledby], .wd-section, div[role="group"]');
        for (const c of containers) {
            const h = document.getElementById(c.getAttribute('aria-labelledby'))?.innerText || c.innerText || '';
            if (h.toLowerCase().includes(keyword)) {
                return c.querySelectorAll('[data-automation-id="DELETE_charm"], [id*="DELETE"]').length;
            }
        }
        return 0;
    }


    // ═══════════════════════════════════════════════
    // SECTION EXPANSION
    // ═══════════════════════════════════════════════

    async function expandSections(expCount, eduCount, skills, languages) {
        // Workday highly accurate counting
        const wdExp = document.querySelectorAll('[data-automation-id^="workExperience-"], [id^="workExperience-"], [id*="workExperience"]').length;
        const wdEdu = document.querySelectorAll('[data-automation-id^="education-"], [id^="education-"], [id*="education"]').length;
        const wdLang = document.querySelectorAll('[data-automation-id^="language-"], [id^="language-"], [id*="language"]').length;

        const existingExp = wdExp > 0 ? wdExp : countBlocksByDelete('experience');
        const existingEdu = wdEdu > 0 ? wdEdu : countBlocksByDelete('education');
        const existingLang = wdLang > 0 ? wdLang : countBlocksByDelete('language');

        console.log(`[AF] Existing blocks: exp=${existingExp}, edu=${existingEdu}, lang=${existingLang}`);

        // Target only buttons within the main content/form area to avoid site navigation (header/footer)
        const main = document.querySelector('[role="main"], main, article, .wd-WorkdayContent, form, #mainContent') || document.body;
        const btns = main.querySelectorAll('button, a, [role="button"]');
        let clicked = false;
        let doneExp = false, doneEdu = false, doneSkill = false, doneLang = false;

        for (const btn of btns) {
            // Is it in a header or nav? Skip it.
            if (btn.closest('header, nav, footer, .wd-header, .top-bar, .site-nav')) continue;
            if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue;
            let txt = (btn.getAttribute('aria-label') || btn.title || btn.innerText || btn.textContent || '').trim().toLowerCase();
            
            // If it's a generic "Add/Add Another" button, determine what it adds by looking at nearby headers
            if (txt === 'add' || txt === 'add another' || txt.startsWith('add another')) {
                let pr = btn.parentElement;
                while (pr && pr.tagName !== 'BODY') {
                    const h = pr.querySelector('h2, h3, h4, legend');
                    if (h) {
                        const ht = (h.innerText || h.textContent || '').toLowerCase();
                        if (ht.includes('experience') || ht.includes('job')) { txt = 'add work experience'; break; }
                        if (ht.includes('education') || ht.includes('school')) { txt = 'add education'; break; }
                        if (ht.includes('language')) { txt = 'add language'; break; }
                        if (ht.includes('skill')) { txt = 'add skill'; break; }
                    }
                    pr = pr.parentElement;
                }
            }

            if (txt.length > 60) continue;

            // ── WORK EXPERIENCE: Detect by contextual heading (Workday uses aria-labelledby="Work-Experience-section") ──
            if (!doneExp && expCount > 0) {
                const isExpBtn = P(txt, [/add.*work/i, /add.*experience/i, /add.*position/i, /add.*employment/i]) ||
                    // Workday "Add" button with Work Experience heading somewhere above it or in parent
                    (( txt === 'add' || txt === 'add another') && (() => {
                        const section = btn.closest('[aria-labelledby], .wd-section, .css-7t35fz, div[role="group"]');
                        if (section) {
                            const headingId = section.getAttribute('aria-labelledby');
                            const heading = headingId ? document.getElementById(headingId) : null;
                            const st = (heading?.innerText || heading?.textContent || section.innerText || section.textContent || '').toLowerCase();
                            if (/work\s*experience|work\s*exp|employment|position/i.test(st)) return true;
                        }
                        return false;
                    })());
                if (isExpBtn) {
                    doneExp = true;
                    // Count accurately BEFORE clicking: Look for unique experience block groupings
                    const getCount = () => {
                        const direct = document.querySelectorAll('[data-automation-id^="workExperience-"], [id^="workExperience-"]');
                        if (direct.length > 0) return direct.length;
                        // Fallback: look for delete buttons or distinct field sets
                        const deletes = document.querySelectorAll('[data-automation-id="DELETE_charm"], [id*="DELETE"]');
                        if (deletes.length > 0) return deletes.length;
                        // If we see any Experience-related input field, count as 1 block even if no container/delete button matches
                        const hasExpInputs = document.querySelector('input[data-automation-id*="jobTitle"], input[data-automation-id*="company"]');
                        return hasExpInputs ? 1 : 0;
                    };
                    
                    const n = Math.max(0, expCount - getCount());
                    console.log(`[AF] Exp btn: clicking ${n}x (need=${expCount} have=${getCount()})`);
                    for (let nIdx = 0; nIdx < n; nIdx++) { 
                        const before = getCount();
                        btn.click(); 
                        clicked = true; 
                        // Wait for new block to truly appear
                        await waitFor(() => getCount() > before, 5000);
                        await sleep(1000); 
                    }
                }
            }

            if (!doneEdu && eduCount > 0 && P(txt, [/add.*education/i, /add.*school/i, /add.*degree/i, /add.*academic/i])) {
                doneEdu = true;
                const getCount = () => {
                    const direct = document.querySelectorAll('[data-automation-id^="education-"], [id^="education-"]');
                    if (direct.length > 0) return direct.length;
                    const deletes = document.querySelectorAll('[data-automation-id="DELETE_charm"], [id*="DELETE"]');
                    if (deletes.length > 0) return deletes.length;
                    const hasEduInputs = document.querySelector('input[data-automation-id*="schoolname"], input[data-automation-id*="degree"], [data-automation-id*="education"] input');
                    return hasEduInputs ? 1 : 0;
                };

                const n = Math.max(0, eduCount - getCount());
                console.log(`[AF] Edu btn: "${txt}" clicking ${n}x (need=${eduCount} have=${getCount()})`);
                for (let i = 0; i < n; i++) { 
                    const before = getCount();
                    btn.click(); 
                    clicked = true; 
                    await waitFor(() => getCount() > before, 5000);
                    await sleep(1000); 
                }
            }

            if (!doneLang && languages && languages.length > 0 && P(txt, [/add.*language/i])) {
                doneLang = true;
                const getCount = () => {
                    const direct = document.querySelectorAll('[data-automation-id^="language-"], [id^="language-"]');
                    if (direct.length > 0) return direct.length;
                    const hasLangInputs = document.querySelector('[data-automation-id*="language"] input, [data-automation-id*="proficiency"] input, [aria-label*="language"]');
                    return hasLangInputs ? 1 : 0;
                };

                const n = Math.max(0, languages.length - getCount());
                console.log(`[AF] Lang btn: "${txt}" clicking ${n}x (need=${languages.length} have=${getCount()})`);
                for (let i = 0; i < n; i++) { 
                    const before = getCount();
                    btn.click(); 
                    clicked = true; 
                    await waitFor(() => getCount() > before, 5000);
                    await sleep(1200); 
                }
            }
        }

        if (clicked) {
            console.log("[AF] Sections expanded, waiting for layout cleanup...");
            await sleep(4000); 
        }
    }

    async function expandLinkSections(data) {
        const normalizeLink = (v) => {
            if (!v) return '';
            const s = String(v).trim();
            if (!s) return '';
            if (/^https?:\/\//i.test(s)) return s;
            if (/^(www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
            return '';
        };
        const allLinks = Array.from(new Set([
            normalizeLink(data?.portfolio_link || data?.website || data?.portfolio),
            normalizeLink(data?.linkedin_link),
            normalizeLink(data?.github_link)
        ].filter(Boolean)));

        const hasAnyLink = allLinks.length > 0;
        if (!hasAnyLink) return;

        const main = document.querySelector('[role="main"], main, article, .wd-WorkdayContent, form, #mainContent') || document.body;
        const detectDedicatedLinkField = (rx) => {
            const els = Array.from(main.querySelectorAll('input, textarea, select, [role="combobox"], [role="textbox"]'));
            return els.some(el => {
                const txt = [
                    getLabel(el) || '',
                    el.placeholder || '',
                    el.name || '',
                    el.id || '',
                    el.getAttribute('aria-label') || '',
                    el.getAttribute('data-automation-id') || ''
                ].join(' ').toLowerCase();
                return rx.test(txt);
            });
        };

        const hasDedicatedLinkedin = detectDedicatedLinkField(/linkedin/);
        const hasDedicatedGithub = detectDedicatedLinkField(/github|git\s*hub/);
        const websiteOnlyLinks = Array.from(new Set([
            normalizeLink(data?.portfolio_link || data?.website || data?.portfolio),
            hasDedicatedGithub ? '' : normalizeLink(data?.github_link),
            hasDedicatedLinkedin ? '' : normalizeLink(data?.linkedin_link)
        ].filter(Boolean)));

        const btns = Array.from(main.querySelectorAll('button, a, [role="button"]'));
        let clickedWebsite = false;
        let clickedSocial = false;

        for (const btn of btns) {
            if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue;
            if (btn.closest('header, nav, footer, .wd-header, .top-bar, .site-nav, .wd-Navigation')) continue;

            const txt = (btn.getAttribute('aria-label') || btn.title || btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (!/^(add|add\s+another|add\s+website|add\s+link|add\s+url)$/.test(txt)) continue;

            const section = btn.closest('[aria-labelledby], section, fieldset, .wd-section, div[role="group"]') || btn.parentElement;
            const headingId = section?.getAttribute?.('aria-labelledby');
            const heading = headingId ? document.getElementById(headingId) : null;
            const scopeText = ((heading?.innerText || heading?.textContent || '') + ' ' +
                (section?.querySelector?.('h1,h2,h3,h4,legend')?.innerText || '') + ' ' +
                (section?.innerText || '')).toLowerCase();

            const isWebsiteSection = /\bwebsites?\b|personal\s*site|portfolio/.test(scopeText);
            const isSocialSection = /social\s*network\s*urls?|social\s*links?/.test(scopeText);

            if (isWebsiteSection && !clickedWebsite) {
                // Create one row per available link for generic website sections.
                const existingRows = section ? section.querySelectorAll('input[type="url"], input[id*="url" i], input[name*="url" i], input[id*="website" i], input[name*="website" i], input[id*="link" i], input[name*="link" i]').length : 0;
                const targetRows = websiteOnlyLinks.length;
                const toClick = Math.max(0, targetRows - existingRows);
                for (let i = 0; i < toClick; i++) {
                    btn.click();
                    await sleep(350);
                }
                clickedWebsite = true;
                console.log(`[AF][link] Expanded Websites section via Add (${toClick}x, targetRows=${targetRows}, existingRows=${existingRows}, dedicatedLinkedIn=${hasDedicatedLinkedin}, dedicatedGitHub=${hasDedicatedGithub})`);
                await sleep(500);
            } else if (isSocialSection && !clickedSocial) {
                const socialRows = section ? section.querySelectorAll('input[type="url"], input[id*="linkedin" i], input[name*="linkedin" i], input[id*="github" i], input[name*="github" i]').length : 0;
                const needSocial = (!!normalizeLink(data?.linkedin_link) || !!normalizeLink(data?.github_link)) && socialRows === 0;
                if (needSocial) {
                    btn.click();
                    clickedSocial = true;
                    console.log('[AF][link] Expanded Social Links section via Add');
                    await sleep(500);
                } else {
                    clickedSocial = true;
                }
            }

            if (clickedWebsite && clickedSocial) break;
        }
    }

    /**
     * Count visible labels containing a SINGLE keyword.
     * Use ONE keyword per section to avoid multi-counting.
     */
    function countBlocks(keyword) {
        let count = 0;
        const els = document.querySelectorAll('label, legend, h2, h3, h4, h5');
        for (const el of els) {
            if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
            // Remove asterisk and colon, then trim
            let txt = (el.innerText || el.textContent || '').toLowerCase().replace(/[\*\:]/g, '').trim();
            // Strict exact match prevents double-counting partials like "Language" and "Language Fluency"
            if (txt === keyword || txt === keyword + ' name') count++;
        }
        return count;
    }


    // ═══════════════════════════════════════════════
    // VALUE SETTERS
    // ═══════════════════════════════════════════════

    /**
     * Native value setter bypass for React/Angular/Vue internal state trackers
     */
    function nativeSet(inp, v) {
        if (!['INPUT','TEXTAREA'].includes(inp.tagName)) return;
        try {
            // React 15/16+ Value Tracker Hack
            const tracker = inp._valueTracker;
            if (tracker) tracker.setValue(''); 
            
            const desc = Object.getOwnPropertyDescriptor(
                inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value'
            );
            if (desc && desc.set) desc.set.call(inp, v);
            else inp.value = v;
        } catch (e) {
            inp.value = v;
        }
    }

    /**
     * Set value on text input/textarea using multiple strategies for React compatibility
     */
    async function setInput(inp, value) {
        if (value === undefined || value === null || value === '') return;
        if (inp.type === 'checkbox' || inp.type === 'radio') return;
        if (!isElementInteractable(inp)) return;
        const v = String(value);

        console.log(`[AF][set] "${v.substring(0, 30)}" into ${inp.tagName}#${inp.id} [${getLabel(inp)}]`);

        // Phase 1: Force UI interaction
        try {
            inp.scrollIntoView({ block: 'center', behavior: 'instant' });
            inp.focus();
            if (typeof inp.select === 'function') inp.select();
            await sleep(150); // Important: wait for masks to clear or focus to settle to prevent first-char drops
            document.execCommand('delete', false, null);
            nativeSet(inp, ''); // Pre-clear for React
            await sleep(50);
        } catch(e){}

        // If focus cannot be moved to target (hidden/stale node), never type via execCommand.
        if (document.activeElement !== inp) {
            nativeSet(inp, v);
            fire(inp);
            return;
        }

        // Phase 2: React-Friendly Keystroke Simulation
        if (v.length < 150) {
            console.log(`[AF][set] typing "${v.substring(0,10)}..." into [${getLabel(inp)}]`);
            for (let i = 0; i < v.length; i++) {
                const char = v[i];
                const common = { key: char, charCode: char.charCodeAt(0), bubbles: true, cancelable: true };
                inp.dispatchEvent(new KeyboardEvent('keydown', common));
                inp.dispatchEvent(new KeyboardEvent('keypress', common));
                document.execCommand('insertText', false, char) || (inp.value = (inp.value || '') + char);
                inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
                inp.dispatchEvent(new KeyboardEvent('keyup', common));
                if (i % 4 === 0) await sleep(5); // Tiny micro-delay to let site process
            }
        } else {
            // Strategy 2: Fast fill for long text
            if (!document.execCommand('insertText', false, v)) {
                nativeSet(inp, v);
            }
        }

        // Phase 3: Validation Broadcast
        await sleep(50);
        fire(inp);
        await sleep(20);
        const ent = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
        inp.dispatchEvent(new KeyboardEvent('keydown', ent));
        inp.blur();
    }

    function isElementInteractable(el) {
        if (!el) return false;
        if (el.disabled) return false;
        if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
        if ('readOnly' in el && el.readOnly) return false;
        const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
        if (!(r.width > 0 || r.height > 0)) return false;
        const st = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
        return true;
    }

    async function setDateSegmentValue(inp, rawValue, tag) {
        if (rawValue === undefined || rawValue === null || rawValue === '') return;
        const v = String(rawValue);
        try {
            inp.focus();
            await sleep(40);
            if (typeof inp.select === 'function') inp.select();
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
            } catch (e) {}

            nativeSet(inp, '');
            inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
            nativeSet(inp, v);
            inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[AF][date-segment] ${tag}: "${v}" -> "${inp.value || ''}"`);
            await sleep(60);
        } catch (e) {
            console.warn(`[AF][date-segment] ${tag} failed`, e);
        }
    }

    async function setMonthControl(inp, monthNum) {
        const n = parseInt(monthNum, 10);
        if (!(n >= 1 && n <= 12)) return false;
        const months = [
            'January','February','March','April','May','June','July','August','September','October','November','December'
        ];
        const fullName = months[n - 1];
        const shortName = fullName.substring(0, 3);
        const mm = String(n).padStart(2, '0');

        if (await setSelect(inp, fullName, true)) return true;
        if (await setSelect(inp, shortName, true)) return true;
        if (await setSelect(inp, mm, true)) return true;
        await setInput(inp, fullName);
        return true;
    }

    async function setLocationCountry(inp, country) {
        const c = String(country || '').trim();
        if (!c) return false;

        const key = ((inp.id || '') + ' ' + (inp.name || '') + ' ' + (inp.getAttribute('data-automation-id') || '')).toLowerCase();
        const prefersPlain = key.includes('countrycode');

        if (!prefersPlain) {
            await setSelect(inp, c, true);
            await sleep(120);
        }

        let txt = readFieldText(inp).toLowerCase();
        const isDialOnly = /^\s*\+\d{1,4}\s*$/.test(txt) || (/\+\d{1,4}/.test(txt) && !txt.includes(c.toLowerCase()));
        if (prefersPlain || isDialOnly || !txt.includes(c.toLowerCase())) {
            await setInput(inp, c);
            await sleep(120);
            txt = readFieldText(inp).toLowerCase();
        }

        const ok = txt.includes(c.toLowerCase()) && !(/^\s*\+\d{1,4}\s*$/.test(txt));
        if (!ok) console.warn(`[AF][country] location country unresolved: expected=${c} got="${txt}"`);
        return ok;
    }

    function readFieldText(inp) {
        const scope = inp?.closest?.('[role="combobox"], [data-automation-id*="country" i], [id*="country" i]') || inp?.parentElement;
        return ((inp?.value || '') + ' ' + (scope?.innerText || '')).trim();
    }

    /**
     * Fill date input — ASYNC so calendar pickers complete before next field.
     * Handles: type=date, type=month, select, month/year calendar pickers, plain text.
     */
    async function fillDate(inp, value) {
        if (!value) return;
        const v = String(value).trim();
        if (/present|current|till/i.test(v)) return;

        const fieldMeta = {
            id: inp.id || '',
            name: inp.name || '',
            type: inp.type || '',
            label: getLabel(inp) || '',
            placeholder: inp.placeholder || '',
            valueBefore: inp.value || ''
        };
        console.log('[AF][date] Start field:', fieldMeta);

        // Hidden mirror inputs (common with masked widgets) cause duplicate fills/logs.
        if (!isVisibleInput(inp)) return;

        const t = (inp.type || '').toLowerCase();

        if (t === 'date') {
            const d = toISO(v); if (d) { nativeSet(inp, d); fire(inp); } return;
        }
        if (t === 'month') {
            const d = toISO(v); if (d) { nativeSet(inp, d.substring(0, 7)); fire(inp); } return;
        }
        if (inp.tagName === 'SELECT') { selectOpt(inp, v); return; }

        // Parse month and year
        const parsed = parseMonthYear(v);
        if (!parsed) {
            inp.focus(); inp.select();
            document.execCommand('insertText', false, v) || (nativeSet(inp, v), fire(inp));
            return;
        }

        console.log(`[AF][date] Parsed "${v}" → month=${parsed.month} year=${parsed.year}`);

        // Click the input to open the calendar picker
        inp.focus();
        inp.click();
        await sleep(200);

        // Find the picker popup
        const picker = findPicker(inp);
        if (!picker) {
            if (inp.offsetWidth === 0 || inp.offsetHeight === 0) return;

            const mm = String(parsed.month).padStart(2, '0');
            const yy = String(parsed.year);
            const dd = String(parsed.day || '01').padStart(2, '0');
            const label = (getLabel(inp) || '').toUpperCase() + (inp.placeholder || '').toUpperCase();
            const isDMY = label.includes('DD/MM/YYYY') || label.includes('DD-MM-YYYY') || label.includes('DAY');
            const masked = isMonthYearMaskedField(inp);
            console.log(`[AF][date] No picker. isDMY=${isDMY} masked=${masked} current="${inp.value || ''}"`);

            if (!isDMY || masked) {
                console.log('[AF][date] Using Segmented MM/YYYY Strategy');
                const ok = await typeMonthYearSegments(inp, parsed);
                if (ok) return;
                console.log('[AF][date] Segmented strategy failed, falling back to paste');
            }

            console.log('[AF][date] Using Clipboard-Paste Strategy');
            
            const fullVal = isDMY ? `${dd}/${mm}/${yy}` : `${mm}/${yy}`;
            
            try {
                // Focus ONLY once
                inp.focus(); 
                
                // Clear the mask thoroughly
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null); 
                for(let b=0; b<10; b++) inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
                
                await sleep(500); 

                // One-shot injection of the full date with slash
                console.log(`[AF][date] Pasting: ${fullVal}`);
                if (!document.execCommand('insertText', false, fullVal)) {
                    nativeSet(inp, fullVal);
                }
                
                fire(inp);
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(500);
                console.log(`[AF][date] Paste result value="${inp.value || ''}"`);
                inp.blur();
            } catch(e){
                console.error('[AF][date] Paste failed', e);
            }
            return;
        }

        console.log('[AF][date] Found picker, navigating...');

        // Step 1: Navigate to correct year
        await navigateToYear(picker, parsed.year);

        // Step 2: Click the month
        await sleep(200);
        clickMonth(picker, parsed.month);

        // Step 3: Wait for picker to close
        await sleep(400);

        // If picker is still visible, dismiss it
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        document.body.click();
        await sleep(200);
    }

    function isVisibleInput(inp) {
        if (!inp) return false;
        const r = inp.getBoundingClientRect();
        if ((r.width === 0 && r.height === 0) || inp.type === 'hidden') return false;
        const st = window.getComputedStyle ? window.getComputedStyle(inp) : null;
        if (!st) return true;
        return st.display !== 'none' && st.visibility !== 'hidden';
    }

    function isMonthYearMaskedField(inp) {
        const txt = [
            inp.placeholder || '',
            inp.value || '',
            getLabel(inp) || '',
            inp.getAttribute('aria-label') || '',
            inp.getAttribute('data-automation-id') || '',
            inp.name || '',
            inp.id || ''
        ].join(' ').toUpperCase();

        if (/DD\s*[\/\-]\s*MM\s*[\/\-]\s*YYYY/.test(txt)) return false;
        if (/MM\s*[\/\-]\s*YYYY/.test(txt)) return true;
        if (/\d{1,2}\s*[\/\-]\s*Y{2,4}/.test(txt)) return true;
        if (/\bMONTH\b/.test(txt) && /\bYEAR\b/.test(txt)) return true;
        return false;
    }

    async function typeMonthYearSegments(inp, parsed) {
        const mm = String(parsed.month).padStart(2, '0');
        const yy = String(parsed.year);
        const digits = `${mm}${yy}`;
        console.log(`[AF][date] Segment writer start. target=${mm}/${yy}, before="${inp.value || ''}"`);

        const insertAtCaret = (el, text) => {
            try {
                if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number' && typeof el.setRangeText === 'function') {
                    el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
                    return true;
                }
            } catch (e) {}
            return false;
        };

        const validateMonthYear = () => {
            const current = String(inp.value || '');
            const monthOk = new RegExp(`(^|\\D)${mm}(\\D|$)`).test(current);
            const yearOk = current.includes(yy);
            return { ok: monthOk && yearOk, current };
        };

        const pushChar = async (ch) => {
            const common = { key: ch, charCode: ch.charCodeAt(0), bubbles: true, cancelable: true };
            inp.dispatchEvent(new KeyboardEvent('keydown', common));
            inp.dispatchEvent(new KeyboardEvent('keypress', common));
            const inserted = document.execCommand('insertText', false, ch) || insertAtCaret(inp, ch);
            if (!inserted) inp.value = (inp.value || '') + ch;
            inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
            inp.dispatchEvent(new KeyboardEvent('keyup', common));
            await sleep(60);
        };

        const segmentVal = async (segment) => {
            console.log(`[AF][date] Inserting segment: ${segment}`);
            for (const ch of segment) await pushChar(ch);
        };

        const keyTap = async (key, code, keyCode) => {
            const evt = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true };
            inp.dispatchEvent(new KeyboardEvent('keydown', evt));
            inp.dispatchEvent(new KeyboardEvent('keyup', evt));
            await sleep(50);
        };

        inp.focus();
        await sleep(120);

        try {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
        } catch (e) {}
        nativeSet(inp, '');
        fire(inp);
        await sleep(120);
        console.log(`[AF][date] After clear value="${inp.value || ''}"`);

        // Primary strategy for masked controls: type only digits and let mask format MM/YYYY.
        for (const ch of digits) await pushChar(ch);
        let probe = validateMonthYear();
        console.log(`[AF][date] MMYYYY digits result: "${probe.current}"`);
        if (probe.ok) {
            fire(inp);
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(120);
            inp.blur();
            return true;
        }

        // If the mask ignored digit stream, retry with explicit segmented navigation.
        nativeSet(inp, '');
        fire(inp);
        await sleep(80);

        await segmentVal(mm);

        // Many masked fields need an explicit segment jump after MM.
        await pushChar('/');
        await keyTap('ArrowRight', 'ArrowRight', 39);
        await keyTap('Tab', 'Tab', 9);
        if (typeof inp.setSelectionRange === 'function') {
            const p = Math.max(3, (inp.value || '').length);
            try { inp.setSelectionRange(p, p); } catch (e) {}
        }
        await sleep(80);

        await segmentVal(yy);

        // Fallback: directly replace year segment if mask still shows placeholders.
        let current = String(inp.value || '');
        if (!current.includes(yy) && typeof inp.setSelectionRange === 'function' && typeof inp.setRangeText === 'function') {
            try {
                const slashIdx = current.indexOf('/');
                const yearStart = slashIdx >= 0 ? slashIdx + 1 : 2;
                const yearEnd = Math.max(yearStart + 4, current.length);
                inp.setSelectionRange(yearStart, yearEnd);
                inp.setRangeText(yy, yearStart, yearEnd, 'end');
                inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: yy }));
                await sleep(80);
                current = String(inp.value || '');
            } catch (e) {}
        }

        // Absolute fallback: force month/year ranges directly when mask keeps wrong values.
        if (typeof inp.setSelectionRange === 'function' && typeof inp.setRangeText === 'function') {
            try {
                let v = String(inp.value || '');
                let slashIdx = v.indexOf('/');
                if (slashIdx < 0) {
                    v = v.padEnd(7, '_');
                    nativeSet(inp, v.includes('/') ? v : `${v.substring(0,2)}/${v.substring(2,6)}`);
                    slashIdx = String(inp.value || '').indexOf('/');
                }
                if (slashIdx >= 0) {
                    inp.setSelectionRange(0, Math.min(2, slashIdx));
                    inp.setRangeText(mm, 0, Math.min(2, slashIdx), 'end');
                    const yStart = slashIdx + 1;
                    inp.setSelectionRange(yStart, yStart + 4);
                    inp.setRangeText(yy, yStart, yStart + 4, 'end');
                    inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: `${mm}/${yy}` }));
                    await sleep(60);
                    console.log(`[AF][date] Absolute range replace result: "${inp.value || ''}"`);
                }
            } catch (e) {
                console.warn('[AF][date] Absolute range replace failed', e);
            }
        }
        // Final Hard-Sync: force background validation to lock in the full date.
        for (let blast = 0; blast < 2; blast++) {
            fire(inp);
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(50);
        }
        
        await sleep(100);
        inp.blur();
        await sleep(50);
        
        const finalProbe = validateMonthYear();
        console.log(`[AF][date] Final Hard-Sync result: "${finalProbe.current}"`);
        return finalProbe.ok;
    }

    function parseMonthYear(v) {
        const moMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
        let m = v.match(/^([a-z]+)\s*(\d{4})$/i);
        if (m) { const mo = moMap[m[1].toLowerCase().substring(0,3)]; if (mo) return { month: mo, year: parseInt(m[2]) }; }
        m = v.match(/^(\d{4})\s*([a-z]+)$/i);
        if (m) { const mo = moMap[m[2].toLowerCase().substring(0,3)]; if (mo) return { month: mo, year: parseInt(m[1]) }; }
        m = v.match(/^(\d{4})-(\d{1,2})/);
        if (m) return { month: parseInt(m[2]), year: parseInt(m[1]) };
        m = v.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (m) return { month: parseInt(m[1]), year: parseInt(m[2]) };
        m = v.match(/^(\d{4})$/);
        if (m) return { month: 1, year: parseInt(m[1]) };
        return null;
    }

    function toISO(v) {
        if (!v || /present|current|till/i.test(v)) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        if (/^\d{4}-\d{2}$/.test(v)) return v + '-01';
        if (/^\d{4}$/.test(v)) return v + '-01-01';
        const a = v.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (a) return `${a[2]}-${a[1].padStart(2, '0')}-01`;
        const mo = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        const b = v.match(/^([a-z]+)\s*(\d{4})$/i);
        if (b) { const m = mo[b[1].toLowerCase().substring(0,3)]; if (m) return `${b[2]}-${m}-01`; }
        const c = v.match(/^(\d{4})\s*([a-z]+)$/i);
        if (c) { const m = mo[c[2].toLowerCase().substring(0,3)]; if (m) return `${c[1]}-${m}-01`; }
        return null;
    }

    /**
     * Find the visible calendar picker popup
     */
    function findPicker(inputEl) {
        // Strategy 1: CSS class selectors
        const sels = ['.react-datepicker','[class*="datepicker"]','[class*="date-picker"]',
            '[class*="calendar"]','[role="dialog"]','.popover'];
        for (const s of sels) {
            for (const p of document.querySelectorAll(s)) {
                if (p.offsetHeight > 0) return p;
            }
        }

        // Strategy 2: From input's ancestors
        let el = inputEl.parentElement;
        for (let d = 0; d < 6 && el; d++) {
            const p = el.querySelector('[class*="datepicker"],[class*="calendar"],[class*="picker"]');
            if (p && p.offsetHeight > 0) return p;
            el = el.parentElement;
        }

        // Strategy 3: Any visible div with month names
        for (const div of document.querySelectorAll('div')) {
            if (div.offsetHeight === 0) continue;
            const text = div.innerText || '';
            if (/Jan.*Feb.*Mar.*Apr/i.test(text) && text.length < 400) return div;
        }

        return null;
    }

    /**
     * Navigate to the target year by using the year <select> or clicking < > arrows.
     */
    async function navigateToYear(picker, targetYear) {
        // Try 1: Year is in a <select> dropdown
        const yearSel = picker.querySelector('select');
        if (yearSel) {
            const opt = Array.from(yearSel.options).find(o =>
                String(o.text).trim() === String(targetYear) || String(o.value).trim() === String(targetYear));
            if (opt) {
                yearSel.value = opt.value;
                fire(yearSel);
                console.log(`[AF][date] Year ${targetYear} set via <select>`);
                await sleep(300);
                return;
            }
            console.log(`[AF][date] Year ${targetYear} NOT in <select> options, using arrows`);
        }

        // Try 2: Click < or > arrows to reach the target year
        // First, read the current year from the picker
        const readYear = () => {
            for (const el of picker.querySelectorAll('*')) {
                const text = (el.innerText || '').trim();
                const m = text.match(/\b(19\d{2}|20\d{2})\b/);
                if (m && el.children.length <= 2 && text.length < 20) return parseInt(m[1]);
            }
            return null;
        };

        let currentYear = readYear();
        if (!currentYear) { console.log('[AF][date] Cannot read year'); return; }

        console.log(`[AF][date] Current: ${currentYear}, target: ${targetYear}`);

        if (currentYear === targetYear) return;

        // Find prev and next buttons
        let prevBtn = null, nextBtn = null;
        const btns = picker.querySelectorAll('button, [role="button"], a');
        for (const b of btns) {
            const t = (b.innerText || '').trim();
            if (t === '<' || t === '‹' || t === '«' || t === '◀' || /prev/i.test(t) ||
                /prev/i.test(b.className || '') || /prev/i.test(b.getAttribute('aria-label') || '')) {
                prevBtn = b;
            }
            if (t === '>' || t === '›' || t === '»' || t === '▶' || /next/i.test(t) ||
                /next/i.test(b.className || '') || /next/i.test(b.getAttribute('aria-label') || '')) {
                nextBtn = b;
            }
        }

        const btn = targetYear < currentYear ? prevBtn : nextBtn;
        if (!btn) { console.log('[AF][date] No prev/next button'); return; }

        // Click until we reach target year (max 20 clicks safety)
        for (let i = 0; i < 20; i++) {
            btn.click();
            await sleep(300);
            const nowYear = readYear();
            console.log(`[AF][date] After click: year=${nowYear}`);
            if (nowYear === targetYear) break;
            if (!nowYear) break;
        }
    }

    /**
     * Click the target month in the picker
     */
    function clickMonth(picker, targetMonth) {
        const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const target = monthNames[targetMonth - 1];

        const candidates = picker.querySelectorAll('div, span, td, button, a, [class*="month"]');
        for (const el of candidates) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if ((text === target || text.startsWith(target)) && el.children.length <= 1) {
                el.click();
                console.log(`[AF][date] Clicked month: "${text}"`);
                return;
            }
        }
        console.log(`[AF][date] Month "${target}" not found in picker`);
    }

    /**
     * Handle <select> and custom dropdowns intelligently
     */
    async function setSelect(inp, value, silent = false) {
        if (!value) return false;
        const v = String(value);

        if (inp.tagName === 'SELECT') {
            return selectFirst(inp, v);
        }

        // For non-<select> elements acting as dropdowns (Workday custom dropdowns)
        try { inp.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        try { inp.click(); } catch (e) {}
        
        // Dynamic wait for search box or popup options to appear
        await waitFor(() => {
            const sb = findVisibleSearchBox();
            if (sb && sb.offsetWidth > 0) return true;
            const opts = document.querySelectorAll('[role="option"], [data-automation-id*="Option"]');
            return Array.from(opts).some(o => o.offsetWidth > 0);
        }, 5000);
        
        // Strategy A: Check if a search box appeared in the topmost popup
        let searchBox = findVisibleSearchBox();
        if (searchBox && searchBox.offsetWidth > 0) {
            const sbLab = (getLabel(searchBox) + ' ' + searchBox.id + ' ' + (searchBox.getAttribute('data-automation-id') || '')).toLowerCase();
            const btnLab = (getLabel(inp) + ' ' + inp.id + ' ' + (inp.getAttribute('data-automation-id') || '')).toLowerCase();
            
            // Context Check: Ensure we're not typing into a leftover search box from another section
            const isClash = (btnLab.includes('state') && sbLab.includes('phone')) || 
                            (btnLab.includes('address') && sbLab.includes('phone')) ||
                            (btnLab.includes('phone') && (sbLab.includes('address') || sbLab.includes('university')));
            
            if (!isClash) {
                console.log(`[AF][DROP] Targeting search box for "${v}" in "${btnLab}"`);
                await setInput(searchBox, v);
                await sleep(800); 

                // Partial fallback for tricky search boxes
                const results = document.querySelectorAll('[role="option"], [data-automation-id*="Option"], [data-automation-id*="menuItem"]');
                let foundAny = Array.from(results).some(r => r.offsetWidth > 0);
                if (!foundAny && v.length > 5) {
                    const half = v.substring(0, 5);
                    await setInput(searchBox, half);
                    await sleep(1000);
                }

                let clicked = await tryCustomDropdown(v);
                
                // Fallback for Dialing Codes
                if (!clicked && P(sbLab, [/phone/i, /code/i, /isd/i, /dial/i])) {
                    const first = document.querySelector('[role="option"], [data-automation-id*="Option"], [role="menuitem"]');
                    if (first && (first.offsetWidth > 0 || first.offsetHeight > 0)) {
                        console.log(`[AF][DROP] Dialing Code Fallback: clicking first visible result`);
                        await clickRobust(first);
                        clicked = true;
                    }
                }

                if (clicked) {
                    const evt = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                    searchBox.dispatchEvent(new KeyboardEvent('keydown', evt));
                    searchBox.dispatchEvent(new KeyboardEvent('keyup', evt));
                    await sleep(300);
                    await dismissPopups();
                    return true;
                }
            } else {
                console.log(`[AF][DROP] Ignoring clashing search box for field ("${btnLab}")`);
            }
        }

        // Strategy B: No external search box found. Is the input ITSELF a text field?
        if (inp.tagName === 'INPUT' || inp.tagName === 'TEXTAREA') {
            console.log(`[AF][set] Typing directly into [${getLabel(inp)}] as no search box appeared`);
            await setInput(inp, v);
            await sleep(500);
            // If it triggered a dropdown anyway, try selection
            if (await tryCustomDropdown(v)) {
                await dismissPopups();
                try { inp.blur(); } catch (e) {}
                return true;
            }
            await dismissPopups();
            try { inp.blur(); } catch (e) {}
            return true;
        }

        // Strategy B: If no search box worked, try clicking the options directly in the dropdown
        if (!silent) console.log(`[AF][DROP] Opening custom dropdown [${getLabel(inp)}] with val="${v}"`);
        let clicked = await tryCustomDropdown(v);
        
        // Verification: If the dropdown is still "empty" (showing placeholder/nothing), try clicking the first result
        if (!clicked || inp.tagName === 'BUTTON') {
            await sleep(400);
            const curVal = (inp.innerText || inp.value || '').trim();
            // Stricter check: if it still has "Select", "*", or "..." it's probably empty
            if (!curVal || curVal.toLowerCase().includes('select') || curVal.includes('*') || curVal.includes('\u2026')) {
                console.log(`[AF][DROP] Verify failed for "${v}", retrying first visible result`);
                const options = document.querySelectorAll('[role="option"], [data-automation-id*="Option"], [data-automation-id*="promptOption"]');
                for (const opt of options) {
                    if (opt.offsetWidth > 0 || opt.offsetHeight > 0) {
                        await clickRobust(opt);
                        clicked = true;
                        break;
                    }
                }
            }
        }

        if (clicked || inp.tagName === 'BUTTON') {
            try { 
                await sleep(200);
                inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })); 
                document.body.click(); 
            } catch (e) {}
        }
        return clicked;
    }

    async function setPhoneCountryCode(inp, country) {
        const c = String(country || '').trim();
        if (!c) return false;

        const dialMap = {
            india: '+91'
        };
        const dial = dialMap[c.toLowerCase()] || '';
        const variants = Array.from(new Set([
            `${c} (${dial})`,
            `${c} (+`,
            c,
            dial
        ].filter(Boolean)));

        for (const v of variants) {
            await openPhoneCodeDropdown(inp);
            const picked = await pickVisibleOptionByText([v, `${c} (+`, c, dial].filter(Boolean));
            if (picked) {
                await sleep(180);
                if (verifyPhoneCodeSelection(inp, c, dial)) {
                    console.log(`[AF][phone] Country code selected via option: ${c}`);
                    return true;
                }
            }
        }

        // Fallback for controls that accept typed dial code token directly.
        const dialVariants = [dial, dial.replace('+', ''), c].filter(Boolean);
        for (const dv of dialVariants) {
            try {
                inp.focus();
                if (typeof inp.select === 'function') inp.select();
                nativeSet(inp, '');
                inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
                nativeSet(inp, dv);
                inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: dv }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(120);
                if (verifyPhoneCodeSelection(inp, c, dial)) {
                    console.log(`[AF][phone] Country code set via direct token: ${dv}`);
                    return true;
                }
            } catch (e) {}
        }

        console.warn(`[AF][phone] Failed to set country code for ${c}`);
        return false;
    }

    async function openPhoneCodeDropdown(inp) {
        try {
            inp.focus();
            inp.click();
        } catch (e) {}

        const root = inp.closest('[role="combobox"], [data-automation-id*="country" i], [id*="country" i], [data-automation-id*="phone" i], [id*="phone" i]') || inp.parentElement;
        if (root) {
            const toggles = root.querySelectorAll('button, [role="button"], [aria-haspopup="listbox"], [aria-expanded]');
            for (const t of toggles) {
                if (t.offsetWidth === 0 && t.offsetHeight === 0) continue;
                try { t.click(); } catch (e) {}
            }
        }

        await waitFor(() => {
            const visibleList = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="dialog"]')).some(el => el.offsetWidth > 0 || el.offsetHeight > 0);
            return visibleList;
        }, 1200);
        await sleep(120);
    }

    async function pickVisibleOptionByText(candidates) {
        const norms = candidates.map(v => String(v || '').toLowerCase()).filter(Boolean);
        if (norms.length === 0) return false;

        const selectors = [
            '[role="listbox"] [role="option"]',
            '[role="listbox"] [role="radio"]',
            '[role="option"]',
            '[role="radio"]',
            '[role="listbox"] label',
            '[role="listbox"] li',
            '[data-automation-id*="Option"]',
            '[data-automation-id*="menuItem"]'
        ];

        const elements = [];
        for (const s of selectors) {
            for (const el of document.querySelectorAll(s)) {
                if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
                const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (!txt) continue;
                elements.push({ el, txt });
            }
        }

        for (const n of norms) {
            for (const item of elements) {
                if (item.txt === n || item.txt.includes(n) || n.includes(item.txt)) {
                    await clickRobust(item.el);
                    return true;
                }
            }
        }
        return false;
    }

    function verifyPhoneCodeSelection(inp, country, dial) {
        const c = String(country || '').toLowerCase();
        const scope = ((inp?.value || '') + ' ' + (inp?.getAttribute?.('value') || '') + ' ' +
            (inp?.closest?.('[role="combobox"], [data-automation-id*="phone" i], [id*="phone" i], [data-automation-id*="country" i], [id*="country" i]')?.innerText || ''))
            .toLowerCase();

        const hasCountry = c && scope.includes(c);
        const hasDial = dial ? scope.includes(String(dial).toLowerCase()) : /\+\d{1,4}/.test(scope);
        return hasCountry || hasDial;
    }

    function selectFirst(sel, value) {
        if (!value) return false;
        const t = String(value).toLowerCase().trim();
        const opts = Array.from(sel.options);

        // Common mapping for degree/state/etc.
        const norm = {
            'b.e.':'bachelor','b.tech':'bachelor','btech':'bachelor','be':'bachelor',
            'b.a.':'bachelor','b.s.':'bachelor','b.sc':'bachelor','bsc':'bachelor',
            'm.e.':'master','m.tech':'master','mtech':'master',
            'm.a.':'master','m.s.':'master','m.sc':'master','msc':'master',
            'mba':'master','mca':'master',
            "bachelor's":'bachelor',"master's":'master',
            'bachelors':'bachelor','masters':'master',
            'phd':'doctorate','ph.d':'doctorate','doctor':'doctorate'
        };
        const n = norm[t] || t;

        let o = opts.find(x => x.text.toLowerCase().trim() === t || x.value.toLowerCase().trim() === t);
        if (!o && n !== t) o = opts.find(x => x.text.toLowerCase().trim() === n || x.value.toLowerCase().trim() === n);
        if (!o) o = opts.find(x => { const xt = x.text.toLowerCase(); return (xt.includes(t) || xt.includes(n)) && xt.length > 0 && x.value !== ''; });
        if (!o && t.length >= 3) o = opts.find(x => x.text.toLowerCase().startsWith(t.substring(0, 3)));

        if (o) {
            sel.value = o.value;
            fire(sel);
            console.log(`[AF][SEL] "${value}" → "${o.text}"`);
            return true;
        }
        return false;
    }

    function selectOpt(sel, value) { selectFirst(sel, value); }

    /**
     * Try clicking matching option in visible custom dropdowns
     * Only clicks non-empty options to avoid clearing fields
     */
    async function tryCustomDropdown(value) {
        if (!value) return false;
        const t = String(value).toLowerCase().trim();

        const sels = [
            '[role="listbox"] [role="option"]',
            '[role="listbox"] [role="radio"]',
            '[role="option"]',
            '[role="radio"]',
            '[role="listbox"] label',
            '[data-automation-id*="promptOption"]',
            '[data-automation-id*="menuItem"]',
            '[data-automation-id*="Option"]',
            'li[data-value]',
            '.dropdown-item',
            '[class*="option"]:not([class*="container"])',
            '.select-option',
            'div[role="button"] span'
        ];

        // RETRY LOOP for slow-loading custom dropdowns
        for (let attempt = 0; attempt < 4; attempt++) {
            const results = [];
            for (const s of sels) {
                const els = document.querySelectorAll(s);
                for (const el of els) {
                    if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
                    const et = (el.innerText || el.textContent || '').trim();
                    if (et) results.push({ el, text: et, lower: et.toLowerCase() });
                }
            }

            // 1. Precise match
            for (const r of results) {
                if (r.lower === t) {
                    console.log(`[AF][DROP] Exact match: "${r.text}"`);
                    await clickRobust(r.el); return true;
                }
            }
            // 2. Contains match
            for (const r of results) {
                if (r.lower.includes(t) || t.includes(r.lower)) {
                    console.log(`[AF][DROP] Context match: "${r.text}"`);
                    await clickRobust(r.el); return true;
                }
            }
            // 3. Fuzzy prefix match
            if (t.length >= 4) {
                for (const r of results) {
                    if (t.substring(0,4) === r.lower.substring(0,4)) {
                        console.log(`[AF][DROP] Fuzzy match: "${r.text}"`);
                        await clickRobust(r.el); return true;
                    }
                }
            }

            if (attempt < 3) await sleep(800);
        }
        return false;
    }

    async function smartSet(inp, value) {
        if (!value) return false;
        const isSel = inp.tagName === 'SELECT';
        const isCustomDrop = inp.getAttribute('aria-haspopup') === 'true' || inp.getAttribute('role') === 'combobox' || (inp.title || '').includes('Select');
        
        if (isSel || isCustomDrop) {
            return await setSelect(inp, value);
        }
        
        if (inp.tagName === 'INPUT' || inp.tagName === 'TEXTAREA') {
            await setInput(inp, value);
            await sleep(500); 
            // Try dropdown selection anyway for "searchable" inputs
            await tryCustomDropdown(value);
            return true;
        }
        
        return await setSelect(inp, value);
    }
    async function waitFor(predicate, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (predicate()) return true;
            await sleep(150);
        }
        return false;
    }


    // ═══════════════════════════════════════════════
    // CORE UTILITIES
    // ═══════════════════════════════════════════════

    async function clickRobust(el) {
        if (!el) return;
        try {
            el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            await sleep(100);
            
            // Framework-agnostic event sequence
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const common = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

            el.dispatchEvent(new MouseEvent('mousedown', common));
            el.dispatchEvent(new MouseEvent('mouseup', common));
            el.click();
            el.dispatchEvent(new PointerEvent('pointerdown', common));
            el.dispatchEvent(new PointerEvent('pointerup', common));
            
            // Special handling for nested radio/checkbox (common in Workday results)
            const radio = el.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]');
            if (radio) {
                radio.dispatchEvent(new MouseEvent('mousedown', common));
                radio.click();
                radio.dispatchEvent(new MouseEvent('mouseup', common));
            }
            
            fire(el); // Trigger change/input events
        } catch (e) {}
    }

    function fire(el) {
        if (!el) return;
        try {
            el.dispatchEvent(new Event('focus', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new InputEvent('input', { 
                bubbles: true, 
                inputType: 'insertText', 
                data: el.value 
            }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {}
        
        // Simulating the user pressing 'Enter' to trigger state updates/search confirmations
        const isTextInput = (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(el.type));
        if (isTextInput) {
            const enterEvt = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
            el.dispatchEvent(new KeyboardEvent('keydown', enterEvt));
            el.dispatchEvent(new KeyboardEvent('keypress', enterEvt));
            el.dispatchEvent(new KeyboardEvent('keyup', enterEvt));
        }
    }

    function boolFill(inp, value) {
        if (inp.type === 'checkbox' || inp.type === 'radio') {
            if (value === true && !inp.checked) { inp.click(); inp.checked = true; fire(inp); }
            else if (value === false && inp.checked) { inp.click(); inp.checked = false; fire(inp); }
        } else if (inp.tagName === 'SELECT') {
            selectOpt(inp, value === true ? 'Yes' : value === false ? 'No' : '');
        } else {
            setInput(inp, value === true ? 'Yes' : value === false ? 'No' : '');
        }
    }

    function getLabel(inp) {
        // 0. Priority: Data Automation ID (Usually stable and specific)
        const aid = inp.getAttribute('data-automation-id');
        if (aid) {
            const t = aid.replace(/[-_]/g, ' ').toLowerCase();
            // Filter out obvious values if the ID is just the value (unlikely but possible)
            if (t.length > 2 && !/^(true|false|yes|no)$/.test(t)) return t;
        }

        // 1. Label for ID
        if (inp.id) {
            try { 
                const l = document.querySelector(`label[for="${CSS.escape(inp.id)}"]`); 
                if (l && l.innerText.trim()) return l.innerText.trim(); 
            } catch (e) {}
        }

        // 2. Aria-labelledby
        const alid = inp.getAttribute('aria-labelledby');
        if (alid) {
            const l = document.getElementById(alid);
            if (l && l.innerText.trim()) return l.innerText.trim();
        }

        // 3. Aria-label (Check if it's not just the value)
        const al = inp.getAttribute('aria-label');
        if (al) {
            const t = al.trim();
            // If it's a button and aria-label includes its parent's text, it's probably the label
            if (inp.tagName === 'BUTTON' && t.length > 0) return t;
        }

        // 4. Closest label
        const pl = inp.closest('label');
        if (pl && pl.innerText.trim()) return pl.innerText.trim();

        // 5. Previous sibling
        let prev = inp.previousElementSibling;
        if (prev && ['LABEL','SPAN','DIV','P'].includes(prev.tagName)) {
            const t = prev.innerText?.trim(); 
            if (t && t.length > 1 && t.length < 80) return t;
        }

        // 6. Sibling within parent
        const par = inp.parentElement;
        if (par) {
            for (const c of par.children) {
                if (c === inp) continue;
                if (['LABEL','SPAN'].includes(c.tagName)) { 
                    const t = c.innerText?.trim(); 
                    if (t && t.length > 1 && t.length < 80) return t; 
                }
            }
        }

        return '';
    }

    function detectSection(inp) {
        let el = inp, d = 0;
        while (el && d < 12 && el.tagName !== 'BODY') {
            const a = ((el.className || '') + ' ' + (el.id || '') + ' ' +
                (el.getAttribute('data-section') || '') + ' ' +
                (el.getAttribute('data-automation-id') || '')).toLowerCase();
            if (/experience|work[-_\s]?exp|employ|job.?hist/i.test(a)) return 'experience';
            if (/education|academic|school|study|field\s*of|degree/i.test(a)) return 'education';
            if (/skill/i.test(a)) return 'skills';
            if (/language/i.test(a)) return 'language';
            if (/phone|tel\b|isd|dial/i.test(a) || a.includes('phonenumber')) return 'phone';
            if (/contact|personal|profile|identity/i.test(a) || a.includes('legalname') || a.includes('address')) return 'personal';

            for (const c of (el.children || [])) {
                if (/^H[1-5]$|^LEGEND$/.test(c.tagName)) {
                    const t = c.innerText?.toLowerCase() || '';
                    if (/work\s*experience|experience/i.test(t)) return 'experience';
                    if (/education/i.test(t)) return 'education';
                    if (/language/i.test(t)) return 'language';
                    if (/phone|tel\b|isd|dial/i.test(t)) return 'phone';
                    if (/contact|personal|profile|identity/i.test(t)) return 'personal';
                }
            }

            let s = el.previousElementSibling, sc = 0;
            while (s && sc < 5) {
                if (/^H[1-5]$|^LEGEND$/.test(s.tagName)) {
                    const t = s.innerText?.toLowerCase() || '';
                    if (/work\s*experience|experience|employment/i.test(t)) return 'experience';
                    if (/education|academic|school/i.test(t)) return 'education';
                    if (/language/i.test(t)) return 'language';
                    if (/phone|tel\b|isd|dial/i.test(t)) return 'phone';
                    if (/contact|personal|profile|identity/i.test(t)) return 'personal';
                }
                const h = s.querySelector?.('h1,h2,h3,h4,h5');
                if (h) {
                    const t = h.innerText?.toLowerCase() || '';
                    if (/work\s*experience|experience|employment/i.test(t)) return 'experience';
                    if (/education|academic|school/i.test(t)) return 'education';
                    if (/language/i.test(t)) return 'language';
                    if (/phone|tel\b|isd|dial/i.test(t)) return 'phone';
                    if (/contact|personal|profile|identity/i.test(t)) return 'personal';
                }
                s = s.previousElementSibling; sc++;
            }

            el = el.parentElement; d++;
        }
        return 'unknown';
    }

    async function dismissPopups() {
        try {
            document.body.click();
            const esc = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
            const expanded = document.querySelectorAll('[aria-expanded="true"], [role="combobox"][aria-expanded="true"]');
            for (const el of expanded) {
                el.dispatchEvent(new KeyboardEvent('keydown', esc));
                el.dispatchEvent(new KeyboardEvent('keyup', esc));
                if (el.tagName === 'BUTTON') document.body.click(); 
            }
            // Also dismiss any visible overlays
            const overlays = document.querySelectorAll('[role="dialog"], [role="listbox"], .modal');
            for (const o of overlays) {
                if (o.offsetWidth > 0) {
                    o.dispatchEvent(new KeyboardEvent('keydown', esc));
                }
            }
            await sleep(150);
        } catch(e) {}
    }

    async function forceCloseDropdown(anchorEl) {
        try {
            const esc = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
            const tab = { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true };

            const targets = [anchorEl, document.activeElement, anchorEl?.closest?.('[role="combobox"]')].filter(Boolean);
            for (const t of targets) {
                t.dispatchEvent(new KeyboardEvent('keydown', esc));
                t.dispatchEvent(new KeyboardEvent('keyup', esc));
            }

            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                try { document.activeElement.blur(); } catch (e) {}
            }

            // Move focus away from combobox/search input and trigger close.
            if (anchorEl) {
                anchorEl.dispatchEvent(new KeyboardEvent('keydown', tab));
                anchorEl.dispatchEvent(new KeyboardEvent('keyup', tab));
            }

            document.body.click();
            document.documentElement.click();
            const outside = document.elementFromPoint(8, 8);
            if (outside && outside !== anchorEl) {
                outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                outside.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }

            await sleep(120);
            const openListboxes = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"]')).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0).length;
            if (openListboxes > 0) {
                window.dispatchEvent(new KeyboardEvent('keydown', esc));
                window.dispatchEvent(new KeyboardEvent('keyup', esc));
                await sleep(120);
            }
        } catch (e) {}
    }

    function findVisibleSearchBox() {
        // Look within the most recently opened/visible overlays
        const overlays = Array.from(document.querySelectorAll('[role="dialog"], [role="listbox"], [role="menu"], .dropdown-menu, .modal'))
                         .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
        if (overlays.length > 0) {
            // Pick the last one (usually topmost in DOM)
            const top = overlays[overlays.length - 1];
            return top.querySelector('input[type="text"], input:not([type="hidden"]), [data-automation-id="searchBox"]');
        }
        return null;
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function P(text, patterns) { return patterns.some(p => p.test(text)); }
    function L(i, field, val) { console.log(`[AF][${i}] ${field}: "${val}"`); }

    /**
     * Get text from nearby elements (parent, previous siblings, adjacent labels).
     * Used for checkbox labels like "I currently work here" that aren't <label> elements.
     */
    function getNearbyText(inp) {
        const parts = [];
        // Previous sibling text
        let prev = inp.previousElementSibling;
        for (let i = 0; i < 3 && prev; i++) {
            const t = (prev.innerText || prev.textContent || '').trim();
            if (t && t.length < 100) parts.push(t);
            prev = prev.previousElementSibling;
        }
        // Parent text (excluding input's own text)
        const par = inp.parentElement;
        if (par) {
            for (const c of par.children) {
                if (c === inp) continue;
                const t = (c.innerText || c.textContent || '').trim();
                if (t && t.length < 100) parts.push(t);
            }
        }
        // Grandparent children text
        const gp = par?.parentElement;
        if (gp) {
            for (const c of gp.children) {
                if (c === par || c === inp) continue;
                const t = (c.innerText || c.textContent || '').trim();
                if (t && t.length < 100) parts.push(t);
            }
        }
        return parts.join(' ');
    }

    /**
     * Normalize degree abbreviations to full words for dropdown matching.
     * Returns the most common full form that will match select options.
     */
    function normalizeDegree(deg) {
        if (!deg) return '';
        const d = deg.toLowerCase().trim();
        const map = {
            'b.e.': 'Bachelor', 'b.e': 'Bachelor', 'be': 'Bachelor',
            'b.tech': 'Bachelor', 'b.tech.': 'Bachelor', 'btech': 'Bachelor',
            'b.a.': 'Bachelor', 'ba': 'Bachelor',
            'b.s.': 'Bachelor', 'b.s': 'Bachelor', 'bs': 'Bachelor',
            'b.sc': 'Bachelor', 'b.sc.': 'Bachelor', 'bsc': 'Bachelor',
            'b.com': 'Bachelor', 'bcom': 'Bachelor',
            'b.b.a': 'Bachelor', 'bba': 'Bachelor',
            "bachelor's": 'Bachelor', 'bachelors': 'Bachelor', 'bachelor': 'Bachelor',
            'm.e.': 'Master', 'm.e': 'Master', 'me': 'Master',
            'm.tech': 'Master', 'm.tech.': 'Master', 'mtech': 'Master',
            'm.a.': 'Master', 'ma': 'Master',
            'm.s.': 'Master', 'm.s': 'Master', 'ms': 'Master',
            'm.sc': 'Master', 'm.sc.': 'Master', 'msc': 'Master',
            'mba': 'Master', 'mca': 'Master', 'm.b.a': 'Master',
            "master's": 'Master', 'masters': 'Master', 'master': 'Master',
            'phd': 'Doctorate', 'ph.d': 'Doctorate', 'ph.d.': 'Doctorate', 'doctorate': 'Doctorate',
            'high school': 'High School', 'diploma': 'Diploma',
            'associate': "Associate's Degree"
        };
        return map[d] || deg;
    }

    /**
     * Normalize state names and abbreviations for dropdown matching.
     * Covers common India and US states.
     */
    function normalizeState(state) {
        if (!state) return '';
        const s = state.toLowerCase().trim();
        const map = {
            // India
            'ka': 'Karnataka', 'karnataka': 'Karnataka',
            'mh': 'Maharashtra', 'maharashtra': 'Maharashtra',
            'dl': 'Delhi', 'delhi': 'Delhi',
            'tg': 'Telangana', 'telangana': 'Telangana',
            'ts': 'Telangana',
            'ap': 'Andhra Pradesh', 'andhra pradesh': 'Andhra Pradesh',
            'tn': 'Tamil Nadu', 'tamil nadu': 'Tamil Nadu',
            'gj': 'Gujarat', 'gujarat': 'Gujarat',
            'up': 'Uttar Pradesh', 'uttar pradesh': 'Uttar Pradesh',
            'hr': 'Haryana', 'haryana': 'Haryana',
            'pb': 'Punjab', 'punjab': 'Punjab',
            // US
            'ca': 'California', 'california': 'California',
            'ny': 'New York', 'new york': 'New York',
            'tx': 'Texas', 'texas': 'Texas',
            'fl': 'Florida', 'florida': 'Florida',
            'wa': 'Washington', 'washington': 'Washington',
            'ma': 'Massachusetts', 'massachusetts': 'Massachusetts',
            'il': 'Illinois', 'illinois': 'Illinois'
        };
        // If it starts with IN- (Workday format for India)
        if (s.startsWith('in-')) {
            const sub = s.substring(3);
            return map[sub] || state;
        }
        return map[s] || state;
    }

})(); // End IIFE