// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your bot's main entry point to handle incoming activities.

const pc = require('./purecloud-chat');
const watson = require('./watson');



const { ActivityTypes, ActionTypes, TurnContext, CardFactory } = require('botbuilder');
var GREETING = false;


// The accessor names for the conversation data and user profile state property accessors.
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_PROFILE_PROPERTY = 'userProfile';

// Welcomed User property name
const WELCOMED_USER = 'welcomedUserProperty';


class EchoBot {
    /**
     *
     * @param {ConversationState} conversation state object
     */
    constructor(conversationState, userState) {
        // Creates a new state accessor property.
        // See https://aka.ms/about-bot-state-accessors to learn more about the bot state and state accessors
        //this.countProperty = conversationState.createProperty(TURN_COUNTER_PROPERTY);
        this.conversationData = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);
        this.userProfile = userState.createProperty(USER_PROFILE_PROPERTY);

        // The state management objects for the conversation and user state.
        this.conversationState = conversationState;
        this.userState = userState;


        //this.conversationState = conversationState;
    }
    /**
     *
     * Use onTurn to handle an incoming activity, received from a user, process it, and reply as needed
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(_adapter, turnContext) {
        // Handle message activity type. User's responses via text or speech or card interactions flow back to the bot as Message activity.
        // Message activities may contain text, speech, interactive cards, and binary or unknown attachments.
        // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types
        const userProfile = await this.userProfile.get(turnContext, {});
        let msg;


        if (turnContext.activity.type === ActivityTypes.Message) {
            // Update history
            if (this.conversationState.purecloud) {

                console.log('> route msg to purecloud');
                pc.sendMessageToPureCloud(turnContext.activity.text, this.conversationState.purecloud);
                console.log('should end here');

            } else if (this.conversationState.watson) {


                watson.sendMessage(turnContext.activity.text, _adapter, TurnContext.getConversationReference(turnContext.activity), this.conversationState)


            } else {
                //Bot logic

                if (!this.conversationState.history) {
                    this.conversationState.history = [];
                }

                this.conversationState.history.push('Customer:\t' + turnContext.activity.text);

                switch (turnContext.activity.text) {
                    case 'transfer':
                        pc.startChat(_adapter, TurnContext.getConversationReference(turnContext.activity), this.conversationState);
                        this.conversationState.history.push('Bot:\t\t\tvery interesting question, let me think about it...');
                        await turnContext.sendActivity(`very interesting question, let me think about it...`);
                        userProfile.purecloud = 'true';
                        break;
                    case 'hi':
                        if (!this.conversationState.bWelcome) {
                            this.conversationState.history.push('Bot:\t\t\tHello there, my Name is B.O.T');
                            await turnContext.sendActivity(`Hello there, my Name is B.O.T`);
                            this.conversationState.bWelcome = true;
                            break;
                        } else {
                            this.conversationState.history.push('Bot:\t\t\tIve already said hi to you, remember?');
                            await turnContext.sendActivity(`I've already said hi to you, remember?`);
                        }

                        break;
                    case '?':
                        this.conversationState.history.push('Bot:\t\t\tif you want to speak with a real person, just type transfer');
                        await turnContext.sendActivity(`if you want to speak with a real person, just type 'transfer'`);
                        break;
                    case '#history':
                        await turnContext.sendActivity(JSON.stringify(this.conversationState.history));
                        break;
                    case '#reset':
                        this.conversationState.history = undefined;
                        this.conversationState.bWelcome = undefined;
                        this.conversationState.watson = undefined;
                        GREETING = false;

                        await turnContext.sendActivity('reset done.');
                        break;

                    case '#watson':
                        this.conversationState.watson = true;
                        await turnContext.sendActivity(`IBM Watson activated`);
                        break;
                    case "card":

                        // Adaptive Card content

                        const buttons = [
                            { type: ActionTypes.ImBack, title: '1. Inline Attachment', value: '1' },
                            { type: ActionTypes.ImBack, title: '2. Internet Attachment', value: '2' },
                            { type: ActionTypes.ImBack, title: '3. Uploaded Attachment', value: '3' }
                        ];


                        // construct hero card.
                        const card = CardFactory.heroCard('', undefined,
                            buttons, { text: 'You can upload an image or select one of the following choices.' });

                        // add card to Activity.
                        const reply = { type: ActivityTypes.Message };
                        reply.attachments = [card];

                        // Send hero card to the user.
                        await turnContext.sendActivity(reply);
                        break;

                    case 'I am contacting you to get the latest on my order number.':
                        msg = 'Can you please provide your 10 digit order number starting ABCXXXXXXx?';
                        this.conversationState.history.push(`Bot:\t\t\t${msg}"`);
                        await turnContext.sendActivity(msg);
                        break;
                    case 'here it is ABC1234567':
                        msg = 'Please hold while check the details of your order number';
                        this.conversationState.history.push(`Bot:\t\t\t${msg}"`);
                        await turnContext.sendActivity(msg);

                        setTimeout(simulateOrderIssue, 2500, _adapter, TurnContext.getConversationReference(turnContext.activity), this.conversationState);
                        break;

                    default:
                        this.conversationState.history.push(`Bot:\t\t\tYou said "${turnContext.activity.text}"`);
                        await turnContext.sendActivity(`You said "${turnContext.activity.text}"`);
                        break;
                }

            }
        } else {
            // Generic handler for all other activity types.

            // Hardoded greeting (global for bot instance)
            if (!GREETING) {
                GREETING = true;
                await turnContext.sendActivity('Welcome to ABC company, how can I help you?');
            }

            //await turnContext.sendActivity(`[${turnContext.activity.type} event detected]`); -- default log
        }
        // Save state changes
        await this.conversationState.saveChanges(turnContext);

        await this.userProfile.set(turnContext, userProfile);
        await this.userState.saveChanges(turnContext);

    }
}

// send message to the bot + start PureCloud chat
// this is hardcoded simulation of 3rd party response
async function simulateOrderIssue(_adapter, _context, _conversationState) {
    await _adapter.continueConversation(_context, async (proactiveTurnContext) => {
        msg = 'There is a payment issue for the order so BOT will transfer this chat to an actual agent';
        _conversationState.history.push('Bot:\t\t\t' + msg);
        await proactiveTurnContext.sendActivity(msg);
        pc.startChat(_adapter, _context, _conversationState);
    });
}

exports.EchoBot = EchoBot;
