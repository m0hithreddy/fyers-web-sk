// Load PapaParse library dynamically
importScripts("libs/papaparse.5.4.1.min.js")

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
    
        const todayDate = new Date().toLocaleDateString();

        // Initalize the leverages. Re-Fetch the leverages, if the date does not match.
        let leverages = (await chrome.storage.local.get(["leverages"])).leverages;
        
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

        // Intialize the tick sizes. Re-Fetch the tick sizes, if the date does not match
        let tickSizes = (await chrome.storage.local.get(["tickSizes"])).tickSizes;

        if (!tickSizes || tickSizes["for_date"] != todayDate) {
            const tickSizesRaw = await((await fetch(
                "https://public.fyers.in/sym_details/NSE_CM.csv"
            )).text());
            const tickSizesCsv = Papa.parse(tickSizesRaw).data;

            tickSizes = {
                "for_date": todayDate,
                "exchanges_symbols": {}
            };
            const exchanges_symbols = tickSizes["exchanges_symbols"];

            for (let row of tickSizesCsv) {
                if (row[4] == null || row[9] == null) {
                    continue
                }
                
                exchanges_symbols[row[9]] = parseFloat(row[4]);
            }

            // Store the tick sizes
            await chrome.storage.local.set({"tickSizes": tickSizes});
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
