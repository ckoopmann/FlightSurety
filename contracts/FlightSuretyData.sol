pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

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
    uint256 numAirlines;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address firstAirline
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        numAirlines = 0;
        _registerAirline(firstAirline);
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
                             address newAirline
                            )
                            external
                            requireAuthorizedCaller
    {
        require(!airlines[newAirline].isRegistered, "Airline is already registered");
        _registerAirline(newAirline);

    }

    function _registerAirline
                            (   
                             address newAirline
                            )
                            internal
    {
        airlines[newAirline].isRegistered = true;
        numAirlines = numAirlines.add(1);
        registeredAirlineAdresses.push(newAirline);
    }

    function fundAirline
                            (   
                             address newAirline
                            )
                            external
                            payable
                            requireAuthorizedCaller
    {
        airlines[newAirline].isFunded = true;
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

    function getRegisteredAirlines() view external returns(address[] addresses){
        addresses = registeredAirlineAdresses;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
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

