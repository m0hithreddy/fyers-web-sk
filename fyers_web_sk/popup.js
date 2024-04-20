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
    const metrics = [
        "leverages", "tickSizes", "exchange", "symbol", "tickSize", "topBid",
        "topAsk", "availableFund", "netPosition"
    ];
    const fields = [
        ...metrics, "breakEvenWindow"
    ]
    const errorMsg = document.getElementById("errorMsg");
    const healthStatus = document.getElementById("healthStatus");

    // Reset the values
    for (let field of fields) {
        const element = document.getElementById(field);
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
        type: "health-metrics"
    });
    if (response.status === "ok") {
        let metricsData = response.data;
        for (let metric of metrics) {
            const element = document.getElementById(metric);
            element.innerHTML = metricsData[metric];
        }

        // Calculations

        // Break Even Window - Profits gone for charges (0.25%) - Round near to multiple's of tick size
        const breakEvenWindow = document.getElementById("breakEvenWindow");
        const tickSize = new Decimal(metricsData["tickSize"])

        const windowLow = new Decimal(metricsData["topAsk"]).times(new Decimal('0.9975')).dividedBy(tickSize).floor().times(tickSize);
        const windowHigh = new Decimal(metricsData["topBid"]).times(new Decimal('1.0025')).dividedBy(tickSize).ceil().times(tickSize);

        breakEvenWindow.innerHTML = `${windowLow} <=> ${windowHigh}`

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
