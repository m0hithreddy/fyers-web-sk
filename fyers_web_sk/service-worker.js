chrome.commands.onCommand.addListener(command => {
    (async () => {
        let tab = await getCurrentTab();
        if(!tab || tab.url !== "https://trade.fyers.in/") {
            return;
        }
    
        chrome.tabs.sendMessage(tab.id, {
            "type": "command",
            "data": {
                "command": command
            }
        });
    })();

    return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    (async () => {
        if (
            !changeInfo || changeInfo.status !== "complete" || !tab 
            || tab.url !== "https://trade.fyers.in/"
        ) {
            return;
        }
    
        // Initalize the leverages. Re-Fetch the leverages, if the date does not match.
        let leverages = (await chrome.storage.local.get(["leverages"])).leverages;
        const todayDate = new Date().toLocaleDateString();
    
        if (!leverages || leverages["for_date"] != todayDate) {
            const leveragesRaw = (await (await fetch(
                "https://public.fyers.in/website/margin-calculator/equity/eq_website_upload.json"
            )).json()).data;
            
            leverages = {
                "for_date": todayDate,
                "exchanges_symbols": {}
            };
            const exchanges_symbols = leverages["exchanges_symbols"];
    
            for (let ld of leveragesRaw) {
                exchanges_symbols[`${ld["exchange"]}:${ld["symbol"]}`] = ld["intraday_multiplier"]
            }
    
            // Store the leverages
            await chrome.storage.local.set({"leverages": leverages});
        }
    })();

    return true;
});

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);

    return tab;
}
