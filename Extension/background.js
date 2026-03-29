const API = "http://localhost:5001";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "login") {
        fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: request.email, password: request.password })
        })
        .then(r => r.json())
        .then(data => {
            if (data.token) {
                chrome.storage.local.set({ token: data.token }, () => {
                   sendResponse({ success: true, token: data.token });
                });
            } else {
                sendResponse({ success: false, error: data.error || "Login failed" });
            }
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
        return true; 
    }

    if (request.action === "load_profile") {
        chrome.storage.local.get(['token'], (res) => {
            if (!res.token) {
                console.error("Background: No token found in storage.");
                return sendResponse({ success: false, error: "No token" });
            }
            
            console.log("Background: Fetching profile with token:", res.token ? res.token.substring(0, 10) + "..." : "MISSING");
            fetch(`${API}/get_resume_details`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${res.token}`
                },
                body: JSON.stringify({})
            })
            .then(async r => {
                if (r.status === 401) {
                    chrome.storage.local.remove(["token"]);
                    throw new Error("Unauthorized: Your session has expired. Please sign in again.");
                }
                return r.json();
            })
            .then(data => {
                if (data.error) sendResponse({ success: false, error: data.error });
                else {
                    chrome.storage.local.set({ profile: data }, () => {
                        sendResponse({ success: true, profile: data });
                    });
                }
            })
            .catch(e => {
                console.error("Background load_profile error:", e.message);
                sendResponse({ success: false, error: e.message });
            });
        });
        return true;
    }
});
