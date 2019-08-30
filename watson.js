const watson = require('ibm-watson/assistant/v1');

const API_KEY = 'FsrdPHqUzpYyLKYe48WngwAGBHv5QMMbDv8ycYJZj_EW';
const URL = 'https://gateway.watsonplatform.net/assistant/api';//ttps://gateway-lon.watsonplatform.net/assistant/api';//https://gateway.watsonplatform.net/assistant/api
const WORKSPACE_ID = 'f07f8c74-fdc3-4145-8f63-5d32ab014ca2';
//const ASSISTANT_ID = 'cac0cd5f-2feb-40b4-b677-e9aac0fba067     


var myContext; // This is global. For PRD solution, myContext variable should be stored to the user conversation object.

const assistant = new watson({
    iam_apikey: API_KEY,
    version: '2019-02-28',
    url: URL
});


function sendMessage(_msg, _adapter, _context) {

    try {
        assistant.message({
            //assistant_id: ASSISTANT_ID,       
            workspace_id: WORKSPACE_ID,
            //session_id: sessionId,
            input: { 'text': _msg },
            context: myContext
        }, function (err, response) {
            if (err) {
                console.log('error:', err);
                sendMessageToBot(_adapter, _context, 'Ups, something goes wrong with Watson');
            }
            else {
                console.log(response);
                myContext = response.context;
                sendMessageToBot(_adapter, _context, response.output.text[0]);
            }

        });
    } catch (error) {
        console.log(error);
        sendMessageToBot(_adapter, _context, 'TryCatch - something goes wrong with Watson');
    }

}


// send message to the bot
async function sendMessageToBot(_adapter, _context, _msg) {
    await _adapter.continueConversation(_context, async (proactiveTurnContext) => {
        await proactiveTurnContext.sendActivity(_msg);
    });
}


module.exports = { sendMessage }
