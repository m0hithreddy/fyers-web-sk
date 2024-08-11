// Mark Position Entry, Break Even and Stop Loss points

// Poll for any manual shape deletions
setInterval(async () => {
    let exchange, symbol;
    try {
        [exchange, symbol] = getExchangeSymbol();
    } catch {
        return;
    }
    
    const es = `${exchange}:${symbol}`;
    const marks = (await chrome.storage.local.get(["positionMarks"])).positionMarks;
    if (!marks || !marks[es]) {
        return;
    }

    const es_marks = marks[es];
    let changed = false;
    for (let i = 0; i < es_marks.length; ) {
        const es_mark = es_marks[i];
        const result = await checkShapesExist(Object.values(es_mark.markIds))
        if (result.includes(false)) {
            await deleteTvEntities(Object.values(es_mark.markIds));

            es_marks.splice(i, 1);
            changed = true;
        } else {
            i++;
        }
    }

    if (changed) {
        await chrome.storage.local.set({"positionMarks": marks});
    }
}, 1000); 

async function markPositionEntryBeSl(exchange, symbol, side, limit_price, quantity) {
    let marks = (await chrome.storage.local.get(["positionMarks"])).positionMarks;
    const es = `${exchange}:${symbol}`;
    const curr_time = Math.floor(Date.now() / 1000);

    // Inits
    if (!marks) {
        marks = {};
    }
    if (!(es in marks)) {
        marks[es] = [];
    }

    if (marks[es].length > 0) {
        // Found existing marks.
        const es_marks = marks[es];

        if (es_marks[0].side != side) {
            // Square off requested, iteratively delete existing position marks.
            // It is enough to check first entry because marks of different kind does'nt exist together.
            while (es_marks.length > 0 && quantity > 0) {
                const es_mark = es_marks[0];
                if (es_mark.quantity > quantity) {
                    es_mark.quantity = es_mark.quantity - quantity;
                    quantity = 0;
                    break;   
                }

                // Delete the current es_mark
                await deleteTvEntities(Object.values(es_mark.markIds))
                
                quantity = quantity - es_mark.quantity;
                es_marks.splice(0, 1);
            }
        }
    }

    if (quantity == 0) {
        // Exhuasted all the quantity. Save the position marks and return.
        await chrome.storage.local.set({"positionMarks": marks});
        return;
    }

    // Compute position related marks
    const tick_size = new Decimal(await getTickSize(exchange, symbol));
    const dlp = new Decimal(limit_price);
    var mark_data;
    if (side === "buy") {
        mark_data = {
            'time': curr_time,
            'entry': limit_price,
            'be': dlp.times(new Decimal('1.0025')).dividedBy(tick_size).ceil().times(tick_size).toNumber(),
            'sl': dlp.times(new Decimal('0.99')).dividedBy(tick_size).floor().times(tick_size).toNumber()
        }
    } else {
        mark_data = {
            'time': curr_time,
            'entry': limit_price,
            'be': dlp.times(new Decimal('0.9975')).dividedBy(tick_size).floor().times(tick_size).toNumber(),
            'sl': dlp.times(new Decimal('1.01')).dividedBy(tick_size).ceil().times(tick_size).toNumber()
        }
    }

    // Create marks
    const markIds = await showPositionEntryBeSl(mark_data);
    marks[es].push({
        exchange: exchange, symbol: symbol, side: side, quantity: quantity, markIds: markIds
    })

    // Persist in storage
    await chrome.storage.local.set({"positionMarks": marks});
}

function showPositionEntryBeSl(markData) {
    return new Promise((resolve, reject) => {
        const dynamicEvent = `Fyers_Web_Sk_${uuid.v4()}`;

        function handleShowPositionEntryBeSlResponse(event) {
            document.removeEventListener(dynamicEvent, handleShowPositionEntryBeSlResponse);
            const shapeIds = event.detail.shapeIds;

            resolve({entryId: shapeIds[0], beId: shapeIds[1], slId: shapeIds[2]});
        }

        document.addEventListener(dynamicEvent, handleShowPositionEntryBeSlResponse);
        document.dispatchEvent(new CustomEvent(
            "Fyers_Web_Sk_create_shape_request",
            {
                detail: {
                    responseEvent: dynamicEvent,
                    forceSave: true,
                    shapes: [
                        [
                            {time: markData.time, price: markData.entry},
                            {
                                shape: "icon", icon: 0xf10c, overrides: {size: 12, color: '#000000'}, zOrder: 'top'
                            }
                        ],
                        [
                            {time: markData.time, price: markData.be},
                            {
                                shape: "icon", icon: 0xf00c, overrides: {size: 12, color: '#000000'}, zOrder: 'top'
                            }
                        ],
                        [
                            {time: markData.time, price: markData.sl},
                            {
                                shape: "icon", icon: 0xf00d, overrides: {size: 12, color: '#000000'}, zOrder: 'top'
                            }
                        ]
                    ]
                }
            }
        ));
    });
}
