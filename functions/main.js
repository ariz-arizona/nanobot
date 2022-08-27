const { google } = require("googleapis");

const { rows } = require("../functions/helpers");

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
        throw new Error(`user not found|${id}`);
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

    const currentDay = parseInt(new Date().toLocaleString("en-US", {
        timeZone: "Europe/Moscow",
        hour12: false,
        day: 'numeric'
    }));
    const data = res.data.sheets[0].data[0].rowData;

    const findIndex = data.findIndex((el) => {
        return el.values[0].formattedValue === username;
    });

    if (!findIndex || !data[findIndex]) {
        throw new Error(`user not found|${username}`);
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

module.exports = { getStat, getFreeDates, getUserRow }