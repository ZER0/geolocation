/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci, Cu } = require("chrome");

const { ns } = require("api-utils/namespace");
const { Class } = require("api-utils/heritage");
const { EventTarget } = require("api-utils/event/target");
const { on, once, off, count, emit } = require('api-utils/event/core');

const { defer } = require("api-utils/promise");

const geoservice = Cc["@mozilla.org/geolocation;1"]
                      .getService(Ci.nsIDOMGeoGeolocation);

// Maybe exports them?
const UNKNOWN_ERROR = 0;
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

const watches = ns();

function positionChange(position) {
  emit(this, "change", position);
};

function positionError(error) {
  emit(this, "error", error);
};

function watchPosition(geo) {
  watches(geo).id = geoservice.watchPosition(
    positionChange.bind(geo),
    positionError.bind(geo),
    watches(geo).options);
};

function clearWatch(geo) {
  geoservice.clearWatch(watches(geo).id);
};

const GeoLocation = Class({
  extends: EventTarget,

  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);

    if (options)
      watches(this).options = options;
  },

  on: function(type, listener) {
    if (~["change", "error"].indexOf(type)) {
      if (!("id" in watches(this)))
        watchPosition(this);

      on(this, type, listener);
    }
  },

  once: function(type, listener) {
    if (~["change", "error"].indexOf(type)) {
      if (!("id" in watches(this)))
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

    geoservice.getCurrentPosition(resolve, reject, watches(this).options);

    return promise;
  }

});

exports.GeoLocation = GeoLocation;