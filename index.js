require('dotenv-extended').load();

var restify = require("restify");
var builder = require("botbuilder");
var apiairecognizer = require("api-ai-recognizer");
var request = require("request");
var needle = require('needle');
var url = require('url');
var validUrl = require('valid-url');
var vision = require('./vision');

var translate = require("@google-cloud/translate")({
    projectId: "mscore-sync-auth",
    keyFilename: __dirname + "\\translate_api\\mscore-sync-auth-6d9c97c0a521.json"
});


var server = restify.createServer();

server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log("%s listening to %s", server.name, server.url);
    //console.log(__dirname + "\\translate_api\\mscore-sync-auth-6d9c97c0a521.json");
});

var recognizer = new apiairecognizer("fad774e3771b4aafad518f320b58590b");

var connector = new builder.ChatConnector({
    appId: '0a9648d1-85bf-431b-b378-932e5c2173a1',
    appPassword: '95GoiXfOctwnzEur0eBZHDm'
});

//Tạo intent và gán nó với dịch vụ API.AI để xử lý yêu cầu
var intents = new builder.IntentDialog({
    recognizers: [recognizer]
});

//Dich tieng anh sang tieng Viet de hien thi vao khung chat
function doTranslation(someword, callback) {
    translate.translate(someword, "vi", (err, translation) => {
        if (!err) {
            callback(translation);
        } else console.log(err);
    });
}

/* Xử lý ảnh do người dùng up lên và gửi cho Microsoft Cognitive phân tích sau đó nhận kết quả trả về */
//kiểm tra xem tin nhắn có chứa ảnh không

function hasImageAttachment(session) {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}

//kiểm tra token của dịch vụ
function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}

//lấy hình ảnh từ tin nhắn
function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        connector.getTokenAccessToken((err, token) => {
            //var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}

//xử lý tin nhắn nếu thành công
function handleSuccessResponse(session, caption) {
    if (caption) {
        doTranslation(caption, (result) => {
            session.send('Tôi nghĩ rằng bức ảnh này có chứa ' + result);
        });
    } else {
        session.send('Không thể tìm thấy mô tả cho bức ảnh này! Hãy thử với một bức ảnh khác');
    }
}

//throw error
function handleErrorResponse(session, error) {
    session.send('Oops! Something went wrong. Try again later.');
    console.error(error);
}

//phân tích thẻ
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }
    return null;
}

//Xử lý dữ liệu hình ảnh
function handleData(session) {
    if (hasImageAttachment(session)) {
        var stream = getImageStreamFromMessage(session.message);
        vision
            .getCationFromStream(stream)
            .then((caption) => { handleSuccessResponse(session, caption); })
            .catch((error) => { handleErrorResponse(session, error); });
    } else {
        var imgUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
        if (imgUrl) {
            vision
                .getCationFromURL(imgUrl)
                .then((caption) => { handleSuccessResponse(session, caption) })
                .catch((error) => { handleErrorResponse(session, error); });
        } else {
            doTranslation("Did you upload an image? I'm more of a visual person. Try sending me an image or an image URL", (result) => {
                session.send(result);
            });
        }
    }
}

/* Hết phần Microsoft Cognitive Server API */



//Mặc định câu trả lời từ intents
intents.onDefault((session) => {
    session.send("Tôi không hiểu ý của bạn ?!");
});

//Nếu câu trò chuyện khớp với các intents thì nó sẽ hồi đáp dựa vào thông tin của intent đó

//Greetings
intents.matches("welcomeIntent", (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        var speech = fulfillment.entity;
        session.send(speech);
    } else {
        session.send("Xin lỗi tôi không hiểu ý của bạn là gì!");
    }
});

//Thanks you
intents.matches("saysThankyou", (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        var speech = fulfillment.entity;
        session.send(speech);
    } else {
        session.send("Xin lỗi tôi không hiểu ý của bạn là gì!");

    }
});

//Time
intents.matches("time", (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        session.send("Thời gian hiện tại là: " + getDateTimeNow());
    }
});

//How are you
intents.matches("howAreYou", (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        var speech = fulfillment.entity;
        session.send(speech);
    } else {
        session.send("Xin lỗi tôi không hiểu ý của bạn là gì!");
    }
});

//Bye
intents.matches('goodbye', (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        var speech = fulfillment.entity;
        session.send(speech);
    } else {
        session.send("Xin lỗi tôi không hiểu ý của bạn là gì!");
    }
});

function getDateTimeNow() {
    return (new Date().getHours() + ":" + new Date().getMinutes() + ":" + new Date().getSeconds()).toString().trim();
}

//Viết hoa chữ cái đầu của string
String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
};

//Thông tin thời tiết
intents.matches('weathercities', (session, args) => {
    var city = builder.EntityRecognizer.findEntity(args.entities, 'cities');
    if (city) {
        var city_name = city.entity;
        var url = "https://api.apixu.com/v1/current.json?key=266976629386422ebcb133822170404&q=" + encodeURIComponent(removeUTF8Characters(city_name));
        request(url, (error, response, body) => {
            body = JSON.parse(body);
            var time = getDateTimeNow();
            var temp = body.current.temp_c;
            var feelslike = body.current.feelslike_c;
            var condition_text = body.current.condition.text;
            doTranslation(condition_text, (result) => {
                session.send("Thời tiết của " + city_name.toString().capitalizeFirstLetter() + " vào lúc " + time + " là: " + temp + " °C. \nCảm nhận thực là: " + feelslike + " °C, " + result);
            });
        });
    } else {
        session.send("Tôi không hiểu ý bạn nói gì?");
    }
});

//Xử lý tiếng Việt có dấu thành tiếng Việt không dấu Huế => Hue, Hồ Chí Minh => Ho_Chi_Minh
function removeUTF8Characters(str) {
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/^\-+|\-+$/g, "");
    return str;
}

//Tell bot name
intents.matches("botname", (session, args) => {
    var fulfillment = builder.EntityRecognizer.findEntity(args.entities, 'fulfillment');
    if (fulfillment) {
        var speech = fulfillment.entity;
        session.send(speech);
    } else {
        session.send("Xin lỗi tôi không hiểu ý của bạn là gì!");
    }
});

//Initial bot
var bot = new builder.UniversalBot(connector);


//App listening
server.post('/api/messages', connector.listen());

//Integrated with intent processor
bot.dialog('/', intents);