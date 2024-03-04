document.addEventListener("DOMContentLoaded", async () => {
    const tab = await getCurrentTab();
    if (tab.url !== "https://trade.fyers.in/") {
        const container = document.getElementsByClassName("container")[0];
        container.innerHTML = '<div class="inactive">This extension is inactive on this page.</div>';
        return;
    }

    refresh();
});

document.getElementById("refresh").addEventListener("click", refresh);

async function refresh() {
    const checks = [
        "leverages", "exchange", "symbol", "topBid",
        "topAsk", "availableFund", "netPosition"
    ];
    const errorMsg = document.getElementById("errorMsg");
    const healthStatus = document.getElementById("healthStatus");

    // Reset the values
    for (let check of checks) {
        const element = document.getElementById(check);
        element.innerHTML = "---";
    }
    errorMsg.style.display = "none";
    healthStatus.innerHTML = "Health Status @ --:--:--"

    // Disable the button
    refreshButton = document.getElementById("refresh");
    refreshButton.disabled = true;
    refreshButton.innerHTML = "Refreshing";
    
    // Stat the health data and populate corresponding fields.
    const response = await chrome.tabs.sendMessage((await getCurrentTab()).id, {
        type: "health-check"
    });
    if (response.status === "ok") {
        for (let check of checks) {
            const element = document.getElementById(check);
            element.innerHTML = response.data[check];
        }

        healthStatus.innerHTML = `Health Status @ ${response.data.atTime}`
    } else {
        errorMsg.innerHTML = response.message
        errorMsg.style.display = "block";
    }

    // Enable the button
    refreshButton.disabled = false;
    refreshButton.innerHTML = "Refresh";
}

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);

    return tab;
}
