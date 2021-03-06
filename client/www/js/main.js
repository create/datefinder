var baseUrl = "http://d-api.herokuapp.com/";

var map;
var DIDSet;
var API_KEY = "AIzaSyA_3-FTpr5X41YFGR-xFHVZMbjcU-BJp1Q"; // google maps api key (jeff's acc)
var currentDID;
var addMarker; // marker for adding
var addinfowindow;
var dates = {};
var placesService;
var DEFAULT_ZOOM = 13;
var currentLocationMarker; // blue dot to show current location
var loadFromUrl = true; // flag whether to listen for hashchanges and update date

$(document).bind("mobileinit", function () {
    console.log("in mobileinit");
    $.support.cors = true;
    $.mobile.allowCrossDomainPages = true;
});

//gets a get parameter
function getParam(name){
    if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(window.location.href))
        return decodeURIComponent(name[1]);
}
function getDidFromUrl() {
    var did;
    if (did=(new RegExp('[#][a-z0-9]*')).exec(window.location.href))
        return did[0].substr(1);
}
function loadDateFromUrl(boolCenter) {
    if (loadFromUrl) {
        var getDid = getDidFromUrl();
        if (getDid) {
            if (boolCenter) {
                window.history.pushState({}, document.title, "#");
                currentDID = getDid;
                setTimeout(function() {
                    onDetailsLoad(boolCenter);
                }, 50);
            } else {
                currentDID = getDid;
                onDetailsLoad(boolCenter);
            }
            return;
        }

        /// DEPRECATED
        var legacyDid = getParam("did");
        if (legacyDid) {
            currentDID = legacyDid;
            onDetailsLoad(boolCenter);
        }
    }
}

// Show the main map with user's position and dates close to the user
$(document).ready(function() {
    console.log("current url: " + document.URL);
    DIDSet = new MiniSet();
    $(window).hashchange(function() {
        if (window.location.hash == "") {
            $('#dates-details-page').panel("close");
        } else {
            loadDateFromUrl(false);
        };
    });
    fixInfoWindow();
    showOnMap().always(function() {
        $('#loading').hide();
        $('#content').show();
        waitToLocate();
        loadDateFromUrl(true);
    });

    $( document ).on( "swipeleft swiperight", "#account-page", function (e) {
        // We check if there is no open panel on the page because otherwise
        // a swipe to close the left panel would also open the right panel (and v.v.).
        // We do this by checking the data that the framework stores on the page element (panel: open).
        if ($.mobile.activePage.jqmData( "panel" ) !== "open") {
            if ( e.type === "swipeleft"  ) {
                //$( "#right-panel" ).panel( "open" );
            } else if ( e.type === "swiperight" ) {
                $( "#account-panel" ).panel( "open" );
            }
        }
    });
    $('#addbutton').click(function() {
        $('#account-panel').panel("close");
    });
    $('#dates-details-page').panel({
        beforeclose: function(event, ui) {
            if (window.location.hash != "") {
                window.history.back();
            }
        }
    });

    $('#linkclick').click(function() {
        $('#linktext').show().val(addDidToUrl(window.location.href, currentDID)).select();
        $('#linkclick').hide();
        if (navigator.userAgent.indexOf('Mac OS X') != -1) {
            // mac
            toast("Hit Cmd+C now to copy the link.")
        } else {
            // pc
            toast("Hit Ctrl+C now to copy the link.")
        }
    });
    $('#flagclick').click(function() {
        var formData = {
            "did": currentDID
        };
        postReq(baseUrl + "addflag", formData, function(res) {
            toast("Flagged unhelpful. Thanks for the feedback.");
                console.log("successfully flagged");
        }).fail(function (err) {
            console.log("err flagging");
            toast(err.responseJSON.errors);
        });
    });
    $('img', $('#dpicture')).load(function() { $('#dpicture').fadeTo(300,1);});

});
function waitToLocate() {
    if (map == null) {
        setTimeout(waitToLocate, 50);
    } else {
        locate();
    }
}

// Draws a marker with the passed position on a map
var showOnMap = function(position) {
    var setup = function (response) {
        console.log("showing map");
        if (response.loc != undefined) {
            var loc = response.loc.split(',');
            var latitude = loc[0];
            var longitude = loc[1];
        } else {
            var latitude = "47.6097";
            var longitude = "-122.3331";
        }
        var myLatlng = new google.maps.LatLng(latitude, longitude);
        var location = latitude + "," + longitude;
        var mapOptions = {
            center: myLatlng,
            mapTypeControl: false,
            streetViewControl: false,
            panControl: false,
            zoomControl: false,
            //minZoom: 12,
            zoom: DEFAULT_ZOOM,
            tilt: 45
        };
        map = new google.maps.Map(document.getElementById("map_canvas"),
        mapOptions);
        placesService = new google.maps.places.PlacesService(map);
        var noPoi = [
        // {
        //     featureType: "poi",

        //     stylers: [
        //       { visibility: "simplified" }
        //     ]
        //   },
        {
          featureType: "road",

          stylers: [
            { visibility: "simplified" }
          ]
        }
        ];

        map.setOptions({styles: noPoi});

        google.maps.event.addListener(map, "idle", function (event) {
            getDates(map.getCenter(), map);
        });
        var deFocus = function() {
            $('#pac-input').blur();
        }
        google.maps.event.addListener(map, "dragstart", function (event) {
            // $('#locate img').attr("src", "img/geolocation.png");
            closePanels();
            deFocus();
        });
        google.maps.event.addListener(map, "click", function (event) {
            closePanels();
            deFocus();
        });

        getDates(myLatlng, map);

        // Create the search box and link it to the UI element.
        var input = /** @type {HTMLInputElement} */(
        document.getElementById('pac-input'));
        //map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

        var searchBox = new google.maps.places.SearchBox(
        /** @type {HTMLInputElement} */(input));

        // Listen for the event fired when the user selects an item from the
        // pick list. Retrieve the matching places for that item.
        google.maps.event.addListener(searchBox, 'places_changed', function() {
            var places = searchBox.getPlaces();
            var bounds = new google.maps.LatLngBounds();

            for (var i = 0, place; place = places[i]; i++) {
                var image = {
                    // url: place.icon,
                    size: new google.maps.Size(71, 71),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(17, 34),
                    scaledSize: new google.maps.Size(25, 25)
                };
                map.panTo(place.geometry.location);
                var zoom = map.getZoom();
                setTimeout(smoothZoom(map, DEFAULT_ZOOM, zoom), 150);
                bounds.extend(place.geometry.location);
            }
        });

        // Bias the SearchBox results towards places that are within the bounds of the
        // current map's viewport.
        google.maps.event.addListener(map, 'bounds_changed', function() {
            var bounds = map.getBounds();
            searchBox.setBounds(bounds);
        });

        // remove focus when user presses enter
        var pacInput = $('#pac-input');
        pacInput.keyup(function(e) {
            if (e.which === 13) {
                pacInput.blur();
            }
        }).focus(function (e) {
            pacInput.val('');
        });
    };
    return $.get("http://ipinfo.io/json", setup
    , "jsonp").fail(setup);
};

//closes panels to show map
function closePanels(force) {
    if ($(window).width() > 600 && !force) {
        $('#account-panel').panel("close");
    } else {
        $('.panel').panel("close");
    }
}

// gets all dates near LatLng position and displays them to map. called initially and when map is panned
var getDates = function(LatLng, map) {
    getReq(baseUrl+"getallnear/"+LatLng.lat()+","+LatLng.lng()+","+map.getZoom(),
    function (data, status) {
        var marker;
        for (var i = 0; i < data.dates.length; i++) {
            var current = data.dates[i];
            var did = current._id;
            if (!DIDSet.has(did)) {
                var name = current.name;
                var lat = current.loc[1];
                var lng = current.loc[0];
                DIDSet.add(did);
                dates[did] = current;
                var newDatePos = new google.maps.LatLng(lat, lng);
                marker = new google.maps.Marker({
                    position: newDatePos,
                    map: map,
                    title: name
                    //animation: google.maps.Animation.DROP
                });
                dates[did].marker = marker;
                var markerClickCallback = function (did) {
                    return function() {
                        currentDID = did;
                        $('#account-panel').panel("close");
                        onDetailsLoad();
                    };
                };
                google.maps.event.addListener(marker, 'click', markerClickCallback(did));
            }
        }
    });
};

var NUM_REVIEWS = 3; // max number of reviews to show initially

function addDidToUrl(url, did) {
    return url.split("#")[0] + "#" + did;
}

// accepts 0, 1, 2, 3 and returns Free, $, $$, $$
function priceToText(price) {
    if (price == 0) {
        return "Free";
    } else if (price == 1) {
        return "$";
    } else if (price == 2) {
        return "$$";
    } else if (price == 3) {
        return "$$$";
    }
}
// called when a marker is clicked. gets info and displays in panel
// if boolCenter is true it will center the map on this date ID marker if it exists
function onDetailsLoad(boolCenter) {
    loadFromUrl = false;
    if (window.location.hash == "") {
        // Adds to history
        window.location.hash = currentDID;
    } else {
        // Doesn't add to history
        window.history.replaceState({}, document.title, "#" + currentDID);
    }
    loadFromUrl = true;
    var currentDate = dates[currentDID];
    if (!currentDate) {
        getReq(baseUrl + "getdate/" + currentDID, function (res, status) {
            dates[currentDID] = res.date;
            currentDate = dates[currentDID];
            actuallyLoadDetails(currentDate, boolCenter);
        }).fail(function (err) {
            console.log("couldn't find date: " + currentDID);
            return;
        });
    } else {
        actuallyLoadDetails(currentDate, boolCenter);
    }
}

function actuallyLoadDetails(currentDate, boolCenter) {
    var list = $('#detailslist');
    var panel = $('#dates-details-page');
    $('.error', panel).text(""); // clear errors
    panel.panel("open");
    $('#linkclick', panel).show();
    $('#linktext', panel).hide();
    var res = {};
    res.date = currentDate;
    if (boolCenter) {
        var lat = res.date.loc[1];
        var lng = res.date.loc[0];
        setTimeout(function(){centerMap({coords: {latitude: lat, longitude: lng}}, true);}, 500);
    }
    var dplace = $('#dplace', panel);
    var oldName = dplace.text();

    $('#dname', panel).text(res.date.name);
    if (res.date.location_name) {
        $('#at', panel).show();
        dplace.show().text(res.date.location_name);
        dplace.attr("href", "");
        dplace.addClass("nopoint");
    } else {
        $('#at', panel).hide();
        dplace.hide();
    }
    var price = priceToText(res.date.price);
    $('#dprice', panel).text(price);
    if (res.date.materials) {
        $('#dmaterials', list).text(res.date.materials);
    } else {
        $('#dmaterials', list).text("Nothing to bring!");
    }
    $('#dreview', list).text(res.date.review);
    if (res.date.placesRef) {
        placesService.getDetails({key: API_KEY, reference: res.date.placesRef, sensor: true}, function (res, status) {
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                console.log("google getDetails sucess");
                if (oldName != res.name) {
                    $('#at', panel).show();
                    dplace.show().text(res.name);
                    dplace.attr("href", res.url);
                    dplace.removeClass("nopoint");
                    // get picture
                    if (res.photos && res.photos.length > 0) {
                        console.log("Found photo");
                        var picture = $('#dpicture', panel);
                        var newUrl = res.photos[0].getUrl({'maxWidth': 305, 'maxHeight': 500});
                        picture.fadeTo(300,0.30, function() {
                            picture.attr("href", res.url);
                            $('#dcont', panel).fadeIn(200);
                            $('img', picture).attr("src", newUrl);
                        });
                    } else {
                        $('#dcont', panel).fadeOut(200);
                    }
                }
            } else {
                console.log("error details");
            }
        });
    } else {
        console.log("no places ref");
        $('#dpicture').fadeOut();
    }
    save('reviews', null);
    getReviews();
    $('#review-form')[0].reset();
};

$("#filter-dates").bind("change", function() {
    var keyArray = DIDSet.keys();
    for (var i = 0; i < keyArray.length; i++) {
        var date = dates[keyArray[i]];
        if (parseInt(date.price) <= parseInt($('#filter-dates').val())) {
            //show
            if (date.marker.getMap() == null) {
                date.marker.setMap(map);
            }
        } else {
            //hide
            date.marker.setMap(null);
        }
    }
});

// called when user clicks on locate div
function locate() {
    //$('#locate img').attr("src", "img/geolocationblue.png");
    navigator.geolocation.getCurrentPosition(centerMap);
}
function centerMap(position, ignoreMarker) {
    var latitude = position.coords.latitude;
    var longitude = position.coords.longitude;
    var myLatlng = new google.maps.LatLng(latitude, longitude);
    if (!ignoreMarker) {
        if (!currentLocationMarker) {
            var infowindow = new google.maps.InfoWindow({
                content: 'You are here!',
                noSupress: true
            });
            currentLocationMarker = new google.maps.Marker({
                position: myLatlng,
                map: map,
                icon: {path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#33CCFF',
                    fillOpacity: 0.9,
                    strokeWeight: 2,
                    strokeColor: 'silver',
                scale: 8}
            });
            google.maps.event.addListener(currentLocationMarker, 'click', function() {
                infowindow.open(map,currentLocationMarker);
            });
        }
        currentLocationMarker.setPosition(myLatlng);
    }
    map.panTo(myLatlng);
    var zoom = map.getZoom();
    setTimeout(smoothZoom(map, DEFAULT_ZOOM, zoom), 150);
}

// EXTRA STUFF

function getReq(url, success) {
    return $.ajax({
        url: url,
        type: "GET",
        beforeSend: function(xhr){xhr.setRequestHeader('access', window.localStorage.userid)},
        success: success
    });
}
function postReq(url, data, success) {
    return $.ajax({
        url: url,
        type: "POST",
        data: data,
        beforeSend: function(xhr){xhr.setRequestHeader('access', window.localStorage.userid)},
        success: success
    });
}

function smoothZoom (map, max, cnt) {
    if (cnt >= max) {
        return;
    }
    else {
        z = google.maps.event.addListener(map, 'zoom_changed', function(event){
            google.maps.event.removeListener(z);
            smoothZoom(map, max, cnt + 1);
        });
        setTimeout(function(){map.setZoom(cnt)}, 80); // 80ms is what I found to work well on my system -- it might not work well on all systems
    }
}
function save (key, value) {
    window.localStorage[key] = value;
};

function toast(message) {
    $('#toast').text(message);
    $('#toast').fadeIn();
    setTimeout(function(){$('#toast').fadeOut("slow")}, 3500);
};

//infowindow POI fix:
function fixInfoWindow() {
    //If it is called for map option, we hide InfoWindow, if "noSupress" option isnt true.
    var set = google.maps.InfoWindow.prototype.set;
    google.maps.InfoWindow.prototype.set = function (key, val) {
        if (key === 'map') {
            if (!this.get('noSupress')) {
                if (addListener) {
                    var event = {latLng: this.position};
                    confirmPopup(event);
                }
                return;
            }
        }
        set.apply(this, arguments);
    }
};

function confirmPopup(event) {
    var lat = event.latLng.lat();
    var lng = event.latLng.lng();
    if (addMarker) {
        addMarker.setMap(null);
    }
    addMarker = new google.maps.Marker({
        position: new google.maps.LatLng(lat, lng),
        map: map,
        title: "Selected",
        animation: google.maps.Animation.DROP
    });
    setTimeout(function() {addinfowindow.open(map, addMarker);}, 300);
};

var getReviews = function() {
    $('#dates-details-page').animate({scrollTop:0}, '500', 'swing');
    var list = $('#detailslist');
    getReq(baseUrl+"getreviews/"+currentDID, function (res) {
        $('.review', list).remove();
        var moreReviewsBtn = $('#more-reviews');
        var reviews = res.date.reviews.reverse();
        if (reviews.length == 0) {
            list.append($('<li class="review">Nothing... yet!</li>'));
            moreReviewsBtn.hide();
        } else {
            for (var i = 0; i < Math.min(reviews.length, NUM_REVIEWS); i++) {
                appendReview(list, reviews[i]);
            }
            if (reviews.length > NUM_REVIEWS) {
                moreReviewsBtn.show();
                window.localStorage.reviews = JSON.stringify(reviews);
            } else {
                moreReviewsBtn.hide();
            }
        }
        list.listview("refresh");
    }).fail(function (err) {
        $(".error", list.parent()).text(err.responseJSON.errors);
    })
}

// Handler for clicking the more button to show more reviews
$('#more-reviews').click(function() {
    var reviews = JSON.parse(window.localStorage.reviews);
    var list = $('#bdetailslist');
    if (reviews) {
        for (var i = NUM_REVIEWS; i < reviews.length; i++) {
            appendReview(list, reviews[i]);
        }
    }
    list.listview("refresh");
    $('#more-reviews').hide();
});

function appendReview(list, myReview) {
    $('<li class="review"><q>'+myReview.review+'</q></li>').hide().appendTo(list).slideDown();
}

$('#review-form').submit(function (e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    var form = $('#review-form');
    $('.error', form).text("");
    var review = $('#add-review-texta').val();
    var formData = {
        "did": currentDID,
        "review": review
    };
    postReq(baseUrl + "addreview", formData, function(res) {
        $('#review-form')[0].reset();
        getReviews();
        console.log("successfully added review");
    }).fail(function(err) {
        $("#review-form .error").text(err.responseJSON.errors);
    });
});
