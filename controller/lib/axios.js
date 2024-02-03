const axios = require("axios");
require("dotenv").config();

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

function getAxiosInstanse() {
    return {
        get(method, params) {
            return axios.get(`/${method}`, {
                baseURL: BASE_URL,
                params,
            })
        },
        post(method, data) {
            return axios({
                method: "post",
                baseURL: BASE_URL,
                url: `/${method}`,
                data,
            });
        }
    };
}

module.exports = { axiosInstance: getAxiosInstanse() };