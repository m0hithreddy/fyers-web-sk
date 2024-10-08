chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => { 
        if (message.type === "command") {
            try {
                // Get exchange and symbol
                const [exchange, symbol] = getExchangeSymbol();
        
                // Get tick size
                const tick_size = await getTickSize(exchange, symbol);

                // Get current position for exchange:symbol
                const current_position = await getCurrentPosition(exchange, symbol);
        
                // Determine whether to add to position or to square off
                const [side, multiplier, atLimit] = parseCommand(message.data.command);
        
                if ((side === "buy" && current_position >= 0) || (side === "sell" && current_position <= 0)) {
                    // Add to position
        
                    // Get available fund
                    let availableFund = await getAvailableFund();
                    availableFund = Math.floor(availableFund * multiplier * 100) / 100;

                    if (availableFund <= 0) {
                        throw new Error("No funds available");
                    }
        
                    const leveragedFund = availableFund * (await getLeverage(exchange, symbol))
        
                    // Compute limit price, position size, order price
                    let limit_price, position_size, order_price
                    if (atLimit) {
                        limit_price = roundToNearest((await getLastCrossHair()).price, side === "buy", tick_size);

                        position_size = computePositionSize(
                            leveragedFund, exchange, side, limit_price
                        );

                        order_price = limit_price;
                    } else {
                        limit_price = getLimitPrice(side);

                        position_size = computePositionSize(
                            leveragedFund, exchange, side, getOrderPrice(limit_price, side, tick_size, 0)
                        );  // Worst case scenario.

                        order_price = getOrderPrice(limit_price, side, tick_size, tick_size);
                    }

                    if (position_size < 1) {
                        throw new Error("Not enough funds to take the position")
                    }
        
                    // Place limit order
                    await placeLimitOrder(exchange, symbol, side, order_price, position_size, true);
                } else {
                    // Square off
        
                    // Compute square off quantity
                    const so_quantity = Math.ceil(Math.abs(current_position) * multiplier);
                    
                    // Compute order price
                    let order_price;
                    if (atLimit) {
                        order_price = roundToNearest((await getLastCrossHair()).price, side === "buy", tick_size);
                    } else {
                        order_price = getOrderPrice(getLimitPrice(side), side, tick_size, tick_size);
                    }

                    // Place limit order
                    await placeLimitOrder(exchange, symbol, side, order_price, so_quantity, !atLimit);
                }
            } catch(err) {
                alert(err.message)
            }
        } else if (message.type === "health-metrics") {
            try {
                const [exchange, symbol] = getExchangeSymbol();
                const leverages_date = (await chrome.storage.local.get(["leverages"]))?.leverages?.for_date;
                const tickSizes_date = (await chrome.storage.local.get(["tickSizes"]))?.tickSizes?.for_date;
                
                if(!leverages_date) {
                    throw new Error("Leverages are not initalized")
                }
    
                sendResponse({
                    "status": "ok",
                    "message": "ok",
                    "data": {
                        "leverages": leverages_date,
                        "tickSizes": tickSizes_date,
                        "exchange": exchange,
                        "symbol": symbol,
                        "leverage": await getLeverage(exchange, symbol),
                        "tickSize": await getTickSize(exchange, symbol),
                        "topBid": getTopBid(),
                        "topAsk": getTopAsk(),
                        "availableFund": await getAvailableFund(),
                        "netPosition": await getCurrentPosition(exchange, symbol),
                        "atTime": (new Date()).toLocaleTimeString()
                    }
                });
            } catch(err) {
                sendResponse({
                    "status": "error",
                    "message": err.message
                });
            }
        }
    })();

    return true;
});
