if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", setupBreakEvenWindowPlotting);
} else {
    setupBreakEvenWindowPlotting();
}

function setupBreakEvenWindowPlotting() {
    const tvChartContainer = document.getElementById("tv_chart_container");
    
    // Wait for the first iframe element to appear
    const chartObserver = new MutationObserver(function(records, observer) {
        let iFrameFound = false;
        for (const record of records) {
            if (record.type === 'childList') {
                for (const node of record.addedNodes) {
                    if (node.tagName && node.tagName.toLowerCase() === 'iframe') {
                        iFrameFound = true;
                    }
                }
            }
        }
        
        // iframe element is not appeared yet! wait for more mutations.
        if (!iFrameFound) {
            return;
        }

        // iframe element appeared, disconnet from chartObserver and 
        // observe for bid and ask spans to appear
        observer.disconnect();

        const iframeDocument = getIFrameDocument();
        const iframeObserver = new MutationObserver(function(records, observer) {
            const bidSpan = iframeDocument?.getElementsByClassName("sellButton-hw_3o_pb")?.[0]?.getElementsByClassName("buttonText-hw_3o_pb")?.[0];
            const askSpan = iframeDocument?.getElementsByClassName("buyButton-hw_3o_pb")?.[0]?.getElementsByClassName("buttonText-hw_3o_pb")?.[0];
            
            if (!(bidSpan && askSpan)) {
                // bid and ask span did not appear yet! wait for more mutations
                return;
            }

            // bid and ask spans appeared, disconnect from iframeObserver and
            // setup break even window plotting.
            observer.disconnect();
            
            // Observe for top ask changes
            const windowHighLines = {};
            const askObserver = new MutationObserver(async (records) => {
                // Parse the ask value
                let ask;
                try {
                    ask = new Decimal(records[records.length - 1].target.textContent.trim());
                } catch {
                    return;
                }

                // Get exchange and symbol
                const [exchange, symbol] = getExchangeSymbol();
                if (!(exchange && symbol)) {
                    return;
                }
                const ticker = `${exchange}:${symbol}`;

                // Compute window high
                const tickSize = new Decimal(await getTickSize(exchange, symbol));
                const windowHigh = ask.times(new Decimal('1.0025')).dividedBy(tickSize).ceil().times(tickSize).toNumber();

                // Show trading view horizontal line
                windowHighLines[ticker] = await showTvHl(windowHighLines[ticker], windowHigh);
            });
            askObserver.observe(askSpan, {
                subtree: true,
                characterData: true,
                childList: true
            });
            
            // Observe for top bid changes
            const windowLowLines = {};
            const bidObserver = new MutationObserver(async (records) => {
                // Parse the bid value
                let bid;
                try {
                    bid = new Decimal(records[records.length - 1].target.textContent.trim());
                } catch {
                    return;
                }
                
                // Get exchange and symbol
                const [exchange, symbol] = getExchangeSymbol();
                if (!(exchange && symbol)) {
                    return;
                }
                const ticker = `${exchange}:${symbol}`;
                
                // Compute window low
                const tickSize = new Decimal(await getTickSize(exchange, symbol));
                const windowLow = bid.times(new Decimal('0.9975')).dividedBy(tickSize).floor().times(tickSize).toNumber();
                
                // Show trading view horizontal line
                windowLowLines[ticker] = await showTvHl(windowLowLines[ticker], windowLow);
            });
            bidObserver.observe(bidSpan, {
                subtree: true,
                characterData: true,
                childList: true
            });
        });
        iframeObserver.observe(iframeDocument, {
            childList: true,
            subtree: true
        });
    });
    chartObserver.observe(tvChartContainer, {
        childList: true,
        subtree: true
    });
}
