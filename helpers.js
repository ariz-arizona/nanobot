const { google } = require("googleapis");
const privatekey = require("./privatekey.json");

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
    case "notfound":
      msg = "Я ничего не нашел :(";
      break;
    default:
      msg = "Ой! Что-то случилось! Может, попробуете еще раз?";
  }
  return msg;
};

const getPath = (_req) => {
  return `http${_req.headers.host.indexOf("localhost") !== -1 ? "" : "s"}://${
    _req.headers.host
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

module.exports = { loadPage, errorMessage, getPath, auth };
