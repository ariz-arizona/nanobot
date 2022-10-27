const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  InteractionResponseFlags,
} = require("discord-interactions");
const { google } = require("googleapis");
const emoji = require('emoji.json')

const { errorMessage, getPath, auth, getReaction, getRandomInt } = require("../functions/helpers");
const { getFreeDates, getUserRow, getStat } = require("../functions/main");
const help = require('../data/help.json');

const { DISCORD_APPLICATION_ID, DISCORD_PUB_KEY, DISCORD_TOKEN } = process.env;
const { SPREADSHEET_ID, GOOGLE_API_KEY } = process.env;

const PNDL_TARGET = 6000;

const sendErrorToDiscord = async (error, token) => {
  console.log(error);
  await fetch(
    `https://discord.com/api/v9/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
    {
      headers: { "Content-Type": "application/json" },
      method: "post",
      body: JSON.stringify({
        content: errorMessage(error),
      }),
    }
  );
}

const sendMsgToDiscord = async (body, url, method = "POST", auth = false) => {
  const content = {
    headers: { "Content-Type": "application/json" },
    method: method,
  };
  if (body) {
    content.body = JSON.stringify(body)
  }
  if (auth) {
    content.headers.authorization = `Bot ${DISCORD_TOKEN}`;
  }
  return await fetch(
    `https://discord.com/api/v9/webhooks/${DISCORD_APPLICATION_ID}/${url}`,
    content
  );
}

router.post("/bot_stat", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, userId } = message;

    const data = await getStat(userId);
    const text = [];

    data.map(el => {
      const l = el.length;
      const item =
        el && el.length > 1
          ? [
            `**${el[1]}**, цель: ${el[2]}, в среднем ${el[l - 5]}`,
            `Всего написано ${el[l - 4]}, до цели осталось ${el[l - 3]}`,
            `Выходных: ${el[l - 2]}, пропусков: ${el[l - 1]}`,
          ]
          : [`Ничего не найдено для ${userId}`];
      text.push(item.join('\n'));
    });

    const body = {
      content: text.join("\n\n"),
    };
    await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
  } catch (error) {
    await sendErrorToDiscord(error, message.token);
  }
  res.sendStatus(200);
});

router.post("/bot_add", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, words, userId, username, comment, day } = message;
    const originalMsgRaw = await sendMsgToDiscord(false, `${token}/messages/@original`, 'GET');
    const originalMsg = await originalMsgRaw.json();

    let freeDates = await getFreeDates(userId);
    if (username) {
      freeDates = freeDates.filter(el => el.name === username);
    }

    let currentHour = parseInt(new Date().toLocaleString("en-US", {
      timeZone: "Europe/Moscow",
      hour12: false,
      hour: 'numeric'
    }));
    if (currentHour === 24) currentHour = 0;

    const buttonsArray = [];

    for (let index = 0; index < freeDates.length; index++) {
      const buttons = [];

      const dates = freeDates[index].dates;
      const name = freeDates[index].name;
      dates.map((el) => {
        el.value = [el.value, words].join("_");
        el.label = `${el.label} (${name})`
      });

      const yesterdayReportCondition = (words !== 'В' && currentHour >= 10 && dates.length > 1);
      if (yesterdayReportCondition) {
        dates.shift();
      }

      if (dates[0]) {
        buttons.push({
          type: 2,
          style: dates[0].style,
          label: dates[0].label,
          custom_id: `free_date_${dates[0].value}_${originalMsg.id}`,
        });
      }
      if (dates[1]) {
        buttons.push({
          type: 2,
          style: dates[1].style,
          label: dates[1].label,
          custom_id: `free_date_${dates[1].value}_${originalMsg.id}`,
        });
      }

      if (buttons.length) buttonsArray.push({
        type: 1,
        components: buttons,
      })
    }
    const txt = buttonsArray.length ?
      [
        `Пользователь: ${freeDates.map(el => el.name).join(', ')}`,
        `Слов: ${words}`,
      ] :
      ['Свободных дат не найдено'];

    if (buttonsArray.length) {
      if (comment) {
        txt.push(`Комментарий: ${comment || ''}`);
      }
      txt.push(`Укажите дату:`);
    }

    if (day && ['yesterday', 'today'].includes(day)) {
      const dates = freeDates[0].dates;
      const name = freeDates[0].name;
      const yesterdayReportCondition = (words !== 'В' && currentHour >= 10 && dates.length > 1);

      const body = {
        token,
        _comment: comment || false,
        username: name,
        date: day,
        words: words,
      };

      if (day === 'today') {
        body.cell = dates[dates.length - 1].value.split('_')[0];
      } else if (day === 'yesterday' && !yesterdayReportCondition) {
        body.cell = dates[0].value.split('_')[0];
      } else if (day === 'yesterday' && yesterdayReportCondition) {
        throw new Error('no words yesterday');
      }

      await fetch(`${getPath(_req)}/bot_add_two`, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } else {
      const body = {
        flags: InteractionResponseFlags.EPHEMERAL,
        content: txt.join('\n'),
        components: buttonsArray
      };

      await sendMsgToDiscord(body, token);
    }

  } catch (error) {
    await sendErrorToDiscord(error, message.token);
  }
  res.sendStatus(200);
});

router.post("/bot_add_two", async (_req, res) => {
  const message = _req.body;
  try {
    const {
      messageData,
      token,
      cell,
      date,
      words,
      username,
      _comment,
      original_id,
    } = message;

    let comment;
    if (_comment !== undefined) {
      comment = _comment
    } else {
      const commentRaw = messageData.content.split('\n').find(el => el.split(': ')[0] === 'Комментарий');
      comment = commentRaw ? commentRaw.split(': ')[1] : false;
    }
    const sheets = google.sheets({
      version: "v4",
      auth: GOOGLE_API_KEY,
    });

    const data = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: cell,
    });

    const value = data.data.sheets[0].data[0].rowData[0].values[0].formattedValue;
    if (value === words) {
      const duplicateBody = {
        flags: InteractionResponseFlags.EPHEMERAL,
        content: ['Кажется, такой отчет уже сдан :(', `День: ${date}`, `Слов: ${words}`].join('\n'),
      };
      // await sendMsgToDiscord(false, `${token}/messages/${original_id}`, 'DELETE');
      await sendMsgToDiscord(duplicateBody, token);
    } else {
      // исправляем сообщение с кнопками, если данные о нем переданы
      if (messageData) {
        const body = {
          flags: InteractionResponseFlags.EPHEMERAL,
          content: `Пользователь ${username} готов вписать слова (${words}) в дату ${date}`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 2,
                  label: `${words} слов в день ${date}`,
                  custom_id: `free_date_${cell}_${date}`,
                  disabled: true
                },
              ],
            },
          ],
        };
        await sendMsgToDiscord(body, `${token}/messages/${messageData.id}`, 'PATCH');
      }
      // если есть оригинальное сообщение, то есть после кнопки, то удаляем сообщение-после-кнопки
      if (original_id) {
        await sendMsgToDiscord(false, `${token}/messages/@original`, 'DELETE');
      }

      const jwt = await auth();

      sheets.spreadsheets.values.update({
        auth: jwt,
        spreadsheetId: SPREADSHEET_ID,
        range: `Список участников!${cell}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[words]] },
      });

      const randomEmoji = emoji[getRandomInt(0, emoji.length - 1)];
      const txt = [`Пользователь: **${username}**`, `День: ${date}`, `Слов: ${words}`];
      if (comment) txt.push(`Комментарий: *${comment}*`)
      txt.push(`\nСлучайный эмоджи от бота: ${randomEmoji.char}`);

      const checkReaction = '\u2705'; // check
      const reaction = getReaction(words);

      let response;
      if (original_id) {
        response = await sendMsgToDiscord({ content: txt.join('\n') }, `${token}/messages/${original_id}`, 'PATCH');
      } else {
        response = await sendMsgToDiscord({ content: txt.join('\n') }, `${token}/messages/@original`, 'PATCH');
      }
      const msg = await response.json();

      await fetch(
        `https://discord.com/api/v9/channels/${msg.channel_id}/messages/${msg.id}/reactions/${checkReaction}/@me`,
        {
          headers: { authorization: `Bot ${DISCORD_TOKEN}` },
          method: 'PUT',
        }
      );
      if (reaction) {
        await fetch(
          `https://discord.com/api/v9/channels/${msg.channel_id}/messages/${msg.id}/reactions/${reaction}/@me`,
          {
            headers: { authorization: `Bot ${DISCORD_TOKEN}` },
            method: 'PUT',
          }
        );
      }
    }
  } catch (error) {
    await sendErrorToDiscord(error, message.token);
  }
  res.sendStatus(200);
});

router.post("/bot_add_user", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, userId, username, target } = message;

    const rowIndex = await getUserRow(userId);
    const freeRow = rowIndex.free + 4;
    if (!rowIndex.usernames.includes(username)) {
      const sheets = google.sheets({
        version: "v4",
        auth: GOOGLE_API_KEY,
      });

      const jwt = await auth();

      sheets.spreadsheets.values.update({
        auth: jwt,
        spreadsheetId: SPREADSHEET_ID,
        range: `Список участников!A${freeRow}:D${freeRow}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[userId, username, target, 6]] },
      });

      const body = {
        content: [`Пользователь: ${username}`, `Цель: ${target}`].join('\n'),
      };
      await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
    } else {
      const body = {
        content: `В таблице уже есть запись для ${username}`
      }
      await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
    }
  } catch (error) {
    await sendErrorToDiscord(error, message.token);
  }
  res.sendStatus(200);
});

router.post("/discord", async (_req, res) => {
  const signature = _req.headers["x-signature-ed25519"];
  const timestamp = _req.headers["x-signature-timestamp"];
  const isValidRequest = verifyKey(
    _req.rawBody,
    signature,
    timestamp,
    DISCORD_PUB_KEY
  );

  if (!isValidRequest) {
    return res.status(401).send({ error: "Bad request signature " });
  }

  const message = _req.body;

  if (message.type === InteractionType.PING) {
    res.status(200).send({
      type: InteractionResponseType.PONG,
    });
  } else if (
    message.type === InteractionType.APPLICATION_COMMAND ||
    message.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE ||
    message.type === InteractionType.MESSAGE_COMPONENT
  ) {
    try {
      const command = message.data.name || message.data.custom_id;
      console.log(`Получена команда ${command}`);

      const options = {};
      if (message.data.options) {
        message.data.options.map((el) => {
          options[el.name] = el.value;
        });
      }
      if (message.data.custom_id) {
        options[message.data.custom_id] = message.data.values;
      }

      if (options.words) {
        if (options.words < 0) options.words = 'В';
        if (options.words > 65536) {
          throw new Error('too many words')
        }
      }

      if (options.target) {
        if (options.target < PNDL_TARGET) options.target = PNDL_TARGET;
        if (options.target > 65536) {
          throw new Error('too many words')
        }
      }

      const user = message.guild_id ? message.member.user : message.user;

      const { token } = message;

      switch (command) {
        case "help":
          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: help.data,
            },
          });

          break;
        case "stat":
          fetch(`${getPath(_req)}/bot_stat`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, userId: user.id }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> запросил статистику`,
            },
          });

          break;
        case "add":
          fetch(`${getPath(_req)}/bot_add`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет`,
            },
          });
          break;
        case 'add_words_user':
          const username = message.data.values[0].split('_')[0];
          const words = message.data.values[0].split('_')[1];
          const day = message.data.values[0].split('_')[2];

          fetch(`${getPath(_req)}/bot_add`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              username,
              words,
              day
            }),
          });
          break;
        case 'today':
          fetch(`${getPath(_req)}/bot_add`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment,
              day: 'today'
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет за сегодня`,
            },
          });
          break;
        case 'yesterday':
          fetch(`${getPath(_req)}/bot_add`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              words: options.words,
              comment: options.comment,
              day: 'yesterday'
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> пишет отчет за вчера`,
            },
          });
          break;
        case /^free_date_/.test(command) && command:
          const args = command.replace('free_date_', '').split('_');
          options.cell = args[0];
          options.date = args[1];
          options.words = args[2];
          options.original_id = args[3];
          fetch(`${getPath(_req)}/bot_add_two`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageData: message.message,
              token,
              username: user.username,
              cell: options.cell,
              date: options.date,
              words: options.words,
              original_id: options.original_id,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь ${user.username} нажал на кнопку`,
            },
          });
          break;
        case "add_user":
          if (!options.target) options.target = PNDL_TARGET;

          fetch(`${getPath(_req)}/bot_add_user`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              userId: user.id,
              username: options.name || user.username,
              target: options.target,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // flags: InteractionResponseFlags.EPHEMERAL,
              content: `Пользователь <@${user.id}> регистрируется на пендель`,
            },
          });
          break;
        default:
          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Я этого не умею :(`,
            },
          });
      }
    } catch (error) {
      console.log(error);
      res.status(200).send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: errorMessage(error),
        },
      });
    }
  } else {
    res.status(400).send({ error: "Unknown Type" });
  }
});

module.exports = router;
