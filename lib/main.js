const { GeoLocation } = require("./geolocation");

let geolocation = GeoLocation({
  onChange: function(position) {
    console.log(position.coords.latitude)
  }
});

geolocation.on("change", function onChange(position) {
  console.log(position.coords.latitude, position.coords.longitude);

  this.removeListener("change", onChange);
});

geolocation.on("error", function onError(error) {
  console.log("something appened: " + error)
});

geolocation.position().then(function(position){
  console.log("promised location: " + position.coords.latitude, position.coords.longitude)
})
