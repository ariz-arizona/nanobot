const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  InteractionResponseFlags,
} = require("discord-interactions");
const { errorMessage } = require("../helpers");

const { DISCORD_APPLICATION_ID, DISCORD_PUB_KEY } = process.env;

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
      console.log(`Получена команда ${command}`)
      switch (command) {
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
