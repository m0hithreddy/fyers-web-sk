document.addEventListener("Fyers_Web_Sk_show_tv_hl_request", function(event) {
    const eventData = event.detail;

    window.tvWidget.onChartReady(() => {
        const chart = window.tvWidget.activeChart();
        
        chart.dataReady(() => {
            let lineId = eventData.lineId;

            try {
                const line = chart.getShapeById(lineId);
                line.setPoints([{price: eventData.price}]);
            } catch {
                lineId = chart.createMultipointShape(
                    [{price: eventData.price}],
                    {
                        shape: "horizontal_line",
                        lock: true,
                        disableSave: true,
                        disableSelection: true,
                        overrides: {
                            linecolor: '#000000',
                            linestyle: 1,
                            linewidth: 1,
                            showPrice: false
                        }
                    }
                );
            }
            
            document.dispatchEvent(new CustomEvent(eventData.responseEvent, {detail: {lineId: lineId}}));
        });
    });
});

document.addEventListener("Fyers_Web_Sk_create_shape_request", function(event) {
    const eventData = event.detail;

    window.tvWidget.onChartReady(() => {
        const chart = window.tvWidget.activeChart();
        
        chart.dataReady(() => {
            const shapes = eventData.shapes;
            const shapeIds = [];
            for (let shape of shapes) {
                shapeIds.push(chart.createShape(...shape));
            }

            if (eventData['forceSave']) {
                window.tvWidget.saveChartToServer();
            }

            document.dispatchEvent(new CustomEvent(
                eventData.responseEvent,
                {detail: {shapeIds: shapeIds}}
            ));
        })
    });
});

document.addEventListener("Fyers_Web_Sk_delete_tv_entities_request", function(event) {
    const eventData = event.detail;

    window.tvWidget.onChartReady(() => {
        const chart = window.tvWidget.activeChart();

        chart.dataReady(() => {
            const result = [];
            for (let entityId of eventData.entityIds) {
                chart.removeEntity(entityId);
                result.push(true);
            }
            
            if (eventData['forceSave']) {
                window.tvWidget.saveChartToServer();
            }

            document.dispatchEvent(new CustomEvent(
                eventData.responseEvent,
                {detail: {result: result}}
            ));
        });
    });
});

document.addEventListener("Fyers_Web_Sk_check_shapes_exist_request", function(event) {
    const eventData = event.detail;

    window.tvWidget.onChartReady(() => {
        const chart = window.tvWidget.activeChart();

        chart.dataReady(() => {
            const result = [];
            for (let shapeId of eventData.shapeIds) {
                try {
                    chart.getShapeById(shapeId);
                    result.push(true);
                } catch {
                    result.push(false);
                }
            }

            document.dispatchEvent(new CustomEvent(
                eventData.responseEvent,
                {detail: {result: result}}
            ));
        });
    });
});
