require("regenerator-runtime/runtime");
import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";
var BigNumber = require("bignumber.js");

const weiMultiple = new BigNumber(10).pow(18);
let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];
let numOracles = 30;
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

function getRandomStatusCode() {
  const proportionalStatusCodes = [20, 20];
  var code = proportionalStatusCodes[Math.floor(Math.random() * proportionalStatusCodes.length)];
  return code;
}

async function registerOracles() {
  let oracleData = {};
  let accounts = await web3.eth.getAccounts();
  console.log("Accounts: ", accounts);
  for (var i = 0; i < numOracles; i++) {
    let account = accounts[i];
    await flightSuretyApp.methods.registerOracle().send({
      from: account,
      value: 1 * weiMultiple,
      gas: 10000000,
    });
    console.log("Registered Oracle at address: ", account);
    let indexes = await flightSuretyApp.methods.getMyIndexes().call({
      from: account,
      gas: 10000000,
    });
    console.log("Got assigned indexes: ", indexes);
    for (var index of indexes) {
      if (index in oracleData) {
        oracleData[index].push(account);
      } else {
        oracleData[index] = [account];
      }
    }
  }
  return oracleData;
}

function processRequests(oracleData) {
  flightSuretyApp.events.OracleRequest(
    {
      fromBlock: 0,
    },
    async function (error, event) {
      if (error) console.log(error);
      else {
        console.log("Oracle Request received for Index:", event.returnValues);
        const {index, airline, flight, timestamp} = event.returnValues;
        if (index in oracleData) {
          const oracleAddresses = oracleData[index];
          console.log(
            `Registered Oracles for index ${index}: `,
            oracleAddresses
          );
          for (var oracle of oracleAddresses) {
            let statusCode = getRandomStatusCode();
            await flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode).send({
              from: oracle,
              gas: 1000000,
            });
            console.log(`Oracle: ${oracle} submitted status: ${statusCode} for flight: ${flight}`)
          }
        } else {
          console.log("No oracles registered for requested index: ", index);
        }
      }
    }
  );
}

async function main() {
  let oracleData = await registerOracles();
  console.log("OracleData: ", oracleData);
  processRequests(oracleData);
}

main();
const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
