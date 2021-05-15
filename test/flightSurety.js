var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
    // Authorize owner for unittesting data contract methods that require authorized caller
    await config.flightSuretyData.authorizeCaller(config.owner);
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

  it("(airline) cannot register a flight using registerFlight() if it is not funded", async () => {
    // ARRANGE
    let transActionFailed = false;
    let flight = "F123";
    let timestamp = 123456;

    // ACT
    try {
      await config.flightSuretyApp.registerFlight(flight, timestamp, {
        from: config.firstAirline,
      });
    } catch {
      transActionFailed = true;
    }

    // ASSERT
    assert.equal(
      transActionFailed,
      true,
      "Transaction should fail when trying to register from an unfunded airline"
    );
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];
    let transActionFailed = false;

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(
        newAirline,
        "Second Airline",
        {
          from: config.firstAirline,
        }
      );
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
    let registeringAirline = config.firstAirline;
    let newAirline = accounts[2];

    // ACT
    let isFunded = await config.flightSuretyData.isFunded(registeringAirline);
    if (!isFunded) {
      await config.flightSuretyApp.fundAirline(registeringAirline, {
        from: registeringAirline,
        value: 10 * config.weiMultiple,
      });
    }
    await config.flightSuretyApp.registerAirline(newAirline, "Second Airline", {
      from: registeringAirline,
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

  it("(airline) can register a flight using registerFlight() if it is funded", async () => {
    // ARRANGE
    let registeringAirline = config.firstAirline;
    let flight = "F123";
    let timestamp = 123456;

    // ACT
    let isFunded = await config.flightSuretyData.isFunded(registeringAirline);
    if (!isFunded) {
      await config.flightSuretyApp.fundAirline(registeringAirline, {
        from: registeringAirline,
        value: 10 * config.weiMultiple,
      });
    }
    await config.flightSuretyApp.registerFlight(flight, timestamp, {
      from: config.firstAirline,
    });

    // ASSERT
    let registeredFlights = await config.flightSuretyApp.registeredFlights();
    assert.equal(
      registeredFlights.length,
      1,
      "One Flight should be registered"
    );
    let flightData = await config.flightSuretyApp.getFlightData(
      registeredFlights[0]
    );
    assert.equal(
      flightData.name,
      flight,
      "Flight Name / Number was not preserved correctly"
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
        value: 10 * config.weiMultiple,
      });
      await config.flightSuretyApp.registerAirline(newAirline, `Airline ${i}`, {
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
    assert.equal(
      numAirlines.toNumber(),
      4,
      "4 airlines need to be registered for this test"
    );
    let registeringAirline = accounts[numAirlines];
    let newAirline = accounts[5];
    await config.flightSuretyApp.fundAirline(registeringAirline, {
      from: registeringAirline,
      value: 10 * config.weiMultiple,
    });

    // Act
    await config.flightSuretyApp.registerAirline(newAirline, "Fifth Airline", {
      from: registeringAirline,
    });

    let result = await config.flightSuretyData.isRegistered.call(newAirline);
    let numAirlinesAfter = await config.flightSuretyData.getNumAirlines.call();
    let voteEvents = await config.flightSuretyApp.getPastEvents(
      "VotedForFunctionCall"
    );
    // ASSERT
    assert.equal(
      voteEvents.length,
      1,
      "One vote for function call event should be emitted"
    );
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

  it("3 Votes are enough to register the 5th airline", async () => {
    // ARRANGe
    let numAirlines = await config.flightSuretyData.getNumAirlines.call();
    assert.equal(
      numAirlines.toNumber(),
      4,
      "4 airlines need to be registered for this test"
    );

    let newAirline = accounts[5];
    for (const registeringAirline of accounts.slice(1, 3)) {
      // Act
      await config.flightSuretyApp.registerAirline(
        newAirline,
        "Fifth Airline",
        {
          from: registeringAirline,
        }
      );
    }

    let result = await config.flightSuretyData.isRegistered.call(newAirline);
    let numAirlinesAfter = await config.flightSuretyData.getNumAirlines.call();
    // ASSERT
    assert.equal(result, true, "With 3 votes new airline should be registered");
    assert.equal(
      numAirlines.toNumber() + 1,
      numAirlinesAfter.toNumber(),
      "Number airlines should have increased by 1"
    );
  });

  it("(passenger) can buy insurance for registered flight with correct amount", async () => {
    // ARRANGe
    let flight = "Testflight2";
    let timestamp = 123456;
    let airline = accounts[2];
    let passenger = accounts[7];
    let amount = 0.1;

    // ACT
    await config.flightSuretyApp.registerFlight(flight, timestamp, {
      from: airline,
    });

    await config.flightSuretyApp.buy(airline, flight, timestamp, {
      from: passenger,
      value: amount * config.weiMultiple,
    });
  });

  it("(passenger) cannot buy insurance for unregistered flight", async () => {
    // ARRANGe
    let flight = "Testflight3";
    let timestamp = 123456;
    let airline = accounts[2];
    let passenger = accounts[7];
    let amount = 0.1;
    let transactionFailed = false;

    // ACT
    try {
      await config.flightSuretyApp.buy(airline, flight, timestamp, {
        from: passenger,
        value: amount * config.weiMultiple,
      });
    } catch (e) {
      transactionFailed = true;
    }

    //ASSERt
    assert.equal(
      transactionFailed,
      true,
      "Passenger was able to buy insurance for unregistered flight"
    );
  });

  it("(passenger) cannot buy insurance for unregistered flight", async () => {
    // ARRANGe
    let flight = "Testflight3";
    let timestamp = 123456;
    let airline = accounts[2];
    let passenger = accounts[7];
    let amount = 0.1;
    let transactionFailed = false;

    // ACT
    try {
      await config.flightSuretyApp.buy(airline, flight, timestamp, {
        from: passenger,
        value: amount * config.weiMultiple,
      });
    } catch (e) {
      transactionFailed = true;
    }

    //ASSERt
    assert.equal(
      transactionFailed,
      true,
      "Passenger was able to buy insurance for unregistered flight"
    );
  });

  it("Crediting Insurees works inside the data contract", async () => {
    // ARRANGe
    let flightKey =
      "0x3198cd775b27e78fe1b0dad8520f6f5653999c55f69ede22bed323a2e437b763";
    let passenger = accounts[8];
    let amount = 0.1;
    let balanceBefore = await web3.eth.getBalance(passenger);

    // ACT
    await config.flightSuretyData.buy(flightKey, passenger, {
      from: config.owner,
      value: amount * config.weiMultiple,
    });

    await config.flightSuretyData.creditInsurees(flightKey, {
      from: config.owner,
    });

    await config.flightSuretyData.pay(passenger, {
      from: config.owner,
    });

    let balanceAfter = await web3.eth.getBalance(passenger);

    // Assert
    assert.isAbove(
      parseInt(balanceAfter),
      parseInt(balanceBefore),
      "Passenger with payed out insurance should have an increased balance"
    );
    
  });

  it("Insurance holders are credited when three oracles register an airline delay", async () => {
    // ARRANGe
    let passenger = accounts[9];
    let amount = 0.1;
    let registrationFee = 1;
    let balanceBefore = await web3.eth.getBalance(passenger);
    let flight = "F123456";
    let timestamp = 123456;
    let mockIndices = [1,2,3];

    let oracles = accounts.slice(1,5)

    // ACT
    // Mock out random index to always return same value for testing purposes
    await config.flightSuretyApp.mockRandomIndex(mockIndices, {
      from: config.owner,
    });

    await config.flightSuretyApp.registerFlight(flight, timestamp, {
      from: config.firstAirline,
    });

    await config.flightSuretyApp.buy(config.firstAirline, flight, timestamp, {
      from: passenger,
      value: amount * config.weiMultiple,
    });

    for(const oracle of oracles){
      await config.flightSuretyApp.registerOracle({from: oracle, value: registrationFee*config.weiMultiple})
    }

    config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);


    await config.flightSuretyApp.unMockRandomIndex({
      from: config.owner,
    });


    let balanceAfter = await web3.eth.getBalance(passenger);

    // Assert
    // assert.isAbove(
    //   parseInt(balanceAfter),
    //   parseInt(balanceBefore),
    //   "Passenger with payed out insurance should have an increased balance"
    // );
    
  });
});
