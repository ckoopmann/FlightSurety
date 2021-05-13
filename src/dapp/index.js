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
        let label = `${airlineName} - ${data.name} - ${data.updatedTimestamp}`;
        flightData.push({
          label: label,
          value: key,
        });
      }
      display("Registered Flights", "Show registered Flights", flightData);
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
