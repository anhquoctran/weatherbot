var request = require('request').defaults({ encoding: null });
const API_KEY = "7d4420b4ce204e679b2111d41e70773e";
var VISION_URL = 'https://api.projectoxford.ai/vision/v1.0/analyze/?visualFeatures=Description&form=BCSIMG&subscription-key=' + API_KEY;

exports.getCationFromStream = (stream) => {
    return new Promise(
        (resolve, reject) => {
            var requestData = {
                url: VISION_URL,
                encoding: 'binary',
                headers: {
                    'content-type': 'application/octet-stream'
                }
            };

            stream.pipe(request.post(requestData, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode !== 200) {
                    reject(body);
                } else {
                    resolve(extractCaption(JSON.parse(body)));
                }
            }));
        }
    );
};

exports.getCationFromURL = (link) => {
    return new Promise((resolve, reject) => {
        var requestData = {
            url: VISION_URL,
            json: {
                'url': link
            }
        };

        request.post(requestData, (err, response, body) => {
            if (err) {
                reject(err);
            } else if (response.statusCode !== 200) {
                reject(body);
            } else {
                resolve(extractCaption(body));
            }
        });
    });
};

function extractCaption(body) {
    if (body && body.description && body.description.captions && body.description.captions.length) {
        return body.description.captions[0].text;
    }

    return null;
}