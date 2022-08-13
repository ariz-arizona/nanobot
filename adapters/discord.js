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

const { DISCORD_APPLICATION_ID, DISCORD_PUB_KEY } = process.env;
const { SPREADSHEET_ID, GOOGLE_API_KEY } = process.env;

const getStat = async (id) => {
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
};

const getFreeDates = async (username) => {
  const sheets = google.sheets({
    version: "v4",
    auth: GOOGLE_API_KEY,
  });
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: "A1:AF60",
  });

  const data = res.data.sheets[0].data[0].rowData;

  const findIndex = data.findIndex((el) => {
    return el.values[0].formattedValue === username;
  });

  if (!findIndex) {
    return new Error("user not found");
  }

  const freeDates = [];
  data[findIndex].values.map((el, i) => {
    const date = data[0].values[i].formattedValue;
    const target = data[findIndex].values[i].formattedValue;
    if (i > 0 && !target) {
      // console.log({i, date, v: `${rows[i]}${findIndex + 1}`})
      freeDates.push({
        value: `${rows[i]}${findIndex + 1}`,
        label: date,
      });
    }
  });

  return freeDates;
};

router.post("/bot_stat", async (_req, res) => {
  const message = _req.body;
  const { token, userId } = message;

  const data = await getStat(userId);
  const text =
    data.length > 1
      ? [
          `Запрос от пользователя: ${userId}`,
          `Пользователь: ${data[0]}`,
          `Цель: ${data[1]}`,
          `Среднее: ${data[data.length - 3]}`,
          `Общее: ${data[data.length - 2]}`,
          `Остаток до цели: ${data[data.length - 1]}`,
        ]
      : [
          `Ничего не найдено для ${
            typeof userId === "number" ? `айди ` : `пользователя`
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

  res.sendStatus(200);
});

router.post("/bot_add", async (_req, res) => {
  const message = _req.body;
  const { token, words, username } = message;

  const freeDates = await getFreeDates(username);
  freeDates[0].focused = true;
  freeDates.map((el) => (el.value = [el.value, words].join("_")));

  await fetch(
    `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
    {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        content: `Пользователь ${username} готов вписать слова (${words}) в дату`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "free_date",
                options: freeDates,
                min_values: 1,
                max_values: 1,
                autocomplete: true,
              },
            ],
          },
        ],
      }),
    }
  );

  res.sendStatus(200);
});

router.post("/bot_add_two", async (_req, res) => {
  const message = _req.body;
  const { token, date, words, username } = message;

  console.log(date, words, username);

  const sheets = google.sheets({
    version: "v4",
    auth: GOOGLE_API_KEY,
  });

  const jwt = await auth();

  sheets.spreadsheets.values.update({
    auth: jwt,
    spreadsheetId: SPREADSHEET_ID,
    range: `Список участников!${date}`,
    valueInputOption: "USER_ENTERED",
    resource: { values: [[words]] },
  });

  await fetch(
    `https://discord.com/api/v8/webhooks/${DISCORD_APPLICATION_ID}/${token}`,
    {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        content: `Ячейка обновлена`,
      }),
    }
  );

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
      const options = {};
      if (message.data.options) {
        message.data.options.map((el) => {
          options[el.name] = el.value;
        });
      }
      if (message.data.custom_id) {
        options[message.data.custom_id] = message.data.values;
      }
      const user = message.guild_id ? message.member.user : message.user;
      const { token } = message;
      console.log(`Получена команда ${command}`);
      switch (command) {
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
        case "free_date":
          fetch(`${getPath(_req)}/bot_add_two`, {
            method: "post",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
              username: user.username,
              date: options.free_date[0].split("_")[0],
              words: options.free_date[0].split("_")[1],
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
      console.log(error);
      res.sendStatus(500);
    }
  } else {
    res.status(400).send({ error: "Unknown Type" });
  }
});

module.exports = router;
