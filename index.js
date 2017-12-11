const csvToGeoJson = (arr) => {
    "use strict";
    const data = [];
    arr.map((d, i) => {
        data.push({
            id: i,
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: [d.Longitude, d.Latitude]
            }
        });
    });
    return data;
};

const groupBy = (xs, key) => {
    return xs.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};

const timeComparator = (obj1, obj2) => {
    "use strict";
    if (obj1.Time === obj2.Time) return 0;
    if (obj1.Time > obj2.Time) return 1;
    if (obj1.Time < obj2.Time) return -1;
};

document.addEventListener("DOMContentLoaded", e => {
    "use strict";

    const mapboxTiles = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={token}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.mapbox-streets-v7',
        token: 'pk.eyJ1IjoibW9yZ29sdCIsImEiOiJjamEyamJrZmc4dmk0MnFxeW0yMGZnOTFiIn0.OIUNIIleqLQEf6Uu1EQqYw'
    });
    const filename = prompt("Type a path to gps CSV file:");
    // const filename = "data/test.csv";

    d3.csv(filename, data => {
        data.forEach(elem => {
            elem.Latitude = parseFloat(elem.Latitude);
            elem.Longitude = parseFloat(elem.Longitude);
            elem.Time = new Date(Date.parse(elem.Time));
            elem.Velocity = parseFloat(elem.Velocity);
            elem.Key = `${elem.SubscriptionID}_${elem.VehicleId}`
        });

        const routes = groupBy(data, 'Key');

        const keys = Object.keys(routes).filter(elem => !elem.endsWith("Overtaking point"));


        const aKey = keys[0];
        const bKey = keys[1];

        const a = routes[aKey].sort(timeComparator);
        const b = routes[bKey].sort(timeComparator);

        const a1 = a[0];
        const a2 = a[a.length - 1];
        const b1 = b[0];
        const b2 = b[b.length - 1];

        const map = L.map('demo')
            .addLayer(mapboxTiles)
            .setView([a1.Latitude, a1.Longitude], 20);


        const svg = d3
            .select(map.getPanes().overlayPane)
            .append("svg");

        const g = svg.append("g").attr("class", "leaflet-zoom-hide");

        let transform = d3.geo.transform({
            point: projectPoint
        });

        const d3path = d3.geo.path().projection(transform);


        const durationA = a2.Time - a1.Time;
        const durationB = b2.Time - b1.Time;
        let delayA = 0;
        let delayB = 0;
        if (a1.Time > b1.Time) {
            delayA = a1.Time - b1.Time;
        }
        if (b1.Time > a1.Time) {
            delayB = b1.Time - a1.Time;
        }
        const featuresA = {
            type: "FeatureCollection",
            features: csvToGeoJson(a)
        };
        const featuresB = {
            type: "FeatureCollection",
            features: csvToGeoJson(b)
        };

        const featuresAll = {
            type: "FeatureCollection",
            features: featuresA.features.concat(featuresB.features)
        };

        const ftA = featuresA.features;
        const ftB = featuresB.features;

        const markerA = g.append("circle")
            .attr("r", 7)
            .attr("id", "markerA")
            .attr("class", "travelMarker")
            .style("fill", "red")
            .style("opacity", "0.75");

        const markerB = g.append("circle")
            .attr("r", 7)
            .attr("id", "markerB")
            .attr("class", "travelMarker")
            .style("fill", "green")
            .style("opacity", "0.75");

        const toLine = d3.svg.line()
            .interpolate("expInOut")
            .x(d => applyLatLngToLayer(d).x)
            .y(d => applyLatLngToLayer(d).y);

        const linePathA = g.selectAll(".lineConnectA")
            .data([ftA])
            .enter()
            .append("path")
            .attr("class", "lineConnectA");

        const linePathB = g.selectAll(".lineConnectB")
            .data([ftB])
            .enter()
            .append("path")
            .attr("class", "lineConnectB");

        const endsA = g.selectAll(".endsA")
            // .data([ftA[0], ftA[ftA.length - 1]])
            .data(ftA)
            .enter()
            .append("circle", ".endsA")
            .attr("r", 7)
            .style("fill", "red")
            .style("opacity", "0.75");

        const endsB = g.selectAll(".endsB")
            // .data([ftB[0], ftB[ftB.length - 1]])
            .data(ftB)
            .enter()
            .append("circle", ".endsB")
            .attr("r", 7)
            .style("fill", "green")
            .style("opacity", "0.75");

        map.on("viewreset", reset);

        reset();
        transition();

        function reset() {
            const bounds = d3path.bounds(featuresAll);
            const topLeft = bounds[0];
            const bottomRight = bounds[1];

            endsA.attr("transform", d => {
                return `translate(${applyLatLngToLayer(d).x}, ${applyLatLngToLayer(d).y})`;
            });

            endsB.attr("transform", d => {
                return `translate(${applyLatLngToLayer(d).x}, ${applyLatLngToLayer(d).y})`;
            });

            markerA.attr("transform",
                () => {
                    const y = ftA[0].geometry.coordinates[1];
                    const x = ftA[0].geometry.coordinates[0];
                    return "translate(" +
                        map.latLngToLayerPoint(new L.LatLng(y, x)).x + "," +
                        map.latLngToLayerPoint(new L.LatLng(y, x)).y + ")";
                });

            markerB.attr("transform",
                () => {
                    const y = ftB[0].geometry.coordinates[1];
                    const x = ftB[0].geometry.coordinates[0];
                    return "translate(" +
                        map.latLngToLayerPoint(new L.LatLng(y, x)).x + "," +
                        map.latLngToLayerPoint(new L.LatLng(y, x)).y + ")";
                });

            svg.attr("width", bottomRight[0] - topLeft[0] + 500)
                .attr("height", bottomRight[1] - topLeft[1] + 500)
                .style("left", topLeft[0] - 50 + "px")
                .style("top", topLeft[1] - 50 + "px");

            linePathA.attr("d", toLine);
            linePathB.attr("d", toLine);

            g.attr("transform", "translate(" + (-topLeft[0] + 50) + "," + (-topLeft[1] + 50) + ")");
        }

        function transition() {
            linePathA.transition()
                .duration(durationA / 8)
                .ease("linear")
                .delay(delayA / 8)
                .attrTween("stroke-dasharray", tweenDashA);

            linePathB.transition()
                .duration(durationB / 8)
                .ease("expInOut")
                .delay(delayB / 8)
                .attrTween("stroke-dasharray", tweenDashB);
        }

        function tweenDashA() {
            return t => {
                const l = linePathA.node().getTotalLength();
                let interpolate = d3.interpolateString(`0,${l}`, `${l},${l}`);

                let markerA = d3.select("#markerA");
                let p = linePathA.node().getPointAtLength(t * l);
                markerA.attr("transform", `translate(${p.x}, ${p.y})`);
                return interpolate(t);
            }
        }

        function tweenDashB() {
            return t => {
                const l = linePathB.node().getTotalLength();
                let interpolate = d3.interpolateString(`0,${l}`, `${l},${l}`);

                let markerB = d3.select("#markerB");
                let p = linePathB.node().getPointAtLength(t * l);
                markerB.attr("transform", `translate(${p.x}, ${p.y})`);
                return interpolate(t);
            }
        }

        function applyLatLngToLayer(d) {
            const y = d.geometry.coordinates[1];
            const x = d.geometry.coordinates[0];
            return map.latLngToLayerPoint(new L.LatLng(y, x))
        }

        function projectPoint(x, y) {
            const point = map.latLngToLayerPoint(new L.LatLng(y, x));
            this.stream.point(point.x, point.y);
        }
    });
});