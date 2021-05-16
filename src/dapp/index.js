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

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flight = DOM.elid("flight-number").value;
      // Write transaction
      contract.fetchFlightStatus(flight, (error, result) => {
        display("Oracles", "Trigger oracles", [
          {
            label: "Fetch Flight Status",
            error: error,
            value: result.flight + " " + result.timestamp,
          },
        ]);
      });
    });

    DOM.elid("buy-insurance-flightKey").addEventListener("click", () => {
      let flightKey = DOM.elid("flight-key").value;
      let amount = parseFloat(DOM.elid("insurance-amount").value);
      // Write transaction
      contract.buyInsuranceFlightKey(flightKey, amount, (error, result) => {
        display("Insurance", "Bought Insurances", [
          {
            label: "Buy Insurance",
            error: error,
            value: `flight: ${flightKey}, amount: ${amount}, result: ${result}`,
          },
        ]);
      });
    });

    DOM.elid("buy-insurance-metadata").addEventListener("click", () => {
      let flight = DOM.elid("flight-name").value;
      let airline = DOM.elid("flight-airline").value;
      let timestamp = DOM.elid("flight-timestamp").value;
      let amount = parseFloat(DOM.elid("insurance-amount-metadata").value);
      // Write transaction
      contract.buyInsuranceMetadata(
        flight,
        airline,
        timestamp,
        amount,
        (error, result) => {
          display("Insurance", "Bought Insurances", [
            {
              label: "Buy Insurance",
              error: error,
              value: `flight: ${flight}, amount: ${amount}, result: ${result}`,
            },
          ]);
        }
      );
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
        let button = DOM.button("Oracle Request");
        button.setAttribute("key", result.key);
        button.addEventListener("click", (event) => {
          console.log(event.target.getAttribute("key"));
          contract.fetchFlightStatus(result, (error, result) => {
            console.log(error,result);
          });
        });
        row.appendChild(button);
        section.appendChild(row);
      });
      displayDiv.append(section);
    }
  });
})();

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
