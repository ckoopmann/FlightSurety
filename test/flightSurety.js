var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];
    let transActionFailed = false;

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch {
      transActionFailed = true;
    }
    let result = await config.flightSuretyData.isRegistered.call(newAirline);
    let numAirlines = await config.flightSuretyData.getNumAirlines.call();

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
    assert.equal(
      transActionFailed,
      true,
      "Transaction should fail when trying to register from an unfunded airline"
    );
    assert.equal(
      numAirlines,
      1,
      "Only one airline should be registered since additional registration failed"
    );
  });

  it("(airline) can register an Airline using registerAirline() if it is funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    await config.flightSuretyApp.fundAirline(config.firstAirline, {
      from: config.firstAirline,
      value: 10,
    });
    await config.flightSuretyApp.registerAirline(newAirline, {
      from: config.firstAirline,
    });

    let result = await config.flightSuretyData.isRegistered.call(newAirline);
    let numAirlines = await config.flightSuretyData.getNumAirlines.call();

    // ASSERT
    assert.equal(
      result,
      true,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
    assert.equal(
      numAirlines,
      2,
      "Number airlines updated after successfull registration of second airline"
    );
  });

  it("new airline can register next airline until four airlines reached", async () => {
    for (var i = 2; i < 4; i++) {
      // ARRANGE
      let registeringAirline = accounts[i];
      let newAirline = accounts[i + 1];
      // ACT
      await config.flightSuretyApp.fundAirline(registeringAirline, {
        from: registeringAirline,
        value: 10,
      });
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: registeringAirline,
      });
      let result = await config.flightSuretyData.isRegistered.call(newAirline);
      let numAirlines = await config.flightSuretyData.getNumAirlines.call();
      // ASSERT
      assert.equal(
        result,
        true,
        "Airline should be able register the next airline"
      );
      assert.equal(
        numAirlines,
        i + 1,
        "Number airlines updated after successfull registration of second airline"
      );
    }
  });

  it("After the 4th airline a single airline cannot register a new peer", async () => {
    // ARRANGe
    let numAirlines = await config.flightSuretyData.getNumAirlines.call();
    assert.isAbove(
      numAirlines.toNumber(),
      3,
      "At least 4 airlines need to be registered for this test"
    );
    let registeringAirline = accounts[numAirlines];
    let newAirline = accounts[numAirlines + 1];
    await config.flightSuretyApp.fundAirline(registeringAirline, {
      from: registeringAirline,
      value: 10,
    });

    let events = config.flightSuretyApp.allEvents((error, event) => console.log("Event", error, event));

    // Act
    await config.flightSuretyApp.registerAirline(newAirline, {
      from: registeringAirline,
    });

    let result = await config.flightSuretyData.isRegistered.call(newAirline);
    let numAirlinesAfter = await config.flightSuretyData.getNumAirlines.call();
    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline after the 4th airline"
    );
    assert.equal(
      numAirlines.toNumber(),
      numAirlinesAfter.toNumber(),
      "Number airlines should not change "
    );
  });
});
