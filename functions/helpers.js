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

module.exports = { loadPage, errorMessage, getPath, auth, rows };
