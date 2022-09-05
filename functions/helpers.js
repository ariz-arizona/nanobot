const { google } = require("googleapis");
const privatekey = require("../privatekey.json");

const loadPage = async (url) => {
  if (!url) {
    return false;
  }
  // console.log(url);
  try {
    const res = await fetch(url);
    if (res.status >= 400) {
      throw new Error("Bad response from server");
    }

    return await res.text();
  } catch (err) {
    console.error(err);
  }
};

const errorMessage = (error) => {
  let msg;
  switch (error.message) {
    case /^user not found\|/.test(error.message) && error.message:
      msg = `Пользователь **${error.message.split('|')[1]}** не найден`;
      break;
    case "user not found":
      msg = "Пользователь не найден";
      break;
    case "user exist":
      msg = "Пользователь уже существует";
      break;
    case "too many words":
      msg = "Слишком большое количество слов, попробуйте еще раз";
      break;
    case "notfound":
      msg = "Я ничего не нашел :(";
      break;
    case "no words yesterday":
      msg = "Вы уже не можете отправлять отчет за вчера :(";
      break;
    default:
      msg = "Ой! Что-то случилось! Может, попробуете еще раз?";
  }
  return msg;
};

const getPath = (_req) => {
  return `http${_req.headers.host.indexOf("localhost") !== -1 ? "" : "s"}://${_req.headers.host
    }`;
};

const auth = async () => {
  // configure a JWT auth client
  let jwtClient = new google.auth.JWT(
    privatekey.client_email,
    null,
    privatekey.private_key,
    [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ]
  );

  //authenticate request
  await jwtClient.authorize();

  return jwtClient;
};

const rows = {
  0: "A",
  1: "B",
  2: "C",
  3: "D",
  4: "E",
  5: "F",
  6: "G",
  7: "H",
  8: "I",
  9: "J",
  10: "K",
  11: "L",
  12: "M",
  13: "N",
  14: "O",
  15: "P",
  16: "Q",
  17: "R",
  18: "S",
  19: "T",
  20: "U",
  21: "V",
  22: "W",
  23: "X",
  24: "Y",
  25: "Z",
  26: "AA",
  27: "AB",
  28: "AC",
  29: "AD",
  30: "AE",
  31: "AF",
};

const getPreviousDay = (date = new Date()) => {
  const previous = new Date(date.getTime());
  previous.setDate(date.getDate() - 1);

  return previous;
}

const getReaction = (words) => {
  let reaction;
  if (words == 'В') {
    reaction = '\uD83D\uDCA4'; // zzz // В 💤
  }
  if (words == 34) {
    reaction = '\uD83C\uDF46'; // 34 🍆
  }
  if (words == 42) {
    reaction = '\uD83E\uDDE3'; // 42 🧣
  }
  if (words == 69 || words == 96 || words === 696 || words === 969) {
    reaction = '\uD83D\uDE0F'; // smirk
  }
  if (words == 300) {
    reaction = '\uD83D\uDE9C'; // 300 🚜
  }
  if (words == 314) {
    reaction = '\uD83E\uDD67'; // 314 🥧
  }
  if (words == 666) {
    reaction = '\uD83D\uDE08'; // 666 😈
  }
  if (words >= 1000) {
    reaction = '\uD83D\uDCAA'; // muscle // >1000 💪
  }
  if (words >= 4000) {
    reaction = '\uD83E\uDDBE'; // >4000 🦾 
  }
  return reaction;
}

function getRandomInt(min = 0, max) {
  min = Math.ceil(min);
  max = Math.ceil(max);
  return Math.floor(Math.random() * (max - min) + min);
}

module.exports = { loadPage, errorMessage, getPath, auth, rows, getPreviousDay, getReaction, getRandomInt };
