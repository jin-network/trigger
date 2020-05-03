var log4js = require('log4js');
var logger = log4js.getLogger("backend");
logger.level = 'debug';

let config = require("./config.js");

const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('text-encoding');
const fetch = require('node-fetch');
const axios = require('axios');

const signatureProvider = new JsSignatureProvider(config.private_keys);
const rpc = new JsonRpc(config.httpEndpoint, { fetch });

const eos_client = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let price0 = 0;
let price1 = 0;

async function update_price() {
    try {
        let res = await axios.get(config.priceServer)

        let data = res.data.data;

        let last_price = data.price;

        price0 = last_price.toFixed(4);
        price1 = (1 / last_price).toFixed(4);

        logger.info("update price success", price0, price1);
    } catch (err) {
        logger.error("update price err", err.message)
    }
}

async function feed_price() {
    try {
        let actions = [];

        actions.push({
            account: config.price_contract,
            name: 'feed',
            authorization: [
                { actor: config.price_contract, permission: 'active' },
            ],
            data: {
                pairid: 0,
                price0: price0,
                price1: price1,
            },
        })

        let result = await eos_client.transact({
            actions: actions
        }, { blocksBehind: 3, expireSeconds: 30, });

        logger.info("feed price success", result.transaction_id);
    } catch (err) {
        logger.error("feed price err", err.message)
    }
}

async function trigger_price() {
    try {
        let actions = [];

        actions.push({
            account: config.oracle_contract,
            name: 'update',
            authorization: [
                { actor: config.submitter, permission: 'active' },
            ],
            data: {
                "submitter": config.submitter,
                "pairid": 0,
            },
        })

        let result = await eos_client.transact({
            actions: actions
        }, { blocksBehind: 3, expireSeconds: 30, });

        logger.info("trigger price success", result.transaction_id);
    } catch (err) {
        logger.error("trigger price err", err.message)
    }
}

setInterval(update_price, 1000);
setInterval(feed_price, 1000 * 6);
setInterval(trigger_price, 1000 * 6);

update_price();