import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    contract.registeredAirlines(async (error, airlineAddresses) => {
      console.log(error, result);
      let airlineData = [];
      for (const address of airlineAddresses) {
        let name = await contract.getAirlineName(address);
        let funded = await contract.isAirlineFunded(address);
        airlineData.push({
          label: name,
          value: JSON.stringify({ address, funded }),
        });
      }
      display("Registered Airlines", "Show registered Airlines", airlineData);
    });

    contract.registeredFlights(async (error, flightKeys) => {
      console.log(error, result);
      let flightData = [];
      for (const key of flightKeys) {
        let data = await contract.getFlightData(key);
        let airlineName = await contract.getAirlineName(data.airline);
        data.airlineName = airlineName;
        data.key = key;
        flightData.push(data);
      }
      displayFlights(flightData);
    });

    // // Show events
    contract.flightSuretyApp.events.allEvents(function (err, log) {
      if (err) console.log(err);
      else {
        console.log(log);
        var node = document.createElement("LI"); // Create a <li> node
        var textnode = document.createTextNode(
          log.event + " - " + log.transactionHash
        ); // Create a text node
        node.appendChild(textnode);
        DOM.elid("app-events").appendChild(node);
      }
    });

    contract.flightSuretyData.events.allEvents(function (err, log) {
      if (err) console.log(err);
      else {
        console.log(log);
        var node = document.createElement("LI"); // Create a <li> node
        var textnode = document.createTextNode(
          log.event + " - " + log.transactionHash
        ); // Create a text node
        node.appendChild(textnode);
        DOM.elid("data-events").appendChild(node);
      }
    });

    function displayFlights(results) {
      let title = "Registered Flights";
      let description = "Flights with insurance available.";
      let displayDiv = DOM.elid("display-wrapper");
      let section = DOM.section();
      section.appendChild(DOM.h2(title));
      section.appendChild(DOM.h5(description));
      results.map((result) => {
        let row = section.appendChild(DOM.div({ className: "row" }));
        let label = `${result.airlineName} - ${result.name}`;
        row.appendChild(DOM.div({ className: "col-sm-4 field" }, label));

        // Button to trigger oracle request
        let oracleButton = DOM.button("Oracle Request");
        oracleButton.addEventListener("click", (event) => {
          contract.fetchFlightStatus(result, (error, result) => {
            if (error) {
              logError("fetchFlighStatus", error);
            }
            console.log(error, result);
          });
        });
        row.appendChild(oracleButton);

        // Buy insurance form
        let insuranceForm = DOM.form();
        let amountInput = DOM.input();
        amountInput.setAttribute("type", "text");
        amountInput.setAttribute("placeholder", "Amount [ETH]");
        insuranceForm.appendChild(amountInput);
        let buyButton = DOM.button("Buy Insurance");
        buyButton.setAttribute("type", "submit");
        insuranceForm.appendChild(buyButton);

        insuranceForm.addEventListener("submit", (event) => {
          let amount = event.srcElement[0].value;
          let flightKey = result.key;
          contract.buyInsuranceFlightKey(flightKey, amount, (error, result) => {
            console.log(error, result);
            if (error) {
              logError("buyInsurance", error);
            }
          });
          event.preventDefault();
        });

        row.appendChild(insuranceForm);

        section.appendChild(row);
      });
      displayDiv.append(section);
    }
  });
})();

function logError(transactionType, errorMessage) {
  var node = document.createElement("LI"); // Create a <li> node
  var textnode = document.createTextNode(
    transactionType + " - " + errorMessage
  ); // Create a text node
  node.appendChild(textnode);
  DOM.elid("error-log").appendChild(node);
}

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
