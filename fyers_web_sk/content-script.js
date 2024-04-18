chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => { 
        if (message.type === "command") {
            try {
                // Get exchange and symbol
                const [exchange, symbol] = getExchangeSymbol();
        
                // Get current position for exchange:symbol
                const current_position = await getCurrentPosition(exchange, symbol);
        
                // Determine whether to add to position or to square off
                const [side, multiplier] = parseCommand(message.data.command);
        
                if ((side === "buy" && current_position >= 0) || (side === "sell" && current_position <= 0)) {
                    // Add to position
        
                    // Get available fund
                    let availableFund = await getAvailableFund();
                    availableFund = Math.floor(availableFund * multiplier * 100) / 100;

                    if (availableFund <= 0) {
                        throw new Error("No funds available");
                    }
        
                    const leveragedFund = availableFund * (await getLeverage(exchange, symbol))
        
                    // Compute position size
                    const limit_price = getLimitPrice(side);

                    const positionSize = computePositionSize(
                        leveragedFund, exchange, side, getOrderPrice(limit_price, side, {sell_margin: 0})
                    );  // Worst case scenario.

                    if (positionSize < 1) {
                        throw new Error("Not enough funds to take the position")
                    }
        
                    // Place limit order
                    const order_price = getOrderPrice(limit_price, side);

                    await placeLimitOrder(exchange, symbol, side,order_price, positionSize);
                } else {
                    // Square off
        
                    // Compute square off quantity
                    const so_quantity = Math.ceil(Math.abs(current_position) * multiplier);

                    // Place limit order
                    const order_price = getOrderPrice(getLimitPrice(side), side);

                    await placeLimitOrder(exchange, symbol, side, order_price, so_quantity)
                }
            } catch(err) {
                alert(err.message)
            }
        } else if (message.type === "health-metrics") {
            try {
                const [exchange, symbol] = getExchangeSymbol();
                const leverages_date = (await chrome.storage.local.get(["leverages"]))?.leverages?.for_date;
                
                if(!leverages_date) {
                    throw new Error("Leverages are not initalized")
                }
    
                sendResponse({
                    "status": "ok",
                    "message": "ok",
                    "data": {
                        "leverages": leverages_date,
                        "exchange": exchange,
                        "symbol": symbol,
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

const FYERS_API_ROOT = "https://api-t1.fyers.in/trade/v3";

function getIFrameDocument() {
    try {
        return document.getElementById("tv_chart_container").getElementsByTagName("iframe")[0].contentWindow.document;
    } catch {
        throw new Error("Page load in progress");
    }
}

function getExchangeSymbol() {
    const iframe = getIFrameDocument();

    try {
        const exchange_symbol = iframe.getElementById("header-toolbar-symbol-search").getElementsByClassName("js-button-text")[0].innerHTML;
        let [exchange, ...symbol] = exchange_symbol.split(":");
        symbol = symbol.join(":"); 

        if (!exchange || !symbol) {
            throw "";
        }
    
        return [exchange, symbol];
    } catch {
        throw new Error("Error scraping exchange and symbol");
    }
}

async function getCurrentPosition(exchange, symbol) {
    try {
        const allPositions = (await (await fetch(`${FYERS_API_ROOT}/positions`, {
            "method": "GET",
            "headers": {
                "Authorization": getCookieValue("_FYERS")
            }
        })).json()).netPositions;
    
        const exchange_symbol = `${exchange}:${symbol}`;
        for (position of allPositions) {
            if (position.symbol == exchange_symbol) {
                return position.net_qty;
            }
        }
    
        return 0;
    } catch {
        throw new Error("Error getting current position");
    }
}

async function getAvailableFund() {
    try {
        const allFunds = (await (await fetch(`${FYERS_API_ROOT}/funds`, {
            "method": "GET",
            "headers": {
                "Authorization": getCookieValue("_FYERS")
            }
        })).json()).fund_limit;
    
        for (fund of allFunds) {
            if (fund.id === 19) {
                return Math.floor(fund.equityAmount * 100) / 100;
            }
        }
    
        return 0;
    } catch {
        throw new Error("Error getting available fund");
    }
}

function getCookieValue(name) {
    return document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)")?.pop() || "";
}

function parseCommand(command) {
    // Split the command into parts
    const [side, multiplierx] = command.split("-");

    return [side, parseFloat(multiplierx.split("x", 1)[0])];
}

async function placeLimitOrder(exchange, symbol, side, limit_price, quantity) {
    try {
        const fyers_id = (await (await fetch(`${FYERS_API_ROOT}/orders`, {
            "method": "POST",
            "headers": {
                "Content-type": "application/json; charset=UTF-8",
                "Authorization": getCookieValue("_FYERS")
            },
            "body": JSON.stringify({
                "disclosedQty": 0,
                "filledQty": 0,
                "limitPrice": limit_price,
                "noConfirm": true,
                "offlineOrder": false,
                "productType": "INTRADAY",
                "qty": quantity,
                "side": side === "buy" ? 1 : -1,
                "stopPrice": 0,
                "symbol": `${exchange}:${symbol}`,
                "type": 1,
                "validity": "DAY"
            })
        })).json()).id_fyers;

        if (!fyers_id) {
            throw "";
        }

        return fyers_id;
    } catch {
        throw new Error("Error placing limit order");
    }
}

async function getLeverage(exchange, symbol){
    try {
        const leverages = (await chrome.storage.local.get(["leverages"])).leverages;
        const exchange_symbol = `${exchange}:${symbol.split("-").slice(0, -1).join("-")}`;
        const leverage = leverages.exchanges_symbols[exchange_symbol];

        if (!leverage) {
            throw "";
        }

        return leverage;
    } catch {
        throw new Error("Error fetching leverage");
    }
}

function getTopBid() {
    const iframe = getIFrameDocument();

    try {
        const top_bid = parseFloat(
            iframe.getElementsByClassName("sellButton-hw_3o_pb")[0]
            .getElementsByClassName("buttonText-hw_3o_pb")[0]
            .innerHTML
        );

        if (!top_bid) {
            throw "";
        }

        return top_bid;
    } catch {
        throw new Error("Error scraping Top Bid");
    }
}

function getTopAsk() {
    const iframe = getIFrameDocument();

    try {
        const top_ask = parseFloat(
            iframe.getElementsByClassName("buyButton-hw_3o_pb")[0]
            .getElementsByClassName("buttonText-hw_3o_pb")[0]
            .innerHTML
        );
        
        if (!top_ask) {
            throw "";
        }

        return top_ask;
    } catch {
        throw new Error("Error scraping Top Ask");
    }
}

function getLimitPrice(side) {
    return side === "buy" ? getTopAsk() : getTopBid();
}

function getOrderPrice(limit_price, side, {buy_margin=0.05, sell_margin=0.05}={}) {
    return Math.round(
        (side === "buy" ? limit_price + buy_margin : limit_price - sell_margin) * 100
    ) / 100;
}

function computePositionSize(capital, exchange, side, price) {
    try {
        let [
            brokerage_rate, max_brokerage, ctt_rate, stt_rate, nse_exchange_rate, bse_exchange_rate,
            sebi_rate, stamp_rate, gst_rate, ipft_rate
        ] = [
            0.0003, 20, 0.0, 0.00025, 0.0000325, 0.0000375, 0.000001, 0.00003, 0.18, 0.000001
        ];
    
        // Change some rates based on input
        if (side === "buy") {
            stt_rate = 0.0;
        }
    
        let exchange_rate;
        if (exchange === "NSE") {
            exchange_rate = nse_exchange_rate;
        } else {
            exchange_rate = bse_exchange_rate;
            ipft_rate = 0.0;
        }
    
        const brokerage = Math.min(capital * brokerage_rate, max_brokerage);
    
        /*
        Rough calculations
        p*q + p*q*(stt+ctt+Xrate+IPFT+sebi+stamp) + brokerage + gst*(brokerage+p*q*(Xrate+IPFT+sebi)) = captial
        */
    
        const positionSize = (capital - (brokerage * (1 + gst_rate))) / (price * (1 + stt_rate + ctt_rate + stamp_rate + ((exchange_rate + ipft_rate + sebi_rate) * (1 + gst_rate))));
    
        return Math.floor(positionSize > 0 ? positionSize : 0);
    } catch {
        throw new Error("Error computing position size");
    }
}
