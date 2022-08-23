const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  InteractionResponseFlags,
} = require("discord-interactions");
const { google } = require("googleapis");

const { errorMessage, getPath, auth, rows } = require("../helpers");
const help = require('../data/help.json');

const { DISCORD_APPLICATION_ID, DISCORD_PUB_KEY } = process.env;
const { SPREADSHEET_ID, GOOGLE_API_KEY } = process.env;

const PNDL_TARGET = 4200;

const getStat = async (id) => {
  try {
    const sheets = google.sheets({
      version: "v4",
      auth: GOOGLE_API_KEY,
    });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: "A3:AI60",
    });

    const data = res.data.sheets[0].data[0].rowData;

    let selectedId = id;

    if (typeof id === "number") {
      if (id < 0) id = 0;
      if (id > 50) id = 50;
    }

    if (typeof id === "string") {
      const findIndex = data.findIndex((el) => {
        return el.values[0].formattedValue === id;
      });
      if (findIndex) selectedId = findIndex;
    }

    if (!data[selectedId] || !data[selectedId].values[0].formattedValue) {
      return new Error("user not found");
    }

    const values = data[selectedId].values.map((el) => el.formattedValue);
    return values;
  } catch (error) {
    console.log(error);
  }
};

const getFreeDates = async (username) => {
  try {
    const sheets = google.sheets({
      version: "v4",
      auth: GOOGLE_API_KEY,
    });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: "A1:AF60",
    });

    const currentDay = parseInt(new Date().toLocaleString("en-US", {
      timeZone: "Europe/Moscow",
      hour12: false,
      day: '2-digit'
    }));
    const data = res.data.sheets[0].data[0].rowData;

    const findIndex = data.findIndex((el) => {
      return el.values[0].formattedValue === username;
    });

    if (!findIndex || !data[findIndex]) {
      return new Error("user not found");
    }

    const freeDates = [];
    data[findIndex].values.map((el, i) => {
      const date = data[0].values[i].formattedValue;
      const target = data[findIndex].values[i].formattedValue;
      const condition = parseInt(date) === currentDay || parseInt(date) === (currentDay - 1);
      if (i > 0 && condition) {
        // console.log({i, date, v: `${rows[i]}${findIndex + 1}`})
        freeDates.push({
          value: [`${rows[i]}${findIndex + 1}`, date].join('_'),
          label: `${date}${target ? ` (сейчас слов ${target})` : ''}`,
          style: parseInt(date) === currentDay ? 1 : 2
        });
      }
    });

    return freeDates;
  } catch (error) {
    console.log(error);
  }
};

const getUserRow = async (username) => {
  const sheets = google.sheets({
    version: "v4",
    auth: GOOGLE_API_KEY,
  });
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: "A3:A60",
  });
  const data = res.data.sheets[0].data[0].rowData;
  const findIndex = data.findIndex((el) => {
    return el.values[0].formattedValue === username;
  });
  const findFree = data.findIndex((el) => {
    return !el.values[0].formattedValue;
  });

  return { index: findIndex, free: findFree };
}

router.post("/bot_stat", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, userId } = message;

    const data = await getStat(userId);
    const text =
      data && data.length > 1
        ? [
          `Запрос от пользователя: ${userId}`,
          `Пользователь: ${data[0]}`,
          `Цель: ${data[1]}`,
          `Среднее: ${data[data.length - 3]}`,
          `Общее: ${data[data.length - 2]}`,
          `Остаток до цели: ${data[data.length - 1]}`,
        ]
        : [
          `Ничего не найдено для ${typeof userId === "number" ? `айди ` : `пользователя`
          } ${userId}`,
        ];

    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          content: text.join("\n"),
        }),
      }
    );
  } catch (error) {
    console.log(error);
    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${message.token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "post",
        body: JSON.stringify({
          content: errorMessage(error),
        }),
      }
    );
  }
  res.sendStatus(200);
});

router.post("/bot_add", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, words, username } = message;

    const freeDates = await getFreeDates(username);
    freeDates.map((el) => (el.value = [el.value, words].join("_")));

    const buttons = [];
    if (freeDates[0]) {
      buttons.push({
        type: 2,
        style: freeDates[0].style,
        label: freeDates[0].label,
        custom_id: `free_date_${freeDates[0].value}`,
      });
    }
    if (freeDates[1]) {
      buttons.push({
        type: 2,
        style: freeDates[1].style,
        label: freeDates[1].label,
        custom_id: `free_date_${freeDates[1].value}`,
      });
    }

    const txt = buttons.length ?
      `(У бота сегодня ${(new Date()).getDate()} день)\nПользователь ${username} готов вписать слова (${words}) в дату:` :
      'Свободных дат не найдено';

    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          flags: InteractionResponseFlags.EPHEMERAL,
          content: txt,
          components: buttons.length ? [
            {
              type: 1,
              components: buttons,
            },
          ] : [],
        }),
      }
    );
  } catch (error) {
    console.log(error);
    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${message.token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "post",
        body: JSON.stringify({
          content: errorMessage(error),
        }),
      }
    );
  }
  res.sendStatus(200);
});

router.post("/bot_add_two", async (_req, res) => {
  const message = _req.body;
  try {
    const { messageData, token, cell, date, words, username } = message;
    await fetch(
      `https://discord.com/api/v8/webhooks/${messageData.webhook_id}/${token}/messages/${messageData.id}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
        body: JSON.stringify({
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
        }),
      }
    );

    // console.log(date, words, username);

    const sheets = google.sheets({
      version: "v4",
      auth: GOOGLE_API_KEY,
    });

    const jwt = await auth();

    sheets.spreadsheets.values.update({
      auth: jwt,
      spreadsheetId: SPREADSHEET_ID,
      range: `Список участников!${cell}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[words]] },
    });

    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          content: [`Пользователь: ${username}`, `День: ${date}`, `Слов: ${words}`].join('\n'),
        }),
      }
    );
  } catch (error) {
    console.log(error);
    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${message.token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "post",
        body: JSON.stringify({
          content: errorMessage(error),
        }),
      }
    );
  }
  res.sendStatus(200);
});

router.post("/bot_add_user", async (_req, res) => {
  const message = _req.body;
  try {
    const { token, target, username } = message;

    const rowIndex = await getUserRow(username);
    const freeRow = rowIndex.free + 3;

    if (rowIndex.index !== -1) {
      throw new Error('user exist')
    }

    const sheets = google.sheets({
      version: "v4",
      auth: GOOGLE_API_KEY,
    });

    const jwt = await auth();

    sheets.spreadsheets.values.update({
      auth: jwt,
      spreadsheetId: SPREADSHEET_ID,
      range: `Список участников!A${freeRow}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[username]] },
    });

    sheets.spreadsheets.values.update({
      auth: jwt,
      spreadsheetId: SPREADSHEET_ID,
      range: `Список участников!B${freeRow}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[target]] },
    });

    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          content: `Пользователь: ${username}\nЦель: ${target}`,
        }),
      }
    );
  } catch (error) {
    console.log(error);
    await fetch(
      `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${message.token}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "post",
        body: JSON.stringify({
          content: errorMessage(error),
        }),
      }
    );
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
          const userId =
            options.id && !isNaN(parseInt(options.id))
              ? parseInt(options.id)
              : user.username;

          fetch(`${getPath(_req)}/bot_stat`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, userId }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Начинаю искать статистику`,
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
              username: user.username,
              words: options.words,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Начинаю искать пользователя`,
            },
          });
          break;
        case /^free_date_/.test(command) && command:
          const args = command.replace('free_date_', '').split('_');
          options.cell = args[0];
          options.date = args[1];
          options.words = args[2];
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
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Начинаю добавлять данные`,
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
              username: user.username,
              target: options.target,
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          res.status(200).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `Начинаю добавлять пользователя`,
            },
          });
          break;
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
