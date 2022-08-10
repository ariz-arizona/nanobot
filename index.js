require('dotenv').config();

const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');

//todo port в переменные среды
const { CURRENT_HOST, APP_PORT = 8443 } = process.env;

const app = express();

app.use(express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    },
}));

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

app.use('/', require('./adapters/discord.js'));

app.get('/', async (_req, res) => {
    res.send(`listening on ${CURRENT_HOST}`)
});

app.listen(APP_PORT, () => {
    console.log(`listening on ${APP_PORT}`)
});