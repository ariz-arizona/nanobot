const { google } = require("googleapis");

const { rows, getPreviousDay } = require("../functions/helpers");

const { SPREADSHEET_ID, GOOGLE_API_KEY } = process.env;

const getStat = async (id) => {
    const sheets = google.sheets({
        version: "v4",
        auth: GOOGLE_API_KEY,
    });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: "A4:AO60",
    });

    const data = res.data.sheets[0].data[0].rowData;

    let selectedId = id;

    const findUsernames = data.map((el, index) => {
        return el.values[0].formattedValue === id ? index : '';
    }).filter(String);

    if (!findUsernames.length) {
        throw new Error(`user not found|${id}`);
    }

    const values = findUsernames.map(el => data[el].values.map((el) => el.formattedValue));
    return values;
};

const getFreeDates = async (userId) => {
    const sheets = google.sheets({
        version: "v4",
        auth: GOOGLE_API_KEY,
    });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: "A1:AJ60",
    });
    const timezone = {
        timeZone: "Europe/Moscow",
        hour12: false,
        day: 'numeric',
        month: 'numeric'
    };

    const currentDayArr = new Date().toLocaleString("en-US", timezone).split('/');
    const currentDay = {
        month: parseInt(currentDayArr[0]),
        day: parseInt(currentDayArr[1])
    };

    const previousDayArr = getPreviousDay().toLocaleString("en-US", timezone).split('/');
    const previousDay = {
        month: parseInt(previousDayArr[0]),
        day: parseInt(previousDayArr[1])
    };
    /*
        const previousDay = { month: 1, day: 17 };
        const currentDay = { month: 1, day: 18 };
    */
    const data = res.data.sheets[0].data[0].rowData;

    const findUsernames = data.map((el, index) => {
        return el.values[0].formattedValue === userId ? { name: el.values[1].formattedValue, index } : '';
    }).filter(String);

    if (!findUsernames.length) {
        throw new Error(`user not found|${userId}`);
    }

    const gSheetsBaseDate = new Date(1899, 11, 30, 10).getTime();

    const result = [];
    findUsernames.map(el => {
        const { index: findIndex, name } = el;
        const freeDates = [];
        data[findIndex].values.map((el, i) => {
            const date = data[0].values[i].formattedValue;
            const effValue = data[0].values[i].effectiveValue.numberValue;
            const parsedDate = new Date(gSheetsBaseDate + effValue * 24 * 60 * 60 * 1000);
            const value = data[findIndex].values[i].formattedValue;
            const condition = (
                parsedDate.getDate() === currentDay.day
                && (parsedDate.getMonth() + 1) === currentDay.month
            ) || (
                    parsedDate.getDate() === previousDay.day
                    && (parsedDate.getMonth() + 1) === previousDay.month
                );

            if (i > 0 && condition) {
                // console.log({ cell: `${rows[i]}${findIndex + 1}`, date });
                freeDates.push({
                    value: [`${rows[i]}${findIndex + 1}`, date].join('_'),
                    label: `${date}${value ? ` (сейчас слов ${value})` : ''}`,
                    style: parseInt(date) === currentDay ? 1 : 2
                });
            }
        });
        // console.log(freeDates)
        result.push({ name, dates: freeDates });
    })

    return result;
};

const getUserRow = async (id) => {
    const sheets = google.sheets({
        version: "v4",
        auth: GOOGLE_API_KEY,
    });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: "A4:B60",
    });
    const data = res.data.sheets[0].data[0].rowData;
    const findUsernames = data.map((el) => {
        return el.values[0].formattedValue === id ? el.values[1].formattedValue : '';
    }).filter(String);
    const findFree = data.findIndex((el) => {
        return !el.values[0].formattedValue;
    });

    return { usernames: findUsernames, free: findFree };
}

module.exports = { getStat, getFreeDates, getUserRow }