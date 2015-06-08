"use strict";

const RECORD_FIELDS_TO_CLEAN = ["_status", "last_modified"];

export function cleanRecord(record, exludeFields=RECORD_FIELDS_TO_CLEAN) {
  return Object.keys(record).reduce((acc, key) => {
    if (exludeFields.indexOf(key) === -1)
      acc[key] = record[key];
    return acc;
  }, {});
};

const DEFAULT_REQUEST_HEADERS = {
  "Accept":       "application/json",
  "Content-Type": "application/json",
};

export default class Api {
  constructor(remote, options={}) {
    this.remote = remote;
    this._options = options;
    try {
      this.version = "v" + remote.match(/\/v(\d+)$/)[1];
    } catch (err) {
      throw new Error("Invalid remote: " + remote);
    }
  }

  get endpoint() {
    return {
      batch:          () => `/${this.version}/batch`,
      collection: (coll) => `/${this.version}/collections/${coll}/records`,
      record: (coll, id) => `${this.endpoint.collection(coll)}/${id}`,
    };
  }

  fetchChangesSince(collName, lastModified=null, options={headers: {}}) {
    var newLastModified;
    var queryString = "?" + (lastModified ? "_since=" + lastModified : "");
    return fetch(this.remote + this.endpoint.collection(collName) + queryString, {
      headers: Object.assign({}, DEFAULT_REQUEST_HEADERS, options.headers)
    })
      .then(res => {
        newLastModified = res.headers.get("Last-Modified");
        return res.json();
      })
      .then(json => {
        return {
          lastModified: newLastModified,
          changes: json.items
        };
      });
  }

  batch(collName, type, records, headers={}) {
    if (!records.length)
      return Promise.resolve([]);
    var method;
    switch(type) {
      case "create": method = "POST";   break;
      case "update": method = "PUT";    break;
      case "delete": method = "DELETE"; break;
    }
    return fetch(this.remote + this.endpoint.batch(), {
      method: "POST",
      headers: DEFAULT_REQUEST_HEADERS,
      body: JSON.stringify({
        defaults: {
          method:  method,
          headers: headers,
        },
        requests: records.map(record => {
          const path = type === "create" ?
            this.endpoint.collection(collName) :
            this.endpoint.record(collName, record.id);
          const body = type === "delete" ? undefined : cleanRecord(record);
          return { path: path, body: body }
        })
      })
    }).then(res => {
      // XXX do it better
      if (res.status !== 200)
        throw new Error("HTTP " + res.status);
      return res;
    });
  }
}
