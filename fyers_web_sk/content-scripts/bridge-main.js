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
