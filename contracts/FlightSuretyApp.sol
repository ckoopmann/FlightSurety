pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;
    uint256 private constant MINIMUM_FUNDING = 10 ether;

    address private contractOwner;          // Account used to deploy contract
    

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
        string name;
    }
    mapping(bytes32 => Flight) private flights;
    bytes32[] registeredFlightKeys;
    struct ConsensusTracker {
        mapping(address => bool) votedAddresses;
        uint256 voteCount;
    }
    mapping(string => mapping(bytes32 => ConsensusTracker)) consensusTrackers;
    

    FlightSuretyData dataContract;

 
    // Events
    event VotedForFunctionCall(address caller, string functionName, bytes32 argumentHash, uint256 voteCount, uint256 threshold);
    event ResetVotesForFunctionCall(string functionName, bytes32 argumentHash);
    event AirlineRegistered(address airlineAddress, string airlineName);
    event FlightRegistered(address airlineAddress, string flight, uint256 timestamp);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireFundedAirline()
    {
        require(dataContract.isFunded(msg.sender), "Caller is not a funded Airline");
        _;
    }

    modifier conditionalMultipartyConsensus(uint256 minAirlinesForConsensus, string functionName, bytes32 argumentHash)
    {
        uint256 numAirlines = dataContract.getNumAirlines();
        if(numAirlines < minAirlinesForConsensus){
            _;
        }
        else {
            ConsensusTracker consensusTracker = consensusTrackers[functionName][argumentHash];
            require(!consensusTracker.votedAddresses[msg.sender], "Caller has already voted for this action");

            consensusTracker.votedAddresses[msg.sender] = true;
            consensusTracker.voteCount = consensusTracker.voteCount.add(1);
            uint256 threshold = numAirlines / 2;
            emit VotedForFunctionCall(msg.sender, functionName, argumentHash, consensusTracker.voteCount, threshold);
            if(consensusTracker.voteCount > threshold){
                _;
                delete consensusTrackers[functionName][argumentHash];
                emit ResetVotesForFunctionCall(functionName, argumentHash);
            }
        }
    }


    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                address dataContractAddress
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        dataContract = FlightSuretyData(dataContractAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            pure 
                            returns(bool) 
    {
        return true;  // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function fundAirline (address airlineToFund) external payable {
        require(msg.value >= MINIMUM_FUNDING, "Insufficient Funds");
        require(dataContract.isRegistered(airlineToFund), "Airline needs to be registered before being able to be funded");
        dataContract.fundAirline.value(msg.value)(airlineToFund);
    }

  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline
                            (   
                                address airlineAddress,
                                string airlineName
                            )
                            external
                            requireFundedAirline
                            conditionalMultipartyConsensus(4, "registerAirline", keccak256(airlineAddress, airlineName))
                            returns(bool success, uint256 votes)
    {
        require(!dataContract.isRegistered(airlineAddress), "New Airline is already registered");
        dataContract.registerAirline(airlineAddress, airlineName);
        emit AirlineRegistered(airlineAddress, airlineName);
        success = true;
        return (success, 0);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight
                                (
                                    string flight,
                                    uint256 timestamp
                                )
                                requireFundedAirline()
                                external
    {
        address airline = msg.sender;
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        Flight flightObject = flights[flightKey];
        require(!flightObject.isRegistered, "Flight is already registered");
        flightObject.isRegistered = true;
        flightObject.statusCode = STATUS_CODE_UNKNOWN;
        flightObject.updatedTimestamp = timestamp;
        flightObject.airline = airline;
        flightObject.name = flight;
        registeredFlightKeys.push(flightKey);
        emit FlightRegistered(airline, flight, timestamp);
    }

    function registeredFlights() external view returns(bytes32[]){
        return registeredFlightKeys;
    }

    function getFlightData(bytes32 flightKey) external view returns(
                                                                uint8 statusCode,
                                                                uint256 updatedTimestamp,
                                                                address airline,
                                                                string name)
    {
        Flight flightObject = flights[flightKey];
        require(flightObject.isRegistered, "Requested Flight is not registered");
        statusCode = flightObject.statusCode;
        updatedTimestamp = flightObject.updatedTimestamp;
        airline = flightObject.airline;
        name = flightObject.name;
    }
    
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
    {
        if(statusCode == STATUS_CODE_LATE_AIRLINE){
            bytes32 flightKey = getFlightKey(airline, flight, timestamp);
            dataContract.creditInsurees(flightKey);
        }
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 
    
    function buyWithKey
                        (
                            bytes32 flightKey                             
                        )
                        public
                        payable
    {
        require(msg.value > 0, "Cannot buy 0 value insurance");
        require(flights[flightKey].isRegistered, "Flight is not registered");
        dataContract.buy.value(msg.value)(flightKey, msg.sender);
    }


    function buy 
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
                        payable
    {
        require(msg.value > 0, "Cannot buy 0 value insurance");
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        buyWithKey(flightKey);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    // Variables controlling mock out of random index during testing
    uint8[3] mockIndices;
    uint currMockIndex;
    bool indexMocked;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);
    event OracleRegistered(address oracle, uint8[3] indexes);
    event MockRandomIndex(uint8[3] mockIndex);
    event UnMockRandomIndex();


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
        emit OracleRegistered(msg.sender, indexes);
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        // Mocked Index for testing purposes
        if(indexMocked){
            uint i = currMockIndex % 3;
            currMockIndex = currMockIndex + 1;
            return mockIndices[i];
        }
        else{
            uint8 maxValue = 10;

            // Pseudo random number...the incrementing nonce adds variation
            uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

            if (nonce > 250) {
                nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
            }

            return random;
        }

    }

    // Method to mock out the random index with a fixed value for testing purposes
    function mockRandomIndex(uint8[3] _mockIndices) public requireContractOwner(){
        mockIndices = _mockIndices;
        indexMocked = true;
        currMockIndex = 0;
        emit MockRandomIndex(_mockIndices);

    }

    // Method to unmock the random index
    function unMockRandomIndex() public requireContractOwner(){
        indexMocked = false;
        emit UnMockRandomIndex();

    }

// endregion

}   

contract FlightSuretyData {
    function registerAirline (address airlineAddress, string airlineName) external;
    function fundAirline ( address airlineAddress) external payable;
    function isRegistered ( address airlineAddress) view external returns(bool);
    function isFunded ( address airlineAddress) view external returns(bool);
    function getNumAirlines() view external returns(uint256);
    function buy (bytes32 flightKey, address passenger) external payable;
    function creditInsurees (bytes32 flightKey) external;
}
