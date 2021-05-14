pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    uint256 MAX_INSURED_AMOUNT = 1 ether;

    struct Airline {
        bool isRegistered;                              
        bool isFunded;
        string name;
    }
    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address=>bool) authorizedCallers;
    mapping(address=>Airline) airlines;
    address[] registeredAirlineAdresses; // separate list of registered airline adresses to be able to iterate. (Since there does not seem to be a way to iterate over mapping keys)
    struct Holder {
        address passengerAddress;
        uint256 insuredAmount;
    }
    Holder[] holders; 
    mapping(address => uint256) passengerCredits;
    uint256 numAirlines;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event InsuranceBought(address passenger, bytes32 flightKey, uint256 amount);
    event PassengerCredited(address passenger, uint256 payout);
    event PolicyPayedOut(bytes32 flightKey, uint256 totalPayout);


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address airlineAddress,
                                    string airlineName
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        numAirlines = 0;
        _registerAirline(airlineAddress, airlineName);
    }

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
        require(operational, "Contract is currently not operational");
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

    modifier requireAuthorizedCaller()
    {
        require(authorizedCallers[msg.sender], "Caller is not auhtorized");
        _;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function authorizeCaller(address callerAddress) external{
        authorizedCallers[callerAddress] = true;
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (   
                                address airlineAddress,
                                string airlineName
                            )
                            requireIsOperational()
                            requireAuthorizedCaller()
                            external
                            requireAuthorizedCaller
    {
        require(!airlines[airlineAddress].isRegistered, "Airline is already registered");
        _registerAirline(airlineAddress, airlineName);

    }

    function _registerAirline
                            (   
                                address airlineAddress,
                                string airlineName
                            )
                            internal
    {
        airlines[airlineAddress].isRegistered = true;
        airlines[airlineAddress].name = airlineName;
        numAirlines = numAirlines.add(1);
        registeredAirlineAdresses.push(airlineAddress);
    }

    function fundAirline
                            (   
                             address airlineAddress
                            )
                            external
                            payable
                            requireIsOperational()
                            requireAuthorizedCaller()
    {
        airlines[airlineAddress].isFunded = true;
    }

    function getNumAirlines() view external returns(uint256){
        return numAirlines;
    }


    function isRegistered
                        (
                            address airlineAddress
                        )
                        view
                        external
                        returns(bool) 
    {
        Airline airline = airlines[airlineAddress];
        return airline.isRegistered;
    }

    function isFunded
                        (
                            address airlineAddress
                        )
                        view
                        external
                        returns(bool) 
    {
        Airline airline = airlines[airlineAddress];
        return airline.isFunded;
    }

    function getName
                        (
                            address airlineAddress
                        )
                        view
                        external
                        returns(string) 
    {
        Airline airline = airlines[airlineAddress];
        return airline.name;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                             bytes32 flightKey,
                             address passenger
                            )
                            external
                            payable
                            requireIsOperational()
                            requireAuthorizedCaller()
    {

        require(msg.value <= MAX_INSURED_AMOUNT, "Insured amount exceeds maximum insurance");
        Holder[] contractHolders = holders;
        for(uint i =0; i<contractHolders.length; i++){
            Holder currentHolder = contractHolders[i];
            require(currentHolder.passengerAddress != passenger, "Passenger is already insured");
        }

        Holder newHolder;
        newHolder.passengerAddress = passenger;
        newHolder.insuredAmount = msg.value;

        contractHolders.push(newHolder);

        emit InsuranceBought(passenger, flightKey, msg.value);

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    bytes32 flightKey
                                )
                                external
                            requireIsOperational()
                            requireAuthorizedCaller()
    {
        Holder[] contractHolders = holders;
        require(contractHolders.length > 0, "Policy has no holders to pay out");
        uint256 totalPayout = 0;
        for(uint i = 0; i < contractHolders.length; i++){
            Holder contractHolder = contractHolders[i];
            uint256 insuredAmount = contractHolder.insuredAmount;
            address passenger = contractHolder.passengerAddress;
            uint256 payout = insuredAmount.add(insuredAmount.div(2)); // Credit 1.5 times the insured amount
            passengerCredits[passenger] = passengerCredits[passenger].add(payout);
            totalPayout.add(payout);
            emit PassengerCredited(passenger, payout);
        }
        // delete contractHolders; // Delte policy to free up space and avoid duplicate payout

        emit PolicyPayedOut(flightKey, totalPayout);
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                address passenger
                            )
                            external
                            requireIsOperational()
                            requireAuthorizedCaller()
    {
        require(passengerCredits[passenger] > 0, "Passenger has no credit available for payout");
        uint256 credit = passengerCredits[passenger];
        delete passengerCredits[passenger];
        passenger.transfer(credit);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                            )
                            public
                            payable
    {
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getRegisteredAirlines() view external returns(address[] addresses){
        addresses = registeredAirlineAdresses;
    }




    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }
    

    


    


}

