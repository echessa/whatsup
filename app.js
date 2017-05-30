var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var temp = "";
var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.listen((process.env.PORT || 3000));

// Server index page
app.get("/", function (req, res) {
  res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
  if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
    console.log("Verified webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Verification failed. The tokens do not match.");
    res.sendStatus(403);
  }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
  // Make sure this is a page subscription
  if (req.body.object == "page") {
    // Iterate over each entry
    // There may be multiple entries if batched
    req.body.entry.forEach(function(entry) {
      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.postback) {
          processPostback(event);
        }
      });
    });

    res.sendStatus(200);
  }
});

function processPostback(event) {
  var senderId = event.sender.id;
  var payload = event.postback.payload;

  if (payload === "START_BUTTON") {
    // Get user's first name from the User Profile API
    // and include it in the greeting
    request({
      url: "https://graph.facebook.com/v2.6/" + senderId,
      qs: {
        access_token: process.env.PAGE_ACCESS_TOKEN,
        fields: "first_name"
      },
      method: "GET"
    }, function(error, response, body) {
      var greeting = "";
      if (error) {
        console.log("Error getting user's name: " +  error);
        greeting = "Hi. ";
      } else {
        var bodyObj = JSON.parse(body);
        name = bodyObj.first_name;
        greeting = "Hi " + name + ". ";
      }
      var message = greeting + "I hope you are well. " +
        "I am a bot created to assist you discover various upcoming events in your area. " +
        "To find out how you can communicate with me, type 'help' or select one of the options below";
      temp = 1;
      sendMessage(senderId, {text: message});
    });
  } else if (payload === "PH_CONCERTS") {
    sendMessage(senderId, {text: "concerts"});
  } else if (payload === "PH_EXPOS") {
    sendMessage(senderId, {text: "expos"});
  } else if (payload === "PH_FESTIVALS") {
    sendMessage(senderId, {text: "festivals"});
  } else if (payload === "PH_CONFERENCES") {
    sendMessage(senderId, {text: "conferences"});
  }
}

// sends message to user
function sendMessage(recipientId, message) {
  request({
    url: "https://graph.facebook.com/v2.6/me/messages",
    qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
    method: "POST",
    json: {
      recipient: {id: recipientId},
      message: message,
    }
  }, function(error, response, body) {
    if (error) {
      console.log("Error sending message: " + response.error);
    }

    // This is a workaround for the bug defined here: https://developers.facebook.com/bugs/565416400306038
    if (temp === 1) {
      temp = 0;
      message = {
        text: "Select the type of event",
        quick_replies: [
          {
            content_type: "text",
            title: "Concerts",
            payload: "PH_CONCERTS"
          },
          {
            content_type: "text",
            title: "Expos",
            payload: "PH_EXPOS"
          },
          {
            content_type: "text",
            title: "Festivals",
            payload: "PH_FESTIVALS"
          },
          {
            content_type: "text",
            title: "Conferences",
            payload: "PH_CONFERENCES"
          }
        ]
      };

      sendMessage(body.recipient_id, message);
    }
  });
}
