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

module.exports = { loadPage, errorMessage, getPath };
