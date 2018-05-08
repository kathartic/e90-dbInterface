'use strict'

// libraries
const MongoClient = require('mongodb').MongoClient;
const stitch = require("mongodb-stitch");
const mqtt = require('mqtt');
const _ = require('lodash');

// global vars
const dbName = "bikeshare";
const subscriptionName = "bikeshare/feed/";
const subscribeTopic = "bikeshare/feed/";

// the app id is given by the clients page on the stitch dashboard.
// TODO: consider not hardcoding this, idiot
const appId = "<your-stitch-app-id>";
const hostAddress = "<host-address>";
const clientPromise = stitch.StitchClientFactory.create(appId);
var bikeColl, userColl, locationColl, mqttClient; // TODO: maybe...don't call it a var.
const defaultUserObject = {
    uid: "<student-id>",
    firstName: "<first-name>",
    lastName: "<last-name>",
    bikeInUse: false,
    bikeId: "0",
    points: 0,
    fine: 0
};
const bikeObj = {
    bikeId: "<4-byte-id>",
    inUse: false,
    dueDate: new Date(),
    location: 1
};
const locationObj = {
    id: 1,
    inUse: true,
    stringName: '<string-name>',
    bikeId: "<4-byte-id>",
};

function main() {
    clientPromise.then(client => {
	const db = client.service("mongodb", "mongodb-atlas").db(dbName);
	bikeColl = db.collection("bikeData");
	userColl = db.collection("userData");
	locationColl = db.collection("locationData");
	console.log('connected to collections!');

	client.login().then(() => {
	    console.log('client logged in!');
	    mqttClient = mqtt.connect(hostAddress);
	    mqttClient.subscribe(subscriptionName + "+", null, (err, granted) => {
		if (err != null) {
		    console.error(`error: ${error} `);
		    process.exit(1);
		}
		
		mqttClient.on('message', handleCheckIn);
		console.log('connected to mqttclient!');
	    }); // subscribe to all esp8266 msgs
 	}); 
    });
}

/* params: string topic, Buffer msg (Node.js type), Byte[] packet 
 * does: given the topic name, processes the check in message. */
function handleCheckIn(topic, message, packet) {
    console.log(`message of length ${message.length} received from: ${topic}`);

    // extract location from topic name.
    const locationInt = _.parseInt(_.replace(topic, subscribeTopic, ''));
    if (_.isNaN(locationInt)) {
	console.log(`Expected integer, received ${_.replace(topic, subscribeTopic, '')}`);
	return; // don't want to do anything if incorrect location
    }

    if (message.length == 1) { // failure message. TODO: add 0 condition
	console.log("received failure to check in message.");
    } else if (message.length == 4) {
	const bytes = [0, 0, 0, 0];

	for (const pair of message.entries()) {	bytes[pair[0]] = byteToHexString(pair[1]); }

	const bikeId = _.join(bytes, ' ');

	checkBikeIntoDb(locationInt, bikeId, function(err) {
	    if (err) { console.error(`error: ${err}`); }
	});
    }
}

/* params: byte b
 * returns: string representation of the hex value of byte */
function byteToHexString(b) {
    var returnVal = "";
    if (b < 16) { returnVal += "0"; }
    returnVal += b.toString(16);
    return _.toUpper(returnVal);
}

/* params: int location, string bike id, callback function cb
 * does: using waterfall-like chaining, updates bike, user, and location collections not in that order. */
function checkBikeIntoDb(location, bikeId, cb) {
    console.log('checking bike into db now.');
    console.log(location);
    console.log(bikeId);
    bikeColl.updateOne( { bikeId }, { $set: { inUse: false, dueDate: new Date(), location } }, {}).then((res, err) => {
	if (err) { console.log(`Error: ${err} `); }
	else {
	    console.log(res);
	    locationColl.updateOne( { id: location }, { $set: { inUse: true } }, {}).then((res, err) => {
		if (err) { console.log(`Error: ${err} `); }
		else {
		    console.log(res);
		    userColl.updateOne( { bikeId }, { $set: { bikeInUse: false } }, {}).then((res, err) => {
			if (err) { console.log(`Error: ${err} `); }
			else { console.log(res); }
			cb(err);
 		    });
		}
	    });
	}
    });
}

/* inserts item into collection and checks for successful insertion. 
 * @param {Collection} coll
 * @param {Object} obj */
function insertItem(coll, obj) {
    coll.insertOne(obj).then((res, err) => {
	console.log('successfully inserted!');
	coll.findOne(obj, {}).then((res, err) => {
	    console.log(res);
	});
    });
}

/* params: none
 * does: resets all collections to their base item. very embarassing. */
function resetToBase() {
    clientPromise.then(client => {
	const db = client.service("mongodb", "mongodb-atlas").db(dbName);
	bikeColl = db.collection("bikeData");
	userColl = db.collection("userData");
	locationColl = db.collection("locationData");
	console.log('connected to collections!');

	client.login().then(() => {
	    console.log('client logged in!');
	    bikeColl.updateOne( { bikeId: bikeObj.bikeId }, bikeObj, {}).then((res, err) => {
		locationColl.updateOne( { id: locationObj.id }, locationObj, {}).then((res, err) => {
		    userColl.updateOne( { uid: defaultUserObject.uid }, defaultUserObject, {}).then((res, err) => {
			console.log('successfully updated object.');
			console.log(res);
 		    });
		});
	    });
 	}); 
    });
}

main();
//resetToBase();
