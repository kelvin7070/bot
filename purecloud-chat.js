
//#region require section

const request = require('request');                             // used to send https requests
const WebSocket = require('ws');                                // used to subscribe to web socket

//#endregion /require section

//#region PureCloud org settings

const organizationId = "f657a486-0a31-413f-bcf9-f453b0b3d6db";  // organizationId
const deploymentId = "25b1e995-6ce9-4a06-8c39-638121e56d95";    // deploymentId from PureCloud org definition
const queueName = "Region APAC - Partner Operations";                             // queueName where Chat will be routed
const env = 'mypurecloud.com';                                   // PureCloud environment (mypurecloud.com / mypurecloud.ie)

//#endregion /PureCloud org settings

// initiate a chat session with PureCloud
function startChat(_adapter, _context, _conversationState) {

    let myBody = {
        "organizationId": organizationId,
        "deploymentId": deploymentId,
        "routingTarget": {
            "targetType": "QUEUE",
            "targetAddress": queueName
        },
        "memberInfo": {
            "displayName": "Steve Jobs",
            "profileImageUrl": "https://banner2.kisspng.com/20181201/xes/kisspng-call-centre-customer-service-clip-art-computer-ico-homepage-vacuum-5c02fa4fe698b1.3075985415436990239445.jpg",
            "customFields": {
                "firstName": "Steve",
                "lastName": "Jobs"
            }
        }
    };

    let options = {
        url: 'https://api.' + env + '/api/v2/webchat/guest/conversations',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(myBody)
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);

            webSocket = new WebSocket(info.eventStreamUri);
            webSocket.on('open', function () {
                //Connection is open. Start the subscription(s)
                console.log('WebSocket opened');
            });

            webSocket.on('message', function (message) {
                var data = JSON.parse(message);

                // we do not care about channel.metadata informations. Ignore them
                if (data.topicName == 'channel.metadata') {
                    return;
                }

                try {
                    if (!_conversationState.purecloud) {
                        // do only once after chat session initated. Save particiapnt data and other required informations
                        _conversationState.purecloud = {};
                        _conversationState.purecloud.conversationId = data.eventBody.conversation.id;
                        _conversationState.purecloud.agentId = data.eventBody.member.id;
                        _conversationState.purecloud.botConversationId = _context.conversation.id;
                        _conversationState.purecloud.chatId = info.jwt;
                        console.log(stringify(data));

                        console.log('conversationId', _conversationState.purecloud.conversationId);
                        console.log('agentId', _conversationState.purecloud.agentId);

                        // Send history
                        sendMessageToPureCloud(buildHistory(_conversationState.history), _conversationState.purecloud);
                    }

                    // new message from purecloud received
                    if (data.metadata.type == 'message') {

                        // We do not want to display message from the bot again (echo)
                        // display only messages where senderId is different than current botId
                        if (data.eventBody.sender.id != _conversationState.purecloud.agentId) {
                            console.log('msg from pc', data.eventBody.body);
                            sendMessageToBot(_adapter, _context, data.eventBody.body);
                        }
                        // member-change event (detect DISCONNECT event)
                    } else if (data.metadata.type == 'member-change' && data.eventBody.member.id == _conversationState.purecloud.agentId && data.eventBody.member.state == 'DISCONNECTED') {
                        console.log('# chat disconnected, clear bot session');
                        _conversationState.purecloud = undefined;
                        sendMessageToBot(_adapter, _context, '[purecloud disconnected]');
                    }
                } catch (error) {
                    console.log(error);
                }
            });
        }
    });
};

// send message to the bot
async function sendMessageToBot(_adapter, _context, _msg) {
    await _adapter.continueConversation(_context, async (proactiveTurnContext) => {
        await proactiveTurnContext.sendActivity(_msg);
    });
}

// send message to the purecloud
function sendMessageToPureCloud(_msg, _data) {
    console.log('sendMessageToPureCloud');

    let myBody = {
        body: _msg,
        bodyType: 'standard'
    };

    let options = {
        url: 'https://api.' + env + '/api/v2/webchat/guest/conversations/' + _data.conversationId + '/members/' + _data.agentId + '/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'bearer ' + _data.chatId
        },
        body: JSON.stringify(myBody)
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            console.log('msg sent to pc:', _msg);

        } else {
            console.log(error);
        }
    });
}

// prepare chat history to be sent to the purecloud.
function buildHistory(_history) {
    let ret = '--- bot history ---\n'
    for (var _item in _history) {
        ret = ret + _history[_item] + '\n';
    }

    ret = ret + '--- bot history ---\n';
    return ret
}

module.exports = { startChat, sendMessageToPureCloud }