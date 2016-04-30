var express = require('express');
var request = require('request');
var bodyParser = require('body-parser')
const Wit = require('node-wit').Wit;

var app = express();

app.set('port', (process.env.PORT || 5000));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

var fb_page_token = "insert token here";
const WIT_TOKEN = "insert token here";
const validation_token = "insert token here"
const sessions = {};

const fbReq = request.defaults({
    uri: 'https://graph.facebook.com/me/messages',
    method: 'POST',
    json: true,
    qs: { access_token: fb_page_token },
    headers: {'Content-Type': 'application/json'},
});

const fbMessage = (recipientId, msg, cb) => {
    const opts = {
        form: {
            recipient: {
                id: recipientId,
            },
            message: {
                text: msg,
            },
        },
    };
    fbReq(opts, (err, resp, data) => {
        if (cb) {
            cb(err || data.error && data.error.message, data);
        }
    });
};

const findOrCreateSession = (fbid) => {
    let sessionId;
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        sessionId = new Date().toISOString();
        sessions[sessionId] = {fbid: fbid, context: {}};
    }
    return sessionId;
};

const actions = {
    say: (sessionId, context, message, cb) => {


        console.log(message);
        const recipientId = sessions[sessionId].fbid;

        if (recipientId) {
            fbMessage(recipientId, message, (err, data) => {
                if (err) {
                    console.log(
                        'Oops! An error occurred while forwarding the response to',
                        recipientId,
                        ':',
                        err
                    );
                }
                cb();
            });
        } else {
            console.log('Oops! Couldn\'t find user for session:', sessionId);
            // Giving the wheel back to our bot
            cb();
        }
    },
    merge: (sessionId, context, entities, message, cb) => {
        cb(context);
    },
    error: (sessionId, context, err) => {
        console.log(err.message);
    },
};


const client = new Wit(WIT_TOKEN, actions);

app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === validation_token) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(404);
    }
});

app.post('/webhook/', function (req, res) {
    console.log(req.body)


    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;

        const sessionId = findOrCreateSession(sender);

        if (event.message && event.message.text) {
            text = event.message.text;


            if (text === 'Generic') {
                sendGenericMessage(sender);
                continue;
            }
            // Handle a text message from this sender
            console.log(text)

            client.runActions(
                sessionId,
                text,
                sessions[sessionId].context,
                (e, context) => {
                    if (e) {
                        console.log('Oops! Got an error: ' + e);
                        return;
                    }else{
                        sessions[sessionId].context = context;
                    }
                });


        }
        if (event.postback) {
            text = JSON.stringify(event.postback);
            sendTextMessage(sender, "Postback received: "+text.substring(0, 200));
            continue;
        }
    }

    res.sendStatus(200);
});

function sendGenericMessage(sender) {
    messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [
                    {
                        "title": "First card",
                        "subtitle": "Element #1 of an hscroll",
                        "image_url": "http://messengerdemo.parseapp.com/img/rift.png",
                        "buttons": [{
                            "type": "web_url",
                            "url": "https://www.messenger.com/",
                            "title": "Web url"
                        }, {
                            "type": "postback",
                            "title": "Postback",
                            "payload": "Payload for first element in a generic bubble",
                        }],
                    }
                    , {
                        "title": "Second card",
                        "subtitle": "Element #2 of an hscroll",
                        "image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
                        "buttons": [{
                            "type": "postback",
                            "title": "Postback",
                            "payload": "Payload for second element in a generic bubble",
                        }],
                    }
                    , {
                        "title": "Second card",
                        "subtitle": "Element #2 of an hscroll",
                        "buttons": [{
                            "type": "postback",
                            "title": "Postback",
                            "payload": "Payload for second element in a generic bubble",
                        }],
                    }
                ]
            }
        }
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: fb_page_token},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData,
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}


function sendTextMessage(sender, text) {

    var messageData = {
        text: text
    };

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: fb_page_token},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData
        }
    }, function (error, response) {

        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

    });

}

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});


