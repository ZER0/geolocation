/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental",
};

const { Cc, Ci, Cu } = require("chrome");

const { ns } = require("sdk/core/namespace");
const { Class } = require("sdk/core/heritage");
const { curry } = require("sdk/lang/functional");
const { merge } = require("sdk/util/object");

const { on, once, off, count, emit } = require('sdk/event/core');
const app = require("sdk/system/xul-app");

const { defer, promised } = require("sdk/core/promise");
const unload = require("sdk/system/unload");
const prefs =  require("sdk/preferences/service");
const doorhanger = require("doorhanger/doorhanger");

const geoservice = Cc["@mozilla.org/geolocation;1"]
                      .getService(Ci.nsIDOMGeoGeolocation);

let { id: addonId, name: addonName } = require("self");

let allowGeolocation = "extensions." + addonId + ".allowGeolocation";
let notificationMessage = addonName + " Add-on wants to know your location.";

// Unused atm.
const UNKNOWN_ERROR = 0;
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

const geolocations = ns();

function positionHandler(type, geo, value) {
  let { promise: allowed } = geolocations(geo).deferred;

  allowed.then(function () {
    emit(geo, type, value)
  })
}

function watchPosition(geo) {
  let geolocation = geolocations(geo);

  geolocation.id = geoservice.watchPosition(
    curry(positionHandler, "change", geo),
    curry(positionHandler, "error", geo),
    geolocation.options
  );
};

function clearWatch(geo) {
  geoservice.clearWatch(geolocations(geo).id);
};

function askPermission(geo) {

  let { resolve, reject } = geolocations(geo).deferred;

  let share = function(remember) {
    resolve();

    if (remember)
      prefs.set(allowGeolocation, true);
  }

  let notShare = function(remember) {
    reject();

    if (remember)
      prefs.set(allowGeolocation, false);
  }

  let shareAlways = curry(share, true);
  let neverShare = curry(notShare, true);

  let options = {
    text: notificationMessage,
  };

  if (app.is("Fennec")) {
    merge(options, {
      checkbox: "Don't ask again",

      mainAction: {
        label: "Share",
        callback: share
      },
      secondaryActions: [{
        label: "Not share",
        callback: notShare
      }]
    })
  } else {
    merge(options, {
      type: "geolocation",

      mainAction: {
        label: "Share Location",
        accessKey: "S",
        callback: share
      },

      secondaryActions: [
        {
          label: "Always Share",
          accessKey: "A",
          callback: shareAlways
        }, {
          label: "Never Share",
          accessKey: "N",
          callback: neverShare
        }
      ]
    })
  }

  doorhanger.notify(options);
}

const GeoLocation = Class({
  initialize: function initialize(options) {

    if (options.onChange)
      this.on("change", options.onChange);

    let geolocation = geolocations(this);

    if (options)
      geolocation.options = options;

    let deferred = defer();

    geolocation.deferred = deferred;

    if (prefs.has(allowGeolocation)) {
      prefs.get(allowGeolocation) ? deferred.resolve() : deferred.reject();
    } else
      askPermission(this);

    unload.when(function(){
      clearWatch(this)
    }.bind(this));
  },

  on: function(type, listener) {
    if (~["change", "error"].indexOf(type)) {
      if (!("id" in geolocations(this)))
        watchPosition(this);

      on(this, type, listener);
    }
  },

  once: function(type, listener) {
    if (~["change", "error"].indexOf(type)) {
      if (!("id" in geolocations(this)))
        watchPosition(this);

      once(this, type, listener);
    }
  },

  removeListener: function(type, listener) {
    if (~["change", "error"].indexOf(type)) {
      off(this, type, listener);

      if (count(this, "change") + count(this, "error") === 0)
        clearWatch(this);
    }
  },

  // Maybe `position` could have an optional `options` parameter that overrides
  // the default from constructor
  position: function() {
    let { resolve, reject, promise } = defer();
    let geolocation = geolocations(this);

     geolocation.deferred.promise.then(function() {
       geoservice.getCurrentPosition(resolve, reject, geolocation.options);
     })

    return promise;
  },

  permission: function() {
    geolocations(this).deferred = defer();

    askPermission(this);
  }
});

exports.GeoLocation = GeoLocation;
