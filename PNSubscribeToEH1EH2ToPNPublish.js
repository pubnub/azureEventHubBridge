// This file Takes a PN Input, Sends it to EH1's input.  Then, anything that arrives on EH2's output is sent back out
// via PN Publish.  User-defined magic should happen between EH1 -> EH2, such as Stream Analytics, etc.

'use strict';

var PNSubChannel = "bot_object";
var PNPubChannel = "bot-relay";

var pubnub = require("pubnub")({
    ssl: true,  // <- enable TLS Tunneling over TCP
    publish_key: "demo-36",
    subscribe_key: "demo-36"
});

var PNPublish = function(ehEvent) {
    console.log('Event Received from EHOutClient, Publishing via PubNub: ');
    console.log(JSON.stringify(ehEvent.body));

    pubnub.publish({
        channel: PNPubChannel,
        message: ehEvent.body
    });
};

var receiveAfterTime = Date.now() - 5000;

var EventHubClient = require('azure-event-hubs').Client;
var Promise = require('bluebird');

var EHInConnectionString  = 'Endpoint=sb://autonubeventhub.servicebus.windows.net/;SharedAccessKeyName=infromsubscriberhub;SharedAccessKey=533HJhCxZIynOV1xbQKBWgilDQ4euKRSUxWsbZBG1v4=;EntityPath=infrompnsubscriber';
var EHOutConnectionString = 'Endpoint=sb://autonubeventhub.servicebus.windows.net/;SharedAccessKeyName=outtopublisherhub;SharedAccessKey=GjfSXpxyIvVWzB6+DEZj9amxBIf1QV9XfyRtaujbTzo=;EntityPath=outtopnpublisher'

var printError = function (err) {
    console.error(err.message);
};

var printEvent = function (ehEvent) {
    console.log('Event Received from EHIn: ');
    console.log(JSON.stringify(ehEvent.body));
};

/**************                                 Create the Ingress Path                                 */

var EHInClient = EventHubClient.fromConnectionString(EHInConnectionString);

// Create the EH Client
EHInClient.open()
    .then(EHInClient.getPartitionIds.bind(EHInClient))
    .then(function (partitionIds) {
        return Promise.map(partitionIds, function (partitionId) {
            return EHInClient.createReceiver('$Default', partitionId, { 'startAfterTime' : receiveAfterTime}).then(function (receiver) {
                receiver.on('errorReceived', printError);
                receiver.on('message', printEvent);
            });
        });
    })
    .catch(printError);

// Create the sender, and then, subscribe via PN, forwarding all messages to this new subscriber to the sender.

EHInClient.createSender().then(function(sender){
    pubnub.subscribe({
        channel: PNSubChannel,
        message: function (message) {
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
