const express = require('express');
const FileCookieStore = require('tough-cookie-filestore2');
const Instagram = require('instagram-web-api');
const bodyParser = require('body-parser');
const numeral = require('numeral');
const fs = require('fs');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));

app.get('/', (request, response) => {
    if (request.query.remove_cookies && fs.existsSync('./cookies.json')) {
        console.log('Cookies file removed!');
        fs.unlinkSync('./cookies.json');
    }
    response.render('index');

}).post('/', (request, response) => {
    let request_username = request.body.username;
    if (!request_username || request_username.length === 0)
        response.redirect('/');
    const username = process.env.instagram_username;
    const password = process.env.instagram_password;
    const cookieStore = new FileCookieStore('./cookies.json');
    const client = new Instagram({username, password, cookieStore});
    let images = [], output = [], like_c, comments_c, engagement_rate, engagement_rate_sum = 0,
        engagement_rate_avg = 0,
        followers = 0;
    (async () => {
        try {
            await client.login();
            const instagram = await client.getUserByUsername({username: request_username});
            if (instagram['has_blocked_viewer'] === false && instagram['edge_owner_to_timeline_media']['count'] > 0) {
                followers = instagram['edge_followed_by']['count'];
                let edges = instagram['edge_owner_to_timeline_media']['edges'];
                for (let p in edges) {
                    if (edges.hasOwnProperty(p)) {
                        like_c = edges[p]['node']['edge_liked_by']['count'];
                        comments_c = edges[p]['node']['edge_media_to_comment']['count'];
                        engagement_rate = ((like_c + comments_c) / followers) * 100;
                        engagement_rate_sum += engagement_rate;
                        engagement_rate = Number((engagement_rate).toFixed(3));
                        images.push({
                            "type": edges[p]['node']['__typename'],
                            "caption": edges[p]['node']['edge_media_to_caption']['edges'].length > 0 ? edges[p]['node']['edge_media_to_caption']['edges'][0]['node']['text'] : '',
                            "engagement_rate": engagement_rate,
                            "like": like_c,
                            "comments": comments_c,
                            "link": 'https://www.instagram.com/p/' + edges[p]['node']['shortcode'],
                            "thumbnail": edges[p]['node']['thumbnail_resources'][1]['src']
                        });
                    }
                }
                if (images.length > 0) {
                    engagement_rate_avg = engagement_rate_sum / images.length;
                    engagement_rate_avg = Number((engagement_rate_avg).toFixed(3));
                }
            }

            output = {
                'full_name': instagram['full_name'],
                'username': instagram['username'],
                'link': 'https://www.instagram.com/' + instagram['username'],
                'biography': instagram['biography'],
                'followers': numeral(followers).format('0,0'),
                'can_see': !((instagram['is_private'] && instagram['followed_by_viewer'] === false) || instagram['has_blocked_viewer']),
                'engagement_rate_avg': engagement_rate_avg,
                'images': images
            };
            response.render('index', {output: output});
        } catch (err) {
            console.log(err);
            response.render('index', {error: true});
        }
    })();

}).listen(port, () => {
    console.log('Listen to port', port, ',', 'http://localhost:' + port);
});