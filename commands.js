// npm install @discordjs/rest
// npm install discord-api-types
// npm install discord.js
require("dotenv").config();

const { DISCORD_APPLICATION_ID, DISCORD_TOKEN } = process.env;
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const commands = [
  {
    name: "stat",
    description: "test command",
    options: [
      {
        type: 3,
        name: "id",
        description: "user id"
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
