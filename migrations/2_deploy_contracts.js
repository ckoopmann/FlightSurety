const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');
var BigNumber = require('bignumber.js');

module.exports = function(deployer, network, accounts) {

    let firstAirlineAddress = accounts[0];
    let firstAirlineName = 'Testairline';
    deployer.deploy(FlightSuretyData, firstAirlineAddress, firstAirlineName)
    .then(() => {
        return deployer.deploy(FlightSuretyApp, FlightSuretyData.address)
                .then(async () => {
                    const appInstance = await FlightSuretyApp.deployed();
                    const dataInstance = await FlightSuretyData.deployed();
                    await dataInstance.authorizeCaller(FlightSuretyApp.address);
                    const weiMultiple = (new BigNumber(10)).pow(18);
                    await appInstance.fundAirline(firstAirlineAddress, {from: firstAirlineAddress, value: 10*weiMultiple })
                    let config = {
                        localhost: {
                            url: 'http://localhost:8545',
                            dataAddress: FlightSuretyData.address,
                            appAddress: FlightSuretyApp.address
                        }
                    }
                    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                });
    });
}
