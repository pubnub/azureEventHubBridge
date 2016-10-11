// This file Takes a PN Input, Sends it to EH1's input.  Then, anything that arrives on EH2's output is sent back out
// via PN Publish.  User-defined magic should happen between EH1 -> EH2, such as Stream Analytics, etc.

'use strict';

// PN Vars

var PNSubChannel = process.env['CUSTOMCONNSTR_PNSubChannel'];    // "bot_object";
var PNPubChannel = process.env['CUSTOMCONNSTR_PNPubChannel'];    // "bot-relay";
var PNPublishKey = process.env['CUSTOMCONNSTR_PNPublishKey'];    // "demo-36";
var PNSubscribeKey = process.env['CUSTOMCONNSTR_PNSubscribeKey'];  // "demo-36";

// Azure Vars

var EHInConnectionString  = process.env['CUSTOMCONNSTR_EHInConnectionString']; // 'Endpoint=sb://autonubeventhub.servicebus.windows.net/;SharedAccessKeyName=infromsubscriberhub;SharedAccessKey=533HJhCxZIynOV1xbQKBWgilDQ4euKRSUxWsbZBG1v4=;EntityPath=infrompnsubscriber';
var EHOutConnectionString = process.env['CUSTOMCONNSTR_EHOutConnectionString']; // 'Endpoint=sb://autonubeventhub.servicebus.windows.net/;SharedAccessKeyName=outtopublisherhub;SharedAccessKey=GjfSXpxyIvVWzB6+DEZj9amxBIf1QV9XfyRtaujbTzo=;EntityPath=outtopnpublisher'

console.log(PNSubChannel);
console.log(PNPubChannel);
console.log(PNPublishKey);
console.log(PNSubscribeKey);
console.log(EHInConnectionString);
console.log(EHOutConnectionString);
//console.log(process.env);


// Begin Logic!

var pubnub = require("pubnub")({
    ssl: true,
    publish_key: PNPublishKey,
    subscribe_key: PNSubscribeKey
});

var PNPublish = function(ehEvent) {
    console.log('Event Received from EHOutClient, Publishing via PubNub: ');
    console.log(JSON.stringify(ehEvent.body));
    console.log("");

    pubnub.publish({
        channel: PNPubChannel,
        message: ehEvent.body
    });
};

var receiveAfterTime = Date.now() - 0;

var EventHubClient = require('azure-event-hubs').Client;
var Promise = require('bluebird');


var printError = function (err) {
    console.log("Error: " + err.message);
};

/**************                                 Create the Ingress Path                                 */

var EHInClient = EventHubClient.fromConnectionString(EHInConnectionString);

// Create the EH Client
EHInClient.open()
    .then(EHInClient.getPartitionIds.bind(EHInClient))
    .catch(printError);

// Create the sender, and then, subscribe via PN, forwarding all messages to this new subscriber to the sender.

EHInClient.createSender().then(function(sender){
    pubnub.subscribe({
        channel: PNSubChannel,
        message: function (message) {
            console.log("Received and forwarding message: " + JSON.stringify(message, null, 4));
            sender.send(message);
        }
    })
});

/**************                                 Create the Egress Path                                 */

var EHOutClient = EventHubClient.fromConnectionString(EHOutConnectionString);

EHOutClient.open()
    .then(EHOutClient.getPartitionIds.bind(EHOutClient))
    .then(function (partitionIds) {
        return Promise.map(partitionIds, function (partitionId) {
            return EHOutClient.createReceiver('$Default', partitionId, { 'startAfterTime' : receiveAfterTime}).then(function (receiver) {
                receiver.on('errorReceived', printError);
                receiver.on('message', PNPublish);
            });
        });
    })
    .catch(printError);
