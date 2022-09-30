// npm install @discordjs/rest
// npm install discord-api-types
// npm install discord.js
require("dotenv").config();

const { DISCORD_APPLICATION_ID, DISCORD_TOKEN } = process.env;
// const DISCORD_TOKEN =
//   "MTAwNjk0ODI1NTE4MTA1ODA3OA.GgHCof.8HYbpzMllrTfqlFu6SsHiZRW8kmYwbEefeCqg0";
// const DISCORD_APPLICATION_ID = "1006948255181058078";

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const commands = [
  {
    name: "help",
    description: "help",
  },{
    name: "stat",
    description: "Получить статистику пользователя"
  },
  {
    name: "add",
    description: "Сдать отчет",
    options: [
      {
        type: 4,
        name: "words",
        description: "words",
        required: true
      },
      {
        type: 3,
        name: "comment",
        description: "comment",
      },
    ],
  },
  {
    name: "today",
    description: "СЕГОДНЯ: Сдать отчет",
    options: [
      {
        type: 4,
        name: "words",
        description: "words",
        required: true
      },
      {
        type: 3,
        name: "comment",
        description: "comment",
      },
    ],
  },
  {
    name: "yesterday",
    description: "ВЧЕРА: Сдать отчет",
    options: [
      {
        type: 4,
        name: "words",
        description: "words",
        required: true
      },
      {
        type: 3,
        name: "comment",
        description: "comment",
      },
    ],
  },
  {
    name: "add_user",
    description: "Зарегистрироваться на пендель",
    options: [
      {
        type: 4,
        name: "target",
        description: "target"
      },
      {
        type: 3,
        name: "name",
        description: "name"
      },
    ],
  },
];

const rest = new REST({ version: "9" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(DISCORD_APPLICATION_ID), {
      body: commands,
    });

    // const result = await rest.get(Routes.applicationCommand(DISCORD_APPLICATION_ID, '941005970715332729'));
    // console.log(JSON.stringify(result));

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
