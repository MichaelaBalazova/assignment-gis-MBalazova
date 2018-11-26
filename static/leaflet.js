var map = L.map('map').setView([51.50767, -0.12797], 11);

map.attributionControl.addAttribution('<a href="https://www.mapbox.com/">Mapbox</a>');
map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/#map=2/34.2/71.5">OpenStreetMap</a>');

var acces_token = 'pk.eyJ1IjoiYmxpbmt5MTgybSIsImEiOiJjam9jNGxmN2kwdjdqM2ttcm1rdmZhdHJpIn0.m1j0lhgzAyIJ_qUxlRnx1A';
var mapboxlayer = L.tileLayer('https://api.mapbox.com/styles/v1/blinky182m/cjomoqaqd3ez22rqhe4m3wtwy/tiles/256/{z}/{x}/{y}?access_token='+acces_token);

map.addLayer(mapboxlayer);

var actualLatLng;
var myLayer;
var popup = L.popup();

var popupBlue = {
    "className" : "blue"
}

var popupYellow = {
    "className" : "yellow"
}

var popupGreen = {
    "className" : "green"
}

var popupRed = {
    "className" : "red"
}

function onMapClick(e) {
    actualLatLng = e.latlng;
    console.log(actualLatLng)

    popup
        .setLatLng(e.latlng)
        .setContent("Here I am!")
        .openOn(map)
}

map.on('click', onMapClick);

$("#allCafes").click(function(){
    $.get("/allCafes", function(data){
        data = JSON.parse(data)

        if (myLayer) { map.removeLayer(myLayer); }
        // myLayer = L.geoJson(data).addTo(map);

        myLayer = L.geoJson(data, {
            pointToLayer: function (feature, latlng){
                var options = {
                    fillColor: "#B7E2F0", radius: 8, color: "black", fillOpacity: 0.8,
                }
                return L.circleMarker(latlng, options);
            },

            onEachFeature: function (feature, layer) {
                layer.bindPopup("<h4>"+feature.properties.f1+"</h4>", popupBlue);
            }
        }).addTo(map);
    })
})

$("#allShoppingMalls").click(function(){
    $.get("/allShoppingMalls", function(data){
        data = JSON.parse(data)
        console.log(data)

        if (myLayer) { map.removeLayer(myLayer); }

        myLayer = L.geoJson(data, {
            pointToLayer: function (feature, latlng){
                var options = {
                    fillColor: "#ff0000", radius: 8, color: "black", fillOpacity: 0.9,
                }
                return L.circleMarker(latlng, options);
            },

            style: function(feature) {
                switch (feature.properties.f2) {
                    case 'mall': return {color: "#FFA293", fillOpacity: 0.8};
                }
            },

            onEachFeature: function (feature, layer) {
                if (feature.properties.f2 === 'mall') {
                    var area= Math.round(feature.properties.f3);
                    layer.bindPopup("<h4>" + feature.properties.f1 + "</h4><h6>" + feature.properties.f2 + "</h6><h6>area = " + area + " m2</h6>", popupRed);
                } else if (feature.properties.f2 === 'cafe') {
                    layer.bindPopup("<h4>" + feature.properties.f1 + "</h4><h6>" + feature.properties.f2 + "</h6>", popupRed);
                }

            }
        }).addTo(map);
    })
})

$("#findClosestCafes").click(function(){
    var distance = $("#dist").val();

    if (actualLatLng) {
        $.get("/findClosestCafes/" + actualLatLng + "/" + distance, function(data){
            data = JSON.parse(data)

            if (myLayer) { map.removeLayer(myLayer); }
            myLayer = L.geoJson(data, {
                pointToLayer: function (feature, latlng){
                    var options = {
                        fillColor: "yellow", radius: 8, color: "black", fillOpacity: 0.8,
                    }
                    return L.circleMarker(latlng, options);
                },

                onEachFeature: function (feature, layer) {
                    var dist= Math.round(feature.properties.f2);
                    layer.bindPopup("<h4>"+feature.properties.f1+"</h4><p>distance: "+dist+" m</p>", popupYellow);
                }
            }).addTo(map);
        })
        actualLatLng = null
    } else {
        alert("Please click on the map on your position")
    }
})

$("#findOneClosestCafe").click(function(){
    if (actualLatLng) {
        $.get("/findOneClosestCafe/" + actualLatLng, function(data){
            data = JSON.parse(data)

            if (myLayer) { map.removeLayer(myLayer); }

            myLayer = L.geoJson(data, {
                pointToLayer: function (feature, latlng){
                    var options = {
                        fillColor: "#cefdce", radius: 8, color: "black", fillOpacity: 0.8,
                    }
                    return L.circleMarker(latlng, options);
                },

                onEachFeature: function (feature, layer) {
                     var dist= Math.round(feature.properties.f2);
                    layer.bindPopup("<h4>"+feature.properties.f1+"</h4><p>distance: "+dist+" m</p>", popupGreen);
                }
            }).addTo(map);
        })
        actualLatLng = null
    } else {
        alert("Please click on the map on your position")
    }
})

$("#findRoadAndCafes").click(function(){
    if (actualLatLng) {
        $.get("/findRoadAndCafes/" + actualLatLng , function(data){
            data = JSON.parse(data)
            console.log(data)

            if (myLayer) { map.removeLayer(myLayer); }
            myLayer = L.geoJson(data, {
                pointToLayer: function (feature, latlng){
                    var options = {
                        fillColor: "yellow", radius: 8, color: "black", fillOpacity: 0.8,
                    }
                    return L.circleMarker(latlng, options);
                },

                onEachFeature: function (feature, layer) {
                    if (feature.properties.f2 === 'cafe') {
                        layer.bindPopup("<h4>" + feature.properties.f1 + "</h4><h6>" + feature.properties.f2 + "</h6>", popupYellow);
                    } else {
                        var lenght = Math.round(feature.properties.f3)
                        layer.bindPopup("<h4>" + feature.properties.f1 + "</h4><h6>" + feature.properties.f2 + " road</h6><h6>lenght = " + lenght + " m</h6>", popupYellow);
                    }
                }
            }).addTo(map);
        })
        actualLatLng = null
    } else {
        alert("Please click on the map on your position")
    }
})